import { expect, it } from "vitest";

import { comTransacaoRevertida } from "./conexao";
import { descreveComBanco } from "./setup";
import {
  inserirTentativa,
  nomeDaParticao,
  novoAluno,
  questaoParaResponder,
} from "./aluno";

/**
 * SPEC 05 · T43 — a trava do so-INSERT (ALUNO-01 AC1, AD-015/AD-029/AD-084).
 *
 * E o Independent Test da story: "tentar UPDATE e ver bloqueio", mais a porta
 * nomeada do esquecimento, que e a unica excecao de DELETE que existe.
 */

/** Declara a porta do esquecimento para o titular `userId` nesta transacao. */
async function abrirPortaDoEsquecimento(
  cliente: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
  userId: string,
): Promise<void> {
  await cliente.query("select set_config('app.esquecimento_user_id', $1, true)", [
    userId,
  ]);
}

descreveComBanco("tentativas — a trava do so-INSERT (ALUNO-01 AC1)", () => {
  it("recusa UPDATE para anon, authenticated e tambem para o service_role", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const questao = await questaoParaResponder(cliente);
      const gravada = await inserirTentativa(cliente, questao);

      for (const papel of ["anon", "authenticated"]) {
        await cliente.query("savepoint tentar_update");
        await cliente.query(`set local role ${papel}`);
        await expect(
          cliente.query("update public.tentativas set correta = false where id = $1", [
            gravada.id,
          ]),
        ).rejects.toThrow(/permission denied|UPDATE proibido/);
        await cliente.query("rollback to savepoint tentar_update");
      }

      // A razao de existir a camada 2: o service_role passa por cima da RLS e
      // tem o privilegio, entao so o gatilho o segura.
      await cliente.query("savepoint update_servico");
      await cliente.query("set local role service_role");
      await expect(
        cliente.query("update public.tentativas set correta = false where id = $1", [
          gravada.id,
        ]),
      ).rejects.toThrow(/UPDATE proibido/);
      await cliente.query("rollback to savepoint update_servico");
    });
  });

  it("recusa UPDATE tambem quando o ataque e direto na particao", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const questao = await questaoParaResponder(cliente);
      const gravada = await inserirTentativa(cliente, questao);
      const particao = nomeDaParticao(new Date());

      await expect(
        cliente.query(
          `update public.${particao} set correta = false where id = $1`,
          [gravada.id],
        ),
      ).rejects.toThrow(/UPDATE proibido/);
    });
  });

  it("recusa TRUNCATE da tabela, inclusive para o service_role", async () => {
    await comTransacaoRevertida(async (cliente) => {
      for (const papel of ["anon", "authenticated"]) {
        await cliente.query("savepoint truncar");
        await cliente.query(`set local role ${papel}`);
        // Nomeia a tabela: `/permission denied/` sozinho passaria por negacao
        // de qualquer outro objeto arrastado pelo `cascade`, e o teste diria
        // menos do que afirma.
        await expect(
          cliente.query("truncate table public.tentativas cascade"),
        ).rejects.toThrow(/permission denied for table tentativas/);
        await cliente.query("rollback to savepoint truncar");
      }

      await cliente.query("savepoint truncar_servico");
      await cliente.query("set local role service_role");
      // `cascade` porque `tentativa_causa_simulado` referencia esta tabela: sem
      // ele o Postgres recusa pela FK antes de chegar ao gatilho, e o teste
      // passaria pelo motivo errado.
      await expect(
        cliente.query("truncate table public.tentativas cascade"),
      ).rejects.toThrow(/TRUNCATE proibido/);
      await cliente.query("rollback to savepoint truncar_servico");
    });
  });

  it("os tres gatilhos e o revoke existem — as tres camadas do AD-084", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows: gatilhos } = await cliente.query<{ nome: string; def: string }>(
        `select tgname as nome, pg_get_triggerdef(oid) as def
           from pg_trigger
          where tgrelid = 'public.tentativas'::regclass and not tgisinternal`,
      );
      const porNome = Object.fromEntries(gatilhos.map((g) => [g.nome, g.def]));
      expect(porNome["tentativas_sem_mutacao"]).toMatch(
        /BEFORE DELETE OR UPDATE ON public\.tentativas FOR EACH ROW/,
      );
      expect(porNome["tentativas_sem_truncate"]).toMatch(
        /BEFORE TRUNCATE ON public\.tentativas FOR EACH STATEMENT/,
      );

      const { rows: privilegios } = await cliente.query<{ p: string }>(
        `select privilege_type as p from information_schema.role_table_grants
          where table_schema = 'public' and table_name = 'tentativas'
            and grantee in ('anon', 'authenticated')`,
      );
      const concedidos = privilegios.map((r) => r.p);
      expect(concedidos).not.toContain("UPDATE");
      expect(concedidos).not.toContain("DELETE");
      expect(concedidos).not.toContain("TRUNCATE");
    });
  });

  it("as funcoes da trava tem search_path fixo (aviso do linter do Supabase)", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows } = await cliente.query<{ nome: string; config: string[] | null }>(
        `select proname as nome, proconfig::text[] as config
           from pg_proc
          where pronamespace = 'public'::regnamespace
            and proname in ('tentativas_bloqueia_mutacao', 'tentativas_bloqueia_truncate')`,
      );
      expect(rows).toHaveLength(2);
      for (const funcao of rows) {
        expect(funcao.config).toContain('search_path=""');
      }
    });
  });
});

