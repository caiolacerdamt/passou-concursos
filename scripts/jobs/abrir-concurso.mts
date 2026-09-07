#!/usr/bin/env node
/**
 * A abertura de um concurso, comandada da sessao do Codex ou do Claude Code
 * (BANCO-01, BANCO-02, RAIOX-07, RAIOX-20 · AD-145).
 *
 * O agente conduz a conversa; **este comando e a verdade**. A pesquisa e a
 * leitura do programa do edital consomem a sessao do agente — o produto nao
 * chama modelo nem provedor de busca para isso. Toda escrita, toda validacao e
 * toda ordem passam por aqui, para que trocar de agente nao perca estado e para
 * que nenhuma regra de seguranca exista apenas no prompt.
 *
 * As acoes, na ordem em que a skill as usa:
 *
 *   `dominios`            imprime a allowlist para o agente pesquisar dentro dela
 *   `iniciar`             abre (ou reencontra) a execucao do concurso
 *   `registrar-achados`   recebe o manifesto do agente, tria e grava candidatos
 *   `decidir-documentos`  1a CONFIRMACAO: aprova/rejeita e baixa so o aprovado
 *   `programa`            recorta o trecho do programa do edital, e so ele
 *   `propor-assuntos`     recebe a proposta da sessao e calcula quase-duplicatas
 *   `decidir-assuntos`    2a CONFIRMACAO: aplica o quadro do edital numa transacao
 *
 * **Nada de prova sai por aqui.** A unica saida de texto de documento e o
 * trecho do programa, cortado localmente e com teto; o caderno de prova segue
 * direto para `medir-prova` e nunca passa pela conversa (AD-140).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { Client } from "pg";
import { z } from "zod";

import {
  type BuscadorHttp,
  type ProgramaExtraido,
  type TipoDeDocumento,
  baixarAprovados,
  casarTopico,
  extrairPrograma,
  lerCatalogo,
  lerDominiosOficiais,
  lerManifesto,
  lerPdf,
  nomeInternoDoDocumento,
  normalizarNome,
  quaseDuplicatas,
  triarCandidatos,
} from "@/modules/acervo";
import { definirLeitorDeConfig, getParam } from "@/modules/config";
import { type ClienteSql, leitorDeConfigPorPg } from "@/modules/ia";

import { lerEnv } from "../alvo-do-banco.mjs";

import { encerrar, iniciarSentry, reportar } from "./sentry-node.mjs";

export type Acao =
  | "dominios"
  | "iniciar"
  | "registrar-achados"
  | "decidir-documentos"
  | "programa"
  | "propor-assuntos"
  | "decidir-assuntos";

const ACOES: readonly Acao[] = [
  "dominios",
  "iniciar",
  "registrar-achados",
  "decidir-documentos",
  "programa",
  "propor-assuntos",
  "decidir-assuntos",
];

export const USO =
  "uso: abrir-concurso --acao <acao>\n" +
  "  dominios           (nada mais)\n" +
  "  iniciar            --concurso <uuid> --operador <uuid>\n" +
  "  registrar-achados  --abertura <uuid> --operador <uuid> --entrada <arquivo.json>\n" +
  "  decidir-documentos --abertura <uuid> --operador <uuid> --entrada <arquivo.json>\n" +
  "                     [--motivo <texto>] [--destino <pasta>]\n" +
  "  programa           --abertura <uuid> --operador <uuid> [--destino <pasta>]\n" +
  "  propor-assuntos    --abertura <uuid> --operador <uuid> --entrada <arquivo.json>\n" +
  "  decidir-assuntos   --abertura <uuid> --operador <uuid> --entrada <arquivo.json>\n" +
  "                     [--motivo <texto>]";

export type Argumentos = {
  acao: Acao;
  concurso: string;
  abertura: string;
  operador: string;
  entrada: string;
  motivo: string;
  destino: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** As acoes que recebem um JSON escrito pelo agente. */
const COM_ENTRADA: readonly Acao[] = [
  "registrar-achados",
  "decidir-documentos",
  "propor-assuntos",
  "decidir-assuntos",
];

