import { expect, it } from "vitest";

import { comTransacaoRevertida } from "./conexao";
import { novoAluno } from "./aluno";
import { descreveComBanco } from "./setup";

descreveComBanco("progresso acionável — concorrência da refação", () => {
  it("permite uma sessão aberta por filtro e libera nova refação depois do fechamento", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = novoAluno();
      const chave = "11111111-1111-4111-8111-111111111111|errei_a_conta";

      await cliente.query(
        `insert into public.sessoes (user_id, contexto, refacao_chave)
         values ($1, 'treino', $2)`,
        [aluno, chave],
      );

      await expect(
        cliente.query(
          `insert into public.sessoes (user_id, contexto, refacao_chave)
           values ($1, 'treino', $2)`,
          [aluno, chave],
        ),
      ).rejects.toThrow(/sessoes_uma_refacao_aberta|duplicate key/);

      await cliente.query(
        `update public.sessoes
            set encerrada_em = now()
          where user_id = $1 and refacao_chave = $2`,
        [aluno, chave],
      );

      await expect(
        cliente.query(
          `insert into public.sessoes (user_id, contexto, refacao_chave)
           values ($1, 'treino', $2)`,
          [aluno, chave],
        ),
      ).resolves.toBeTruthy();
    });
  });
});
