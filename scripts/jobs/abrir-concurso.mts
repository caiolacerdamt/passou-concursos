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
 *   `processar-provas`    delega a medicao ao `medir-prova` da SPEC 38
 *   `recalcular`          recalcula o Raio-X e reavalia a prontidao
 *   `relatorio`           onde a execucao esta, o lastro por materia e o proximo passo
 *   `publicar`            3a CONFIRMACAO: fecha a execucao e publica o concurso
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
  | "decidir-assuntos"
  | "processar-provas"
  | "recalcular"
  | "relatorio"
  | "publicar";

const ACOES: readonly Acao[] = [
  "dominios",
  "iniciar",
  "registrar-achados",
  "decidir-documentos",
  "programa",
  "propor-assuntos",
  "decidir-assuntos",
  "processar-provas",
  "recalcular",
  "relatorio",
  "publicar",
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
  "                     [--motivo <texto>]\n" +
  "  processar-provas   --abertura <uuid> --operador <uuid> [--destino <pasta>]\n" +
  "  recalcular         --abertura <uuid> --operador <uuid>\n" +
  "  relatorio          --abertura <uuid>\n" +
  "  publicar           --abertura <uuid> --operador <uuid> --motivo <texto>";

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
    // `relatorio` so LE: ele e o comando da retomada, e exigir operador para
    // perguntar "onde isto parou" so atrapalharia quem chegou agora.
    if (acao !== "relatorio") exigirUuid("operador");
  }
  // Publicar e a terceira confirmacao: o motivo vai a `operador_acoes` e nao
  // pode ser o texto generico que as outras acoes aceitam.
  if (acao === "publicar" && argumentos.motivo === "") {
    throw new Error(`--motivo e obrigatorio em publicar\n${USO}`);
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

// ── Acao `processar-provas` ─────────────────────────────────────────────────

/**
 * Roda a medicao de uma prova. **Delega, nao reimplementa.**
 *
 * O contrato e o do `medir-prova` da SPEC 38, chamado como comando: e la que
 * moram a grade, o separador deterministico, a reserva por modelo e a chave do
 * provedor. Chamar por processo — e nao importar as funcoes — e o que mantem
 * este arquivo sem gateway e sem segredo de modelo, e o que faz o teste de
 * `motivoDeParada` continuar dizendo a verdade (AD-141, AD-145).
 */
export type MedidorDeProva = (
  provaId: string,
  pdf: string,
) => Promise<{ codigo: number; saida: string }>;

export const medidorPadrao: MedidorDeProva = async (provaId, pdf) => {
  const { spawnSync } = await import("node:child_process");
  const resultado = spawnSync(
    process.execPath,
    [
      path.join("node_modules", "tsx", "dist", "cli.mjs"),
      path.join("scripts", "jobs", "medir-prova.mts"),
      "--acao",
      "etiquetar",
      "--prova",
      provaId,
      "--pdf",
      pdf,
    ],
    { encoding: "utf8" },
  );
  return {
    codigo: resultado.status ?? 1,
    // O `medir-prova` ja e quem garante que nenhuma linha de prova sai no
    // stdout: ele imprime contagem e veredito. Repassar o texto dele e seguro.
    saida: `${resultado.stdout ?? ""}${resultado.stderr ?? ""}`.trim(),
  };
};

export type ResumoDoProcessamento = {
  provas: { prova: string; arquivo: string; codigo: number; saida: string }[];
};

/**
 * Mede cada prova aprovada e baixada, e so entao libera a etapa do edital.
 *
 * Nao ha tarefa de IA nova aqui: `etiqueta_de_item` e `separacao_de_itens` sao
 * as da SPEC 38, e a extracao completa de questoes (SPEC 09) **nao** e acionada
 * pela abertura. Prova que falha nao derruba as outras — fica no relatorio.
 */
export async function acaoProcessarProvas(
  cliente: ClienteSql,
  abertura: string,
  operador: string,
  opcoes: { destino?: string; medir?: MedidorDeProva } = {},
): Promise<ResumoDoProcessamento> {
  await cliente.query("select public.exigir_operador_ativo($1)", [operador]);

  const { rows } = await cliente.query(
    `select id::text as documento_id, prova_id::text
       from public.concurso_documentos
      where abertura_id = $1 and tipo = 'prova'
        and decisao = 'aprovado' and prova_id is not null
      order by registrado_em`,
    [abertura],
  );

  const medir = opcoes.medir ?? medidorPadrao;
  const provas: ResumoDoProcessamento["provas"] = [];

  for (const linha of rows) {
    const documentoId = String(linha.documento_id);
    const provaId = String(linha.prova_id);
    const arquivo = path.join(
      opcoes.destino ?? "provas",
      nomeInternoDoDocumento(documentoId, "prova"),
    );
    const { codigo, saida } = await medir(provaId, arquivo);
    provas.push({ prova: provaId, arquivo, codigo, saida });
  }

  // A medicao acabou; o edital e o proximo passo. `avancar_abertura` recusa se
  // a execucao ja tiver passado daqui, e aceita repetir o estado atual.
  await cliente.query("select public.avancar_abertura($1, $2, 'processamento_em_andamento')", [
    abertura,
    operador,
  ]);

  return { provas };
}

export function formatarProcessamento(resumo: ResumoDoProcessamento): string {
  if (resumo.provas.length === 0) {
    return [
      "nenhuma prova aprovada e baixada nesta abertura.",
      "O concurso segue so com o edital: o Raio-X nasce no degrau 2, e o " +
        "relatorio dira, materia por materia, o que falta para subir.",
    ].join("\n");
  }

  const partes = [`${resumo.provas.length} prova(s) medidas pelo pipeline da SPEC 38:`];
  for (const prova of resumo.provas) {
    partes.push(`  ${prova.prova} ${prova.codigo === 0 ? "OK" : "FALHOU"}`);
    for (const linha of prova.saida.split("\n").filter((l) => l.trim() !== "")) {
      partes.push(`      ${linha}`);
    }
  }
  return partes.join("\n");
}

// ── Acao `recalcular` ───────────────────────────────────────────────────────

export type ResumoDoRecalculo = { linhas: number; mudancasDeVisibilidade: number };

/**
 * Recalcula o Raio-X e reavalia a prontidao.
 *
 * Determinista de ponta a ponta: `recalcula_raiox` e regra e SQL, e
 * `avaliar_prontidao_do_concurso` compara cobertura com o piso. Nenhum modelo
 * participa — o AD invariante 6 vale aqui como vale no plano.
 */
export async function acaoRecalcular(
  cliente: ClienteSql,
  abertura: string,
  operador: string,
): Promise<ResumoDoRecalculo> {
  const { rows: dono } = await cliente.query(
    "select concurso_id::text from public.aberturas_concurso where id = $1",
    [abertura],
  );
  if (dono.length === 0) throw new Error("abertura_inexistente");
  const concurso = String((dono[0] as { concurso_id: string }).concurso_id);

  await cliente.query("select public.exigir_operador_ativo($1)", [operador]);

  const { rows: raiox } = await cliente.query("select public.recalcula_raiox() as linhas");
  const { rows: prontidao } = await cliente.query(
    "select public.avaliar_prontidao_do_concurso($1) as mudou",
    [concurso],
  );

  return {
    linhas: Number((raiox[0] as { linhas: number }).linhas),
    mudancasDeVisibilidade: Number((prontidao[0] as { mudou: number }).mudou),
  };
}

// ── Acao `relatorio` ────────────────────────────────────────────────────────

export type LinhaDoLastro = {
  materia: string;
  degrau: number;
  nProvas: number;
  anos: number[];
  baseDoPeso: string;
};

export type Relatorio = {
  aberturaId: string;
  orgao: string;
  cargo: string;
  estado: string;
  visibilidade: string;
  descartados: number;
  faltantes: string[];
  documentosPendentes: number;
  documentosAprovados: number;
  documentosBaixados: number;
  provas: number;
  metaDeProvas: number;
  cobertura: number | null;
  piso: number;
  atingePiso: boolean;
  materias: LinhaDoLastro[];
};

export async function acaoRelatorio(
  cliente: ClienteSql,
  abertura: string,
): Promise<Relatorio> {
  const { rows } = await cliente.query(
    `select a.abertura_id::text, a.concurso_id::text, a.orgao, a.cargo,
            a.estado::text, a.visibilidade::text, a.descartados, a.faltantes,
            a.documentos_pendentes, a.documentos_aprovados, a.documentos_baixados,
            a.provas_da_abertura,
            c.perfil_concurso_id::text
       from public.abertura_em_curso a
       join public.concursos c on c.id = a.concurso_id
      where a.abertura_id = $1`,
    [abertura],
  );
  if (rows.length === 0) throw new Error("abertura_inexistente");
  const linha = rows[0];

  const { rows: resumo } = await cliente.query(
    `select cobertura, piso, atinge_piso
       from public.prontidao_do_concurso_resumo where concurso_id = $1`,
    [linha.concurso_id],
  );

  const { rows: materias } = await cliente.query(
    `select m.nome, p.degrau, p.n_provas, p.anos, p.base_do_peso
       from public.raiox_projecoes_materia p
       join public.materias m on m.id = p.materia_id
      where p.perfil_concurso_id = $1
      order by p.peso desc, m.nome`,
    [linha.perfil_concurso_id],
  );

  return {
    aberturaId: String(linha.abertura_id),
    orgao: String(linha.orgao),
    cargo: String(linha.cargo),
    estado: String(linha.estado),
    visibilidade: String(linha.visibilidade),
    descartados: Number(linha.descartados),
    faltantes: (linha.faltantes ?? []) as string[],
    documentosPendentes: Number(linha.documentos_pendentes),
    documentosAprovados: Number(linha.documentos_aprovados),
    documentosBaixados: Number(linha.documentos_baixados),
    provas: Number(linha.provas_da_abertura),
    metaDeProvas: await getParam("param.m1.meta_provas_por_concurso"),
    cobertura: resumo[0]?.cobertura === undefined ? null : Number(resumo[0].cobertura),
    piso: Number(resumo[0]?.piso ?? 0),
    atingePiso: Boolean(resumo[0]?.atinge_piso),
    materias: materias.map((m) => ({
      materia: String(m.nome),
      degrau: Number(m.degrau),
      nProvas: Number(m.n_provas),
      anos: (m.anos ?? []) as number[],
      baseDoPeso: String(m.base_do_peso),
    })),
  };
}

/**
 * O que falta para a materia subir de degrau (RAIOX-18).
 *
 * O degrau nao e nota: e de onde o peso veio. Dizer "degrau 3" sem dizer o que
 * o faria virar 1 devolveria ao operador a mesma pergunta que ele veio fazer.
 */
export function proximoPasso(linha: LinhaDoLastro, metaDeProvas: number): string {
  switch (linha.degrau) {
    case 1: {
      const faltam = metaDeProvas - linha.nProvas;
      return faltam > 0
        ? `no lastro proprio; faltam ${faltam} prova(s) para a meta de ${metaDeProvas}`
        : `no lastro proprio, com ${linha.nProvas} prova(s) — meta de ${metaDeProvas} atingida`;
    }
    case 2:
      return "peso vem do edital; medir uma prova DESTE concurso leva ao degrau 1";
    case 3:
      return "peso vem de prova da mesma banca em outro orgao; prova deste concurso leva ao degrau 1";
    default:
      return "sem dado: registrar o peso do edital leva ao degrau 2, medir uma prova leva ao 1";
  }
}

/**
 * O relatorio que fecha a abertura — e que diz como retomar quando ela parou.
 *
 * E o mesmo comando nos dois casos de proposito: quem volta a uma execucao
 * interrompida nao deveria precisar saber um comando diferente de quem esta
 * conferindo o resultado.
 */
export function formatarRelatorioDaAbertura(relatorio: Relatorio): string {
  const partes = [
    `${relatorio.orgao} · ${relatorio.cargo}`,
    `abertura ${relatorio.aberturaId} · estado ${relatorio.estado} · concurso ${relatorio.visibilidade}`,
    `documentos: ${relatorio.documentosAprovados} aprovado(s), ` +
      `${relatorio.documentosBaixados} baixado(s), ${relatorio.documentosPendentes} pendente(s); ` +
      `${relatorio.descartados} descartado(s) fora da allowlist`,
    `provas nesta abertura: ${relatorio.provas} de ${relatorio.metaDeProvas} (meta operacional)`,
  ];

  if (relatorio.faltantes.length > 0) {
    partes.push("faltando em fonte oficial:");
    for (const falta of relatorio.faltantes) partes.push(`  - ${falta}`);
  }

  partes.push("");
  if (relatorio.materias.length === 0) {
    partes.push("Raio-X: nenhuma materia projetada ainda — rode `recalcular`.");
  } else {
    partes.push("lastro do Raio-X, materia por materia:");
    for (const materia of relatorio.materias) {
      partes.push(
        `  ${materia.materia} · degrau ${materia.degrau} · ${materia.nProvas} prova(s)` +
          (materia.anos.length > 0 ? ` (${materia.anos.join(", ")})` : "") +
          ` · peso de ${materia.baseDoPeso}`,
      );
      partes.push(`      ${proximoPasso(materia, relatorio.metaDeProvas)}`);
    }
  }

  partes.push("");
  const cobertura =
    relatorio.cobertura === null ? "?" : `${(relatorio.cobertura * 100).toFixed(1)}%`;
  partes.push(
    `prontidao: cobertura ${cobertura} contra o piso de ${(relatorio.piso * 100).toFixed(0)}% — ` +
      (relatorio.atingePiso ? "atinge" : "NAO atinge"),
  );
  partes.push(comoRetomar(relatorio));
  return partes.join("\n");
}

/** A frase que diz qual comando vem agora. Existe para a retomada nao ser adivinhacao. */
export function comoRetomar(relatorio: Relatorio): string {
  switch (relatorio.estado) {
    case "pesquisa_pendente":
      return "PROXIMO: pesquisar na sua sessao e rodar `registrar-achados`.";
    case "documentos_pendentes":
      return "PROXIMO: levar a lista ao operador e rodar `decidir-documentos` (confirmacao 1).";
    case "documentos_aprovados":
      return "PROXIMO: `programa` para ler o edital e `processar-provas` para medir as provas.";
    case "processamento_em_andamento":
      return "PROXIMO: `propor-assuntos` com a proposta que voce montou do trecho do programa.";
    case "assuntos_pendentes":
      return "PROXIMO: levar as linhas ao operador e rodar `decidir-assuntos` (confirmacao 2).";
    case "pronto_para_recalculo":
      return "PROXIMO: `recalcular` e, com o operador de acordo, `publicar` (confirmacao 3).";
    default:
      return relatorio.visibilidade === "publicado"
        ? "abertura concluida e concurso publicado. Nada pendente."
        : "abertura concluida. Publicar depende de o concurso ficar elegivel — veja a prontidao acima.";
  }
}

// ── Acao `publicar` ─────────────────────────────────────────────────────────

export type ResumoDaPublicacao = { concurso: string; visibilidade: string };

/**
 * A terceira confirmacao: a publicacao, que e acao humana registrada.
 *
 * O comando **nao** decide nada aqui. Ele fecha a execucao e chama
 * `publicar_concurso`, que exige o concurso ja elegivel pela regra da SPEC 37 e
 * grava operador e motivo. Concurso que nao atingiu o piso e recusado pelo
 * banco, com a mensagem que o operador precisa ler (RAIOX-20 AC2).
 */
export async function acaoPublicar(
  cliente: ClienteSql,
  abertura: string,
  operador: string,
  motivo: string,
): Promise<ResumoDaPublicacao> {
  const { rows: fechada } = await cliente.query(
    "select public.concluir_abertura($1, $2, $3) as concurso",
    [abertura, operador, motivo],
  );
  const concurso = String((fechada[0] as { concurso: string }).concurso);

  await cliente.query("select public.publicar_concurso($1, $2, $3)", [
    concurso,
    operador,
    motivo,
  ]);

  const { rows } = await cliente.query(
    "select visibilidade::text from public.concursos where id = $1",
    [concurso],
  );
  return { concurso, visibilidade: String((rows[0] as { visibilidade: string }).visibilidade) };
}

export function formatarPublicacao(resumo: ResumoDaPublicacao): string {
  return `concurso ${resumo.concurso} agora esta ${resumo.visibilidade}, com operador e motivo registrados em operador_acoes.`;
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
    medir?: MedidorDeProva;
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
    } else if (argumentos.acao === "decidir-assuntos") {
      const bruto = lerEntradaJson(argumentos.entrada, opcoes.lerArquivo);
      const resumo = await acaoDecidirAssuntos(
        cliente,
        argumentos.abertura,
        argumentos.operador,
        lerDecisoesDeAssunto(bruto),
        motivoOuPadrao(argumentos.motivo),
      );
      console.log(formatarSegundaConfirmacao(resumo));
    } else if (argumentos.acao === "processar-provas") {
      const resumo = await acaoProcessarProvas(cliente, argumentos.abertura, argumentos.operador, {
        destino: argumentos.destino,
        medir: opcoes.medir,
      });
      console.log(formatarProcessamento(resumo));
      // Prova que falhou na medicao deixa codigo vermelho: o relatorio ja diz
      // o que aconteceu, e a sessao nao deve seguir como se tivesse medido.
      if (resumo.provas.some((prova) => prova.codigo !== 0)) {
        await encerrar();
        return 1;
      }
    } else if (argumentos.acao === "recalcular") {
      const resumo = await acaoRecalcular(cliente, argumentos.abertura, argumentos.operador);
      console.log(
        `[abertura] Raio-X recalculado: ${resumo.linhas} linha(s); ` +
          `${resumo.mudancasDeVisibilidade} mudanca(s) de visibilidade por prontidao.`,
      );
    } else if (argumentos.acao === "relatorio") {
      console.log(formatarRelatorioDaAbertura(await acaoRelatorio(cliente, argumentos.abertura)));
    } else {
      const resumo = await acaoPublicar(
        cliente,
        argumentos.abertura,
        argumentos.operador,
        argumentos.motivo,
      );
      console.log(formatarPublicacao(resumo));
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