export function lerArgumentos(argv: readonly string[]): Argumentos {
  const valores = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith("--")) valores.set(argv[i].slice(2), argv[i + 1] ?? "");
  }

  const acao = (valores.get("acao")?.trim() ?? "") as Acao;
  if (!ACOES.includes(acao)) throw new Error(USO);

  const argumentos: Argumentos = {
    acao,
    concurso: valores.get("concurso")?.trim() ?? "",
    abertura: valores.get("abertura")?.trim() ?? "",
    operador: valores.get("operador")?.trim() ?? "",
    entrada: valores.get("entrada")?.trim() ?? "",
    motivo: valores.get("motivo")?.trim() ?? "",
    destino: valores.get("destino")?.trim() ?? "provas",
  };

  // O ID nao e formatado no banco: um `--operador joao` viraria erro de cast no
  // meio de uma transacao, e nao recusa de entrada.
  const exigirUuid = (nome: keyof Argumentos) => {
    if (!UUID.test(argumentos[nome])) throw new Error(`--${nome} precisa ser um uuid\n${USO}`);
  };

  if (acao === "iniciar") {
    exigirUuid("concurso");
    exigirUuid("operador");
  }
  if (acao !== "dominios" && acao !== "iniciar") {
    exigirUuid("abertura");
    exigirUuid("operador");
  }
  // `programa` e a excecao: ele nao recebe JSON do agente — LE o edital ja
  // baixado do disco e devolve so o trecho do programa.
  if (COM_ENTRADA.includes(acao) && argumentos.entrada === "") {
    throw new Error(`--entrada e obrigatorio\n${USO}`);
  }

  return argumentos;
}

// ── Acao `dominios` ─────────────────────────────────────────────────────────

/**
 * A lista que o agente consulta ANTES de pesquisar.
 *
 * Existe para a sessao restringir a propria busca em vez de descobrir o limite
 * por tentativa e erro — e para a allowlist ser um numero visivel na conversa,
 * e nao um detalhe escondido em codigo.
 */
export function formatarDominios(dominios: readonly string[]): string {
  return [
    `dominios oficiais (${dominios.length}) — pesquise SOMENTE dentro deles:`,
    ...dominios.map((host) => `  ${host}  (host exato ou subdominio)`),
    "resultado de agregador e descartado sem exibicao (AD-003).",
  ].join("\n");
}

// ── Acao `registrar-achados` ────────────────────────────────────────────────

export type ResumoDosAchados = {
  aceitos: number;
  descartados: number;
  faltantes: string[];
  documentos: { id: string; tipo: string; titulo: string; url: string }[];
};

export async function acaoRegistrarAchados(
  cliente: ClienteSql,
  abertura: string,
  operador: string,
  bruto: unknown,
  dominios: readonly string[],
): Promise<ResumoDosAchados> {
  const triagem = triarCandidatos(lerManifesto(bruto), dominios);

  await cliente.query(
    "select public.registrar_documentos_encontrados($1, $2, $3::jsonb, $4, $5::jsonb)",
    [
      abertura,
      operador,
      JSON.stringify(
        triagem.aceitos.map((c) => ({
          tipo: c.tipo,
          url: c.url,
          titulo: c.titulo,
          metadados: c.metadados,
        })),
      ),
      triagem.descartados,
      JSON.stringify(triagem.faltantes),
    ],
  );

  const { rows } = await cliente.query(
    `select id::text, tipo::text, titulo, url
       from public.concurso_documentos
      where abertura_id = $1 and decisao = 'pendente'
      order by tipo, url`,
    [abertura],
  );

  return {
    aceitos: triagem.aceitos.length,
    descartados: triagem.descartados,
    faltantes: triagem.faltantes,
    documentos: rows.map((linha) => ({
      id: String(linha.id),
      tipo: String(linha.tipo),
      titulo: String(linha.titulo),
      url: String(linha.url),
    })),
  };
}

/**
 * A lista que vai a primeira confirmacao.
 *
 * So aparece o que passou pela allowlist. O descartado e um numero, e o
 * faltante e uma frase — porque documento que nao existe em fonte oficial e
 * trabalho humano fora do sistema, e o fluxo apenas informa.
 */
export function formatarAchados(resumo: ResumoDosAchados): string {
  const partes = [
    `${resumo.aceitos} documento(s) em fonte oficial · ${resumo.descartados} descartado(s) fora da allowlist`,
  ];
  for (const documento of resumo.documentos) {
    partes.push(`  [${documento.tipo}] ${documento.id}`);
    partes.push(`      ${documento.titulo}`);
    partes.push(`      ${documento.url}`);
  }
  if (resumo.faltantes.length > 0) {
    partes.push("faltando em fonte oficial (trabalho humano, fora do sistema):");
    for (const falta of resumo.faltantes) partes.push(`  - ${falta}`);
  }
  partes.push("");
  partes.push(
    "CONFIRMACAO 1 — nenhum download aconteceu ainda. Leve a lista ao operador e " +
      "rode `decidir-documentos` com a decisao dele para cada ID.",
  );
  return partes.join("\n");
}

