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
): Promise<{ plano: string; piso: string; meta: string }> {
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
  return { plano: plano.rows[0].id, piso: piso.rows[0].id, meta: meta.rows[0].id };
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
        questoes_meta: number;
        questoes_bruto: number;
      }>(
        `select estudo_meta, estudo_progresso, estudo_bruto, questoes_meta, questoes_bruto
           from public.gamificacao_dia where user_id = $1 and data = $2`,
        [aluno, data],
      );
      expect(anel.rows[0]).toMatchObject({
        estudo_meta: 1,
        estudo_progresso: 1,
        estudo_bruto: 1,
        questoes_meta: 2,
        questoes_bruto: 2,
      });
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
        await expect(
          cliente.query(
            `insert into public.gamificacao_dia (user_id, data) values ($1, $2)`,
            [b, data],
          ),
        ).rejects.toThrow(/permission denied|row-level security/);
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
});
