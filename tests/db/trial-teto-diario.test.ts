import type { Client } from "pg";
import { expect, it } from "vitest";

import {
  criarItemDeSessao,
  criarSessao,
  inserirTentativa,
  questaoParaResponder,
} from "./aluno";
import { comTransacaoRevertida } from "./conexao";
import { comoAluno, criarMatricula, criarUsuario } from "./conta";
import { descreveComBanco } from "./setup";

/**
 * O teto diario do trial (AD-133), dentro de `registrar_tentativa`.
 *
 * Tudo aqui roda com `set local role authenticated`: a funcao e
 * `security invoker`, e `tipo_da_matricula_ativa()` le `auth.uid()`. Sem o
 * papel, a consulta roda como dono do banco, `auth.uid()` vem nulo e o teto
 * nunca seria alcancado — o teste passaria sem testar nada.
 */

async function definirTeto(cliente: Client, valor: number): Promise<void> {
  const autor = await criarUsuario(cliente);
  await cliente.query(
    `insert into public.configuracoes (chave, valor, modulo_dono, alterado_por, motivo)
     values ('param.m8.trial_questoes_por_dia', $1::jsonb, 'm8', $2, 'teste do teto')`,
    [JSON.stringify(valor), autor],
  );
}

/** Aluno com matricula do tipo pedido e `quantas` questoes prontas na sessao. */
async function cenario(
  cliente: Client,
  produto: "trial-7d" | "anual-unico",
  quantas: number,
): Promise<{ aluno: string; itens: string[] }> {
  const aluno = await criarUsuario(cliente);
  await criarMatricula(cliente, aluno, { produto });

  const sessao = await criarSessao(cliente, aluno);
  const itens: string[] = [];
  for (let ordem = 1; ordem <= quantas; ordem += 1) {
    const questao = await questaoParaResponder(cliente);
    itens.push(await criarItemDeSessao(cliente, sessao, questao, ordem));
  }

  return { aluno, itens };
}

async function responder(
  cliente: Client,
  aluno: string,
  item: string,
): Promise<void> {
  await cliente.query(
    `select tentativa_id
       from public.registrar_tentativa(
         $1, $2, 'plano'::public.contexto_tentativa, 'C', null, false, null)`,
    [aluno, item],
  );
}

async function quantasTentativas(
  cliente: Client,
  aluno: string,
): Promise<number> {
  const { rows } = await cliente.query<{ n: string }>(
    "select count(*)::text as n from public.tentativas where user_id = $1",
    [aluno],
  );
  return Number(rows[0].n);
}

descreveComBanco("trial · teto diario de questoes", () => {
  it("a questao seguinte ao teto e recusada, e nenhuma linha nova aparece", async () => {
    await comTransacaoRevertida(async (cliente) => {
      await definirTeto(cliente, 2);
      const { aluno, itens } = await cenario(cliente, "trial-7d", 3);

      await comoAluno(cliente, aluno, async () => {
        await responder(cliente, aluno, itens[0]);
        await responder(cliente, aluno, itens[1]);

        await cliente.query("savepoint estourou");
        await expect(responder(cliente, aluno, itens[2])).rejects.toThrow(
          /trial_teto_diario/,
        );
        await cliente.query("rollback to savepoint estourou");
      });

      expect(await quantasTentativas(cliente, aluno)).toBe(2);
    });
  });

  /**
   * O erro mais provavel aqui e o teto vazar para quem pagou. Mesmo cenario,
   * outro tipo de matricula.
   */
  it("quem tem matricula paga passa do teto sem erro nenhum", async () => {
    await comTransacaoRevertida(async (cliente) => {
      await definirTeto(cliente, 2);
      const { aluno, itens } = await cenario(cliente, "anual-unico", 3);

      await comoAluno(cliente, aluno, async () => {
        for (const item of itens) {
          await responder(cliente, aluno, item);
        }
      });

      expect(await quantasTentativas(cliente, aluno)).toBe(3);
    });
  });

  it("baixar o teto na configuracao muda o comportamento sem deploy", async () => {
    await comTransacaoRevertida(async (cliente) => {
      await definirTeto(cliente, 1);
      const { aluno, itens } = await cenario(cliente, "trial-7d", 2);

      await comoAluno(cliente, aluno, async () => {
        await responder(cliente, aluno, itens[0]);

        await cliente.query("savepoint teto_um");
        await expect(responder(cliente, aluno, itens[1])).rejects.toThrow(
          /trial_teto_diario/,
        );
        await cliente.query("rollback to savepoint teto_um");
      });

      expect(await quantasTentativas(cliente, aluno)).toBe(1);
    });
  });

  it("trial_questoes_restantes_hoje dimensiona a sessao e some para quem pagou", async () => {
    await comTransacaoRevertida(async (cliente) => {
      await definirTeto(cliente, 3);

      const trial = await cenario(cliente, "trial-7d", 1);
      await comoAluno(cliente, trial.aluno, async () => {
        const antes = await cliente.query<{ n: number | null }>(
          "select public.trial_questoes_restantes_hoje() as n",
        );
        expect(antes.rows[0].n).toBe(3);

        await responder(cliente, trial.aluno, trial.itens[0]);

        const depois = await cliente.query<{ n: number | null }>(
          "select public.trial_questoes_restantes_hoje() as n",
        );
        expect(depois.rows[0].n).toBe(2);
      });

      const pago = await cenario(cliente, "anual-unico", 0);
      await comoAluno(cliente, pago.aluno, async () => {
        const { rows } = await cliente.query<{ n: number | null }>(
          "select public.trial_questoes_restantes_hoje() as n",
        );
        // `null` e "nao ha teto", que e diferente de "sobrou zero".
        expect(rows[0].n).toBeNull();
      });
    });
  });

  it("resposta de ontem nao conta para o teto de hoje", async () => {
    await comTransacaoRevertida(async (cliente) => {
      await definirTeto(cliente, 1);
      const { aluno, itens } = await cenario(cliente, "trial-7d", 1);

      // Uma resposta de anteontem. O teto conta o dia do produto
      // (America/Sao_Paulo), nao a vida inteira do aluno.
      const outra = await questaoParaResponder(cliente);
      const sessaoAntiga = await criarSessao(cliente, aluno);
      await inserirTentativa(cliente, outra, {
        user_id: aluno,
        sessao_id: sessaoAntiga,
        respondida_em: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      });

      await comoAluno(cliente, aluno, async () => {
        // Teto 1 e uma resposta antiga: a de hoje ainda precisa caber.
        await responder(cliente, aluno, itens[0]);
      });

      expect(await quantasTentativas(cliente, aluno)).toBe(2);
    });
  });
});
