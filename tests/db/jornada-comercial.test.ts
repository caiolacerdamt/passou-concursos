import type { Client } from "pg";
import { afterEach, expect, it } from "vitest";

import { agendarRevisao } from "@/modules/aluno/revisao";
import { restaurarLeitorPadrao } from "@/modules/config/leitura";

import { comoAluno as comoAlunoDaConta, criarMatricula, criarUsuario } from "./conta";
import { comTransacaoRevertida } from "./conexao";
import { descreveComBanco } from "./setup";
import { supabaseNaTransacao } from "./supabase-na-transacao";

/**
 * Onda 6 (W6-B) — a jornada comercial de ponta a ponta, contra o acervo real do
 * projeto de desenvolvimento.
 *
 * Ela existe para responder ao critério de encerramento do plano: comprar,
 * receber um plano que cobre o edital, abrir um recurso curado, responder
 * questões, ver o progresso na hora, receber a revisão na data certa, ver a
 * gamificação e remarcar um dia perdido sem perder prioridade.
 *
 * Nada aqui é semeado no acervo de propósito: o plano usa as questões e os
 * recursos que estão publicados de verdade. Se o acervo distribuído regredir, o
 * teste falha aqui, e não na frente do aluno.
 */

const DATA_DA_JORNADA = "2026-09-07"; // segunda-feira

afterEach(() => {
  restaurarLeitorPadrao();
});

type Bloco = {
  id: string;
  tipo: string;
  nivel: string;
  ordem: number;
  topico_id: string | null;
  materia_id: string | null;
  n_questoes: number;
};

async function blocosDoDia(cliente: Client, aluno: string, data: string): Promise<Bloco[]> {
  const { rows } = await cliente.query<Bloco>(
    `select b.id, b.tipo::text as tipo, b.nivel::text as nivel, b.ordem,
            b.topico_id::text as topico_id, t.materia_id::text as materia_id,
            b.n_questoes
       from public.plano_bloco b
       join public.plano_dia p on p.id = b.plano_dia_id
       left join public.topicos t on t.id = b.topico_id
      where p.user_id = $1 and p.data = $2
      order by b.nivel, b.ordem`,
    [aluno, data],
  );
  return rows;
}

/**
 * Responde `quantidade` questões publicadas do tópico, numa sessão fechada.
 *
 * O contexto importa: bloco de conteúdo (`plano`) cria a agenda inicial e bloco
 * de `revisao` cria o evento de revisão — o banco recusa a troca dos dois.
 */
