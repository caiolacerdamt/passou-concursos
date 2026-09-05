import type { Client } from "pg";
import { expect, it } from "vitest";

import { comTransacaoRevertida } from "./conexao";
import { comoAluno, criarMatricula, criarUsuario } from "./conta";
import { descreveComBanco } from "./setup";

/**
 * A fila dos quatro e-mails do trial (AD-133 · item 6 do TRIAL-2).
 *
 * `pg_cron` nao fala HTTP: o que este arquivo prova e o **enfileiramento**. O
 * envio e do job do GitHub Actions e tem os proprios testes de unidade.
 */

async function alunoDeTrial(
  cliente: Client,
  diasAtras: number,
): Promise<string> {
  const aluno = await criarUsuario(cliente);
  await cliente.query(
    "update auth.users set email_confirmed_at = now(), created_at = now() where id = $1",
    [aluno],
  );

  // `inicio_em` recuado: e o que coloca o aluno no degrau desejado do ciclo.
  await criarMatricula(cliente, aluno, {
    produto: "trial-7d",
    inicio_em: new Date(Date.now() - diasAtras * 86_400_000).toISOString(),
  });

  return aluno;
}

async function filaDe(cliente: Client, aluno: string): Promise<string[]> {
  const { rows } = await cliente.query<{ tipo: string }>(
    "select tipo::text as tipo from public.trial_emails_pendentes where user_id = $1 order by tipo",
    [aluno],
  );
  return rows.map((linha) => linha.tipo);
}

descreveComBanco("trial · a fila dos quatro e-mails", () => {
  it("enfileira o degrau do dia: 0, 3, 6 e 8", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const dia0 = await alunoDeTrial(cliente, 0);
      const dia3 = await alunoDeTrial(cliente, 3);
      const dia6 = await alunoDeTrial(cliente, 6);
      const dia8 = await alunoDeTrial(cliente, 8);
      // O dia 5 nao e degrau: ninguem recebe nada.
      const dia5 = await alunoDeTrial(cliente, 5);

      await cliente.query("select public.enfileirar_emails_do_trial()");

      expect(await filaDe(cliente, dia0)).toEqual(["dia_0"]);
      expect(await filaDe(cliente, dia3)).toEqual(["dia_3"]);
      expect(await filaDe(cliente, dia6)).toEqual(["dia_6"]);
      expect(await filaDe(cliente, dia8)).toEqual(["dia_8"]);
      expect(await filaDe(cliente, dia5)).toEqual([]);
    });
  });

  /**
   * "Os quatro saem uma vez cada" e forma de tabela, e nao checagem no codigo:
   * um retry do cron nao pode duplicar e-mail.
   */
  it("rodar duas vezes no mesmo dia nao duplica a linha", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = await alunoDeTrial(cliente, 3);

      await cliente.query("select public.enfileirar_emails_do_trial()");
      await cliente.query("select public.enfileirar_emails_do_trial()");

      expect(await filaDe(cliente, aluno)).toEqual(["dia_3"]);
    });
  });

  it("conta sem e-mail confirmado nao entra na fila", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = await criarUsuario(cliente);
      await criarMatricula(cliente, aluno, {
        produto: "trial-7d",
        inicio_em: new Date(Date.now() - 3 * 86_400_000).toISOString(),
      });

      await cliente.query("select public.enfileirar_emails_do_trial()");

      expect(await filaDe(cliente, aluno)).toEqual([]);
    });
  });

  it("matricula paga nao recebe e-mail de trial", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = await criarUsuario(cliente);
      await cliente.query(
        "update auth.users set email_confirmed_at = now() where id = $1",
        [aluno],
      );
      await criarMatricula(cliente, aluno, {
        inicio_em: new Date(Date.now() - 3 * 86_400_000).toISOString(),
      });

      await cliente.query("select public.enfileirar_emails_do_trial()");

      expect(await filaDe(cliente, aluno)).toEqual([]);
    });
  });

  it("os numeros do aluno vao congelados no contexto", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = await alunoDeTrial(cliente, 3);

      await cliente.query("select public.enfileirar_emails_do_trial()");

      const { rows } = await cliente.query<{ contexto: Record<string, number> }>(
        "select contexto from public.trial_emails_pendentes where user_id = $1",
        [aluno],
      );

      // Sem tentativas semeadas, todos zerados — o que importa e que as chaves
      // existem: o job le `contexto.questoes`, e chave ausente viraria zero em
      // silencio para um aluno que respondeu.
      expect(Object.keys(rows[0].contexto).sort()).toEqual([
        "acertos",
        "assuntos",
        "caderno",
        "dias",
        "questoes",
        "revisoes",
      ]);
    });
  });

  /** Cada linha carrega o e-mail de um titular. Aluno nenhum le esta fila. */
  it("authenticated nao le a fila", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = await alunoDeTrial(cliente, 0);

      await comoAluno(cliente, aluno, async () => {
        await cliente.query("savepoint le_a_fila");
        await expect(
          cliente.query("select * from public.trial_emails_pendentes limit 1"),
        ).rejects.toThrow(/permission denied|permissão negada/i);
        await cliente.query("rollback to savepoint le_a_fila");
      });
    });
  });
});
