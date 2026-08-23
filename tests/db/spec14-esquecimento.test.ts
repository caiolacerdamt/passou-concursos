import type { Client } from "pg";
import { expect, it } from "vitest";

import { inserirTentativa, comoAluno, questaoParaResponder } from "./aluno";
import { criarMatricula, criarUsuario, idDoProdutoUnico } from "./conta";
import { comTransacaoRevertida } from "./conexao";
import { descreveComBanco } from "./setup";

async function criarPagamento(
  cliente: Client,
  aluno: string,
): Promise<{ id: string; matriculaId: string }> {
  const matricula = await criarMatricula(cliente, aluno);
  const produto = await idDoProdutoUnico(cliente);
  const { rows } = await cliente.query<{ id: string }>(
    `insert into public.pagamentos
       (produto_id, email, valor_centavos, meio, parcelas, referencia_interna,
        user_id, matricula_id)
     values ($1, $2, 19700, 'PIX', 1, $3, $4, $5)
     returning id`,
    [
      produto,
      `apagamento-${crypto.randomUUID()}@exemplo.test`,
      `apagamento-${crypto.randomUUID()}`,
      aluno,
      matricula.id,
    ],
  );

  await cliente.query(
    `insert into public.pagamento_aceites
       (pagamento_id, maior_de_idade, termos_versao, aceito_em)
     values ($1, true, 'termos-spec14', now())`,
    [rows[0].id],
  );
  await cliente.query(
    "insert into public.faturas (pagamento_id, estado) values ($1, 'emitida')",
    [rows[0].id],
  );
  await cliente.query(
    `insert into public.pagamento_resultado_tokens
       (pagamento_id, token_hash, expira_em)
     values ($1, $2, now() + interval '48 hours')`,
    [rows[0].id, crypto.randomUUID().replaceAll("-", "").padEnd(64, "a")],
  );
  await cliente.query(
    "select public.registrar_pagamento_evento($1, 'PAYMENT_CONFIRMED', null, $2, 'recebido')",
    [`apagamento-evento-${crypto.randomUUID()}`, rows[0].id],
  );
  await cliente.query(
    "select public.mudar_estado_pagamento($1, 'confirmada'::public.pagamento_estado, null)",
    [rows[0].id],
  );

  return { id: rows[0].id, matriculaId: matricula.id };
}