async function estudarBloco(
  cliente: Client,
  aluno: string,
  bloco: { id: string | null; topico_id: string | null },
  data: string,
  quantidade: number,
  opcoes: { contexto?: "plano" | "revisao"; acertaTudo?: boolean } = {},
): Promise<{ sessaoId: string; acertos: number; respostas: number }> {
  const contexto = opcoes.contexto ?? "plano";
  const { rows: plano } = await cliente.query<{ id: string }>(
    "select id from public.plano_dia where user_id = $1 and data = $2",
    [aluno, data],
  );
  const { rows: sessao } = await cliente.query<{ id: string }>(
    `insert into public.sessoes
       (user_id, contexto, plano_bloco_id, plano_dia_id, iniciada_em)
     values ($1, $2::public.contexto_tentativa, $3, $4, $5::timestamptz)
     returning id`,
    [
      aluno,
      contexto,
      bloco.id,
      bloco.id === null ? null : (plano[0]?.id ?? null),
      `${data}T18:00:00-03:00`,
    ],
  );
  const sessaoId = sessao[0].id;

  const { rows: questoes } = await cliente.query<{
    questao_id: string;
    questao_versao: number;
    materia_id: string;
    materia_rotulo: string;
    topico_id: string;
    topico_rotulo: string;
    banca: string;
    tipo_questao: string;
    dificuldade: number;
    resposta_correta: string;
  }>(
    `select q.id as questao_id, q.questao_versao, m.id as materia_id, m.nome as materia_rotulo,
            t.id as topico_id, t.nome as topico_rotulo, p.banca,
            q.tipo_questao::text as tipo_questao, coalesce(q.dificuldade, 3) as dificuldade,
            q.resposta_correta
       from public.questoes q
       join public.topicos t on t.id = q.topico_id
       join public.materias m on m.id = t.materia_id
       join public.provas p on p.id = q.prova_id
      where q.topico_id = $1 and q.vigente and q.status = 'publicada' and not q.anulada
      order by q.numero
      limit $2`,
    [bloco.topico_id, quantidade],
  );
  expect(questoes.length).toBeGreaterThan(0);

  let acertos = 0;
  for (const [indice, questao] of questoes.entries()) {
    await cliente.query(
      `insert into public.sessao_itens (sessao_id, questao_id, questao_versao, ordem)
       values ($1, $2, $3, $4)`,
      [sessaoId, questao.questao_id, questao.questao_versao, indice + 1],
    );
    // O primeiro item erra de propósito: sem erro não há caderno de erros nem
    // recuperação para o progresso mostrar.
    const acertou = opcoes.acertaTudo === true || indice > 0;
    if (acertou) acertos += 1;
    // O erro precisa ser uma alternativa válida do tipo da questão; letra solta
    // seria recusada pelo CHECK antes de virar erro de conteúdo.
    const errada =
      questao.tipo_questao === "certo_errado"
        ? questao.resposta_correta === "C"
          ? "E"
          : "C"
        : questao.resposta_correta === "A"
          ? "B"
          : "A";
    await cliente.query(
      `insert into public.tentativas (
         user_id, questao_id, questao_versao,
         materia_id, materia_rotulo, topico_id, topico_rotulo, banca,
         tipo_questao, dificuldade, origem,
         sessao_id, contexto, ordem_na_sessao,
         resposta_dada, correta, tempo_ms, marcou_chute,
         causa_erro, causa_origem, respondida_em
       ) values (
         $1, $2, $3, $4, $5, $6, $7, $8,
         $9::public.tipo_questao, $10, 'real',
         $11, $18::public.contexto_tentativa, $12, $13, $14, 45000, false,
         $15::public.causa_erro, $16::public.causa_origem, $17::timestamptz
       )`,
      [
        aluno,
        questao.questao_id,
        questao.questao_versao,
        questao.materia_id,
        questao.materia_rotulo,
        questao.topico_id,
        questao.topico_rotulo,
        questao.banca,
        questao.tipo_questao,
        questao.dificuldade,
        sessaoId,
        indice + 1,
        acertou ? questao.resposta_correta : errada,
        acertou,
        acertou ? null : "nao_sabia_conteudo",
        acertou ? null : "aluno",
        `${data}T18:0${indice}:00-03:00`,
        contexto,
      ],
    );
  }

  await cliente.query(
    `update public.sessoes set encerrada_em = $2::timestamptz where id = $1`,
    [sessaoId, `${data}T18:30:00-03:00`],
  );
  return { sessaoId, acertos, respostas: questoes.length };
}

