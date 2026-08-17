import { expect, it } from "vitest";

import { comTransacaoRevertida } from "./conexao";
import { descreveComBanco } from "./setup";
import { criarItemDeSessao, criarSessao, novoAluno, questaoParaResponder } from "./aluno";

/**
 * SPEC 05 · T46 — `registrar_tentativa` contra o banco de verdade
 * (ALUNO-01 AC2, ALUNO-03 AC1, edge case do duplo-clique).
 */

type Registro = {
  tentativa_id: string;
  respondida_em: string;
  correta: boolean;
  duplicada: boolean;
};

async function registrar(
  cliente: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
  args: {
    userId: string;
    itemId: string;
    contexto?: string;
    resposta?: string;
    tempoMs?: number | null;
    marcouChute?: boolean;
    causa?: string | null;
  },
): Promise<Registro> {
  const { rows } = (await cliente.query(
    `select tentativa_id, respondida_em::text, correta, duplicada
       from public.registrar_tentativa(
         $1, $2, $3::public.contexto_tentativa, $4, $5, $6, $7::public.causa_erro)`,
    [
      args.userId,
      args.itemId,
      args.contexto ?? "plano",
      args.resposta ?? "C",
      args.tempoMs ?? null,
      args.marcouChute ?? false,
      args.causa ?? null,
    ],
  )) as { rows: Registro[] };
  return rows[0];
}

descreveComBanco("registrar_tentativa — snapshot congelado (ALUNO-01 AC2)", () => {
  it("grava o snapshot inteiro lido da questao no momento da resposta", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = novoAluno();
      const questao = await questaoParaResponder(cliente, { dificuldade: 4 });
      const sessao = await criarSessao(cliente, aluno);
      const item = await criarItemDeSessao(cliente, sessao, questao);

      const registro = await registrar(cliente, { userId: aluno, itemId: item });

      const { rows } = await cliente.query<Record<string, unknown>>(
        "select * from public.tentativas where id = $1",
        [registro.tentativa_id],
      );
      const linha = rows[0];
      expect(linha.materia_id).toBe(questao.materia_id);
      expect(linha.materia_rotulo).toBe(questao.materia_rotulo);
      expect(linha.topico_id).toBe(questao.topico_id);
      expect(linha.topico_rotulo).toBe(questao.topico_rotulo);
      expect(linha.banca).toBe(questao.banca);
      expect(linha.tipo_questao).toBe(questao.tipo_questao);
      expect(linha.dificuldade).toBe(4);
      expect(linha.origem).toBe("real");
      expect(linha.questao_id).toBe(questao.questao_id);
      expect(linha.questao_versao).toBe(questao.questao_versao);
      expect(linha.sessao_id).toBe(sessao);
      expect(linha.ordem_na_sessao).toBe(1);
    });
  });

  it("o gabarito vem do banco: a mesma resposta e certa ou errada conforme a questao", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = novoAluno();
      const questao = await questaoParaResponder(cliente); // resposta correta = 'C'
      const sessao = await criarSessao(cliente, aluno);
      const item = await criarItemDeSessao(cliente, sessao, questao);

      const certa = await registrar(cliente, {
        userId: aluno,
        itemId: item,
        resposta: "C",
      });
      expect(certa.correta).toBe(true);

      const outra = await questaoParaResponder(cliente);
      const item2 = await criarItemDeSessao(cliente, sessao, outra, 2);
      const errada = await registrar(cliente, {
        userId: aluno,
        itemId: item2,
        resposta: "A",
        contexto: "plano",
      });
      expect(errada.correta).toBe(false);
    });
  });

  it("carimba causa_origem='aluno' quando a causa vem junto (AD-043)", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = novoAluno();
      const questao = await questaoParaResponder(cliente);
      const sessao = await criarSessao(cliente, aluno, "treino");
      const item = await criarItemDeSessao(cliente, sessao, questao);

      const registro = await registrar(cliente, {
        userId: aluno,
        itemId: item,
        contexto: "treino",
        resposta: "A",
        causa: "errei_a_conta",
      });
      expect(registro.correta).toBe(false);

      const { rows } = await cliente.query<{
        causa_erro: string;
        causa_origem: string;
      }>("select causa_erro, causa_origem from public.tentativas where id = $1", [
        registro.tentativa_id,
      ]);
      expect(rows[0].causa_erro).toBe("errei_a_conta");
      expect(rows[0].causa_origem).toBe("aluno");
    });
  });

  it("resposta certa nao carimba causa_origem", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = novoAluno();
      const questao = await questaoParaResponder(cliente);
      const sessao = await criarSessao(cliente, aluno);
      const item = await criarItemDeSessao(cliente, sessao, questao);

      const registro = await registrar(cliente, { userId: aluno, itemId: item });
      const { rows } = await cliente.query<{ causa_origem: string | null }>(
        "select causa_origem from public.tentativas where id = $1",
        [registro.tentativa_id],
      );
      expect(rows[0].causa_origem).toBeNull();
    });
  });
});

