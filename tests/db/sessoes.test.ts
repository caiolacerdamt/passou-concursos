import { expect, it } from "vitest";

import { comTransacaoRevertida } from "./conexao";
import { descreveComBanco } from "./setup";
import {
  criarItemDeSessao,
  criarSessao,
  inserirTentativa,
  novoAluno,
  questaoParaResponder,
} from "./aluno";

/**
 * SPEC 05 · T45 — as tabelas mutaveis que cercam o log (ALUNO-04 AC3, AD-043).
 */

descreveComBanco("sessao e itens da sessao", () => {
  it("nao aceita duas questoes na mesma ordem nem a mesma questao duas vezes", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = novoAluno();
      const sessao = await criarSessao(cliente, aluno);
      const a = await questaoParaResponder(cliente);
      const b = await questaoParaResponder(cliente);
      await criarItemDeSessao(cliente, sessao, a, 1);

      await cliente.query("savepoint mesma_ordem");
      await expect(criarItemDeSessao(cliente, sessao, b, 1)).rejects.toThrow(
        /sessao_itens_ordem_unica/,
      );
      await cliente.query("rollback to savepoint mesma_ordem");

      // A mesma questao duas vezes tornaria o dedup ambiguo: dois itens
      // candidatos para a mesma resposta.
      await expect(criarItemDeSessao(cliente, sessao, a, 2)).rejects.toThrow(
        /sessao_itens_questao_unica/,
      );
    });
  });

  it("o dedup do duplo-clique: so o primeiro UPDATE encontra linha", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = novoAluno();
      const sessao = await criarSessao(cliente, aluno);
      const questao = await questaoParaResponder(cliente);
      const item = await criarItemDeSessao(cliente, sessao, questao);

      const primeiro = await cliente.query(
        "update public.sessao_itens set respondido_em = now() where id = $1 and respondido_em is null",
        [item],
      );
      const segundo = await cliente.query(
        "update public.sessao_itens set respondido_em = now() where id = $1 and respondido_em is null",
        [item],
      );

      expect(primeiro.rowCount).toBe(1);
      expect(segundo.rowCount).toBe(0);
    });
  });

  it("sair no meio deixa item sem resposta e nao desfaz a tentativa ja gravada", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = novoAluno();
      const sessao = await criarSessao(cliente, aluno);
      const a = await questaoParaResponder(cliente);
      const b = await questaoParaResponder(cliente);
      const item1 = await criarItemDeSessao(cliente, sessao, a, 1);
      await criarItemDeSessao(cliente, sessao, b, 2);

      await cliente.query(
        "update public.sessao_itens set respondido_em = now() where id = $1",
        [item1],
      );
      await inserirTentativa(cliente, a, { user_id: aluno, sessao_id: sessao });
      await cliente.query(
        "update public.sessoes set encerrada_em = now() where id = $1",
        [sessao],
      );

      const { rows: pendentes } = await cliente.query<{ n: string }>(
        "select count(*) as n from public.sessao_itens where sessao_id = $1 and respondido_em is null",
        [sessao],
      );
      expect(Number(pendentes[0].n)).toBe(1);

      const { rows: gravadas } = await cliente.query<{ n: string }>(
        "select count(*) as n from public.tentativas where sessao_id = $1",
        [sessao],
      );
      expect(Number(gravadas[0].n)).toBe(1);
    });
  });

  it("apagar a sessao leva os itens junto, e nao toca no log", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = novoAluno();
      const sessao = await criarSessao(cliente, aluno);
      const questao = await questaoParaResponder(cliente);
      await criarItemDeSessao(cliente, sessao, questao);
      await inserirTentativa(cliente, questao, { user_id: aluno, sessao_id: sessao });

      await cliente.query("delete from public.sessoes where id = $1", [sessao]);

      const { rows: itens } = await cliente.query<{ n: string }>(
        "select count(*) as n from public.sessao_itens where sessao_id = $1",
        [sessao],
      );
      expect(Number(itens[0].n)).toBe(0);

      // `sessao_id` nao e FK: apagar a sessao nunca pode levar o fato junto.
      const { rows: log } = await cliente.query<{ n: string }>(
        "select count(*) as n from public.tentativas where sessao_id = $1",
        [sessao],
      );
      expect(Number(log[0].n)).toBe(1);
    });
  });
});

