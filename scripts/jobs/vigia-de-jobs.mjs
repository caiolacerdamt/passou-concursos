#!/usr/bin/env node
/**
 * Vigia das execucoes de pg_cron (INFRA-09 AC2).
 *
 * Le `public.jobs_falhados` e reporta cada falha da janela. Roda uma vez por dia
 * pelo GitHub Actions (AD-036) e tambem a mao, por `workflow_dispatch`.
 *
 * **Por que existe:** job de pg_cron roda dentro do Postgres e falha dentro do
 * Postgres. Ninguem recebe nada; a linha entra em `cron.job_run_details` e fica
 * la. Este script e o unico caminho entre aquela linha e o e-mail do time.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { Client } from "pg";

import { sanitizarTexto } from "../../src/modules/observabilidade/saneamento.mjs";
import { lerEnv } from "../alvo-do-banco.mjs";

import { encerrar, iniciarSentry, reportar } from "./sentry-node.mjs";

/**
 * Janela olhada a cada execucao: 26 horas — o dia mais 2 de folga, para uma
 * execucao atrasada nao abrir buraco entre duas passagens.
 *
 * **Constante em codigo, nunca na tabela de configuracao.** E a mesma excecao
 * declarada da janela de cache (AD-081), pelo mesmo motivo invertido:
 * configuracao ilegivel e uma das falhas que este script existe para denunciar.
 * Se ele dependesse dela para ligar, calaria justamente quando importa.
 */
export const JANELA_HORAS = 26;

export const CONSULTA = `
  select jobid, runid, jobname, status, return_message, start_time
  from public.jobs_falhados
  where start_time > now() - make_interval(hours => $1::int)
  order by start_time
`;

/**
 * Ambiente do script: o do processo, com o `.env` por cima quando ele existe.
 *
 * A ordem e a mesma do `db-push.mjs` e pelo mesmo motivo registrado la: nesta
 * maquina existe variavel global do Windows com valor de outra conta, e
 * `--env-file` **nao** sobrescreve variavel que ja existe no sistema. No GitHub
 * Actions nao ha `.env`, entao vale o que o workflow passar.
 *
 * @param {string} [raiz]
 * @returns {Record<string, string | undefined>}
 */
export function ambienteDoScript(raiz = process.cwd()) {
  const caminho = path.join(raiz, ".env");
  if (!existsSync(caminho)) return { ...process.env };
  return { ...process.env, ...lerEnv(readFileSync(caminho, "utf8")) };
}

/**
 * O que impede este script de rodar, se e que impede.
 *
 * @param {Record<string, string | undefined>} ambiente
 * @returns {string | null} o motivo, ou `null` quando esta tudo no lugar
 */
export function motivoDeParada(ambiente) {
  const url = ambiente.DATABASE_URL?.trim();
  if (!url) {
    return "DATABASE_URL nao esta definida: sem ela o vigia nao consegue olhar nada. Cadastre o segredo no repositorio (ver docs/SEGREDOS.md).";
  }
  return null;
}

/**
 * Transforma linha da view em erro reportavel.
 *
 * `return_message` e o texto do erro do Postgres e leva valor de linha com
 * facilidade — por isso ele passa pelo saneamento aqui, no ponto em que e lido,
 * e nao so no destino.
 *
 * @param {Array<Record<string, unknown>>} linhas
 * @returns {Array<{ mensagem: string, contexto: Record<string, unknown> }>}
 */
export function resumirFalhas(linhas) {
  return linhas.map((linha) => {
    const nome = linha.jobname ?? `jobid ${String(linha.jobid)}`;
    return {
      mensagem: `job de pg_cron falhou: ${String(nome)} (${String(linha.status)})`,
      contexto: {
        origem: "pg_cron",
        jobid: linha.jobid ?? null,
        runid: linha.runid ?? null,
        jobname: linha.jobname ?? null,
        status: linha.status ?? null,
        detalhe: sanitizarTexto(String(linha.return_message ?? "sem mensagem")),
        inicio: linha.start_time instanceof Date ? linha.start_time.toISOString() : null,
      },
    };
  });
}

/**
 * @param {Record<string, string | undefined>} ambiente
 * @returns {Promise<number>} codigo de saida
 */
export async function executar(ambiente) {
  const motivo = motivoDeParada(ambiente);
  if (motivo !== null) {
    console.error(`[vigia] ${motivo}`);
    return 1;
  }

  await iniciarSentry();

  const cliente = new Client({ connectionString: ambiente.DATABASE_URL });
  /** @type {Array<Record<string, unknown>>} */
  let linhas = [];

  try {
    await cliente.connect();
    const resultado = await cliente.query(CONSULTA, [JANELA_HORAS]);
    linhas = resultado.rows;
  } catch (erro) {
    // Vigia que nao consegue olhar e pior do que vigia nenhum, porque parece
    // que olhou. Reporta e sai vermelho.
    await reportar(erro, { origem: "vigia-de-jobs", motivo: "nao consegui consultar jobs_falhados" });
    await encerrar();
    return 1;
  } finally {
    await cliente.end().catch(() => {});
  }

  const falhas = resumirFalhas(linhas);

  if (falhas.length === 0) {
    console.log(`[vigia] nenhuma falha de pg_cron nas ultimas ${JANELA_HORAS}h.`);
    await encerrar();
    return 0;
  }

  for (const falha of falhas) {
    await reportar(new Error(falha.mensagem), falha.contexto);
  }
  await encerrar();

  // Sai vermelho de proposito: o alerta ja saiu, e a execucao vermelha e um
  // segundo sinal, independente do Sentry estar de pe.
  return 1;
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const ambiente = ambienteDoScript();
  // `iniciarSentry` le do process.env; na maquina o DSN mora no .env.
  if (ambiente.NEXT_PUBLIC_SENTRY_DSN) {
    process.env.NEXT_PUBLIC_SENTRY_DSN = ambiente.NEXT_PUBLIC_SENTRY_DSN;
  }
  process.exit(await executar(ambiente));
}
