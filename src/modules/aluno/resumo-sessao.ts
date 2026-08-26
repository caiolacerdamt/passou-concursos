import type { SupabaseClient } from "@supabase/supabase-js";

import {
  fonteCitacaoSchema,
  type FonteCitacao,
  type OrigemQuestao,
  type TipoQuestao,
} from "@/modules/acervo";

export type QuestaoDoResumo = {
  id: string;
  questaoVersao: number;
  origem: OrigemQuestao;
  tipoQuestao: TipoQuestao;
  enunciado: string;
  fonteCitacao: FonteCitacao | null;
  respostaCorreta: string;
};

export type ItemDoResumo = {
  ordem: number;
  respostaDada: string;
  correta: boolean;
  questao: QuestaoDoResumo;
};

export type ResumoDaSessao = {
  id: string;
  blocoId: string | null;
  encerradaEm: string;
  proximaRevisao: string | null;
  nQuestoes: number;
  nAcertos: number;
  itens: readonly ItemDoResumo[];
};

type SessaoBanco = {
  id: string;
  plano_bloco_id: string | null;
  encerrada_em: string;
  contexto: string;
};
type TentativaBanco = {
  questao_id: string;
  questao_versao: number;
  topico_id: string;
  ordem_na_sessao: number;
  resposta_dada: string;
  correta: boolean;
};
type QuestaoBanco = {
  id: string;
  questao_versao: number;
  origem: OrigemQuestao;
  tipo_questao: TipoQuestao;
  enunciado: string;
  fonte_citacao: unknown;
  resposta_correta: string | null;
};
type RevisaoBanco = { topico_id: string; due: string | null };

function falhaAoLer(recurso: string, mensagem: string): Error {
  return new Error(`falha ao ler ${recurso}: ${mensagem}`);
}

function fonteDaQuestao(linha: QuestaoBanco): FonteCitacao | null {
  if (linha.fonte_citacao === null || linha.fonte_citacao === undefined) return null;
  const fonte = fonteCitacaoSchema.safeParse(linha.fonte_citacao);
  if (!fonte.success) throw new Error("resumo aponta para proveniência inválida");
  return fonte.data;
}

export async function consultarResumoDaSessao(
  cliente: SupabaseClient,
  sessaoId: string,
): Promise<ResumoDaSessao | null> {
  const sessaoConsulta = await cliente
    .from("sessoes")
    .select("id, plano_bloco_id, contexto, encerrada_em")
    .eq("id", sessaoId)
    .not("encerrada_em", "is", null)
    .maybeSingle();

  if (sessaoConsulta.error) {
    throw falhaAoLer("sessão concluída", sessaoConsulta.error.message);
  }
  if (!sessaoConsulta.data) return null;
  const sessao = sessaoConsulta.data as SessaoBanco;

  const tentativasConsulta = await cliente
    .from("tentativas")
    .select("questao_id, questao_versao, ordem_na_sessao, resposta_dada, correta")
    .eq("sessao_id", sessao.id)
    .order("ordem_na_sessao", { ascending: true });

  if (tentativasConsulta.error) {
    throw falhaAoLer("respostas da sessão", tentativasConsulta.error.message);
  }
  const tentativas = (tentativasConsulta.data ?? []) as TentativaBanco[];
  if (tentativas.length === 0) throw new Error("sessão encerrada não possui tentativas");

  let proximaRevisao: string | null = null;
  const agendaRelevante = sessao.contexto === "plano" || sessao.contexto === "treino" || sessao.contexto === "revisao";
  const topicos = [...new Set(tentativas.map((tentativa) => tentativa.topico_id))];
  if (agendaRelevante && topicos.length > 0) {
    const agendaConsulta = await cliente
      .from("revisao_agenda")
      .select("topico_id, due")
      .in("topico_id", topicos)
      .order("due", { ascending: true });

    if (agendaConsulta.error) {
      throw falhaAoLer("revisão da sessão", agendaConsulta.error.message);
    }

    // Refação pode tocar mais de um tópico; "próxima" é a menor data entre
    // as agendas que pertencem às respostas desta sessão.
    proximaRevisao = ((agendaConsulta.data ?? []) as RevisaoBanco[]).find(
      (linha) => typeof linha.due === "string" && linha.due.length > 0,
    )?.due ?? null;
  }

  const questoesConsulta = await cliente
    .from("questoes")
    .select("id, questao_versao, origem, tipo_questao, enunciado, fonte_citacao, resposta_correta")
    .in("id", [...new Set(tentativas.map((tentativa) => tentativa.questao_id))]);

  if (questoesConsulta.error) {
    throw falhaAoLer("questões do resumo", questoesConsulta.error.message);
  }
  const porVersao = new Map(
    ((questoesConsulta.data ?? []) as QuestaoBanco[]).map((questao) => [
      `${questao.id}:${questao.questao_versao}`,
      questao,
    ]),
  );

  const itens = tentativas.map((tentativa): ItemDoResumo => {
    const linha = porVersao.get(`${tentativa.questao_id}:${tentativa.questao_versao}`);
    if (!linha || !linha.resposta_correta) {
      throw new Error("resumo aponta para questão-versão sem gabarito");
    }

    const questao: QuestaoDoResumo = {
      id: linha.id,
      questaoVersao: linha.questao_versao,
      origem: linha.origem,
      tipoQuestao: linha.tipo_questao,
      enunciado: linha.enunciado,
      fonteCitacao: fonteDaQuestao(linha),
      respostaCorreta: linha.resposta_correta,
    };

    return {
      ordem: Number(tentativa.ordem_na_sessao),
      respostaDada: tentativa.resposta_dada,
      correta: tentativa.correta,
      questao,
    };
  });

  return {
    id: sessao.id,
    blocoId: sessao.plano_bloco_id,
    encerradaEm: sessao.encerrada_em,
    proximaRevisao,
    nQuestoes: itens.length,
    nAcertos: itens.filter((item) => item.correta).length,
    itens,
  };
}