descreveComBanco("W6-B — jornada comercial de ponta a ponta", () => {
  it("compra, plano, estudo, questões, progresso, revisão e gamificação", async () => {
    await comTransacaoRevertida(async (cliente) => {
      // 1. Compra confirmada: matrícula ativa e visível para o próprio aluno.
      const aluno = await criarUsuario(cliente);
      const operador = await criarUsuario(cliente);
      const matricula = await criarMatricula(cliente, aluno);
      expect(matricula.estado).toBe("ativa");

      const minhas = await comoAlunoDaConta(cliente, aluno, () =>
        cliente.query<{ total: number }>(
          "select count(*)::int as total from public.matriculas where user_id = $1",
          [aluno],
        ),
      );
      expect(minhas.rows[0].total).toBe(1);

      // 2. Onboarding: concurso ativo já existe; o aluno declara dias e tempo.
      await cliente.query(
        `insert into public.perfil_estudo
           (user_id, nivel_declarado, minutos_por_dia, dias_estudo, onboarding_concluido)
         values ($1, 'iniciante', 120, array[0,1,2,3,4,5,6]::smallint[], true)`,
        [aluno],
      );

      // 3. Plano do dia: cobre o edital ativo, sem tópico fora do programa.
      const gerados = await cliente.query<{ n: number }>(
        "select public.gera_plano_do_dia($1, $2::date) as n",
        [aluno, DATA_DA_JORNADA],
      );
      expect(Number(gerados.rows[0].n)).toBeGreaterThan(0);

      const blocos = await blocosDoDia(cliente, aluno, DATA_DA_JORNADA);
      expect(blocos.length).toBeGreaterThan(0);

      const comTopico = blocos.filter((bloco) => bloco.topico_id !== null);
      expect(comTopico.length).toBeGreaterThan(0);
      const foraDoEdital = await cliente.query<{ total: number }>(
        `select count(*)::int as total
           from unnest($1::uuid[]) as bloco(topico_id)
          where not exists (
            select 1 from public.perfil_concurso p
            cross join lateral jsonb_array_elements_text(p.programa_edital) e(topico_id)
             where p.ativo and e.topico_id = bloco.topico_id::text
          )`,
        [comTopico.map((bloco) => bloco.topico_id)],
      );
      expect(foraDoEdital.rows[0].total).toBe(0);

      // 4. Onde estudar: o tópico do bloco tem recurso curado ativo, e o aluno
      //    matriculado consegue lê-lo com a RLS ligada.
      const bloco = comTopico[0];
      const recursos = await comoAlunoDaConta(cliente, aluno, () =>
        cliente.query<{ total: number }>(
          `select count(*)::int as total from public.recursos_estudo
            where topico_id = $1 and ativo`,
          [bloco.topico_id],
        ),
      );
      expect(recursos.rows[0].total).toBeGreaterThan(0);

      // 5. Questões do conteúdo, com um erro de propósito.
      const estudo = await estudarBloco(cliente, aluno, bloco, DATA_DA_JORNADA, 3);
      expect(estudo.respostas).toBeGreaterThan(1);

      // 6. Progresso imediato: sem esperar o cron da madrugada.
      const recalculo = await cliente.query<{ n: number }>(
        "select public.recalcula_projecoes($1) as n",
        [aluno],
      );
      expect(Number(recalculo.rows[0].n)).toBeGreaterThan(0);

      const dominio = await cliente.query<{ n_respostas: number; n_acertos: number }>(
        `select n_respostas, n_acertos from public.dominio_topico
          where user_id = $1 and topico_id = $2`,
        [aluno, bloco.topico_id],
      );
      expect(dominio.rows[0].n_respostas).toBe(estudo.respostas);
      expect(dominio.rows[0].n_acertos).toBe(estudo.acertos);

      const caderno = await cliente.query<{ total: number }>(
        `select count(*)::int as total from public.caderno_erros
          where user_id = $1 and topico_id = $2`,
        [aluno, bloco.topico_id],
      );
      expect(caderno.rows[0].total).toBeGreaterThan(0);

      // 7. Revisão: conteúdo novo cai no dia seguinte e o desempenho move o due.
      const supabase = supabaseNaTransacao(cliente);
      const primeira = await agendarRevisao(
        {
          userId: aluno,
          topicoId: bloco.topico_id as string,
          percentualAcerto: estudo.acertos / estudo.respostas,
          sessaoId: estudo.sessaoId,
          primeiraRevisao: true,
          agora: new Date(`${DATA_DA_JORNADA}T21:00:00Z`),
        },
        supabase,
      );
      const amanha = new Date(`${DATA_DA_JORNADA}T21:00:00Z`);
      amanha.setUTCDate(amanha.getUTCDate() + 1);
      expect(primeira.due.toISOString().slice(0, 10)).toBe(amanha.toISOString().slice(0, 10));

      const agendada = await cliente.query<{ due: string }>(
        "select due from public.revisao_agenda where user_id = $1 and topico_id = $2",
        [aluno, bloco.topico_id],
      );
      expect(agendada.rows[0].due).toBe(amanha.toISOString().slice(0, 10));

      // No dia da revisão o aluno fecha um bloco de `revisao` do mesmo tópico:
      // é esse bloco que vira evento e empurra a próxima data para frente.
      const diaDaRevisao = amanha.toISOString().slice(0, 10);
      const revisao = await estudarBloco(
        cliente,
        aluno,
        { id: null, topico_id: bloco.topico_id },
        diaDaRevisao,
        2,
        { contexto: "revisao", acertaTudo: true },
      );
      const depoisDaRevisao = await agendarRevisao(
        {
          userId: aluno,
          topicoId: bloco.topico_id as string,
          percentualAcerto: revisao.acertos / revisao.respostas,
          sessaoId: revisao.sessaoId,
          primeiraRevisao: false,
          agora: amanha,
        },
        supabase,
      );
      expect(depoisDaRevisao.due.getTime()).toBeGreaterThan(amanha.getTime());

      const reagendada = await cliente.query<{ due: string; ultima_nota: number }>(
        "select due, ultima_nota from public.revisao_agenda where user_id = $1 and topico_id = $2",
        [aluno, bloco.topico_id],
      );
      expect(reagendada.rows[0].due > diaDaRevisao).toBe(true);

      // 8. Gamificação ligada: o esforço real vira anel e pontos.
      await cliente.query(
        `insert into public.configuracoes
           (chave, valor, modulo_dono, alterado_por, motivo)
         values ('flag.m6.gamificacao', 'true'::jsonb, 'm6', $1, 'jornada W6-B')`,
        [operador],
      );
      const materializou = await cliente.query<{ n: number }>(
        "select public.materializar_gamificacao($1, $2::date) as n",
        [aluno, DATA_DA_JORNADA],
      );
      expect(Number(materializou.rows[0].n)).toBeGreaterThan(0);

      const pontos = await cliente.query<{ pontos_total: number }>(
        `select pontos_total from public.gamificacao_pontos_dia
          where user_id = $1 and data = $2::date`,
        [aluno, DATA_DA_JORNADA],
      );
      expect(pontos.rows[0].pontos_total).toBeGreaterThan(0);

      const anel = await cliente.query<{ questoes_progresso: number; questoes_bruto: number }>(
        `select questoes_progresso, questoes_bruto from public.gamificacao_dia
          where user_id = $1 and data = $2::date`,
        [aluno, DATA_DA_JORNADA],
      );
      expect(anel.rows[0].questoes_bruto).toBeGreaterThan(0);
    });
  });

  it("adia um bloco do dia sem perder a prioridade do edital", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = await criarUsuario(cliente);
      await criarMatricula(cliente, aluno);
      await cliente.query(
        `insert into public.perfil_estudo
           (user_id, nivel_declarado, minutos_por_dia, dias_estudo, onboarding_concluido)
         values ($1, 'iniciante', 120, array[0,1,2,3,4,5,6]::smallint[], true)`,
        [aluno],
      );
      await cliente.query("select public.gera_plano_do_dia($1, $2::date)", [
        aluno,
        DATA_DA_JORNADA,
      ]);

      const blocos = await blocosDoDia(cliente, aluno, DATA_DA_JORNADA);
      const alvo = blocos.find((bloco) => bloco.topico_id !== null) as Bloco;

      const adiado = await comoAlunoDaConta(cliente, aluno, () =>
        cliente.query<{ adiar_plano_bloco: string }>(
          "select public.adiar_plano_bloco($1::uuid) as adiar_plano_bloco",
          [alvo.id],
        ),
      );
      const novaData = adiado.rows[0].adiar_plano_bloco;
      expect(novaData > DATA_DA_JORNADA).toBe(true);

      const noDestino = await cliente.query<{ total: number }>(
        `select count(*)::int as total
           from public.plano_bloco b
           join public.plano_dia p on p.id = b.plano_dia_id
          where p.user_id = $1 and p.data = $2::date and b.topico_id = $3`,
        [aluno, novaData, alvo.topico_id],
      );
      expect(noDestino.rows[0].total).toBeGreaterThan(0);

      const sumiuDoDia = await cliente.query<{ total: number }>(
        `select count(*)::int as total
           from public.plano_bloco b
           join public.plano_dia p on p.id = b.plano_dia_id
          where p.user_id = $1 and p.data = $2::date and b.id = $3`,
        [aluno, DATA_DA_JORNADA, alvo.id],
      );
      expect(sumiuDoDia.rows[0].total).toBe(0);
    });
  });
});
