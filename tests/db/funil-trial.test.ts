import type { Client } from "pg";
import { expect, it } from "vitest";

import { comTransacaoRevertida } from "./conexao";
import { comoAluno, criarMatricula, criarUsuario } from "./conta";
import { descreveComBanco } from "./setup";

/**
 * A metrica do funil, no proprio Postgres (AD-133 · item 7 do TRIAL-2).
 *
 * Os testes filtram pelos **proprios** ids em vez de contar linhas da view
 * inteira. Nao e preciosismo: a `DATABASE_URL` de desenvolvimento e o mesmo
 * banco de producao, e uma assercao sobre o total global quebra no dia em que
 * um aluno de verdade cria conta — foi exatamente o que derrubou quatro testes
 * na rodada da parte 1.
 */

type LinhaDoFunil = {
  semana: Date;
  contas_criadas: string;
  emails_confirmados: string;
  trials_concedidos: string;
  com_ao_menos_1_tentativa: string;
  com_3_dias_ativos: string;
  convertidos: string;
};

/**
 * `criarUsuario` nao preenche `auth.users.created_at` — em producao quem
 * preenche e o proprio GoTrue. Sem ele a coorte da linha e NULL e a busca por
 * semana nao acha nada, entao a fixture carimba a data aqui.
 */
async function contaDaSemana(cliente: Client): Promise<string> {
  const id = await criarUsuario(cliente);
  await cliente.query("update auth.users set created_at = now() where id = $1", [id]);
  return id;
}

/** A semana da conta recem-criada, para isolar a linha do teste. */
async function linhaDaSemanaDe(
  cliente: Client,
  userId: string,
): Promise<LinhaDoFunil> {
  const { rows } = await cliente.query<LinhaDoFunil>(
    `select f.* from public.funil_trial f
      where f.semana = (
        select date_trunc('week', u.created_at) from auth.users u where u.id = $1
      )`,
    [userId],
  );

  return rows[0];
}

descreveComBanco("funil_trial · a metrica do funil", () => {
  it("conta a conta criada e separa o e-mail confirmado do nao confirmado", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const primeira = await contaDaSemana(cliente);
      const antes = await linhaDaSemanaDe(cliente, primeira);

      // Uma conta sem confirmar e uma confirmada, na mesma semana de coorte.
      await contaDaSemana(cliente);
      const confirmado = await contaDaSemana(cliente);
      await cliente.query(
        "update auth.users set email_confirmed_at = now() where id = $1",
        [confirmado],
      );

      const depois = await linhaDaSemanaDe(cliente, primeira);

      // A conta sem confirmar continua no denominador: e justamente a perda que
      // mais importa medir, e coortar pelo trial a esconderia.
      expect(Number(depois.contas_criadas)).toBe(Number(antes.contas_criadas) + 2);
      expect(Number(depois.emails_confirmados)).toBe(
        Number(antes.emails_confirmados) + 1,
      );
    });
  });

  it("conta o trial concedido pela matricula de tipo trial", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = await contaDaSemana(cliente);
      const antes = await linhaDaSemanaDe(cliente, aluno);

      await criarMatricula(cliente, aluno, { produto: "trial-7d" });

      const depois = await linhaDaSemanaDe(cliente, aluno);

      expect(Number(depois.trials_concedidos)).toBe(
        Number(antes.trials_concedidos) + 1,
      );
    });
  });

  /**
   * A view **nao e dado de aluno**. Ela e um agregado da base inteira, e
   * `security_invoker` sozinho nao basta: sem o revoke, `authenticated` leria a
   * operacao toda de dentro do produto.
   */
  it("authenticated nao consegue ler a view", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = await criarUsuario(cliente);

      await comoAluno(cliente, aluno, async () => {
        // Savepoint: a consulta recusada aborta a transacao, e sem ele o
        // proprio `reset role` do helper falharia depois.
        await cliente.query("savepoint le_a_view");
        await expect(
          cliente.query("select * from public.funil_trial limit 1"),
        ).rejects.toThrow(/permission denied|permissão negada/i);
        await cliente.query("rollback to savepoint le_a_view");
      });
    });
  });

  it("a funcao do operador recusa quem nao esta na allowlist", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = await criarUsuario(cliente);

      await comoAluno(cliente, aluno, async () => {
        await cliente.query("savepoint chama_a_funcao");
        await expect(
          cliente.query("select * from public.funil_trial_do_operador()"),
        ).rejects.toThrow(/operador_nao_autorizado/);
        await cliente.query("rollback to savepoint chama_a_funcao");
      });
    });
  });

  it("a funcao do operador devolve as linhas para um operador ativo", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const operador = await criarUsuario(cliente);
      await cliente.query(
        "insert into public.operadores (operador_id, ativo) values ($1, true)",
        [operador],
      );

      await comoAluno(cliente, operador, async () => {
        const { rows } = await cliente.query(
          "select * from public.funil_trial_do_operador()",
        );

        expect(Array.isArray(rows)).toBe(true);
      });
    });
  });
});
