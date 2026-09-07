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
 *
 * **Nada de PDF sai por aqui.** O agente le contagem, ID e veredito; o arquivo
 * fica no disco do runner (AD-140).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { Client } from "pg";

import {
  type BuscadorHttp,
  type TipoDeDocumento,
  baixarAprovados,
  lerDominiosOficiais,
  lerManifesto,
  triarCandidatos,
} from "@/modules/acervo";
import { definirLeitorDeConfig } from "@/modules/config";
import { type ClienteSql, leitorDeConfigPorPg } from "@/modules/ia";

import { lerEnv } from "../alvo-do-banco.mjs";

import { encerrar, iniciarSentry, reportar } from "./sentry-node.mjs";

export type Acao =
  | "dominios"
  | "iniciar"
  | "registrar-achados"
  | "decidir-documentos";

const ACOES: readonly Acao[] = [
  "dominios",
  "iniciar",
  "registrar-achados",
  "decidir-documentos",
];

export const USO =
  "uso: abrir-concurso --acao dominios|iniciar|registrar-achados|decidir-documentos\n" +
  "  dominios                          (nada mais)\n" +
  "  iniciar            --concurso <uuid> --operador <uuid>\n" +
  "  registrar-achados  --abertura <uuid> --operador <uuid> --entrada <arquivo.json>\n" +
  "  decidir-documentos --abertura <uuid> --operador <uuid> --entrada <arquivo.json>\n" +
  "                     [--motivo <texto>] [--destino <pasta>]";

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
  if (acao === "registrar-achados" || acao === "decidir-documentos") {
    exigirUuid("abertura");
    exigirUuid("operador");
    if (argumentos.entrada === "") throw new Error(`--entrada e obrigatorio\n${USO}`);
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
    } else {
      const bruto = lerEntradaJson(argumentos.entrada, opcoes.lerArquivo);
      const resumo = await acaoDecidirDocumentos(
        cliente,
        argumentos.abertura,
        argumentos.operador,
        lerDecisoes(bruto),
        argumentos.motivo === ""
          ? "decisao do operador na sessao de abertura"
          : argumentos.motivo,
        dominios,
        { destino: argumentos.destino, escrever: opcoes.escreverArquivo },
      );
      console.log(formatarDecisao(resumo));
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