descreveComBanco("causa do simulado — a tabela vizinha (ALUNO-04 AC3)", () => {
  it("aceita 'faltou_tempo', que `tentativas` recusa", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = novoAluno();
      const questao = await questaoParaResponder(cliente);
      const tentativa = await inserirTentativa(cliente, questao, {
        user_id: aluno,
        contexto: "simulado",
        correta: false,
        resposta_dada: "A",
      });

      await expect(
        cliente.query(
          `insert into public.tentativa_causa_simulado
             (tentativa_id, respondida_em, user_id, causa_erro)
           values ($1, $2, $3, 'faltou_tempo')`,
          [tentativa.id, tentativa.respondida_em, aluno],
        ),
      ).resolves.toBeTruthy();
    });
  });

  it("gravar a causa nao toca a linha da tentativa", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = novoAluno();
      const questao = await questaoParaResponder(cliente);
      const tentativa = await inserirTentativa(cliente, questao, {
        user_id: aluno,
        contexto: "simulado",
        correta: false,
        resposta_dada: "A",
      });

      const linha = async () => {
        const { rows } = await cliente.query(
          "select * from public.tentativas where id = $1",
          [tentativa.id],
        );
        return rows[0];
      };
      const antes = await linha();

      await cliente.query(
        `insert into public.tentativa_causa_simulado
           (tentativa_id, respondida_em, user_id, causa_erro)
         values ($1, $2, $3, 'errei_a_conta')`,
        [tentativa.id, tentativa.respondida_em, aluno],
      );

      expect(await linha()).toEqual(antes);
    });
  });

  it("uma causa por tentativa; corrigir e UPDATE aqui, nunca no fato", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = novoAluno();
      const questao = await questaoParaResponder(cliente);
      const tentativa = await inserirTentativa(cliente, questao, {
        user_id: aluno,
        contexto: "simulado",
        correta: false,
        resposta_dada: "A",
      });
      const inserir = (causa: string) =>
        cliente.query(
          `insert into public.tentativa_causa_simulado
             (tentativa_id, respondida_em, user_id, causa_erro)
           values ($1, $2, $3, $4::public.causa_erro)`,
          [tentativa.id, tentativa.respondida_em, aluno, causa],
        );

      await inserir("chutei");
      await cliente.query("savepoint segunda_causa");
      await expect(inserir("faltou_tempo")).rejects.toThrow(
        /tentativa_causa_simulado_unica/,
      );
      await cliente.query("rollback to savepoint segunda_causa");

      await expect(
        cliente.query(
          "update public.tentativa_causa_simulado set causa_erro = 'faltou_tempo' where tentativa_id = $1",
          [tentativa.id],
        ),
      ).resolves.toBeTruthy();
    });
  });

  it("a causa por default e auto-relato do aluno (AD-043)", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = novoAluno();
      const questao = await questaoParaResponder(cliente);
      const tentativa = await inserirTentativa(cliente, questao, {
        user_id: aluno,
        contexto: "simulado",
        correta: false,
        resposta_dada: "A",
      });
      const { rows } = await cliente.query<{ causa_origem: string }>(
        `insert into public.tentativa_causa_simulado
           (tentativa_id, respondida_em, user_id, causa_erro)
         values ($1, $2, $3, 'chutei') returning causa_origem`,
        [tentativa.id, tentativa.respondida_em, aluno],
      );
      expect(rows[0].causa_origem).toBe("aluno");
    });
  });

  it("nao aceita causa de tentativa que nao existe", async () => {
    await comTransacaoRevertida(async (cliente) => {
      await expect(
        cliente.query(
          `insert into public.tentativa_causa_simulado
             (tentativa_id, respondida_em, user_id, causa_erro)
           values (gen_random_uuid(), now(), gen_random_uuid(), 'chutei')`,
        ),
      ).rejects.toThrow(/tentativa_causa_simulado_tentativa_fk/);
    });
  });
});

descreveComBanco("RLS das tabelas de sessao", () => {
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

  it("as tres tabelas tem RLS ligada e nenhuma aceita TRUNCATE do navegador", async () => {
    await comTransacaoRevertida(async (cliente) => {
      for (const tabela of ["sessoes", "sessao_itens", "tentativa_causa_simulado"]) {
        const { rows } = await cliente.query<{ ligada: boolean }>(
          "select relrowsecurity as ligada from pg_class where oid = ('public.' || $1)::regclass",
          [tabela],
        );
        expect(rows[0].ligada, `RLS desligada em ${tabela}`).toBe(true);

        const { rows: grants } = await cliente.query<{ p: string }>(
          `select privilege_type as p from information_schema.role_table_grants
            where table_schema = 'public' and table_name = $1
              and grantee in ('anon','authenticated')`,
          [tabela],
        );
        expect(grants.map((g) => g.p)).not.toContain("TRUNCATE");
      }
    });
  });

  it("o aluno nao enxerga a sessao do vizinho, nem os itens dela", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const eu = novoAluno();
      const vizinho = novoAluno();
      const questao = await questaoParaResponder(cliente);
      const minha = await criarSessao(cliente, eu);
      const dele = await criarSessao(cliente, vizinho);
      await criarItemDeSessao(cliente, minha, questao);
      await criarItemDeSessao(cliente, dele, questao);

      await comoAluno(cliente, eu, async () => {
        const { rows: sessoes } = (await cliente.query(
          "select id from public.sessoes",
        )) as { rows: { id: string }[] };
        expect(sessoes.map((s) => s.id)).toEqual([minha]);

        const { rows: itens } = (await cliente.query(
          "select sessao_id from public.sessao_itens",
        )) as { rows: { sessao_id: string }[] };
        expect(itens.map((i) => i.sessao_id)).toEqual([minha]);
      });
    });
  });

  it("o aluno nao consegue por item na sessao do vizinho", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const eu = novoAluno();
      const vizinho = novoAluno();
      const questao = await questaoParaResponder(cliente);
      const dele = await criarSessao(cliente, vizinho);

      await comoAluno(cliente, eu, async () => {
        await expect(
          criarItemDeSessao(cliente as never, dele, questao),
        ).rejects.toThrow(/row-level security/);
      });
    });
  });
});
