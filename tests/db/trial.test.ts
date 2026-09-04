import { expect, it } from "vitest";

import { comTransacaoRevertida } from "./conexao";
import { criarMatricula, criarUsuario, idDoProduto } from "./conta";
import { descreveComBanco } from "./setup";

/**
 * O trial **e uma matricula** (AD-133).
 *
 * O que este arquivo prova, e o que ele deliberadamente **nao** prova: nada
 * aqui toca `tem_matricula_ativa()`. A liberacao continua sendo uma pergunta so.
 * O que nasce e uma segunda pergunta, de **escopo**: paga ou trial?
 */
descreveComBanco("trial · produto com prazo em dias e matricula com tipo", () => {
  it("matricula de trial sai com 7 dias e tipo='trial'", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = await criarUsuario(cliente);
      const matricula = await criarMatricula(cliente, aluno, {
        produto: "trial-7d",
        inicio_em: "2026-03-01T12:00:00Z",
      });

      expect(matricula.tipo).toBe("trial");
      expect(matricula.fim_em.toISOString()).toBe("2026-03-08T12:00:00.000Z");
    });
  });

  it("a matricula paga continua com 12 meses e tipo='pago'", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = await criarUsuario(cliente);
      const matricula = await criarMatricula(cliente, aluno, {
        inicio_em: "2026-03-01T12:00:00Z",
      });

      expect(matricula.tipo).toBe("pago");
      expect(matricula.fim_em.toISOString()).toBe("2027-03-01T12:00:00.000Z");
    });
  });

  it("o tipo vem do produto, nao do que o chamador mandou", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = await criarUsuario(cliente);
      const { rows } = await cliente.query<{ tipo: string }>(
        `insert into public.matriculas (user_id, produto_id, tipo)
         values ($1, $2, 'pago')
         returning tipo::text`,
        [aluno, await idDoProduto(cliente, "trial-7d")],
      );

      expect(rows[0].tipo).toBe("trial");
    });
  });

  it("trocar o tipo de uma matricula existente e recusado", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = await criarUsuario(cliente);
      const matricula = await criarMatricula(cliente, aluno, { produto: "trial-7d" });

      await expect(
        cliente.query("update public.matriculas set tipo = 'pago' where id = $1", [
          matricula.id,
        ]),
      ).rejects.toThrow(/tipo_de_matricula_e_imutavel/);
    });
  });

  it("produto com os dois prazos, ou com nenhum, e recusado", async () => {
    await comTransacaoRevertida(async (cliente) => {
      await cliente.query("savepoint dois_prazos");
      await expect(
        cliente.query(
          `insert into public.produtos (codigo, nome, tipo, meses_de_acesso, dias_de_acesso)
           values ('teste-dois-prazos', 'x', 'pago', 12, 7)`,
        ),
      ).rejects.toThrow(/produtos_prazo_exclusivo/);
      await cliente.query("rollback to savepoint dois_prazos");

      await expect(
        cliente.query(
          `insert into public.produtos (codigo, nome, tipo, meses_de_acesso, dias_de_acesso)
           values ('teste-sem-prazo', 'x', 'pago', null, null)`,
        ),
      ).rejects.toThrow(/produtos_prazo_exclusivo/);
    });
  });

  it("as matriculas que ja existiam ficaram todas com tipo='pago'", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows } = await cliente.query<{ n: string }>(
        `select count(*)::text as n
           from public.matriculas m
           join public.produtos p on p.id = m.produto_id
          where p.codigo = 'anual-unico' and m.tipo <> 'pago'`,
      );
      expect(rows[0].n).toBe("0");
    });
  });
});
