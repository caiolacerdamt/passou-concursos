import { expect, it } from "vitest";
import type { Client } from "pg";

import { inserirTentativa, questaoParaResponder } from "./aluno";
import { comTransacaoRevertida } from "./conexao";
import { comoAluno, criarUsuario } from "./conta";
import { descreveComBanco } from "./setup";

function dataDeHojeEmSaoPaulo(): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const valores = Object.fromEntries(partes.map((parte) => [parte.type, parte.value]));
  return `${valores.year}-${valores.month}-${valores.day}`;
}

async function criarPlanoComBlocos(
  cliente: Client,
  aluno: string,
  data: string,
): Promise<{
  plano: string;
  piso: string;
  meta: string;
  pisoRevisao: string;
  metaRevisao: string;
}> {
  const plano = await cliente.query<{ id: string }>(
    `insert into public.plano_dia (user_id, data) values ($1, $2) returning id`,
    [aluno, data],
  );
  const piso = await cliente.query<{ id: string }>(
    `insert into public.plano_bloco
       (plano_dia_id, tipo, nivel, ordem, n_questoes, n_questoes_cheias,
        minutos_estimados, minutos_estimados_cheios)
     values ($1, 'avancar', 'piso', 1, 1, 1, 2, 2) returning id`,
    [plano.rows[0].id],
  );
  const meta = await cliente.query<{ id: string }>(
    `insert into public.plano_bloco
       (plano_dia_id, tipo, nivel, ordem, n_questoes, n_questoes_cheias,
        minutos_estimados, minutos_estimados_cheios)
     values ($1, 'avancar', 'meta_cheia', 1, 1, 1, 2, 2) returning id`,
    [plano.rows[0].id],
  );
  const pisoRevisao = await cliente.query<{ id: string }>(
    `insert into public.plano_bloco
       (plano_dia_id, tipo, nivel, ordem, n_questoes, n_questoes_cheias,
        minutos_estimados, minutos_estimados_cheios)
     values ($1, 'revisar', 'piso', 2, 1, 1, 2, 2) returning id`,
    [plano.rows[0].id],
  );
  const metaRevisao = await cliente.query<{ id: string }>(
    `insert into public.plano_bloco
       (plano_dia_id, tipo, nivel, ordem, n_questoes, n_questoes_cheias,
        minutos_estimados, minutos_estimados_cheios)
     values ($1, 'revisar', 'meta_cheia', 2, 1, 1, 2, 2) returning id`,
    [plano.rows[0].id],
  );
  return {
    plano: plano.rows[0].id,
    piso: piso.rows[0].id,
    meta: meta.rows[0].id,
    pisoRevisao: pisoRevisao.rows[0].id,
    metaRevisao: metaRevisao.rows[0].id,
  };
}

async function fecharBlocoComTentativa(
  cliente: Client,
  aluno: string,
  bloco: string,
  data: string,
  questao: Awaited<ReturnType<typeof questaoParaResponder>>,
): Promise<void> {
  const sessao = await cliente.query<{ id: string }>(
    `insert into public.sessoes
       (user_id, contexto, plano_bloco_id, plano_dia_id, iniciada_em, encerrada_em)
     select $1, 'plano', $2, p.plano_dia_id, $3::timestamptz, $4::timestamptz
       from public.plano_bloco p where p.id = $2
     returning id`,
    [aluno, bloco, `${data}T18:00:00-03:00`, `${data}T18:10:00-03:00`],
  );
  await inserirTentativa(cliente, questao, {
    user_id: aluno,
    sessao_id: sessao.rows[0].id,
    contexto: "plano",
    respondida_em: `${data}T18:05:00-03:00`,
  });
}