// ── Acao `decidir-documentos` ───────────────────────────────────────────────

export type Decisao = { id: string; decisao: "aprovado" | "rejeitado" };

export function lerDecisoes(bruto: unknown): Decisao[] {
  if (!Array.isArray(bruto) || bruto.length === 0) {
    throw new Error("a entrada precisa ser uma lista nao vazia de {id, decisao}");
  }
  return bruto.map((linha) => {
    const item = linha as { id?: unknown; decisao?: unknown };
    if (typeof item.id !== "string" || !UUID.test(item.id)) {
      throw new Error("cada decisao precisa de um `id` uuid");
    }
    if (item.decisao !== "aprovado" && item.decisao !== "rejeitado") {
      throw new Error("`decisao` precisa ser 'aprovado' ou 'rejeitado'");
    }
    return { id: item.id, decisao: item.decisao };
  });
}

/**
 * A linha do catalogo-alvo da prova (BANCO-02).
 *
 * Idempotente pelo `provas_alvo_unico`: baixar o mesmo caderno de novo — na
 * mesma abertura ou numa segunda — encontra a linha que ja existe em vez de
 * catalogar uma prova gemea. A proveniencia e gravada pelo RPC, nao aqui.
 */
export async function garantirProva(
  cliente: ClienteSql,
  metadados: Record<string, unknown>,
): Promise<string> {
  const chave = [
    String(metadados.banca ?? ""),
    Number(metadados.ano ?? 0),
    String(metadados.orgao ?? ""),
    String(metadados.cargo ?? ""),
    metadados.caderno === undefined ? null : String(metadados.caderno),
  ] as const;

  if (chave[0] === "" || chave[2] === "" || chave[3] === "" || !Number.isInteger(chave[1])) {
    throw new Error("prova sem banca/ano/orgao/cargo nao entra no catalogo-alvo");
  }

  await cliente.query(
    `insert into public.provas (banca, ano, orgao, cargo, caderno)
     values ($1, $2, $3, $4, $5)
     on conflict (banca, ano, orgao, cargo, coalesce(caderno, '')) do nothing`,
    [...chave],
  );
  const { rows } = await cliente.query(
    `select id::text from public.provas
      where banca = $1 and ano = $2 and orgao = $3 and cargo = $4
        and coalesce(caderno, '') = coalesce($5, '')`,
    [...chave],
  );
  return String((rows[0] as { id: string }).id);
}

export type ResumoDaDecisao = {
  aprovados: number;
  baixados: { id: string; arquivo: string; bytes: number; prova: string | null }[];
  falhas: { id: string; motivo: string }[];
};

/**
 * A primeira confirmacao, e so entao o download.
 *
 * A ordem importa e nao e negociavel: o RPC recusa decisao fora de ordem, e o
 * download so le a lista **depois** de o banco ter aceitado a decisao. Falha de
 * rede num documento nao derruba os outros — vira pendencia no relatorio.
 */
export async function acaoDecidirDocumentos(
  cliente: ClienteSql,
  abertura: string,
  operador: string,
  decisoes: readonly Decisao[],
  motivo: string,
  dominios: readonly string[],
  opcoes: {
    destino: string;
    escrever?: (caminho: string, dados: Buffer) => void;
    /** Injetados pelo teste; em producao valem o `fetch` e a configuracao. */
    buscar?: BuscadorHttp;
    tetoMib?: number;
  } = { destino: "provas" },
): Promise<ResumoDaDecisao> {
  const { rows: decididos } = await cliente.query(
    "select public.decidir_documentos($1, $2, $3::jsonb, $4) as aprovados",
    [abertura, operador, JSON.stringify(decisoes), motivo],
  );
  const aprovados = Number((decididos[0] as { aprovados: number }).aprovados);

  const { rows } = await cliente.query(
    `select id::text, url, tipo::text, metadados
       from public.concurso_documentos
      where abertura_id = $1 and decisao = 'aprovado' and baixado_em is null
      order by tipo, url`,
    [abertura],
  );

  const pendentes = rows.map((linha) => ({
    id: String(linha.id),
    url: String(linha.url),
    tipo: String(linha.tipo) as TipoDeDocumento,
    metadados: (linha.metadados ?? {}) as Record<string, unknown>,
  }));

  const resultado = await baixarAprovados(pendentes, dominios, {
    buscar: opcoes.buscar,
    tetoMib: opcoes.tetoMib,
  });
  const escrever = opcoes.escrever ?? ((caminho, dados) => writeFileSync(caminho, dados));
  if (resultado.baixados.length > 0) mkdirSync(opcoes.destino, { recursive: true });

  const porId = new Map(pendentes.map((p) => [p.id, p]));
  const baixados: ResumoDaDecisao["baixados"] = [];
  for (const pdf of resultado.baixados) {
    const documento = porId.get(pdf.id);
    if (documento === undefined) continue;
    const arquivo = path.join(opcoes.destino, pdf.nomeInterno);
    escrever(arquivo, pdf.conteudo);
    // Prova ganha linha no catalogo-alvo; edital nao e prova e nao tem uma.
    const prova =
      documento.tipo === "prova" ? await garantirProva(cliente, documento.metadados) : null;
    await cliente.query(
      "select public.registrar_documento_baixado($1, $2, $3, $4, $5, $6)",
      [abertura, operador, pdf.id, pdf.bytes, pdf.sha256, prova],
    );
    baixados.push({ id: pdf.id, arquivo, bytes: pdf.bytes, prova });
  }

  return { aprovados, baixados, falhas: resultado.falhas };
}

