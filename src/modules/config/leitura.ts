import { unstable_cache } from "next/cache";

import { clienteDeServico } from "@/lib/db/servidor";

import {
  CATALOGO,
  type Chave,
  type ChaveFlag,
  type ChaveParam,
  type TipoDe,
} from "./catalogo";

/**
 * Janela de cache da leitura de configuracao (INFRA-11 AC5).
 *
 * **Constante em codigo, nunca na tabela.** Se o TTL morasse na propria tabela
 * que ele cacheia, um valor errado se auto-perpetuaria e o valor novo nunca
 * chegaria. E a unica excecao declarada ao "tudo em configuracao" — registrada
 * no design do M9, secao Risks.
 */
export const JANELA_DE_CACHE_SEGUNDOS = 30;

/** Tag do cache, para a escrita invalidar depois do INSERT (T8). */
export const TAG_DE_CACHE = "configuracoes";

// ── Reporte de erro ─────────────────────────────────────────────────────────
// Ponto unico, injetavel. O Sentry entra aqui no INFRA-09; ate la o padrao e o
// console, e o teste troca por um espiao para provar que foi chamado (T9).

export type ReporteDeErro = (
  erro: unknown,
  contexto: Record<string, unknown>,
) => void;

const REPORTE_PADRAO: ReporteDeErro = (erro, contexto) => {
  console.error("[config]", contexto, erro);
};

let reportar: ReporteDeErro = REPORTE_PADRAO;

export function definirReporteDeErro(novo: ReporteDeErro): void {
  reportar = novo;
}

export function restaurarReportePadrao(): void {
  reportar = REPORTE_PADRAO;
}

// ── Leitura ─────────────────────────────────────────────────────────────────

/** Devolve o valor bruto (jsonb) de cada chave pedida que tem linha no banco. */
export type LeitorDeConfig = (
  chaves: readonly Chave[],
) => Promise<Record<string, unknown>>;

/** Leitor real: **um** round-trip, direto na view do valor vigente. */
export const leitorDoBanco: LeitorDeConfig = async (chaves) => {
  const { data, error } = await clienteDeServico()
    .from("configuracoes_vigentes")
    .select("chave, valor")
    .in("chave", chaves as string[]);

  if (error) {
    throw new Error(`falha ao ler configuracoes_vigentes: ${error.message}`);
  }

  return Object.fromEntries(
    (data ?? []).map((linha) => [linha.chave as string, linha.valor]),
  );
};

const leitorCacheado: LeitorDeConfig = unstable_cache(
  leitorDoBanco,
  ["configuracoes-vigentes"],
  { revalidate: JANELA_DE_CACHE_SEGUNDOS, tags: [TAG_DE_CACHE] },
);

let leitorAtual: LeitorDeConfig = leitorCacheado;

/** Seam de teste. Producao nunca chama isto. */
export function definirLeitorDeConfig(novo: LeitorDeConfig): void {
  leitorAtual = novo;
}

export function restaurarLeitorPadrao(): void {
  leitorAtual = leitorCacheado;
}

/**
 * `null` quando a leitura falhou. A distincao importa: banco fora do ar nao e a
 * mesma coisa que chave sem linha, e o AC6 trata os dois de formas diferentes
 * quando a chave e uma flag.
 */
async function lerBruto(
  chaves: readonly Chave[],
): Promise<Record<string, unknown> | null> {
  try {
    return await leitorAtual(chaves);
  } catch (erro) {
    reportar(erro, { chaves, motivo: "falha ao ler a configuracao" });
    return null;
  }
}

/**
 * Resolve uma chave a partir do que veio do banco. Tres quedas, todas para o
 * default declarado no catalogo:
 *   leitura falhou · nao ha linha · o valor do banco nao valida contra o tipo.
 * Sem linha e operacao normal e **nao** vira alerta; as outras duas viram.
 */
function resolver(chave: Chave, bruto: Record<string, unknown> | null): unknown {
  const definicao = CATALOGO[chave];

  if (bruto === null) return definicao.padrao;
  if (!Object.prototype.hasOwnProperty.call(bruto, chave)) return definicao.padrao;

  const validado = definicao.tipo.safeParse(bruto[chave]);
  if (!validado.success) {
    reportar(validado.error, {
      chave,
      motivo: "valor do banco nao valida contra o tipo declarado no catalogo",
    });
    return definicao.padrao;
  }

  return validado.data;
}

/** Valor vigente de um parametro, tipado. Em qualquer duvida, o default. */
export async function getParam<K extends ChaveParam>(
  chave: K,
): Promise<TipoDe<K>> {
  return resolver(chave, await lerBruto([chave])) as TipoDe<K>;
}

/** Varios parametros de uma vez, em **um** round-trip. */
export async function getParams<const K extends readonly ChaveParam[]>(
  ...chaves: K
): Promise<{ [I in keyof K]: TipoDe<K[I]> }> {
  const bruto = await lerBruto(chaves);
  return chaves.map((chave) => resolver(chave, bruto)) as {
    [I in keyof K]: TipoDe<K[I]>;
  };
}

/**
 * Uma feature flag esta ligada? (INFRA-11 AC6)
 *
 * **Qualquer duvida devolve `false`** — inclusive quando o default declarado e
 * `true`. Flag ilegivel nunca liga superficie sozinha. Chave sem linha no banco
 * nao e duvida: e operacao normal, e o default declarado vale.
 */
export async function isFlagOn(chave: ChaveFlag): Promise<boolean> {
  const bruto = await lerBruto([chave]);
  if (bruto === null) return false;

  if (!Object.prototype.hasOwnProperty.call(bruto, chave)) {
    return CATALOGO[chave].padrao;
  }

  const validado = CATALOGO[chave].tipo.safeParse(bruto[chave]);
  if (!validado.success) {
    reportar(validado.error, {
      chave,
      motivo: "flag do banco nao valida contra o tipo; fica desligada",
    });
    return false;
  }

  return validado.data;
}
