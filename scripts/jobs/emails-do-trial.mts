#!/usr/bin/env node
/**
 * Envia os e-mails do ciclo do trial (AD-133 · item 6 do TRIAL-2).
 *
 * `pg_cron` enfileira (`enfileirar_emails_do_trial()`); este job consome a fila
 * e envia pela API HTTP do Resend. **Não é serverless** (AD-036) e segue a
 * convenção de job da AD-095.
 *
 * **Falha fecha, não engole.** Sem `RESEND_API_KEY` ou sem remetente, o job sai
 * vermelho antes de tocar a fila, e as linhas continuam lá para a execução
 * seguinte. Um no-op silencioso aqui significaria uma safra inteira de leads sem
 * nenhum e-mail e ninguém sabendo — que é exatamente o que o AD-105 proíbe.
 *
 * O envio **não** passa pelo Supabase Auth: `rate_limit_email_sent` é por
 * projeto e cobre confirmação de cadastro e recuperação de senha. Pendurar o
 * ciclo do trial no mesmo balde faria uma campanha de tráfego derrubar a
 * recuperação de senha de quem já paga.
 */
import { pathToFileURL } from "node:url";

import { Client } from "pg";

import {
  contextoDoEmail,
  montarEmailDoTrial,
  type TipoDeEmailDoTrial,
} from "@/modules/conta/emails-do-trial";

import { encerrar, iniciarSentry, reportar } from "./sentry-node.mjs";

const ENDPOINT_RESEND = "https://api.resend.com/emails";

/** Teto de linhas por execução. A fila diária não chega perto disso. */
export const LIMITE_DA_EXECUCAO = 500;

export type LinhaDaFila = {
  id: string;
  email: string;
  tipo: TipoDeEmailDoTrial;
  contexto: unknown;
};

export type ResumoDoEnvio = {
  lidas: number;
  enviados: number;
  falhas: number;
};

export type Transporte = (
  destinatario: string,
  assunto: string,
  texto: string,
) => Promise<void>;

export type ClienteSql = {
  query<T = Record<string, unknown>>(
    texto: string,
    valores?: unknown[],
  ): Promise<{ rows: T[] }>;
};

/**
 * A configuração exigida, lida **antes** de qualquer leitura da fila.
 *
 * A ordem é o contrato: conferir depois de ler a fila abriria a janela em que o
 * job marca linha como tentada sem ter como enviar nada.
 */
export function exigirConfiguracao(
  ambiente: Record<string, string | undefined>,
): { apiKey: string; remetente: string; site: string } {
  const apiKey = ambiente.RESEND_API_KEY?.trim();
  const remetente = ambiente.RESEND_FROM?.trim();
  const site = ambiente.NEXT_PUBLIC_SITE_URL?.trim();

  if (!apiKey || !remetente) {
    throw new Error(
      "emails-do-trial: RESEND_API_KEY e RESEND_FROM sao obrigatorios. " +
        "A fila NAO foi consumida — as linhas continuam pendentes.",
    );
  }
  if (!site) {
    throw new Error(
      "emails-do-trial: NEXT_PUBLIC_SITE_URL e obrigatorio — sem ele os links " +
        "do e-mail apontariam para lugar nenhum.",
    );
  }

  return { apiKey, remetente, site: site.replace(/\/+$/, "") };
}

export function transporteResend(
  apiKey: string,
  remetente: string,
  fetchImpl: typeof fetch = fetch,
): Transporte {
  return async (destinatario, assunto, texto) => {
    const resposta = await fetchImpl(ENDPOINT_RESEND, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: remetente,
        to: [destinatario],
        subject: assunto,
        text: texto,
      }),
    });

    if (!resposta.ok) {
      throw new Error(`resend respondeu ${resposta.status}`);
    }
  };
}

/**
 * Consome a fila. Uma linha que falha **não** é marcada como enviada: ela
 * registra o erro, incrementa a contagem e volta na execução seguinte.
 *
 * Uma falha isolada não derruba as outras linhas — mas o job termina vermelho
 * se qualquer uma falhou, porque silêncio aqui é o modo de falha caro.
 */
export async function enviarFilaDoTrial(
  cliente: ClienteSql,
  transporte: Transporte,
  site: string,
): Promise<ResumoDoEnvio> {
  const { rows } = await cliente.query<LinhaDaFila>(
    `select id::text, email, tipo::text as tipo, contexto
       from public.trial_emails_pendentes
      where enviado_em is null
      order by enfileirado_em
      limit $1`,
    [LIMITE_DA_EXECUCAO],
  );

  let enviados = 0;
  let falhas = 0;

  for (const linha of rows) {
    const { assunto, texto } = montarEmailDoTrial(
      linha.tipo,
      contextoDoEmail(linha.contexto),
      site,
    );

    try {
      await transporte(linha.email, assunto, texto);
      await cliente.query(
        `update public.trial_emails_pendentes
            set enviado_em = now(), n_tentativas = n_tentativas + 1, ultimo_erro = null
          where id = $1`,
        [linha.id],
      );
      enviados += 1;
    } catch (erro) {
      falhas += 1;
      await cliente.query(
        `update public.trial_emails_pendentes
            set n_tentativas = n_tentativas + 1, ultimo_erro = $2
          where id = $1`,
        // Só a mensagem, nunca o corpo: o corpo carrega o e-mail do titular.
        [linha.id, erro instanceof Error ? erro.message.slice(0, 400) : "falha"],
      );
    }
  }

  return { lidas: rows.length, enviados, falhas };
}

async function principal(): Promise<void> {
  iniciarSentry();

  const { apiKey, remetente, site } = exigirConfiguracao(process.env);

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("emails-do-trial: DATABASE_URL e obrigatorio.");
  }

  const cliente = new Client({ connectionString: databaseUrl });
  await cliente.connect();

  try {
    const resumo = await enviarFilaDoTrial(
      cliente,
      transporteResend(apiKey, remetente),
      site,
    );

    // Sem e-mail no resumo: ele vai para o log do Actions, que não é lugar de
    // endereço de titular.
    console.log(JSON.stringify({ job: "emails-do-trial", ...resumo }));

    if (resumo.falhas > 0) {
      throw new Error(
        `emails-do-trial: ${resumo.falhas} de ${resumo.lidas} linhas falharam e continuam na fila`,
      );
    }
  } finally {
    await cliente.end();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  principal()
    .then(() => encerrar())
    .catch(async (erro) => {
      reportar(erro, { job: "emails-do-trial" });
      await encerrar();
      console.error(erro);
      process.exitCode = 1;
    });
}
