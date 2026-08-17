import { expect, it } from "vitest";

import { comBanco, comTransacaoRevertida } from "./conexao";
import { descreveComBanco } from "./setup";

/**
 * INFRA-09 AC2 — falha de job de pg_cron SHALL NOT ser silenciosa.
 *
 * As linhas de teste entram em `cron.job_run_details` direto, dentro de uma
 * transacao revertida. Agendar um job de verdade e esperar ele quebrar levaria
 * um minuto de relogio por teste e dependeria do agendador — o que esta spec
 * possui e a **view**, e e ela que precisa de prova.
 */
descreveComBanco("pg_cron e a view jobs_falhados", () => {
  it("a extensao pg_cron esta instalada e com o historico de execucao de pe", async () => {
    await comBanco(async (cliente) => {
      const extensao = await cliente.query(
        "select extversion from pg_extension where extname = 'pg_cron'",
      );
      expect(extensao.rows).toHaveLength(1);

      const historico = await cliente.query(
        "select to_regclass('cron.job_run_details') as tabela",
      );
      expect(historico.rows[0].tabela).toBe("cron.job_run_details");
    });
  });

  it("mostra execucao que falhou e esconde execucao que deu certo", async () => {
    await comTransacaoRevertida(async (cliente) => {
      await cliente.query(`
        insert into cron.job_run_details
          (jobid, runid, job_pid, database, username, command, status, return_message, start_time, end_time)
        values
          (999001, 999001, 1, 'postgres', 'postgres', 'select 1/0', 'failed',    'division by zero', now(), now()),
          (999002, 999002, 1, 'postgres', 'postgres', 'select 1',   'succeeded', 'SELECT 1',         now(), now()),
          (999003, 999003, 1, 'postgres', 'postgres', 'select 1',   'canceled',  'cancelado',        now(), now()),
          (999004, 999004, 1, 'postgres', 'postgres', 'select 1',   'running',    null,              now(), null)
      `);

      const { rows } = await cliente.query(
        "select runid, status, return_message from public.jobs_falhados where runid between 999001 and 999004 order by runid",
      );

      // Falha e cancelamento aparecem; sucesso e execucao em andamento, nao.
      expect(rows.map((linha) => Number(linha.runid))).toEqual([999001, 999003]);
      expect(rows[0].status).toBe("failed");
      expect(rows[0].return_message).toBe("division by zero");
    });
  });

  it("mostra a falha mesmo quando o job foi apagado — historico orfa ainda e falha", async () => {
    await comTransacaoRevertida(async (cliente) => {
      // Nenhuma linha em cron.job com este jobid: o left join precisa segurar.
      await cliente.query(`
        insert into cron.job_run_details
          (jobid, runid, job_pid, database, username, command, status, return_message, start_time, end_time)
        values (999101, 999101, 1, 'postgres', 'postgres', 'select 1/0', 'failed', 'division by zero', now(), now())
      `);

      const { rows } = await cliente.query(
        "select runid, jobname from public.jobs_falhados where runid = 999101",
      );

      expect(rows).toHaveLength(1);
      expect(rows[0].jobname).toBe(null);
    });
  });

  it("a view nao esta aberta para anon nem para authenticated", async () => {
    // `return_message` carrega o texto do erro do Postgres, que leva valor de
    // linha junto. Isso nao vai para o navegador.
    await comBanco(async (cliente) => {
      const { rows } = await cliente.query(`
        select grantee
        from information_schema.role_table_grants
        where table_schema = 'public'
          and table_name = 'jobs_falhados'
          and grantee in ('anon', 'authenticated')
      `);
      expect(rows).toEqual([]);
    });
  });

  it("a view roda com o privilegio de quem chama, nao com o do dono", async () => {
    await comBanco(async (cliente) => {
      const { rows } = await cliente.query(`
        select reloptions
        from pg_class
        where relname = 'jobs_falhados' and relnamespace = 'public'::regnamespace
      `);
      expect(rows[0].reloptions).toContain("security_invoker=true");
    });
  });
});