async function criarGrupoOperacional(cliente: Client, aluno: string): Promise<{
  pagamento: { id: string; matriculaId: string };
}> {
  const questao = await questaoParaResponder(cliente);
  const sessao = await cliente.query<{ id: string }>(
    `insert into public.sessoes (user_id, contexto)
     values ($1, 'treino') returning id`,
    [aluno],
  );
  await inserirTentativa(cliente, questao, {
    user_id: aluno,
    sessao_id: sessao.rows[0].id,
    contexto: "treino",
    correta: false,
    resposta_dada: "A",
    causa_erro: "errei_a_conta",
    causa_origem: "aluno",
  });

  const simulado = await inserirTentativa(cliente, questao, {
    user_id: aluno,
    sessao_id: sessao.rows[0].id,
    contexto: "simulado",
    correta: false,
    resposta_dada: "B",
  });
  await cliente.query(
    `insert into public.tentativa_causa_simulado
       (tentativa_id, respondida_em, user_id, causa_erro)
     values ($1, $2::timestamptz, $3, 'faltou_tempo')`,
    [simulado.id, simulado.respondida_em, aluno],
  );

  // Fixture de tamanho próximo ao critério de sucesso: o apagamento precisa
  // remover o conjunto inteiro, não apenas uma amostra de duas tentativas.
  for (let indice = 0; indice < 28; indice += 1) {
    await inserirTentativa(cliente, questao, {
      user_id: aluno,
      contexto: "treino",
      ordem_na_sessao: indice + 1,
      correta: false,
      resposta_dada: "A",
      causa_erro: "fiquei_na_duvida",
      causa_origem: "aluno",
    });
  }

  await cliente.query(
    `insert into public.dominio_topico
       (user_id, topico_id, n_respostas, n_acertos, n_chute_certo, score)
     values ($1, $2, 2, 0, 0, 0.1)`,
    [aluno, questao.topico_id],
  );
  await cliente.query(
    `insert into public.caderno_erros
       (user_id, topico_id, causa_erro, n_erros, ultimo_erro_em)
     values ($1, $2, 'errei_a_conta', 1, now())`,
    [aluno, questao.topico_id],
  );
  await cliente.query(
    `insert into public.revisao_agenda
       (user_id, topico_id, algoritmo, due)
     values ($1, $2, 'fsrs', current_date)`,
    [aluno, questao.topico_id],
  );
  await cliente.query(
    `insert into public.revisao_evento
       (user_id, topico_id, nota, percentual)
     values ($1, $2, 2, 0.4)`,
    [aluno, questao.topico_id],
  );

  await cliente.query(
    `insert into public.perfil_estudo
       (user_id, minutos_por_dia, dias_estudo, onboarding_concluido)
     values ($1, 60, '{1,2,3,4,5}', true)`,
    [aluno],
  );
  const plano = await cliente.query<{ id: string }>(
    "insert into public.plano_dia (user_id, data) values ($1, '2026-08-21') returning id",
    [aluno],
  );
  await cliente.query(
    `insert into public.plano_bloco
       (plano_dia_id, tipo, nivel, ordem, minutos_estimados)
     values ($1, 'revisar', 'piso', 1, 20)`,
    [plano.rows[0].id],
  );
  await cliente.query(
    `insert into public.sequencia_dia
       (user_id, data, agendado, folga, piso_entregue, piso_cumprido, estado, sequencia)
     values ($1, '2026-08-21', true, false, true, true, 'cumprido', 1)`,
    [aluno],
  );
  await cliente.query(
    "insert into public.folgas_programadas (user_id, data, motivo) values ($1, '2026-08-22', 'teste')",
    [aluno],
  );

  return { pagamento: await criarPagamento(cliente, aluno) };
}