descreveComBanco("registrar_tentativa — dedup do duplo-clique", () => {
  it("dois cliques produzem UMA tentativa, e o segundo devolve a existente", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = novoAluno();
      const questao = await questaoParaResponder(cliente);
      const sessao = await criarSessao(cliente, aluno);
      const item = await criarItemDeSessao(cliente, sessao, questao);

      const primeiro = await registrar(cliente, { userId: aluno, itemId: item });
      const segundo = await registrar(cliente, {
        userId: aluno,
        itemId: item,
        // Ate com resposta diferente: o segundo clique nunca reescreve o fato.
        resposta: "A",
      });

      expect(primeiro.duplicada).toBe(false);
      expect(segundo.duplicada).toBe(true);
      expect(segundo.tentativa_id).toBe(primeiro.tentativa_id);

      const { rows } = await cliente.query<{ n: string; resposta_dada: string }>(
        "select count(*) as n, min(resposta_dada) as resposta_dada from public.tentativas where sessao_id = $1",
        [sessao],
      );
      expect(Number(rows[0].n)).toBe(1);
      expect(rows[0].resposta_dada).toBe("C");
    });
  });

  it("o item fica marcado como respondido depois do primeiro clique", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = novoAluno();
      const questao = await questaoParaResponder(cliente);
      const sessao = await criarSessao(cliente, aluno);
      const item = await criarItemDeSessao(cliente, sessao, questao);

      await registrar(cliente, { userId: aluno, itemId: item });
      const { rows } = await cliente.query<{ respondido_em: string | null }>(
        "select respondido_em from public.sessao_itens where id = $1",
        [item],
      );
      expect(rows[0].respondido_em).not.toBeNull();
    });
  });

  it("errar no treino sem causa e recusado com nome proprio, ANTES do INSERT (ALUNO-03 AC1)", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = novoAluno();
      const questao = await questaoParaResponder(cliente);
      const sessao = await criarSessao(cliente, aluno, "treino");
      const item = await criarItemDeSessao(cliente, sessao, questao);

      await cliente.query("savepoint sem_causa");
      // A recusa e da funcao, com motivo nomeado — **nao** do CHECK da tabela.
      // Se fosse o CHECK, a tela receberia 'causa_obrigatoria_no_treino', que e
      // nome de constraint do Postgres e nao mensagem para o aluno.
      await expect(
        registrar(cliente, {
          userId: aluno,
          itemId: item,
          contexto: "treino",
          resposta: "A",
        }),
      ).rejects.toThrow(/causa_obrigatoria:/);
      await cliente.query("rollback to savepoint sem_causa");

      // E com a causa, passa.
      const registro = await registrar(cliente, {
        userId: aluno,
        itemId: item,
        contexto: "treino",
        resposta: "A",
        causa: "nao_sei_dizer",
      });
      expect(registro.correta).toBe(false);
      expect(registro.duplicada).toBe(false);
    });
  });

  it("acertar no treino sem causa passa — a exigencia e so no erro", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = novoAluno();
      const questao = await questaoParaResponder(cliente);
      const sessao = await criarSessao(cliente, aluno, "treino");
      const item = await criarItemDeSessao(cliente, sessao, questao);

      const registro = await registrar(cliente, {
        userId: aluno,
        itemId: item,
        contexto: "treino",
        resposta: "C",
      });
      expect(registro.correta).toBe(true);
    });
  });

  it("errar sem causa fora do treino passa — diagnostico e simulado nao interrompem", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = novoAluno();
      const sessao = await criarSessao(cliente, aluno, "simulado");
      for (const [i, contexto] of (["diagnostico", "simulado"] as const).entries()) {
        const questao = await questaoParaResponder(cliente);
        const item = await criarItemDeSessao(cliente, sessao, questao, i + 1);
        const registro = await registrar(cliente, {
          userId: aluno,
          itemId: item,
          contexto,
          resposta: "A",
        });
        expect(registro.correta).toBe(false);
      }
    });
  });

  it("um INSERT recusado devolve o item ao estado de nao respondido", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = novoAluno();
      const questao = await questaoParaResponder(cliente);
      const sessao = await criarSessao(cliente, aluno, "treino");
      const item = await criarItemDeSessao(cliente, sessao, questao);

      // Erro no treino sem causa: a funcao recusa depois de ja ter marcado o
      // item. Se o dedup e a recusa nao fossem atomicos, o item ficaria
      // respondido para sempre e o aluno perderia a questao.
      await cliente.query("savepoint recusa");
      await expect(
        registrar(cliente, {
          userId: aluno,
          itemId: item,
          contexto: "treino",
          resposta: "A",
        }),
      ).rejects.toThrow(/causa_obrigatoria/);
      await cliente.query("rollback to savepoint recusa");

      const { rows } = await cliente.query<{ respondido_em: string | null }>(
        "select respondido_em from public.sessao_itens where id = $1",
        [item],
      );
      expect(rows[0].respondido_em).toBeNull();

      // E o aluno consegue responder de novo, agora com causa.
      const registro = await registrar(cliente, {
        userId: aluno,
        itemId: item,
        contexto: "treino",
        resposta: "A",
        causa: "nao_sei_dizer",
      });
      expect(registro.duplicada).toBe(false);
    });
  });
});

