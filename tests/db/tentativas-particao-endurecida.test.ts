import { expect, it } from "vitest";

import { comTransacaoRevertida } from "./conexao";
import { descreveComBanco } from "./setup";
import { inserirTentativa, nomeDaParticao, novoAluno, questaoParaResponder } from "./aluno";

/**
 * SPEC 05 · T44 — endurecimento das particoes (AD-091).
 *
 * O que se afirma aqui e o que o AD-084 sozinho **nao** garantia numa tabela
 * particionada: o Postgres nao clona gatilho de statement, e particao nova nasce
 * em `public` com os privilegios do `alter default privileges` do Supabase e sem
 * RLS.
 */

/** Cria uma particao crua (sem protecao nenhuma) num mes distante. */
async function particaoCrua(
  cliente: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
  ano: number,
): Promise<string> {
  const nome = `tentativas_ensaio_${ano}`;
  await cliente.query(
    `create table public.${nome} partition of public.tentativas
       for values from ('${ano}-01-01') to ('${ano}-02-01')`,
  );
  return nome;
}

descreveComBanco("particoes de tentativas — endurecimento (AD-091)", () => {
  it("nenhuma particao concede privilegio a anon nem a authenticated", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows } = await cliente.query<{ tabela: string; p: string; g: string }>(
        `select g.table_name as tabela, g.privilege_type as p, g.grantee as g
           from information_schema.role_table_grants g
           join pg_class c on c.relname = g.table_name
           join pg_inherits i on i.inhrelid = c.oid
          where i.inhparent = 'public.tentativas'::regclass
            and g.table_schema = 'public'
            and g.grantee in ('anon', 'authenticated')`,
      );
      expect(rows).toEqual([]);
    });
  });

  it("toda particao tem RLS ligada e o gatilho de TRUNCATE proprio", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows } = await cliente.query<{
        nome: string;
        rls: boolean;
        gatilhos: number;
      }>(
        `select c.relname as nome,
                c.relrowsecurity as rls,
                (select count(*) from pg_trigger t
                  where t.tgrelid = c.oid and t.tgname = c.relname || '_sem_truncate')::int
                  as gatilhos
           from pg_class c
           join pg_inherits i on i.inhrelid = c.oid
          where i.inhparent = 'public.tentativas'::regclass`,
      );
      expect(rows.length).toBeGreaterThan(0);
      for (const particao of rows) {
        expect(particao.rls, `RLS desligada em ${particao.nome}`).toBe(true);
        expect(particao.gatilhos, `sem gatilho em ${particao.nome}`).toBe(1);
      }
    });
  });

  it("TRUNCATE direto numa particao e recusado — o buraco que o AD-084 sozinho deixava", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const particao = nomeDaParticao(new Date());
      await cliente.query("set local role service_role");
      // `cascade`: `tentativa_causa_simulado` referencia `tentativas`, e sem ele
      // a recusa vem da FK e nao do gatilho — o teste passaria por nada.
      await expect(
        cliente.query(`truncate table public.${particao} cascade`),
      ).rejects.toThrow(/TRUNCATE proibido/);
    });
  });

  it("o aluno nao le a particao direto, mas continua lendo pela tabela-pai", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const questao = await questaoParaResponder(cliente);
      const eu = novoAluno();
      await inserirTentativa(cliente, questao, { user_id: eu });
      const particao = nomeDaParticao(new Date());

      await cliente.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: eu, role: "authenticated" }),
      ]);
      await cliente.query("set local role authenticated");

      await cliente.query("savepoint ler_particao");
      await expect(
        cliente.query(`select * from public.${particao}`),
      ).rejects.toThrow(/permission denied/);
      await cliente.query("rollback to savepoint ler_particao");

      const { rows } = (await cliente.query(
        "select user_id from public.tentativas",
      )) as { rows: { user_id: string }[] };
      expect(rows.map((r) => r.user_id)).toEqual([eu]);
    });
  });
});