// ── Acao `programa` ─────────────────────────────────────────────────────────

/**
 * Entrega ao agente **somente** o trecho do programa do edital.
 *
 * O corte e local e por regra de texto. O que sai daqui e o unico texto de
 * documento que a sessao ve em toda a abertura — a prova nao passa por aqui de
 * jeito nenhum: ela segue direto para `medir-prova` (AD-140).
 *
 * Corte que nao fecha vira **pendencia**, e nao "manda o edital inteiro e deixa
 * o agente achar": o edital inteiro seria reenviado a cada turno da sessao.
 */
export async function acaoPrograma(
  cliente: ClienteSql,
  abertura: string,
  operador: string,
  opcoes: { lerArquivo?: (caminho: string) => Buffer; destino?: string } = {},
): Promise<ProgramaExtraido & { arquivo: string }> {
  await cliente.query("select public.exigir_operador_ativo($1)", [operador]);

  const { rows } = await cliente.query(
    `select id::text, tipo::text
       from public.concurso_documentos
      where abertura_id = $1 and tipo = 'edital'
        and decisao = 'aprovado' and baixado_em is not null
      order by registrado_em
      limit 1`,
    [abertura],
  );
  if (rows.length === 0) {
    throw new Error(
      "nenhum edital aprovado e baixado nesta abertura: rode `decidir-documentos` antes",
    );
  }

  const documentoId = String((rows[0] as { id: string }).id);
  const arquivo = path.join(
    opcoes.destino ?? "provas",
    nomeInternoDoDocumento(documentoId, "edital"),
  );
  const ler = opcoes.lerArquivo ?? ((alvo: string) => readFileSync(alvo));
  const pdf = lerPdf(ler(arquivo));

  return { ...extrairPrograma(pdf.paginas), arquivo };
}

export function formatarPrograma(resultado: ProgramaExtraido & { arquivo: string }): string {
  if (!resultado.confiavel) {
    return [
      `PENDENCIA: ${resultado.motivo}.`,
      "Nenhum texto do edital foi emitido — o documento inteiro NAO vai para a conversa.",
      `Abra ${resultado.arquivo} a mao, confira as paginas do programa e siga com o operador.`,
    ].join("\n");
  }

  return [
    `programa do edital · paginas ${resultado.paginaInicial}-${resultado.paginaFinal} · ` +
      `${resultado.caracteres} caracteres` +
      (resultado.truncado ? " (TRUNCADO no teto)" : ""),
    "",
    resultado.trecho,
    "",
    "Leia o trecho acima na SUA sessao, monte a proposta de materias e assuntos e " +
      "entregue-a a `propor-assuntos`. Nao ha chamada de modelo do produto aqui.",
  ].join("\n");
}

// ── Acao `propor-assuntos` ──────────────────────────────────────────────────

/**
 * A proposta que o agente escreve depois de ler o trecho.
 *
 * `.strict()` pela mesma razao do manifesto: campo a mais e sinal de que a
 * sessao entendeu outra coisa. O peso e opcional — edital sem tabela de pontos
 * existe, e inventar peso seria pior do que ficar sem ele.
 */
