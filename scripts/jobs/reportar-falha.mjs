#!/usr/bin/env node
/**
 * Reporta que um workflow do GitHub Actions falhou (INFRA-09 AC2).
 *
 * Chamado pelo passo `if: failure()` da CI. Carrega **so metadado publico do
 * GitHub** — nome do workflow, resultado de cada job e a URL da execucao.
 * Nenhum dado de aluno passa por aqui.
 *
 * Uso:
 *   node scripts/jobs/reportar-falha.mjs
 *   node scripts/jobs/reportar-falha.mjs "detalhe livre"
 */
import { pathToFileURL } from "node:url";

import { encerrar, iniciarSentry, reportar } from "./sentry-node.mjs";

/**
 * @param {Record<string, string | undefined>} ambiente
 * @param {string} [detalhe]
 * @returns {string}
 */
export function montarMensagem(ambiente, detalhe) {
  const workflow = ambiente.GITHUB_WORKFLOW?.trim() || "workflow desconhecido";
  const complemento =
    detalhe?.trim() || ambiente.DETALHE_DA_FALHA?.trim() || "sem detalhe";
  return `GitHub Actions falhou: ${workflow} — ${complemento}`;
}

/**
 * URL da execucao, para o alerta levar direto ao log.
 *
 * @param {Record<string, string | undefined>} ambiente
 * @returns {string | null} `null` quando falta peca para montar a URL
 */
export function urlDaExecucao(ambiente) {
  const servidor = ambiente.GITHUB_SERVER_URL?.trim();
  const repositorio = ambiente.GITHUB_REPOSITORY?.trim();
  const execucao = ambiente.GITHUB_RUN_ID?.trim();
  if (!servidor || !repositorio || !execucao) return null;
  return `${servidor}/${repositorio}/actions/runs/${execucao}`;
}

/**
 * @param {Record<string, string | undefined>} ambiente
 * @returns {Record<string, unknown>}
 */
export function montarContexto(ambiente) {
  return {
    origem: "github-actions",
    workflow: ambiente.GITHUB_WORKFLOW?.trim() || null,
    job: ambiente.GITHUB_JOB?.trim() || null,
    ref: ambiente.GITHUB_REF?.trim() || null,
    execucao: urlDaExecucao(ambiente),
  };
}

/**
 * @param {Record<string, string | undefined>} ambiente
 * @param {string} [detalhe]
 * @returns {Promise<void>}
 */
export async function executar(ambiente, detalhe) {
  await iniciarSentry();
  await reportar(new Error(montarMensagem(ambiente, detalhe)), montarContexto(ambiente));
  await encerrar();
}

// Roda so quando chamado direto pela linha de comando, nunca ao ser importado.
if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await executar(process.env, process.argv[2]);
}