descreveComBanco("SPEC 14 — porta de esquecimento e retenção mínima", () => {
  it("apaga grupo 1, retém fatura e torna o resultado transitório inválido", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = await criarUsuario(cliente);
      const { pagamento } = await criarGrupoOperacional(cliente, aluno);

      const { rows: pedido } = await cliente.query<{
        estado: string;
        dados_apagados_em: string | null;
      }>("select estado, dados_apagados_em::text from public.apagar_dados_do_usuario($1)", [aluno]);
      expect(pedido[0].estado).toBe("dados_apagados");
      expect(pedido[0].dados_apagados_em).not.toBeNull();

      const { rows: financeiro } = await cliente.query<{
        user_id: string | null;
        matricula_id: string | null;
        email: string;
        asaas_cliente_id: string | null;
      }>(
        `select user_id, matricula_id, email, asaas_cliente_id
           from public.pagamentos where id = $1`,
        [pagamento.id],
      );
      expect(financeiro[0]).toMatchObject({
        user_id: null,
        matricula_id: null,
        asaas_cliente_id: null,
      });
      expect(financeiro[0].email).toMatch(/^apagado\+[0-9a-f-]+@invalid\.local$/);

      const { rows: retidos } = await cliente.query<{ fatura: string; aceite: string; evento: string }>(
        `select
           (select count(*)::text from public.faturas where pagamento_id = $1) as fatura,
           (select count(*)::text from public.pagamento_aceites where pagamento_id = $1) as aceite,
           (select count(*)::text from public.pagamento_eventos where pagamento_id = $1) as evento`,
        [pagamento.id],
      );
      expect(retidos[0]).toEqual({ fatura: "1", aceite: "1", evento: "1" });

      const { rows: tokens } = await cliente.query<{ n: string }>(
        "select count(*)::text as n from public.pagamento_resultado_tokens where pagamento_id = $1",
        [pagamento.id],
      );
      expect(tokens[0].n).toBe("0");

      const { rows: group1 } = await cliente.query<{ tabela: string; n: string }>(
        `select tabela, n::text
           from public.contar_dados_grupo1_esquecimento($1)
          order by tabela`,
        [aluno],
      );
      expect(group1.filter((linha) => linha.tabela !== "solicitacoes_esquecimento")
        .every((linha) => linha.n === "0")).toBe(true);
      expect(group1.find((linha) => linha.tabela === "solicitacoes_esquecimento")?.n).toBe("1");

      await cliente.query("delete from auth.users where id = $1", [aluno]);
      expect((await cliente.query("select public.finalizar_esquecimento($1)", [aluno])).rows[0].finalizar_esquecimento).toBe(true);
      const { rows: depoisDaFinalizacao } = await cliente.query<{ n: string }>(
        `select n::text from public.contar_dados_grupo1_esquecimento($1)`,
        [aluno],
      );
      expect(depoisDaFinalizacao.every((linha) => linha.n === "0")).toBe(true);
    });
  });

  it("a operação é retomável, a confirmação marca a fila e Auth vem antes da finalização", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = await criarUsuario(cliente);
      await criarGrupoOperacional(cliente, aluno);

      await cliente.query("select public.apagar_dados_do_usuario($1)", [aluno]);
      await cliente.query("select public.registrar_falha_esquecimento($1, 'resend_timeout')", [aluno]);
      await cliente.query("select public.apagar_dados_do_usuario($1)", [aluno]);

      const { rows: antesDoEmail } = await cliente.query<{ estado: string; ultima_falha_codigo: string | null }>(
        "select estado, ultima_falha_codigo from public.solicitacoes_esquecimento where user_id = $1",
        [aluno],
      );
      // O retry do apagamento recupera o pedido e limpa a falha antiga; a
      // próxima falha do provedor, se houver, será registrada de novo.
      expect(antesDoEmail[0]).toEqual({ estado: "dados_apagados", ultima_falha_codigo: null });

      await cliente.query("select public.registrar_email_esquecimento($1)", [aluno]);
      const { rows: email } = await cliente.query<{ estado: string; email_enviado_em: string | null }>(
        "select estado, email_enviado_em::text from public.solicitacoes_esquecimento where user_id = $1",
        [aluno],
      );
      expect(email[0].estado).toBe("email_enviado");
      expect(email[0].email_enviado_em).not.toBeNull();

      expect((await cliente.query<{ ok: boolean }>("select public.finalizar_esquecimento($1) as ok", [aluno])).rows[0].ok).toBe(false);

      await cliente.query("delete from auth.users where id = $1", [aluno]);
      expect((await cliente.query<{ ok: boolean }>("select public.finalizar_esquecimento($1) as ok", [aluno])).rows[0].ok).toBe(true);
      expect((await cliente.query("select 1 from public.solicitacoes_esquecimento where user_id = $1", [aluno])).rows).toHaveLength(0);
      expect((await cliente.query<{ ok: boolean }>("select public.finalizar_esquecimento($1) as ok", [aluno])).rows[0].ok).toBe(true);
    });
  });

  it("não abre a porta para authenticated nem deixa delete de log direto", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = await criarUsuario(cliente);
      await criarGrupoOperacional(cliente, aluno);

      await comoAluno(cliente, aluno, async () => {
        await expect(
          cliente.query("select public.apagar_dados_do_usuario($1)", [aluno]),
        ).rejects.toThrow(/permission denied|execute/i);
      });

      await expect(
        cliente.query("delete from public.revisao_evento where user_id = $1", [aluno]),
      ).rejects.toThrow(/porta|esquecimento/i);
    });
  });

  it("mantém o inventário de tabelas com user_id fechado contra a rotina", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows } = await cliente.query<{ tabela: string }>(
        `select c.relname as tabela
           from pg_attribute a
           join pg_class c on c.oid = a.attrelid
           join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public'
            and a.attname = 'user_id'
            and a.attnum > 0
            and not a.attisdropped
            and c.relkind in ('r', 'p')
            and not c.relispartition
          order by 1`,
      );
      expect(rows.map((linha) => linha.tabela)).toContain("solicitacoes_esquecimento");
    });
  });
});