export const propostaSchema = z
  .object({
    materias: z
      .array(
        z
          .object({
            nome: z.string().min(1).max(200),
            ordem: z.number().int().min(0).max(999).default(0),
            peso: z
              .object({
                valor: z.number().positive(),
                base: z.enum(["pontos", "itens", "percentual"]),
              })
              .strict()
              .optional(),
            assuntos: z.array(z.string().min(1).max(200)).min(1).max(200),
          })
          .strict(),
      )
      .min(1)
      .max(50),
  })
  .strict();

export type Proposta = z.infer<typeof propostaSchema>;

export function lerProposta(bruto: unknown): Proposta {
  const lido = propostaSchema.safeParse(bruto);
  if (!lido.success) {
    throw new Error(
      `proposta recusada: ${lido.error.issues.map((i) => i.path.join(".")).join(", ")}`,
    );
  }
  return lido.data;
}

export type LinhaProposta = {
  id: string;
  materiaEdital: string;
  nomeProposto: string;
  topicoId: string | null;
  candidatos: { topicoId: string; nome: string; materiaNome: string; similaridade: number }[];
};

/** A base e a mesma do `concurso_peso_materia` da SPEC 39, e nao texto livre. */
export type BaseDoPeso = "pontos" | "itens" | "percentual";

export type PesoSugerido = {
  materia_id: string;
  materia_nome: string;
  peso_declarado: number;
  base: BaseDoPeso;
};

export type ResumoDaProposta = {
  linhas: LinhaProposta[];
  pesos: PesoSugerido[];
  pesosSemMateria: string[];
};

/**
 * Casa a proposta com a taxonomia e calcula as quase-duplicatas **por codigo**.
 *
 * O agente nao decide nada aqui: ele nomeou assuntos, e o codigo diz quais ja
 * existem com esse nome exato (`casarTopico`) e quais se parecem o bastante
 * para virarem pergunta de fusao. O limiar vive em configuracao (AD-078).
 */
export async function acaoProporAssuntos(
  cliente: ClienteSql,
  abertura: string,
  operador: string,
  bruto: unknown,
): Promise<ResumoDaProposta> {
  const proposta = lerProposta(bruto);
  const catalogo = await lerCatalogo(cliente);
  const limiar = await getParam("param.m1.limiar_quase_duplicata");

  const paraOBanco = proposta.materias.flatMap((materia) =>
    materia.assuntos.map((assunto, indice) => {
      const casado = casarTopico(assunto, materia.nome, catalogo);
      return {
        materia_edital: materia.nome,
        nome_proposto: assunto,
        ordem: materia.ordem * 100 + indice,
        topico_id: casado?.id ?? null,
        // Assunto que ja casou exato nao ganha pergunta de fusao: fundir um
        // assunto nele mesmo nao e decisao, e ruido.
        candidatos:
          casado === null ? quaseDuplicatas(assunto, catalogo, limiar) : [],
      };
    }),
  );

  await cliente.query("select public.registrar_assuntos_propostos($1, $2, $3::jsonb)", [
    abertura,
    operador,
    JSON.stringify(paraOBanco),
  ]);

  // O peso do edital e por materia CANONICA (SPEC 39): a materia do edital so
  // vira peso quando ha uma canonica com o mesmo nome. Sem isso, o peso ficaria
  // repartido por estimativa — que e o que o nivel 1 existe para nao fazer.
  const canonicas = new Map<string, { id: string; nome: string }>();
  for (const topico of catalogo) {
    canonicas.set(normalizarNome(topico.materiaNome), {
      id: topico.materiaId,
      nome: topico.materiaNome,
    });
  }

  const pesos: PesoSugerido[] = [];
  const pesosSemMateria: string[] = [];
  for (const materia of proposta.materias) {
    if (materia.peso === undefined) continue;
    const canonica = canonicas.get(normalizarNome(materia.nome));
    if (canonica === undefined) {
      pesosSemMateria.push(materia.nome);
      continue;
    }
    pesos.push({
      materia_id: canonica.id,
      materia_nome: canonica.nome,
      peso_declarado: materia.peso.valor,
      base: materia.peso.base,
    });
  }

  const { rows } = await cliente.query(
    `select id::text, materia_edital, nome_proposto, topico_id::text, candidatos
       from public.abertura_assuntos
      where abertura_id = $1 and decisao = 'pendente'
      order by ordem, nome_proposto`,
    [abertura],
  );

  return {
    linhas: rows.map((linha) => ({
      id: String(linha.id),
      materiaEdital: String(linha.materia_edital),
      nomeProposto: String(linha.nome_proposto),
      topicoId: linha.topico_id === null ? null : String(linha.topico_id),
      candidatos: (linha.candidatos ?? []) as LinhaProposta["candidatos"],
    })),
    pesos,
    pesosSemMateria,
  };
}