descreveComBanco("endurecer_particoes_de_tentativas() — a funcao", () => {
  it("protege uma particao criada crua, sem privilegio, sem RLS e sem gatilho", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const nome = await particaoCrua(cliente, 2087);

      // Antes: e exatamente a copia aberta que o AD-091 descreve.
      const { rows: antes } = await cliente.query<{ rls: boolean; concessoes: number }>(
        `select c.relrowsecurity as rls,
                (select count(*)::int from information_schema.role_table_grants g
                  where g.table_schema = 'public' and g.table_name = c.relname
                    and g.grantee in ('anon','authenticated')) as concessoes
           from pg_class c where c.oid = ('public.' || $1)::regclass`,
        [nome],
      );
      expect(antes[0].rls).toBe(false);
      expect(antes[0].concessoes).toBeGreaterThan(0);

      await cliente.query("select public.endurecer_particoes_de_tentativas()");

      const { rows: depois } = await cliente.query<{
        rls: boolean;
        concessoes: number;
        gatilhos: number;
      }>(
        `select c.relrowsecurity as rls,
                (select count(*)::int from information_schema.role_table_grants g
                  where g.table_schema = 'public' and g.table_name = c.relname
                    and g.grantee in ('anon','authenticated')) as concessoes,
                (select count(*)::int from pg_trigger t
                  where t.tgrelid = c.oid and t.tgname = c.relname || '_sem_truncate') as gatilhos
           from pg_class c where c.oid = ('public.' || $1)::regclass`,
        [nome],
      );
      expect(depois[0].rls).toBe(true);
      expect(depois[0].concessoes).toBe(0);
      expect(depois[0].gatilhos).toBe(1);

      await cliente.query("set local role service_role");
      await expect(
        cliente.query(`truncate table public.${nome} cascade`),
      ).rejects.toThrow(/TRUNCATE proibido/);
    });
  });

  it("rodar duas vezes nao erra e nao duplica gatilho", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const nome = await particaoCrua(cliente, 2088);

      const primeira = await cliente.query<{ endurecer_particoes_de_tentativas: number }>(
        "select public.endurecer_particoes_de_tentativas()",
      );
      const segunda = await cliente.query<{ endurecer_particoes_de_tentativas: number }>(
        "select public.endurecer_particoes_de_tentativas()",
      );
      expect(segunda.rows[0].endurecer_particoes_de_tentativas).toBe(
        primeira.rows[0].endurecer_particoes_de_tentativas,
      );

      const { rows } = await cliente.query<{ nomes: string[] }>(
        `select array_agg(t.tgname::text order by t.tgname)::text[] as nomes
           from pg_trigger t
           join pg_class c on c.oid = t.tgrelid
          where c.relname = $1 and not t.tgisinternal`,
        [nome],
      );
      // Dois, e nao um: o gatilho de linha e clonado pelo proprio Postgres
      // quando a particao e criada, e o de TRUNCATE e o que a funcao acrescenta
      // — uma vez so, mesmo chamada duas vezes.
      expect(rows[0].nomes).toEqual([`${nome}_sem_truncate`, "tentativas_sem_mutacao"]);
    });
  });

  it("nao e executavel por quem se autentica pelo navegador", async () => {
    await comTransacaoRevertida(async (cliente) => {
      for (const papel of ["anon", "authenticated"]) {
        await cliente.query("savepoint chamar");
        await cliente.query(`set local role ${papel}`);
        await expect(
          cliente.query("select public.endurecer_particoes_de_tentativas()"),
        ).rejects.toThrow(/permission denied/);
        await cliente.query("rollback to savepoint chamar");
      }
    });
  });
});

descreveComBanco("manutencao da particao no pg_cron (INFRA-04 AC3)", () => {
  it("roda o partman e o endurecimento em jobs SEPARADOS, nessa ordem", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows } = await cliente.query<{
        jobname: string;
        schedule: string;
        command: string;
        active: boolean;
      }>(
        `select jobname, schedule, command, active
           from cron.job
          where jobname in ('tentativas-manutencao-particao',
                            'tentativas-endurece-particao')
          order by schedule`,
      );
      expect(rows).toHaveLength(2);
      expect(rows.every((linha) => linha.active)).toBe(true);

      const [manutencao, endurecimento] = rows;

      // Diario: com premake = 3, execucao perdida vira alerta, nao INSERT perdido.
      expect(manutencao.schedule).toBe("17 5 * * *");
      expect(manutencao.command).toContain("partman.run_maintenance_proc()");

      expect(endurecimento.schedule).toBe("27 5 * * *");
      expect(endurecimento.command).toContain(
        "public.endurecer_particoes_de_tentativas()",
      );

      // O ponto do teste. Juntar as duas instrucoes numa string so foi o bug de
      // 2026-08-17: `run_maintenance_proc` faz COMMIT no corpo, e o pg_cron
      // envolve comando de multiplas instrucoes numa transacao implicita, onde
      // COMMIT e "invalid transaction termination". O job abortava todo dia
      // antes da primeira linha. Cada job carrega UMA instrucao.
      expect(manutencao.command).not.toContain(
        "endurecer_particoes_de_tentativas",
      );
      expect(endurecimento.command).not.toContain("run_maintenance_proc");

      // A ordem continua importando: endurecer antes de criar nao protegeria a
      // particao nova.
      const minuto = (agendamento: string) => {
        const [m, h] = agendamento.split(" ");
        return Number(h) * 60 + Number(m);
      };
      expect(minuto(manutencao.schedule)).toBeLessThan(
        minuto(endurecimento.schedule),
      );
    });
  });
});
