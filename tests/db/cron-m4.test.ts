import { expect, it } from "vitest";

import { comBanco, comTransacaoRevertida } from "./conexao";
import { descreveComBanco } from "./setup";

/**
 * SPEC 06 · T53 — os dois jobs da madrugada e a poda do historico
 * (ALUNO-02 AC2, ALUNO-07 AC1, INFRA-03).
 *
 * `cron.job` e estado global do banco, nao dado de teste: estes testes **leem**
 * o agendamento, nunca o alteram. Quem agenda e a migracao.
 */

type Job = { jobname: string; schedule: string; command: string; active: boolean };

async function job(nome: string): Promise<Job | undefined> {
  return comBanco(async (cliente) => {
    const { rows } = await cliente.query<Job>(
      "select jobname, schedule, command, active from cron.job where jobname = $1",
      [nome],
    );
    return rows[0];
  });
}

descreveComBanco("pg_cron — os jobs do M4 (INFRA-03)", () => {
  it("o recalculo das projecoes roda as 06:00 UTC (03:00 BRT)", async () => {
    const encontrado = await job("m4-recalcula-projecoes");
    expect(encontrado).toBeDefined();
    expect(encontrado?.schedule).toBe("0 6 * * *");
    expect(encontrado?.active).toBe(true);
    expect(encontrado?.command).toMatch(/recalcula_projecoes\(\)/);
  });

  it("o plano do dia roda as 06:30 UTC, DEPOIS do recalculo", async () => {
    const projecoes = await job("m4-recalcula-projecoes");
    const plano = await job("m4-gera-plano-do-dia");

    expect(plano?.schedule).toBe("30 6 * * *");
    expect(plano?.active).toBe(true);
    expect(plano?.command).toMatch(/gera_plano_do_dia\(\)/);

    // A ordem e requisito, nao estilo: o plano le as projecoes. Inverter os
    // horarios faria o aluno receber um plano montado sobre o retrato de ontem.
    const minuto = (j: Job | undefined) => {
      const [m, h] = (j?.schedule ?? "").split(" ");
      return Number(h) * 60 + Number(m);
    };
    expect(minuto(plano)).toBeGreaterThan(minuto(projecoes));
  });

  it("a poda do historico roda antes dos dois, e depois da manutencao de particao", async () => {
    const poda = await job("m4-poda-historico-de-jobs");
    const particao = await job("tentativas-manutencao-particao");

    expect(poda?.active).toBe(true);
    expect(poda?.command).toMatch(/podar_historico_de_jobs\(\)/);

    const minuto = (j: Job | undefined) => {
      const [m, h] = (j?.schedule ?? "").split(" ");
      return Number(h) * 60 + Number(m);
    };
    // Podar depois da manutencao e antes dos jobs do dia: o historico do dia
    // nasce numa tabela ja limpa.
    expect(minuto(poda)).toBeGreaterThan(minuto(particao));
    expect(minuto(poda)).toBeLessThan(minuto(await job("m4-recalcula-projecoes")));
  });

  it("os jobs chamam as funcoes por nome qualificado — `search_path` de job e traicoeiro", async () => {
    for (const nome of ["m4-recalcula-projecoes", "m4-gera-plano-do-dia"]) {
      expect((await job(nome))?.command).toMatch(/public\./);
    }
  });
});

descreveComBanco("podar_historico_de_jobs (divida da SPEC 03)", () => {
  it("apaga execucao mais velha que a janela e preserva a recente", async () => {
    await comTransacaoRevertida(async (cliente) => {
      // Linhas plantadas com um jobid que nao existe em `cron.job`: e o caso
      // real de historico orfao, que a `jobs_falhados` continua mostrando.
      const jobidFalso = 999_111;
      await cliente.query(
        `insert into cron.job_run_details
           (jobid, runid, job_pid, database, username, command, status, return_message, start_time, end_time)
         values
           ($1, 999111001, 0, 'postgres', 'postgres', 'select 1', 'succeeded', '', now() - interval '400 days', now() - interval '400 days'),
           ($1, 999111002, 0, 'postgres', 'postgres', 'select 1', 'succeeded', '', now() - interval '1 day',   now() - interval '1 day')`,
        [jobidFalso],
      );

      const { rows } = await cliente.query<{ podar_historico_de_jobs: number }>(
        "select public.podar_historico_de_jobs() as podar_historico_de_jobs",
      );
      expect(rows[0].podar_historico_de_jobs).toBeGreaterThanOrEqual(1);

      const { rows: sobraram } = await cliente.query<{ runid: string }>(
        "select runid from cron.job_run_details where jobid = $1",
        [jobidFalso],
      );
      expect(sobraram.map((l) => String(l.runid))).toEqual(["999111002"]);
    });
  });

  it("execucao ainda rodando (`end_time` nulo) nunca e apagada", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const jobidFalso = 999_222;
      await cliente.query(
        `insert into cron.job_run_details
           (jobid, runid, job_pid, database, username, command, status, start_time, end_time)
         values ($1, 999222001, 0, 'postgres', 'postgres', 'select 1', 'running', now() - interval '400 days', null)`,
        [jobidFalso],
      );

      await cliente.query("select public.podar_historico_de_jobs()");

      // Job travado ha muito tempo e exatamente o que se quer investigar —
      // apagar a linha dele seria apagar a prova do incidente.
      const { rows } = await cliente.query(
        "select 1 from cron.job_run_details where jobid = $1",
        [jobidFalso],
      );
      expect(rows).toHaveLength(1);
    });
  });
});