/**
 * A segunda confirmacao, como o operador a le.
 *
 * Cada linha diz o que o codigo achou e **qual decisao ela espera**. Nada tem
 * default: linha sem decisao segura o quadro inteiro, porque escolher por
 * omissao seria decidir no lugar de quem assina.
 */
export function formatarProposta(resumo: ResumoDaProposta): string {
  const partes = [`${resumo.linhas.length} assunto(s) propostos pelo programa do edital:`];

  let materiaAtual = "";
  for (const linha of resumo.linhas) {
    if (linha.materiaEdital !== materiaAtual) {
      materiaAtual = linha.materiaEdital;
      partes.push(`\n  ${materiaAtual}`);
    }
    if (linha.topicoId !== null) {
      partes.push(`    ${linha.id}  "${linha.nomeProposto}"  ->  ja existe (mapear)`);
      continue;
    }
    partes.push(`    ${linha.id}  "${linha.nomeProposto}"  ->  nao existe`);
    for (const candidato of linha.candidatos) {
      partes.push(
        `        parecido: ${candidato.nome} (${candidato.materiaNome}) · ` +
          `${(candidato.similaridade * 100).toFixed(0)}% · topico ${candidato.topicoId}`,
      );
    }
    if (linha.candidatos.length === 0) partes.push("        nenhum parecido — criar ou rejeitar");
  }

  if (resumo.pesos.length > 0) {
    partes.push("\n  peso declarado pelo edital (entra junto da decisao):");
    for (const peso of resumo.pesos) {
      partes.push(`    ${peso.materia_nome}: ${peso.peso_declarado} em ${peso.base}`);
    }
  }
  for (const semMateria of resumo.pesosSemMateria) {
    partes.push(
      `    AVISO: "${semMateria}" declara peso mas nao tem materia canonica de mesmo nome; ` +
        "o peso NAO entra (repartir por estimativa e o que o degrau 2 evita).",
    );
  }

  partes.push("");
  partes.push(
    "CONFIRMACAO 2 — nada do edital mudou ainda. Decida CADA linha (mapear, criar, " +
      "fundir ou rejeitar) e rode `decidir-assuntos`. Fusao e sempre humana.",
  );
  return partes.join("\n");
}

// ── Acao `decidir-assuntos` ─────────────────────────────────────────────────

export const decisoesDeAssuntoSchema = z
  .object({
    decisoes: z
      .array(
        z
          .object({
            id: z.string().regex(UUID),
            decisao: z.enum(["mapear", "criar", "fundir", "rejeitar"]),
            topico_id: z.string().regex(UUID).optional(),
            origem_id: z.string().regex(UUID).optional(),
            materia_id: z.string().regex(UUID).optional(),
          })
          .strict(),
      )
      .min(1),
    pesos: z
      .array(
        z
          .object({
            materia_id: z.string().regex(UUID),
            // `materia_nome` viaja so para o humano conferir o que assinou; o
            // banco ignora, e por isso ele e opcional aqui.
            materia_nome: z.string().optional(),
            peso_declarado: z.number().positive(),
            base: z.enum(["pontos", "itens", "percentual"]),
          })
          .strict(),
      )
      .default([]),
  })
  .strict();

export type DecisoesDeAssunto = z.infer<typeof decisoesDeAssuntoSchema>;

export function lerDecisoesDeAssunto(bruto: unknown): DecisoesDeAssunto {
  const lido = decisoesDeAssuntoSchema.safeParse(bruto);
  if (!lido.success) {
    throw new Error(
      `decisoes recusadas: ${lido.error.issues.map((i) => i.path.join(".")).join(", ")}`,
    );
  }

  // O que o schema nao alcanca: cada decisao exige o que ela usa. Conferir aqui
  // e melhor do que deixar o `raise` do banco explicar no meio da transacao.
  for (const decisao of lido.data.decisoes) {
    if (decisao.decisao === "mapear" && decisao.topico_id === undefined) {
      throw new Error("`mapear` exige `topico_id`");
    }
    if (decisao.decisao === "criar" && decisao.materia_id === undefined) {
      throw new Error("`criar` exige `materia_id` da materia canonica");
    }
    if (
      decisao.decisao === "fundir" &&
      (decisao.topico_id === undefined || decisao.origem_id === undefined)
    ) {
      throw new Error("`fundir` exige `topico_id` (destino) e `origem_id`");
    }
  }
  return lido.data;
}

