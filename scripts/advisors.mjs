#!/usr/bin/env node
/**
 * Advisors do Supabase (INFRA-09 AC3).
 *
 * O AC3 manda usar os advisors de seguranca e desempenho como **fonte
 * complementar** ao Sentry. Complementar porque respondem perguntas diferentes:
 * o Sentry conta o que quebrou; o advisor conta o que esta errado e ainda nao
 * quebrou — tabela com RLS ligada e sem policy, funcao com `search_path`
 * mutavel, indice faltando.
 *
 * **O endpoint e marcado `experimental` pela propria Supabase.** Por isso
 * resposta em formato diferente do esperado vira erro explicito, e nunca
 * "nenhum achado": um advisor que emudece sem avisar e pior do que nao existir.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { PROJETO_REF, lerEnv } from "./alvo-do-banco.mjs";

export const TIPOS = /** @type {const} */ (["security", "performance"]);

/** Achado neste nivel reprova a execucao. */
export const NIVEIS_QUE_REPROVAM = ["ERROR", "DESCONHECIDO"];

/**
 * @param {string} tipo
 * @param {string} [ref]
 * @returns {string}
 */
export function urlDoAdvisor(tipo, ref = PROJETO_REF) {
  return `https://api.supabase.com/v1/projects/${ref}/advisors/${tipo}`;
}

/**
 * Separa os achados por nivel.
 *
 * @param {unknown} resposta
 * @returns {Record<string, Array<Record<string, unknown>>>}
 */
export function classificar(resposta) {
  const lints = /** @type {{ lints?: unknown }} */ (resposta ?? {}).lints;
  if (!Array.isArray(lints)) {
    throw new Error(
      "resposta inesperada da API de advisors: nao veio a lista `lints`. " +
        "O endpoint e experimental e pode ter mudado — confira o painel do Supabase " +
        "antes de assumir que esta tudo certo.",
    );
  }

  /** @type {Record<string, Array<Record<string, unknown>>>} */
  const grupos = { ERROR: [], WARN: [], INFO: [], DESCONHECIDO: [] };
  for (const lint of lints) {
    const bruto = /** @type {{ level?: unknown }} */ (lint ?? {}).level;
    const nivel = typeof bruto === "string" ? bruto.toUpperCase() : "DESCONHECIDO";
    const destino = grupos[nivel] ?? grupos.DESCONHECIDO;
    destino.push(/** @type {Record<string, unknown>} */ (lint));
  }
  return grupos;
}

/**
 * @param {Record<string, Array<Record<string, unknown>>>} grupos
 * @returns {boolean}
 */
export function reprova(grupos) {
  return NIVEIS_QUE_REPROVAM.some((nivel) => (grupos[nivel] ?? []).length > 0);
}

/**
 * Uma linha por achado, na ordem de gravidade.
 *
 * @param {string} tipo
 * @param {Record<string, Array<Record<string, unknown>>>} grupos
 * @returns {string[]}
 */
export function resumir(tipo, grupos) {
  const linhas = [];
  for (const nivel of ["ERROR", "DESCONHECIDO", "WARN", "INFO"]) {
    for (const lint of grupos[nivel] ?? []) {
      const titulo = String(lint.title ?? lint.name ?? "sem titulo");
      const detalhe = String(lint.detail ?? "").replace(/\s+/g, " ").trim();
      linhas.push(`[${tipo}] ${nivel}: ${titulo}${detalhe ? ` — ${detalhe}` : ""}`);
    }
  }
  return linhas;
}

/**
 * Le o token: `.env` por cima do ambiente, mesma ordem do `db-push.mjs`.
 *
 * @param {string} [raiz]
 * @returns {string}
 */
export function tokenDoAmbiente(raiz = process.cwd()) {
  const caminho = path.join(raiz, ".env");
  const doArquivo = existsSync(caminho) ? lerEnv(readFileSync(caminho, "utf8")) : {};
  return (doArquivo.SUPABASE_ACCESS_TOKEN ?? process.env.SUPABASE_ACCESS_TOKEN ?? "").trim();
}

/**
 * @param {{ token: string, buscar?: typeof fetch, ref?: string }} opcoes
 * @returns {Promise<number>} codigo de saida
 */
export async function executar({ token, buscar = fetch, ref = PROJETO_REF }) {
  if (token === "") {
    console.error(
      "[advisors] SUPABASE_ACCESS_TOKEN nao esta definido. Gere um token em " +
        "https://supabase.com/dashboard/account/tokens e ponha no .env (local) " +
        "ou nos segredos do repositorio (CI). Ver docs/SEGREDOS.md.",
    );
    return 1;
  }

  let houveProblema = false;

  for (const tipo of TIPOS) {
    const resposta = await buscar(urlDoAdvisor(tipo, ref), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!resposta.ok) {
      console.error(`[advisors] ${tipo}: a API respondeu ${resposta.status}.`);
      houveProblema = true;
      continue;
    }

    const grupos = classificar(await resposta.json());
    for (const linha of resumir(tipo, grupos)) console.log(linha);

    if (reprova(grupos)) {
      houveProblema = true;
    } else {
      console.log(`[advisors] ${tipo}: nenhum achado de gravidade ERROR.`);
    }
  }

  return houveProblema ? 1 : 0;
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exit(await executar({ token: tokenDoAmbiente() }));
}