descreveComBanco("registrar_tentativa — de quem e a sessao", () => {
  it("recusa gravar num item de sessao de outro aluno", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const dono = novoAluno();
      const intruso = novoAluno();
      const questao = await questaoParaResponder(cliente);
      const sessao = await criarSessao(cliente, dono);
      const item = await criarItemDeSessao(cliente, sessao, questao);

      await cliente.query("savepoint intruso");
      await expect(
        registrar(cliente, { userId: intruso, itemId: item }),
      ).rejects.toThrow(/item_inexistente/);
      await cliente.query("rollback to savepoint intruso");

      const { rows } = await cliente.query<{ n: string }>(
        "select count(*) as n from public.tentativas where sessao_id = $1",
        [sessao],
      );
      expect(Number(rows[0].n)).toBe(0);
    });
  });

  it("recusa item que nao existe", async () => {
    await comTransacaoRevertida(async (cliente) => {
      await expect(
        registrar(cliente, {
          userId: novoAluno(),
          itemId: "99999999-9999-9999-9999-999999999999",
        }),
      ).rejects.toThrow(/item_inexistente/);
    });
  });

  it("nao e chamavel por anon", async () => {
    await comTransacaoRevertida(async (cliente) => {
      await cliente.query("set local role anon");
      await expect(
        cliente.query(
          `select * from public.registrar_tentativa(
             gen_random_uuid(), gen_random_uuid(), 'plano', 'C')`,
        ),
      ).rejects.toThrow(/permission denied/);
    });
  });
});
