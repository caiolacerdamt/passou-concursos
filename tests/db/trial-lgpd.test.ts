import type { Client } from "pg";
import { expect, it } from "vitest";

import { inserirTentativa, questaoParaResponder } from "./aluno";
import { comTransacaoRevertida } from "./conexao";
import { criarMatricula, criarUsuario } from "./conta";
import { descreveComBanco } from "./setup";

/**
 * O lead de trial e titular do grupo 1 (AD-133, item 9).
 *
 * Ate este plano, **todo** titular no banco era alguem que pagou, e todos os
 * fixtures de esquecimento tinham pagamento. A conta gratuita inaugura o
 * caminho oposto. A cobertura do inventario fechado de
 * `apagar_dados_do_usuario` nao deveria mudar — mas provar, nao supor.
 */

async function contarGrupo1(cliente: Client, aluno: string): Promise<number> {
  const { rows } = await cliente.query<{ n: string }>(
    `select coalesce(sum(n), 0)::text as n
       from public.contar_dados_grupo1_esquecimento($1)`,
    [aluno],
  );
  return Number(rows[0].n);
}

/** Um lead com o rastro tipico: matricula de trial, sessao e uma resposta. */
async function leadDeTrial(cliente: Client): Promise<string> {
  const aluno = await criarUsuario(cliente);
  await criarMatricula(cliente, aluno, { produto: "trial-7d" });

  const questao = await questaoParaResponder(cliente);
  const { rows: sessao } = await cliente.query<{ id: string }>(
    "insert into public.sessoes (user_id, contexto) values ($1, 'plano') returning id",
    [aluno],
  );
  await inserirTentativa(cliente, questao, {
    user_id: aluno,
    sessao_id: sessao[0].id,
  });

  return aluno;
}

descreveComBanco("trial · LGPD do lead que nunca pagou", () => {
  it("o apagamento alcanca a conta que nunca teve pagamento", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = await leadDeTrial(cliente);

      expect(await contarGrupo1(cliente, aluno)).toBeGreaterThan(0);

      await cliente.query("select public.apagar_dados_do_usuario($1)", [aluno]);

      // O pedido fica na fila ate a confirmacao externa (DADOS-04/AD-105);
      // fora ele, nao pode sobrar nada.
      const { rows } = await cliente.query<{ tabela: string; n: string }>(
        `select tabela, n::text as n
           from public.contar_dados_grupo1_esquecimento($1)
          where n > 0`,
        [aluno],
      );
      expect(rows.map((l) => l.tabela)).toEqual(["solicitacoes_esquecimento"]);
    });
  });
});

descreveComBanco("trial · candidatos a retencao do lead", () => {
  it("lista quem testou, nunca pagou e passou da janela", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = await criarUsuario(cliente);
      await criarMatricula(cliente, aluno, {
        produto: "trial-7d",
        estado: "vencida",
        inicio_em: "2024-01-01T00:00:00Z",
        fim_em: "2024-01-08T00:00:00Z",
      });

      const { rows } = await cliente.query<{ user_id: string }>(
        "select user_id from public.candidatos_a_retencao_do_trial(6)",
      );
      expect(rows.map((l) => l.user_id)).toContain(aluno);
    });
  });

  it("quem pagou depois volta para a janela de 24 meses e sai da lista", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = await criarUsuario(cliente);
      await criarMatricula(cliente, aluno, {
        produto: "trial-7d",
        estado: "encerrada",
        inicio_em: "2024-01-01T00:00:00Z",
        fim_em: "2024-01-08T00:00:00Z",
      });
      await criarMatricula(cliente, aluno, {
        estado: "vencida",
        inicio_em: "2024-01-08T00:00:00Z",
        fim_em: "2025-01-08T00:00:00Z",
      });

      const { rows } = await cliente.query<{ user_id: string }>(
        "select user_id from public.candidatos_a_retencao_do_trial(6)",
      );
      expect(rows.map((l) => l.user_id)).not.toContain(aluno);
    });
  });

  it("trial recente nao entra na lista", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = await criarUsuario(cliente);
      await criarMatricula(cliente, aluno, { produto: "trial-7d" });

      const { rows } = await cliente.query<{ user_id: string }>(
        "select user_id from public.candidatos_a_retencao_do_trial(6)",
      );
      expect(rows.map((l) => l.user_id)).not.toContain(aluno);
    });
  });

  it("a janela sai da configuracao quando o parametro nao e passado", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = await criarUsuario(cliente);
      await criarMatricula(cliente, aluno, {
        produto: "trial-7d",
        estado: "vencida",
        // Tres meses atras: dentro da janela de 6, fora de uma de 1.
        inicio_em: new Date(Date.now() - 95 * 24 * 3600 * 1000).toISOString(),
        fim_em: new Date(Date.now() - 88 * 24 * 3600 * 1000).toISOString(),
      });

      const padrao = await cliente.query<{ user_id: string }>(
        "select user_id from public.candidatos_a_retencao_do_trial()",
      );
      expect(padrao.rows.map((l) => l.user_id)).not.toContain(aluno);

      const autor = await criarUsuario(cliente);
      await cliente.query(
        `insert into public.configuracoes (chave, valor, modulo_dono, alterado_por, motivo)
         values ('param.m7.retencao_trial_meses', '1'::jsonb, 'm7', $1, 'teste da janela')`,
        [autor],
      );

      const apertada = await cliente.query<{ user_id: string }>(
        "select user_id from public.candidatos_a_retencao_do_trial()",
      );
      expect(apertada.rows.map((l) => l.user_id)).toContain(aluno);
    });
  });
});
