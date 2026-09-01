import type { SupabaseClient } from "@supabase/supabase-js";

import { isFlagOn } from "@/modules/config";
import { reportarErro } from "@/modules/observabilidade/reporte";

import { consultarGamificacao, type DadosGamificacao } from "./gamificacao";
import { dataHojeDoProduto } from "./plano";
import {
  consultarProgresso,
  type LinhaCaderno,
  type RelatorioSemanal,
} from "./progresso";
import type { Trajetoria } from "./trajetoria";
import { consultarTrajetoriaOpcional } from "./trajetoria-opcional";

/** Quantos erros do caderno cabem no atalho de recuperação do painel. */
export const TETO_DE_ERROS_NO_PAINEL = 3;

export type EstadoDaContagem = "indefinida" | "futura" | "hoje" | "passada";

export type ContagemDaProva = {
  dataProva: string | null;
  /** Dias corridos até a prova. `null` quando a data não está definida. */
  dias: number | null;
  estado: EstadoDaContagem;
};

const DATA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

function emDiasUtc(data: string): number | null {
  const partes = DATA_ISO.exec(data);
  if (!partes) return null;
  const ano = Number(partes[1]);
  const mes = Number(partes[2]);
  const dia = Number(partes[3]);
  const instante = Date.UTC(ano, mes - 1, dia);
  const conferencia = new Date(instante);
  if (
    conferencia.getUTCFullYear() !== ano ||
    conferencia.getUTCMonth() !== mes - 1 ||
    conferencia.getUTCDate() !== dia
  ) {
    return null;
  }
  return instante / 86_400_000;
}

/**
 * Conta os dias até a prova pelo calendário do produto (America/Sao_Paulo),
 * o mesmo fuso que decide qual é o dia do plano. Data ausente ou ilegível
 * nunca vira número inventado: devolve `indefinida`.
 */
export function contarDiasParaProva(
  dataProva: string | null | undefined,
  agora: Date = new Date(),
): ContagemDaProva {
  if (typeof dataProva !== "string" || dataProva.trim() === "") {
    return { dataProva: null, dias: null, estado: "indefinida" };
  }

  const prova = emDiasUtc(dataProva.slice(0, 10));
  const hoje = emDiasUtc(dataHojeDoProduto(agora));
  if (prova === null || hoje === null) {
    return { dataProva: null, dias: null, estado: "indefinida" };
  }

  const dias = prova - hoje;
  return {
    dataProva: dataProva.slice(0, 10),
    dias,
    estado: dias > 0 ? "futura" : dias === 0 ? "hoje" : "passada",
  };
}

/**
 * Lê a gamificação só quando a flag global está ligada e nunca derruba a
 * superfície: falha de leitura vira ausência silenciosa e um erro reportado.
 */
export async function consultarGamificacaoOpcional(
  cliente: SupabaseClient,
): Promise<DadosGamificacao | null> {
  if (!(await isFlagOn("flag.m6.gamificacao"))) return null;

  try {
    const dados = await consultarGamificacao(cliente);
    return dados.habilitada ? dados : null;
  } catch (erro) {
    reportarErro(erro, { modulo: "aluno", operacao: "consultar_gamificacao" });
    return null;
  }
}

export type PainelDoDia = {
  contagem: ContagemDaProva;
  gamificacao: DadosGamificacao | null;
  /** `null` com a flag desligada ou leitura falha — nunca derruba a tela. */
  trajetoria: Trajetoria | null;
  relatorioSemanal: RelatorioSemanal | null;
  recuperacao: readonly LinhaCaderno[];
  /** `true` quando a leitura de acompanhamento falhou e o aluno precisa saber. */
  acompanhamentoIndisponivel: boolean;
};

/**
 * Reúne, para a superfície Hoje, o que hoje só existia em telas separadas:
 * contagem da prova, gamificação do dia, leitura da semana e os erros que
 * merecem outra chance. Cada leitura é opcional e falha sozinha.
 */
export async function consultarPainelDoDia(
  cliente: SupabaseClient,
  opcoes: { dataProva?: string | null; agora?: Date } = {},
): Promise<PainelDoDia> {
  const agora = opcoes.agora ?? new Date();
  const contagem = contarDiasParaProva(opcoes.dataProva, agora);

  const [gamificacao, acompanhamento, trajetoria] = await Promise.all([
    consultarGamificacaoOpcional(cliente),
    lerAcompanhamento(cliente, agora),
    consultarTrajetoriaOpcional(cliente, { dataProva: opcoes.dataProva, agora }),
  ]);

  return {
    contagem,
    gamificacao,
    trajetoria,
    relatorioSemanal: acompanhamento.relatorioSemanal,
    recuperacao: acompanhamento.recuperacao,
    acompanhamentoIndisponivel: acompanhamento.indisponivel,
  };
}

async function lerAcompanhamento(
  cliente: SupabaseClient,
  agora: Date,
): Promise<{
  relatorioSemanal: RelatorioSemanal | null;
  recuperacao: readonly LinhaCaderno[];
  indisponivel: boolean;
}> {
  if (!(await isFlagOn("flag.m4.caderno_erros"))) {
    return { relatorioSemanal: null, recuperacao: [], indisponivel: false };
  }

  try {
    const progresso = await consultarProgresso(cliente, {}, agora);
    return {
      relatorioSemanal: progresso.relatorioSemanal,
      recuperacao: progresso.caderno.slice(0, TETO_DE_ERROS_NO_PAINEL),
      indisponivel: false,
    };
  } catch (erro) {
    reportarErro(erro, { modulo: "aluno", operacao: "consultar_painel_do_dia" });
    return { relatorioSemanal: null, recuperacao: [], indisponivel: true };
  }
}