descreveComBanco("tentativas — a porta do esquecimento (AD-029)", () => {
  it("recusa DELETE quando a sessao nao declarou titular nenhum", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const questao = await questaoParaResponder(cliente);
      const aluno = novoAluno();
      await inserirTentativa(cliente, questao, { user_id: aluno });

      await expect(
        cliente.query("delete from public.tentativas where user_id = $1", [aluno]),
      ).rejects.toThrow(/rotina de esquecimento/);
    });
  });

  it("recusa DELETE quando a sessao declara OUTRO aluno", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const questao = await questaoParaResponder(cliente);
      const dono = novoAluno();
      const outro = novoAluno();
      await inserirTentativa(cliente, questao, { user_id: dono });

      await abrirPortaDoEsquecimento(cliente, outro);
      await expect(
        cliente.query("delete from public.tentativas where user_id = $1", [dono]),
      ).rejects.toThrow(/rotina de esquecimento/);
    });
  });

  it("aceita DELETE do titular declarado, e so das linhas dele", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const questao = await questaoParaResponder(cliente);
      const titular = novoAluno();
      const vizinho = novoAluno();
      await inserirTentativa(cliente, questao, { user_id: titular });
      await inserirTentativa(cliente, questao, { user_id: titular, ordem_na_sessao: 2 });
      await inserirTentativa(cliente, questao, { user_id: vizinho });

      await abrirPortaDoEsquecimento(cliente, titular);
      const apagadas = await cliente.query(
        "delete from public.tentativas where user_id = $1",
        [titular],
      );
      expect(apagadas.rowCount).toBe(2);

      // A porta aberta para um titular nao apaga o dado do vizinho. O savepoint
      // e obrigatorio: a excecao aborta a transacao, e sem ele a contagem
      // seguinte falharia por "transaction is aborted" em vez de contar.
      await cliente.query("savepoint apagar_vizinho");
      await expect(
        cliente.query("delete from public.tentativas where user_id = $1", [vizinho]),
      ).rejects.toThrow(/rotina de esquecimento/);
      await cliente.query("rollback to savepoint apagar_vizinho");

      const { rows } = await cliente.query<{ n: string }>(
        "select count(*) as n from public.tentativas where user_id = $1",
        [vizinho],
      );
      expect(Number(rows[0].n)).toBe(1);
    });
  });

  it("a porta aberta NAO libera UPDATE — ela e so de apagamento", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const questao = await questaoParaResponder(cliente);
      const titular = novoAluno();
      const gravada = await inserirTentativa(cliente, questao, { user_id: titular });

      await abrirPortaDoEsquecimento(cliente, titular);
      await expect(
        cliente.query("update public.tentativas set correta = false where id = $1", [
          gravada.id,
        ]),
      ).rejects.toThrow(/UPDATE proibido/);
    });
  });
});

descreveComBanco("tentativas — RLS por aluno", () => {
  /** Roda `uso` como `authenticated` com `auth.uid()` valendo `userId`. */
  async function comoAluno(
    cliente: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
    userId: string,
    uso: () => Promise<void>,
  ): Promise<void> {
    await cliente.query("savepoint como_aluno");
    await cliente.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: userId, role: "authenticated" }),
    ]);
    await cliente.query("set local role authenticated");
    try {
      await uso();
    } finally {
      await cliente.query("rollback to savepoint como_aluno");
    }
  }

  it("a RLS esta ligada e nao ha policy de UPDATE nem de DELETE", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows: tabela } = await cliente.query<{ ligada: boolean }>(
        "select relrowsecurity as ligada from pg_class where oid = 'public.tentativas'::regclass",
      );
      expect(tabela[0].ligada).toBe(true);

      const { rows: policies } = await cliente.query<{ cmd: string }>(
        "select cmd from pg_policies where schemaname = 'public' and tablename = 'tentativas'",
      );
      const comandos = policies.map((p) => p.cmd).sort();
      expect(comandos).toEqual(["INSERT", "SELECT"]);
    });
  });

  it("o aluno le a propria linha e nao enxerga a do vizinho", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const questao = await questaoParaResponder(cliente);
      const eu = novoAluno();
      const vizinho = novoAluno();
      await inserirTentativa(cliente, questao, { user_id: eu });
      await inserirTentativa(cliente, questao, { user_id: vizinho });

      await comoAluno(cliente, eu, async () => {
        const { rows } = (await cliente.query(
          "select user_id from public.tentativas",
        )) as { rows: { user_id: string }[] };
        expect(rows.map((r) => r.user_id)).toEqual([eu]);
      });
    });
  });

  it("o aluno nao consegue gravar tentativa no nome de outro", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const questao = await questaoParaResponder(cliente);
      const eu = novoAluno();
      const vizinho = novoAluno();

      await comoAluno(cliente, eu, async () => {
        await expect(
          inserirTentativa(cliente as never, questao, { user_id: vizinho }),
        ).rejects.toThrow(/row-level security/);
      });
    });
  });

  it("o aluno consegue gravar a propria tentativa", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const questao = await questaoParaResponder(cliente);
      const eu = novoAluno();

      await comoAluno(cliente, eu, async () => {
        await expect(
          inserirTentativa(cliente as never, questao, { user_id: eu }),
        ).resolves.toBeTruthy();
      });
    });
  });
});