export type ResumoDaSegundaConfirmacao = { aplicados: number; pesos: number };

/**
 * Aplica o quadro inteiro — numa transacao so, do lado do banco.
 *
 * O comando nao monta edital em pedacos: `decidir_assuntos` mapeia, cria pela
 * fila de candidatos da SPEC 15, funde pela funcao da SPEC 37 e grava o peso do
 * edital de uma vez. Linha invalida derruba tudo e nada fica pela metade.
 */
export async function acaoDecidirAssuntos(
  cliente: ClienteSql,
  abertura: string,
  operador: string,
  entrada: DecisoesDeAssunto,
  motivo: string,
): Promise<ResumoDaSegundaConfirmacao> {
  const { rows } = await cliente.query(
    "select public.decidir_assuntos($1, $2, $3::jsonb, $4::jsonb, $5) as aplicados",
    [
      abertura,
      operador,
      JSON.stringify(entrada.decisoes),
      JSON.stringify(
        entrada.pesos.map((peso) => ({
          materia_id: peso.materia_id,
          peso_declarado: peso.peso_declarado,
          base: peso.base,
        })),
      ),
      motivo,
    ],
  );

  return {
    aplicados: Number((rows[0] as { aplicados: number }).aplicados),
    pesos: entrada.pesos.length,
  };
}

export function formatarSegundaConfirmacao(resumo: ResumoDaSegundaConfirmacao): string {
  return [
    `${resumo.aplicados} assunto(s) aplicados ao edital do concurso; ` +
      `${resumo.pesos} peso(s) de materia gravados.`,
    "O edital esta montado. Siga com a medicao das provas e o recalculo do Raio-X.",
  ].join("\n");
}

export function formatarDecisao(resumo: ResumoDaDecisao): string {
  const partes = [
    `${resumo.aprovados} documento(s) aprovado(s); ${resumo.baixados.length} baixado(s).`,
  ];
  for (const item of resumo.baixados) {
    partes.push(
      `  ${item.id} -> ${item.arquivo} (${item.bytes} bytes)` +
        (item.prova === null ? "" : ` · prova ${item.prova}`),
    );
  }
  for (const falha of resumo.falhas) {
    partes.push(`  FALHOU ${falha.id}: ${falha.motivo} — rode de novo, nao duplica.`);
  }
  return partes.join("\n");
}

// ── Provisionamento ─────────────────────────────────────────────────────────

export function ambienteDoScript(
  raiz: string = process.cwd(),
): Record<string, string | undefined> {
  const caminho = path.join(raiz, ".env");
  if (!existsSync(caminho)) return { ...process.env };
  return { ...process.env, ...lerEnv(readFileSync(caminho, "utf8")) };
}

/**
 * O que impede o comando de rodar.
 *
 * **Nao ha chave de modelo na lista de proposito**: nenhuma acao deste comando
 * chama modelo. Exigir a chave do provedor aqui sugeriria o contrario, e o teste
 * varre este arquivo para provar que ela nao e nem lida (AD-145).
 */
export function motivoDeParada(
  ambiente: Record<string, string | undefined>,
): string | null {
  if (!ambiente.DATABASE_URL?.trim()) {
    return "DATABASE_URL nao esta definida. Ver docs/SEGREDOS.md.";
  }
  return null;
}

/** Le o JSON que o agente escreveu. Injetavel para o teste nao tocar o disco. */
export type LeitorDeTexto = (caminho: string) => string;

/** O motivo que vai a `operador_acoes`. Nunca vazio: o banco recusaria. */
export function motivoOuPadrao(motivo: string): string {
  return motivo === "" ? "decisao do operador na sessao de abertura" : motivo;
}

export function lerEntradaJson(
  caminho: string,
  ler: LeitorDeTexto = (alvo) => readFileSync(alvo, "utf8"),
): unknown {
  try {
    return JSON.parse(ler(caminho));
  } catch (erro) {
    throw new Error(`nao consegui ler o JSON de ${caminho}: ${String(erro)}`);
  }
}

