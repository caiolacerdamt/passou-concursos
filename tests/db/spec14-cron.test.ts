import { expect, it } from "vitest";

import { comBanco } from "./conexao";
import { descreveComBanco } from "./setup";

type Job = {
  jobname: string;
  schedule: string;
  command: string;
  active: boolean;
};

async function job(nome: string): Promise<Job | undefined> {
  const { rows } = await comBanco(async (cliente) =>
    cliente.query<Job>(
      "select jobname, schedule, command, active from cron.job where jobname = $1",
      [nome],
    ),
  );
  return rows[0];
}

descreveComBanco("SPEC 14 — job da sequência", () => {
  it("agenda uma única rotina ativa depois do plano do dia", async () => {
    const encontrado = await job("m4-recalcula-sequencia");
    const plano = await job("m4-gera-plano-do-dia");

    expect(encontrado).toBeDefined();
    expect(encontrado).toMatchObject({
      schedule: "0 7 * * *",
      active: true,
    });
    expect(encontrado?.command).toMatch(/public\.recalcula_sequencia\(\)/);
    expect(Number(encontrado?.schedule.split(" ")[1])).toBeGreaterThan(
      Number(plano?.schedule.split(" ")[1]),
    );
  });

  it("usa função com lock e janela que não fecha o dia atual", async () => {
    const { rows } = await comBanco((cliente) =>
      cliente.query<{ corpo: string }>(
        `select pg_get_functiondef(p.oid) as corpo
           from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public'
            and p.proname = 'recalcula_sequencia'`,
      ),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].corpo).toMatch(/pg_try_advisory_xact_lock/);
    expect(rows[0].corpo).toMatch(/Sao_Paulo/);
    expect(rows[0].corpo).toMatch(/- 1/);
  });

  it("não cria uma segunda linha quando a migration é consultada novamente", async () => {
    const { rows } = await comBanco((cliente) =>
      cliente.query<{ n: string }>(
        "select count(*)::text as n from cron.job where jobname = 'm4-recalcula-sequencia'",
      ),
    );
    expect(rows[0].n).toBe("1");
  });
});
