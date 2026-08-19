import { expect, it } from "vitest";

import { inserirQuestao } from "./acervo";
import { comTransacaoRevertida } from "./conexao";
import { comoAluno, criarMatricula, criarUsuario, idDoProdutoUnico } from "./conta";
import { descreveComBanco } from "./setup";

/**
 * A matricula como **unica** chave do conteudo pago (PAG-01, PAG-06 AC2).
 *
 * Todo teste daqui roda dentro de `comoAluno`, com `set local role
 * authenticated`. Sem isso a consulta roda como dono do banco, que ignora RLS —
 * e um teste de paywall que ignora RLS passa sempre e nao prova nada.
 */
descreveComBanco("matricula e paywall", () => {
  it("deriva 12 meses do produto, sem constante no codigo (PAG-06 AC1)", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = await criarUsuario(cliente);
      const matricula = await criarMatricula(cliente, aluno, {
        inicio_em: "2026-03-01T12:00:00Z",
      });

      expect(matricula.fim_em.toISOString()).toBe("2027-03-01T12:00:00.000Z");
      expect(matricula.estado).toBe("ativa");
    });
  });

  it("um aluno nao tem duas matriculas ativas (PAG-01)", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = await criarUsuario(cliente);
      await criarMatricula(cliente, aluno);

      await expect(criarMatricula(cliente, aluno)).rejects.toThrow(
        /matriculas_uma_ativa_por_aluno/,
      );
    });
  });

  it("o historico de matriculas encerradas do mesmo aluno cabe", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = await criarUsuario(cliente);
      // Volta no ano seguinte (AD-055): a vencida fica, a nova nasce ativa.
      await criarMatricula(cliente, aluno, {
        estado: "vencida",
        inicio_em: "2025-01-01T00:00:00Z",
        fim_em: "2026-01-01T00:00:00Z",
      });
      const nova = await criarMatricula(cliente, aluno);

      expect(nova.estado).toBe("ativa");
    });
  });

  it("aluno sem matricula nao le nenhuma questao — nem parcialmente", async () => {
    await comTransacaoRevertida(async (cliente) => {
      await inserirQuestao(cliente);
      const aluno = await criarUsuario(cliente);

      await comoAluno(cliente, aluno, async () => {
        const { rows } = await cliente.query<{ n: string }>(
          "select count(*)::text as n from public.questoes",
        );
        // Zero, e nao "algumas": o AC6 do m8 §P1 proibe conteudo parcial.
        expect(rows[0].n).toBe("0");
      });
    });
  });

  it("aluno com matricula ativa le o acervo", async () => {
    await comTransacaoRevertida(async (cliente) => {
      await inserirQuestao(cliente);
      const aluno = await criarUsuario(cliente);
      await criarMatricula(cliente, aluno);

      await comoAluno(cliente, aluno, async () => {
        const { rows } = await cliente.query<{ n: number }>(
          "select count(*)::int as n from public.questoes",
        );
        expect(rows[0].n).toBeGreaterThan(0);
      });
    });
  });

  /**
   * O caso frio da lição da SPEC 06: comparar **presente contra ausente**. Uma
   * matricula que existe mas venceu tem que fechar a porta igual a que nao
   * existe — e e o ramo que um teste so de "tem/nao tem" nunca visita.
   */
  it("matricula vencida no relogio fecha a porta igual (PAG-06/AD-055)", async () => {
    await comTransacaoRevertida(async (cliente) => {
      await inserirQuestao(cliente);
      const aluno = await criarUsuario(cliente);
      await criarMatricula(cliente, aluno, {
        estado: "ativa",
        inicio_em: "2024-01-01T00:00:00Z",
        fim_em: "2025-01-01T00:00:00Z",
      });

      await comoAluno(cliente, aluno, async () => {
        const { rows } = await cliente.query<{ tem: boolean; n: string }>(
          "select public.tem_matricula_ativa() as tem, (select count(*)::text from public.questoes) as n",
        );
        expect(rows[0].tem).toBe(false);
        expect(rows[0].n).toBe("0");
      });
    });
  });

  it("matricula reembolsada fecha a porta (PAG-03 AC3)", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = await criarUsuario(cliente);
      await criarMatricula(cliente, aluno, { estado: "reembolsada" });

      await comoAluno(cliente, aluno, async () => {
        const { rows } = await cliente.query<{ tem: boolean }>(
          "select public.tem_matricula_ativa() as tem",
        );
        expect(rows[0].tem).toBe(false);
      });
    });
  });

  it("aluno A nao le a matricula do aluno B (RLS)", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const a = await criarUsuario(cliente);
      const b = await criarUsuario(cliente);
      await criarMatricula(cliente, a);
      await criarMatricula(cliente, b);

      await comoAluno(cliente, a, async () => {
        const { rows } = await cliente.query<{ user_id: string }>(
          "select user_id from public.matriculas",
        );
        expect(rows.map((l) => l.user_id)).toEqual([a]);
      });
    });
  });

  it("aluno nao escreve a propria matricula: seria o 2o mecanismo de liberacao", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = await criarUsuario(cliente);
      const produto = await idDoProdutoUnico(cliente);

      await comoAluno(cliente, aluno, async () => {
        // Savepoint porque o INSERT recusado aborta a transacao inteira, e o
        // `reset role` do fim de `comoAluno` nao rodaria mais.
        await cliente.query("savepoint tentativa_de_escrita");
        await expect(
          cliente.query(
            "insert into public.matriculas (user_id, produto_id) values ($1, $2)",
            [aluno, produto],
          ),
        ).rejects.toThrow(/permission denied|violates row-level security/i);
        await cliente.query("rollback to savepoint tentativa_de_escrita");
      });
    });
  });

  /**
   * `tem_matricula_ativa()` **nao aceita** o titular por parametro: le
   * `auth.uid()` por dentro. E o contrato nº 11 do STATE, que nasceu do gap
   * Major da SPEC 06. Se alguem acrescentar uma sobrecarga com argumento, um
   * aluno passa a poder perguntar pela matricula do outro — e este teste cai.
   */
  it("tem_matricula_ativa nao aceita titular de fora (contrato nº 11)", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows } = await cliente.query<{ args: string }>(
        `select pg_get_function_identity_arguments(p.oid) as args
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = 'tem_matricula_ativa'`,
      );

      expect(rows).toHaveLength(1);
      expect(rows[0].args).toBe("");
    });
  });

  it("produtos e legivel sem matricula: a pagina de vendas precisa dele", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = await criarUsuario(cliente);

      await comoAluno(cliente, aluno, async () => {
        const { rows } = await cliente.query<{ codigo: string }>(
          "select codigo from public.produtos",
        );
        expect(rows.map((l) => l.codigo)).toContain("anual-unico");
      });
    });
  });

  it("anon nao le o acervo em nenhuma hipotese", async () => {
    await comTransacaoRevertida(async (cliente) => {
      await inserirQuestao(cliente);
      await cliente.query("set local role anon");
      try {
        const { rows } = await cliente.query<{ n: string }>(
          "select count(*)::text as n from public.questoes",
        );
        expect(rows[0].n).toBe("0");
      } finally {
        await cliente.query("reset role");
      }
    });
  });
});