/** @returns codigo de saida */
export async function executar(
  ambiente: Record<string, string | undefined>,
  argv: readonly string[],
  opcoes: {
    abrirConexao?: () => ClienteSql & { connect(): Promise<void>; end(): Promise<void> };
    lerArquivo?: LeitorDeTexto;
    escreverArquivo?: (caminho: string, dados: Buffer) => void;
    lerPdfDoDisco?: (caminho: string) => Buffer;
  } = {},
): Promise<number> {
  let argumentos: Argumentos;
  try {
    argumentos = lerArgumentos(argv);
  } catch (erro) {
    console.error(`[abertura] ${erro instanceof Error ? erro.message : String(erro)}`);
    return 1;
  }

  const motivo = motivoDeParada(ambiente);
  if (motivo !== null) {
    console.error(`[abertura] ${motivo}`);
    return 1;
  }

  await iniciarSentry();

  const abrir =
    opcoes.abrirConexao ??
    (() => new Client({ connectionString: ambiente.DATABASE_URL }) as never);
  const cliente = abrir();

  try {
    await cliente.connect();
    definirLeitorDeConfig(leitorDeConfigPorPg(cliente) as never);
    const dominios = await lerDominiosOficiais();

    if (argumentos.acao === "dominios") {
      console.log(formatarDominios(dominios));
    } else if (argumentos.acao === "iniciar") {
      const { rows } = await cliente.query("select public.iniciar_abertura($1, $2) as id", [
        argumentos.concurso,
        argumentos.operador,
      ]);
      const id = String((rows[0] as { id: string }).id);
      console.log(
        `[abertura] execucao ${id}\n` +
          "Pesquise os documentos com a ferramenta da SUA sessao, dentro dos dominios de " +
          "`--acao dominios`, e entregue o manifesto a `registrar-achados`.",
      );
    } else if (argumentos.acao === "registrar-achados") {
      const bruto = lerEntradaJson(argumentos.entrada, opcoes.lerArquivo);
      const resumo = await acaoRegistrarAchados(
        cliente,
        argumentos.abertura,
        argumentos.operador,
        bruto,
        dominios,
      );
      console.log(formatarAchados(resumo));
    } else if (argumentos.acao === "decidir-documentos") {
      const bruto = lerEntradaJson(argumentos.entrada, opcoes.lerArquivo);
      const resumo = await acaoDecidirDocumentos(
        cliente,
        argumentos.abertura,
        argumentos.operador,
        lerDecisoes(bruto),
        motivoOuPadrao(argumentos.motivo),
        dominios,
        { destino: argumentos.destino, escrever: opcoes.escreverArquivo },
      );
      console.log(formatarDecisao(resumo));
    } else if (argumentos.acao === "programa") {
      const resultado = await acaoPrograma(
        cliente,
        argumentos.abertura,
        argumentos.operador,
        { destino: argumentos.destino, lerArquivo: opcoes.lerPdfDoDisco },
      );
      console.log(formatarPrograma(resultado));
      // Corte que nao fecha e pendencia de verdade: sai com codigo vermelho
      // para a sessao nao seguir para `propor-assuntos` como se tivesse lido.
      if (!resultado.confiavel) {
        await encerrar();
        return 1;
      }
    } else if (argumentos.acao === "propor-assuntos") {
      const bruto = lerEntradaJson(argumentos.entrada, opcoes.lerArquivo);
      const resumo = await acaoProporAssuntos(
        cliente,
        argumentos.abertura,
        argumentos.operador,
        bruto,
      );
      console.log(formatarProposta(resumo));
    } else {
      const bruto = lerEntradaJson(argumentos.entrada, opcoes.lerArquivo);
      const resumo = await acaoDecidirAssuntos(
        cliente,
        argumentos.abertura,
        argumentos.operador,
        lerDecisoesDeAssunto(bruto),
        motivoOuPadrao(argumentos.motivo),
      );
      console.log(formatarSegundaConfirmacao(resumo));
    }

    await encerrar();
    return 0;
  } catch (erro) {
    // A mensagem do banco basta: ela ja diz em que estado a execucao esta, e e
    // isso que o agente precisa para retomar. Nada do documento entra no log.
    console.error(`[abertura] ${erro instanceof Error ? erro.message : String(erro)}`);
    await reportar(erro, {
      origem: "abrir-concurso",
      motivo: "a abertura parou antes de terminar",
      acao: argumentos.acao,
    });
    await encerrar();
    return 1;
  } finally {
    await cliente.end().catch(() => {});
  }
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const ambiente = ambienteDoScript();
  if (ambiente.NEXT_PUBLIC_SENTRY_DSN) {
    process.env.NEXT_PUBLIC_SENTRY_DSN = ambiente.NEXT_PUBLIC_SENTRY_DSN;
  }
  process.exit(await executar(ambiente, process.argv.slice(2)));
}