descreveComBanco("W4-B — domínio de gamificação", () => {
  it("materializa anel e pontos sem premiar vazio e sem duplicar reprocessamento", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = await criarUsuario(cliente);
      const autor = await criarUsuario(cliente);
      const data = dataDeHojeEmSaoPaulo();
      await cliente.query(
        `insert into public.configuracoes
           (chave, valor, modulo_dono, alterado_por, motivo)
         values ('flag.m6.gamificacao', 'true'::jsonb, 'm6', $1, 'teste W4-B')`,
        [autor],
      );
      await cliente.query(
        `insert into public.perfil_estudo
           (user_id, minutos_por_dia, dias_estudo, onboarding_concluido)
         values ($1, 60, array[0,1,2,3,4,5,6]::smallint[], true)`,
        [aluno],
      );

      const plano = await criarPlanoComBlocos(cliente, aluno, data);
      const questao = await questaoParaResponder(cliente);
      // O piso é prioritário, a meta cheia é conclusão. Uma terceira sessão
      // vazia fica encerrada e não pode gerar ponto.
      await fecharBlocoComTentativa(cliente, aluno, plano.piso, data, questao);
      await fecharBlocoComTentativa(cliente, aluno, plano.meta, data, questao);
      await cliente.query(
        `insert into public.sessoes
           (user_id, contexto, plano_bloco_id, plano_dia_id, iniciada_em, encerrada_em)
         values ($1, 'plano', $2, $3, $4::timestamptz, $5::timestamptz)`,
        [
          aluno,
          plano.meta,
          plano.plano,
          `${data}T19:00:00-03:00`,
          `${data}T19:01:00-03:00`,
        ],
      );

      const primeiro = await cliente.query<{ n: number }>(
        "select public.materializar_gamificacao($1, $2::date) as n",
        [aluno, data],
      );
      const segundo = await cliente.query<{ n: number }>(
        "select public.materializar_gamificacao($1, $2::date) as n",
        [aluno, data],
      );
      expect(Number(primeiro.rows[0].n)).toBe(2);
      expect(Number(segundo.rows[0].n)).toBe(0);

      const pontos = await cliente.query<{
        pontos_total: number;
        estudo_prioritario: number;
        conclusao: number;
      }>(
        `select pontos_total, estudo_prioritario, conclusao
           from public.gamificacao_pontos_dia where user_id = $1 and data = $2`,
        [aluno, data],
      );
      expect(pontos.rows[0]).toMatchObject({
        pontos_total: 30,
        estudo_prioritario: 10,
        conclusao: 20,
      });

      const anel = await cliente.query<{
        estudo_meta: number;
        estudo_progresso: number;
        estudo_bruto: number;
        estudo_piso_meta: number;
        estudo_piso_progresso: number;
        questoes_meta: number;
        questoes_progresso: number;
        questoes_bruto: number;
        questoes_piso_meta: number;
        questoes_piso_progresso: number;
        revisao_meta: number;
        revisao_progresso: number;
        revisao_piso_meta: number;
        revisao_piso_progresso: number;
      }>(
        `select estudo_meta, estudo_progresso, estudo_bruto, questoes_meta,
                estudo_piso_meta, estudo_piso_progresso,
                questoes_progresso, questoes_bruto,
                questoes_piso_meta, questoes_piso_progresso,
                revisao_meta, revisao_progresso,
                revisao_piso_meta, revisao_piso_progresso
           from public.gamificacao_dia where user_id = $1 and data = $2`,
        [aluno, data],
      );
      expect(anel.rows[0]).toMatchObject({
        estudo_meta: 1,
        estudo_progresso: 1,
        estudo_bruto: 2,
        estudo_piso_meta: 1,
        estudo_piso_progresso: 1,
        questoes_meta: 2,
        questoes_progresso: 2,
        questoes_bruto: 2,
        questoes_piso_meta: 2,
        questoes_piso_progresso: 1,
        revisao_meta: 1,
        revisao_progresso: 0,
        revisao_piso_meta: 1,
        revisao_piso_progresso: 0,
      });
    });
  });

  it("mede a meta cheia e preserva o recorte do piso", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = await criarUsuario(cliente);
      const autor = await criarUsuario(cliente);
      const data = dataDeHojeEmSaoPaulo();
      await cliente.query(
        `insert into public.configuracoes
           (chave, valor, modulo_dono, alterado_por, motivo)
         values ('flag.m6.gamificacao', 'true'::jsonb, 'm6', $1, 'teste anel piso W4-B')`,
        [autor],
      );
      const plano = await criarPlanoComBlocos(cliente, aluno, data);
      const questao = await questaoParaResponder(cliente);

      // A meta cheia concluida avanca o anel inteiro.
      await fecharBlocoComTentativa(cliente, aluno, plano.meta, data, questao);
      await fecharBlocoComTentativa(cliente, aluno, plano.metaRevisao, data, questao);
      await cliente.query("select public.materializar_gamificacao($1, $2::date)", [aluno, data]);

      const antes = await cliente.query<{
        estudo_meta: number;
        estudo_progresso: number;
        estudo_bruto: number;
        questoes_meta: number;
        questoes_progresso: number;
        questoes_bruto: number;
        estudo_piso_meta: number;
        estudo_piso_progresso: number;
        questoes_piso_meta: number;
        questoes_piso_progresso: number;
        revisao_piso_meta: number;
        revisao_piso_progresso: number;
        revisao_meta: number;
        revisao_progresso: number;
        revisao_bruto: number;
      }>(
        `select estudo_meta, estudo_progresso, estudo_bruto, questoes_meta,
                questoes_progresso, questoes_bruto,
                estudo_piso_meta, estudo_piso_progresso,
                questoes_piso_meta, questoes_piso_progresso,
                revisao_piso_meta, revisao_piso_progresso,
                revisao_meta, revisao_progresso, revisao_bruto
           from public.gamificacao_dia where user_id = $1 and data = $2`,
        [aluno, data],
      );
      expect(antes.rows[0]).toMatchObject({
        estudo_meta: 1,
        estudo_progresso: 1,
        estudo_bruto: 1,
        estudo_piso_meta: 1,
        estudo_piso_progresso: 0,
        questoes_meta: 2,
        questoes_progresso: 2,
        questoes_bruto: 2,
        questoes_piso_meta: 2,
        questoes_piso_progresso: 0,
        revisao_meta: 1,
        revisao_progresso: 1,
        revisao_bruto: 1,
        revisao_piso_meta: 1,
        revisao_piso_progresso: 0,
      });

      // O recorte do piso fecha as tres dimensoes, sem alterar o progresso da
      // meta cheia que ja estava concluida.
      await fecharBlocoComTentativa(cliente, aluno, plano.piso, data, questao);
      await fecharBlocoComTentativa(cliente, aluno, plano.pisoRevisao, data, questao);
      await cliente.query("select public.materializar_gamificacao($1, $2::date)", [aluno, data]);

      const depois = await cliente.query<{
        estudo_progresso: number;
        questoes_progresso: number;
        revisao_progresso: number;
        estudo_piso_progresso: number;
        questoes_piso_progresso: number;
        revisao_piso_progresso: number;
      }>(
        `select estudo_progresso, questoes_progresso, revisao_progresso,
                estudo_piso_progresso, questoes_piso_progresso,
                revisao_piso_progresso
           from public.gamificacao_dia where user_id = $1 and data = $2`,
        [aluno, data],
      );
      expect(depois.rows[0]).toEqual({
        estudo_progresso: 1,
        questoes_progresso: 2,
        revisao_progresso: 1,
        estudo_piso_progresso: 1,
        questoes_piso_progresso: 2,
        revisao_piso_progresso: 1,
      });
    });
  });

  it("satisfaz a revisao gemea nos dois sentidos e a usa na sequencia", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const piso = await criarUsuario(cliente);
      const meta = await criarUsuario(cliente);
      const autor = await criarUsuario(cliente);
      const data = "2026-08-17";
      const questao = await questaoParaResponder(cliente);

      await cliente.query(
        `insert into public.configuracoes
           (chave, valor, modulo_dono, alterado_por, motivo)
         values ('flag.m6.gamificacao', 'true'::jsonb, 'm6', $1, 'teste gemea W4-B')`,
        [autor],
      );
      for (const aluno of [piso, meta]) {
        await cliente.query(
          `insert into public.perfil_estudo
             (user_id, minutos_por_dia, dias_estudo, onboarding_concluido)
           values ($1, 60, array[1]::smallint[], true)`,
          [aluno],
        );
      }

      async function criarPar(aluno: string): Promise<{ piso: string; meta: string }> {
        const plano = await cliente.query<{ id: string }>(
          `insert into public.plano_dia (user_id, data) values ($1, $2) returning id`,
          [aluno, data],
        );
        const blocoPiso = await cliente.query<{ id: string }>(
          `insert into public.plano_bloco
             (plano_dia_id, topico_id, tipo, nivel, ordem, n_questoes,
              n_questoes_cheias, minutos_estimados, minutos_estimados_cheios)
           values ($1, $2, 'revisar', 'piso', 1, 1, 1, 2, 2) returning id`,
          [plano.rows[0].id, questao.topico_id],
        );
        const blocoMeta = await cliente.query<{ id: string }>(
          `insert into public.plano_bloco
             (plano_dia_id, topico_id, tipo, nivel, ordem, n_questoes,
              n_questoes_cheias, minutos_estimados, minutos_estimados_cheios)
           values ($1, $2, 'revisar', 'meta_cheia', 1, 1, 1, 2, 2) returning id`,
          [plano.rows[0].id, questao.topico_id],
        );
        return { piso: blocoPiso.rows[0].id, meta: blocoMeta.rows[0].id };
      }

      const planoPiso = await criarPar(piso);
      const planoMeta = await criarPar(meta);
      await fecharBlocoComTentativa(cliente, piso, planoPiso.piso, data, questao);
      await fecharBlocoComTentativa(cliente, meta, planoMeta.meta, data, questao);

      for (const aluno of [piso, meta]) {
        await cliente.query("select public.materializar_gamificacao($1, $2::date)", [aluno, data]);
      }

      const anel = await cliente.query<{
        user_id: string;
        revisao_meta: number;
        revisao_progresso: number;
        revisao_piso_meta: number;
        revisao_piso_progresso: number;
      }>(
        `select user_id, revisao_meta, revisao_progresso,
                revisao_piso_meta, revisao_piso_progresso
           from public.gamificacao_dia where user_id in ($1, $2)
          order by user_id`,
        [piso, meta],
      );
      expect(anel.rows).toHaveLength(2);
      expect(anel.rows.every((linha) => linha.revisao_meta === 1)).toBe(true);
      expect(anel.rows.every((linha) => linha.revisao_progresso === 1)).toBe(true);
      expect(anel.rows.every((linha) => linha.revisao_piso_meta === 1)).toBe(true);
      expect(anel.rows.every((linha) => linha.revisao_piso_progresso === 1)).toBe(true);

      await cliente.query("select public.recalcula_sequencia($1, $2::date)", [piso, data]);
      await cliente.query("select public.recalcula_sequencia($1, $2::date)", [meta, data]);
      const sequencias = await cliente.query<{ user_id: string; estado: string }>(
        `select user_id, estado from public.sequencia_dia
          where user_id in ($1, $2) and data = $3 order by user_id`,
        [piso, meta, data],
      );
      expect(sequencias.rows).toEqual([
        ...[piso, meta]
          .sort()
          .map((user_id) => ({ user_id, estado: "cumprido" })),
      ]);
    });
  });

  it("nao trata avancar e treinar do mesmo topico como gemeas", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = await criarUsuario(cliente);
      const autor = await criarUsuario(cliente);
      const data = dataDeHojeEmSaoPaulo();
      const primeira = await questaoParaResponder(cliente);
      const segunda = await questaoParaResponder(cliente);

      await cliente.query(
        `insert into public.configuracoes
           (chave, valor, modulo_dono, alterado_por, motivo)
         values ('flag.m6.gamificacao', 'true'::jsonb, 'm6', $1, 'teste tipos gemeos W4-B')`,
        [autor],
      );
      const plano = await cliente.query<{ id: string }>(
        `insert into public.plano_dia (user_id, data) values ($1, $2) returning id`,
        [aluno, data],
      );
      const piso = await cliente.query<{ id: string }>(
        `insert into public.plano_bloco
           (plano_dia_id, topico_id, tipo, nivel, ordem, n_questoes,
            n_questoes_cheias, minutos_estimados, minutos_estimados_cheios)
         values ($1, $2, 'avancar', 'piso', 1, 1, 1, 2, 2) returning id`,
        [plano.rows[0].id, primeira.topico_id],
      );
      const treinoMesmoTopico = await cliente.query<{ id: string }>(
        `insert into public.plano_bloco
           (plano_dia_id, topico_id, tipo, nivel, ordem, n_questoes,
            n_questoes_cheias, minutos_estimados, minutos_estimados_cheios)
         values ($1, $2, 'treinar', 'meta_cheia', 2, 1, 1, 2, 2) returning id`,
        [plano.rows[0].id, primeira.topico_id],
      );
      const treinoOutroTopico = await cliente.query<{ id: string }>(
        `insert into public.plano_bloco
           (plano_dia_id, topico_id, tipo, nivel, ordem, n_questoes,
            n_questoes_cheias, minutos_estimados, minutos_estimados_cheios)
         values ($1, $2, 'treinar', 'meta_cheia', 3, 1, 1, 2, 2) returning id`,
        [plano.rows[0].id, segunda.topico_id],
      );

      await fecharBlocoComTentativa(cliente, aluno, piso.rows[0].id, data, primeira);
      const satisfacao = await cliente.query<{ piso: boolean; mesmo_tipo: boolean }>(
        `select public.plano_bloco_satisfeito($1, $2) as piso,
                public.plano_bloco_satisfeito($3, $2) as mesmo_tipo`,
        [piso.rows[0].id, aluno, treinoMesmoTopico.rows[0].id],
      );
      expect(satisfacao.rows[0]).toEqual({ piso: true, mesmo_tipo: false });

      await cliente.query("select public.materializar_gamificacao($1, $2::date)", [aluno, data]);
      const anel = await cliente.query<{
        estudo_meta: number;
        estudo_progresso: number;
        estudo_bruto: number;
      }>(
        `select estudo_meta, estudo_progresso, estudo_bruto
           from public.gamificacao_dia where user_id = $1 and data = $2`,
        [aluno, data],
      );
      expect(anel.rows[0]).toEqual({ estudo_meta: 2, estudo_progresso: 1, estudo_bruto: 1 });
      expect(treinoOutroTopico.rows[0].id).not.toBe(treinoMesmoTopico.rows[0].id);
    });
  });

  it("pontua recuperação somente após erro mais recente da mesma questão", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = await criarUsuario(cliente);
      const autor = await criarUsuario(cliente);
      const data = dataDeHojeEmSaoPaulo();
      await cliente.query(
        `insert into public.configuracoes
           (chave, valor, modulo_dono, alterado_por, motivo)
         values ('flag.m6.gamificacao', 'true'::jsonb, 'm6', $1, 'teste recuperação W4-B')`,
        [autor],
      );
      const questao = await questaoParaResponder(cliente);

      await inserirTentativa(cliente, questao, {
        user_id: aluno,
        correta: false,
        resposta_dada: "A",
        causa_erro: "nao_sei_dizer",
        causa_origem: "aluno",
        respondida_em: `${data}T10:00:00-03:00`,
      });
      await inserirTentativa(cliente, questao, {
        user_id: aluno,
        correta: true,
        resposta_dada: "C",
        respondida_em: `${data}T10:01:00-03:00`,
      });
      await inserirTentativa(cliente, questao, {
        user_id: aluno,
        correta: true,
        resposta_dada: "C",
        respondida_em: `${data}T10:02:00-03:00`,
      });
      await inserirTentativa(cliente, questao, {
        user_id: aluno,
        correta: false,
        resposta_dada: "A",
        causa_erro: "nao_sei_dizer",
        causa_origem: "aluno",
        respondida_em: `${data}T10:03:00-03:00`,
      });
      await inserirTentativa(cliente, questao, {
        user_id: aluno,
        correta: true,
        resposta_dada: "C",
        respondida_em: `${data}T10:04:00-03:00`,
      });

      const primeiro = await cliente.query<{ n: number }>(
        "select public.materializar_gamificacao($1, $2::date) as n",
        [aluno, data],
      );
      expect(Number(primeiro.rows[0].n)).toBe(2);
      const eventos = await cliente.query<{ n: string; pontos: number }>(
        `select count(*)::text as n, coalesce(sum(pontos), 0)::int as pontos
           from public.gamificacao_ponto_evento
          where user_id = $1 and tipo = 'recuperacao_erro'`,
        [aluno],
      );
      expect(eventos.rows[0]).toEqual({ n: "2", pontos: 50 });

      const segundo = await cliente.query<{ n: number }>(
        "select public.materializar_gamificacao($1, $2::date) as n",
        [aluno, data],
      );
      expect(Number(segundo.rows[0].n)).toBe(0);
    });
  });

  it("não permite escrever/ler a projeção de outro aluno e o esquecimento alcança tudo", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const a = await criarUsuario(cliente);
      const b = await criarUsuario(cliente);
      const autor = await criarUsuario(cliente);
      const data = dataDeHojeEmSaoPaulo();
      await cliente.query(
        `insert into public.configuracoes
           (chave, valor, modulo_dono, alterado_por, motivo)
         values ('flag.m6.gamificacao', 'true'::jsonb, 'm6', $1, 'teste RLS W4-B')`,
        [autor],
      );
      for (const aluno of [a, b]) {
        await cliente.query(
          `insert into public.gamificacao_dia
             (user_id, data, estudo_meta, estudo_progresso, estudo_bruto)
           values ($1, $2, 1, 0, 0)`,
          [aluno, data],
        );
        await cliente.query(
          `insert into public.gamificacao_missao_dia
             (user_id, data, id, tipo, meta, estado)
           values ($1, $2, 'missao-piso', 'concluir_piso', 1, 'pendente')`,
          [aluno, data],
        );
      }

      await comoAluno(cliente, a, async () => {
        const visiveis = await cliente.query<{ user_id: string }>(
          "select user_id from public.gamificacao_dia",
        );
        expect(visiveis.rows.map((linha) => linha.user_id)).toEqual([a]);
        await cliente.query("savepoint gamificacao_rls_insert");
        try {
          await expect(
            cliente.query(
              `insert into public.gamificacao_dia (user_id, data) values ($1, $2)`,
              [b, data],
            ),
          ).rejects.toThrow(/permission denied|row-level security/);
        } finally {
          await cliente.query("rollback to savepoint gamificacao_rls_insert");
          await cliente.query("release savepoint gamificacao_rls_insert");
        }
      });

      await cliente.query("select public.apagar_dados_do_usuario($1)", [a]);
      const contagem = await cliente.query<{ tabela: string; n: string }>(
        `select tabela, n::text from public.contar_dados_grupo1_esquecimento($1)
          where tabela like 'gamificacao_%' order by tabela`,
        [a],
      );
      expect(contagem.rows.every((linha) => linha.n === "0")).toBe(true);
      const vizinho = await cliente.query<{ n: string }>(
        "select count(*)::text as n from public.gamificacao_dia where user_id = $1",
        [b],
      );
      expect(vizinho.rows[0].n).toBe("1");
    });
  });

  it("mantem o recorte do piso completo nos fallbacks e sem plano", async () => {
    await comTransacaoRevertida(async (cliente) => {
      type Dimensao = {
        progresso: number;
        meta: number;
        bruto: number;
        piso_meta: number;
        piso_progresso: number;
      };
      type Resposta = {
        habilitada: boolean;
        estado: string;
        anel: {
          estudo: Dimensao;
          questoes: Dimensao;
          revisao: Dimensao;
        };
      };
      const zeros = {
        progresso: 0,
        meta: 0,
        bruto: 0,
        piso_meta: 0,
        piso_progresso: 0,
      };

      const semSessao = await cliente.query<{ dados: Resposta }>(
        "select public.consultar_gamificacao_do_dia() as dados",
      );
      expect(semSessao.rows[0].dados).toMatchObject({
        habilitada: false,
        estado: "desligada",
        anel: { estudo: zeros, questoes: zeros, revisao: zeros },
      });

      const alunoSemPlano = await criarUsuario(cliente);
      const alunoDesligado = await criarUsuario(cliente);
      const autor = await criarUsuario(cliente);
      const data = dataDeHojeEmSaoPaulo();
      await cliente.query(
        `insert into public.configuracoes
           (chave, valor, modulo_dono, alterado_por, motivo)
         values ('flag.m6.gamificacao', 'true'::jsonb, 'm6', $1, 'teste fallback anel W4-B')`,
        [autor],
      );
      for (const aluno of [alunoSemPlano, alunoDesligado]) {
        await cliente.query(
          `insert into public.perfil_estudo
             (user_id, minutos_por_dia, dias_estudo, onboarding_concluido)
           values ($1, 60, array[0,1,2,3,4,5,6]::smallint[], true)`,
          [aluno],
        );
      }

      await comoAluno(cliente, alunoSemPlano, async () => {
        const { rows } = await cliente.query<{ dados: Resposta }>(
          "select public.consultar_gamificacao_do_dia() as dados",
        );
        expect(rows[0].dados).toMatchObject({
          habilitada: true,
          estado: "ok",
          anel: { estudo: zeros, questoes: zeros, revisao: zeros },
        });
      });

      await cliente.query(
        `insert into public.configuracoes
           (chave, valor, modulo_dono, alterado_por, motivo)
         values ('flag.m6.gamificacao', 'false'::jsonb, 'm6', $1, 'teste fallback desligado W4-B')`,
        [autor],
      );
      await comoAluno(cliente, alunoDesligado, async () => {
        const { rows } = await cliente.query<{ dados: Resposta }>(
          "select public.consultar_gamificacao_do_dia() as dados",
        );
        expect(rows[0].dados).toMatchObject({
          habilitada: false,
          estado: "desligada",
          anel: { estudo: zeros, questoes: zeros, revisao: zeros },
        });
      });

      const materializada = await cliente.query<{
        estudo_piso_meta: number;
        questoes_piso_meta: number;
        revisao_piso_meta: number;
      }>(
        `select estudo_piso_meta, questoes_piso_meta, revisao_piso_meta
           from public.gamificacao_dia where user_id = $1 and data = $2`,
        [alunoSemPlano, data],
      );
      expect(materializada.rows[0]).toEqual({
        estudo_piso_meta: 0,
        questoes_piso_meta: 0,
        revisao_piso_meta: 0,
      });
    });
  });

  it("devolve a discriminacao do dia e a de sempre lado a lado", async () => {
    await comTransacaoRevertida(async (cliente) => {
      type Discriminacao = {
        estudo_prioritario: number;
        conclusao: number;
        revisao_no_prazo: number;
        recuperacao_erro: number;
      };
      type Resposta = {
        pontos: {
          dia: number;
          total: number;
          discriminacao: Discriminacao;
          discriminacao_total: Discriminacao;
        };
        progresso_conquistas: Record<string, { progresso: number; meta: number }>;
      };

      const aluno = await criarUsuario(cliente);
      const autor = await criarUsuario(cliente);
      const hoje = dataDeHojeEmSaoPaulo();
      await cliente.query(
        `insert into public.configuracoes
           (chave, valor, modulo_dono, alterado_por, motivo)
         values ('flag.m6.gamificacao', 'true'::jsonb, 'm6', $1, 'teste discriminacao vitalicia')`,
        [autor],
      );
      await cliente.query(
        `insert into public.perfil_estudo
           (user_id, minutos_por_dia, dias_estudo, onboarding_concluido)
         values ($1, 60, array[0,1,2,3,4,5,6]::smallint[], true)`,
        [aluno],
      );

      // Todos os eventos ficam no PASSADO: e a reproducao exata do que o aluno
      // via — total positivo com a discriminacao do dia zerada.
      const passado = [
        ["estudo_prioritario", 10],
        ["estudo_prioritario", 10],
        ["conclusao", 20],
        ["revisao_no_prazo", 15],
        ["recuperacao_erro", 25],
      ] as const;
      for (const [indice, [tipo, pontos]] of passado.entries()) {
        await cliente.query(
          `insert into public.gamificacao_ponto_evento
             (user_id, chave_evento, tipo, origem_id, data, pontos)
           values ($1, $2, $3, $4, ($5::date - 3), $6)`,
          [aluno, `evento-antigo-${indice}`, tipo, `origem-${indice}`, hoje, pontos],
        );
      }

      await comoAluno(cliente, aluno, async () => {
        const { rows } = await cliente.query<{ dados: Resposta }>(
          "select public.consultar_gamificacao_do_dia() as dados",
        );
        const { pontos, progresso_conquistas: conquistas } = rows[0].dados;

        // A janela do dia continua zerada — ela sempre esteve certa.
        expect(pontos.dia).toBe(0);
        expect(pontos.discriminacao).toEqual({
          estudo_prioritario: 0,
          conclusao: 0,
          revisao_no_prazo: 0,
          recuperacao_erro: 0,
        });
        // O que faltava era a outra metade, e ela fecha com o total.
        expect(pontos.total).toBe(80);
        expect(pontos.discriminacao_total).toEqual({
          estudo_prioritario: 20,
          conclusao: 20,
          revisao_no_prazo: 15,
          recuperacao_erro: 25,
        });

        // E a conquista travada passa a saber dizer quanto falta.
        expect(conquistas.primeiro_bloco).toEqual({ progresso: 1, meta: 1 });
        expect(conquistas.cem_questoes.meta).toBeGreaterThan(0);
        expect(conquistas.cem_questoes.progresso).toBe(0);
        expect(conquistas.sequencia_pessoal.progresso).toBeLessThanOrEqual(
          conquistas.sequencia_pessoal.meta,
        );
      });
    });
  });
});
