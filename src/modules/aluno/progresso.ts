import type { SupabaseClient } from "@supabase/supabase-js";

import { clienteDeServico } from "@/lib/db/servidor";

import { CONTEXTOS, type Contexto } from "./tentativas";

export const CAUSAS_DO_CADERNO = [
  "nao_sabia_conteudo",
  "errei_a_conta",
  "entendi_errado_enunciado",
  "confundi_conceitos",
  "fiquei_na_duvida",
  "chutei",
  "nao_sei_dizer",
  "faltou_tempo",
] as const;

export type CausaDoCaderno = (typeof CAUSAS_DO_CADERNO)[number];

export type FiltrosProgresso = {
  causa: CausaDoCaderno | null;
  topicoId: string | null;
};

export type LinhaHistorico = {
  topicoId: string;
  topico: string;
  nRespostas: number;
  nAcertos: number;
  score: number;
};

export type LinhaCaderno = {
  topicoId: string;
  topico: string;
  causa: CausaDoCaderno;
  nErros: number;
  ultimoErroEm: string;
};

export type EstadoDaSequencia = {
  data: string;
  sequencia: number;
  estado:
    | "cumprido"
    | "piso_pendente"
    | "fora_agenda"
    | "folga"
    | "plano_indisponivel";
  pisoEntregue: boolean;
  pisoCumprido: boolean;
  temHistorico: boolean;
};

export type DadosProgresso = {
  filtros: FiltrosProgresso;
  historico: LinhaHistorico[];
  caderno: LinhaCaderno[];
  topicos: Array<{ id: string; nome: string }>;
  sequencia: EstadoDaSequencia | null;
  estadoInicial: boolean;
};

export type ResultadoDaFinalizacao = {
  userId: string;
  contexto: Contexto;
  topicoId: string | null;
  nRespostas: number;
  nAcertos: number;
};

type EntradaDeFiltro = {
  causa?: unknown;
  topico?: unknown;
  topicoId?: unknown;
};

type DominioBanco = {
  topico_id: string;
  n_respostas: number | string;
  n_acertos: number | string;
  score: number | string;
};

type CadernoBanco = {
  topico_id: string;
  causa_erro: string;
  n_erros: number | string;
  ultimo_erro_em: string;
};

type TopicoBanco = { id: string; nome: string };

type SequenciaBanco = {
  data: string;
  sequencia: number | string;
  estado: EstadoDaSequencia["estado"];
  piso_entregue: boolean;
  piso_cumprido: boolean;
  tem_historico: boolean;
};

type SessaoFinalizadaBanco = {
  contexto: string;
  encerrada_em: string | null;
};

type TentativaDoBlocoBanco = {
  topico_id: string;
  correta: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function texto(valor: unknown): string | null {
  if (Array.isArray(valor)) return texto(valor[0]);
  if (typeof valor !== "string") return null;
  const normalizado = valor.trim();
  return normalizado === "" ? null : normalizado;
}

function causaValida(valor: unknown): CausaDoCaderno | null {
  const normalizado = texto(valor);
  return (CAUSAS_DO_CADERNO as readonly string[]).includes(normalizado ?? "")
    ? (normalizado as CausaDoCaderno)
    : null;
}

/**
 * Query string é entrada não confiável. Filtro desconhecido vira ausência de
 * filtro e nunca atravessa a fronteira para um `.eq()` ou `.in()`.
 */
export function normalizarFiltrosProgresso(entrada: unknown): FiltrosProgresso {
  const objeto =
    typeof entrada === "object" && entrada !== null
      ? (entrada as EntradaDeFiltro)
      : {};
  const topico = texto(objeto.topicoId ?? objeto.topico);

  return {
    causa: causaValida(objeto.causa),
    topicoId: topico && UUID.test(topico) ? topico : null,
  };
}

function falhaAoLer(recurso: string, mensagem: string): Error {
  return new Error(`falha ao ler ${recurso}: ${mensagem}`);
}

function numero(valor: number | string, campo: string): number {
  const convertido = Number(valor);
  if (!Number.isFinite(convertido)) {
    throw new Error(`${campo} contém número inválido`);
  }
  return convertido;
}

/**
 * Reconstroi a projecao assim que uma sessao fecha e devolve o placar do bloco.
 *
 * `recalcula_projecoes` e uma RPC de bastidor, revogada para o navegador. O
 * cliente de servico e usado somente depois de `auth.getUser()` confirmar o
 * titular; as leituras do placar continuam no cliente da sessao, sob RLS. O
 * percentual de revisao nasce dessas linhas, nunca do formulario.
 */
export async function finalizarBloco(
  cliente: SupabaseClient,
  sessaoId: string,
): Promise<ResultadoDaFinalizacao> {
  const {
    data: usuario,
    error: erroDaSessao,
  } = await cliente.auth.getUser();
  if (erroDaSessao) throw falhaAoLer("identidade da sessão", erroDaSessao.message);
  if (usuario.user === null) throw new Error("sessão autenticada ausente");

  const recalc = await clienteDeServico().rpc("recalcula_projecoes", {
    p_user_id: usuario.user.id,
  });
  if (recalc.error) throw falhaAoLer("projeções", recalc.error.message);
  const linhasRecalculadas = Array.isArray(recalc.data)
    ? recalc.data[0]
    : recalc.data;
  const nRecalculadas = Number(linhasRecalculadas);
  if (!Number.isFinite(nRecalculadas)) {
    throw new Error("recalcula_projecoes devolveu contagem inválida");
  }
  if (nRecalculadas === -1) {
    throw new Error("recalcula_projecoes está ocupada; tente novamente em instantes");
  }

  const sessaoConsulta = await cliente
    .from("sessoes")
    .select("contexto, encerrada_em")
    .eq("id", sessaoId)
    .maybeSingle();
  if (sessaoConsulta.error) {
    throw falhaAoLer("sessão finalizada", sessaoConsulta.error.message);
  }
  const sessao = sessaoConsulta.data as SessaoFinalizadaBanco | null;
  if (sessao === null) throw new Error("sessão finalizada não encontrada");
  if (sessao.encerrada_em === null) {
    throw new Error("sessão ainda não está encerrada");
  }
  if (!(CONTEXTOS as readonly string[]).includes(sessao.contexto)) {
    throw new Error("sessão finalizada devolveu contexto inválido");
  }

  const tentativasConsulta = await cliente
    .from("tentativas")
    .select("topico_id, correta")
    .eq("sessao_id", sessaoId)
    .eq("user_id", usuario.user.id);
  if (tentativasConsulta.error) {
    throw falhaAoLer("tentativas do bloco", tentativasConsulta.error.message);
  }
  const tentativas = (tentativasConsulta.data ?? []) as TentativaDoBlocoBanco[];
  if (tentativas.length === 0) {
    throw new Error("sessão finalizada não possui tentativas");
  }

  const nRespostas = tentativas.length;
  const nAcertos = tentativas.filter((tentativa) => tentativa.correta).length;
  if (tentativas.some((tentativa) => typeof tentativa.topico_id !== "string")) {
    throw new Error("tentativa do bloco devolveu tópico inválido");
  }
  const topicos = [...new Set(tentativas.map((tentativa) => tentativa.topico_id))];
  const topicoId = topicos.length === 1 ? topicos[0] : null;
  if (sessao.contexto === "revisao" && topicoId === null) {
    throw new Error("bloco de revisão precisa de um único tópico");
  }

  return {
    userId: usuario.user.id,
    contexto: sessao.contexto as Contexto,
    topicoId,
    nRespostas,
    nAcertos,
  };
}

function mapearSequencia(linha: SequenciaBanco | undefined): EstadoDaSequencia | null {
  if (!linha) return null;
  return {
    data: linha.data,
    sequencia: numero(linha.sequencia, "sequencia_dia.sequencia"),
    estado: linha.estado,
    pisoEntregue: linha.piso_entregue,
    pisoCumprido: linha.piso_cumprido,
    temHistorico: linha.tem_historico,
  };
}

/**
 * Lê somente as projeções próprias expostas pela RLS. `tentativas` nunca é
 * consultada nesta superfície: o log continua sendo fonte de reconstrução,
 * não fonte de renderização.
 */
export async function consultarProgresso(
  cliente: SupabaseClient,
  entrada: unknown = {},
): Promise<DadosProgresso> {
  const filtros = normalizarFiltrosProgresso(entrada);

  let dominioBuilder = cliente
    .from("dominio_topico")
    .select("topico_id, n_respostas, n_acertos, score");
  if (filtros.topicoId) dominioBuilder = dominioBuilder.eq("topico_id", filtros.topicoId);

  let cadernoBuilder = cliente
    .from("caderno_erros")
    .select("topico_id, causa_erro, n_erros, ultimo_erro_em");
  if (filtros.causa) cadernoBuilder = cadernoBuilder.eq("causa_erro", filtros.causa);
  if (filtros.topicoId) cadernoBuilder = cadernoBuilder.eq("topico_id", filtros.topicoId);

  const [dominioConsulta, cadernoConsulta, sequenciaConsulta] = await Promise.all([
    dominioBuilder.order("n_respostas", { ascending: false }).order("topico_id", { ascending: true }),
    cadernoBuilder.order("n_erros", { ascending: false }).order("ultimo_erro_em", { ascending: false }),
    cliente.rpc("consultar_sequencia_do_dia"),
  ]);

  if (dominioConsulta.error) {
    throw falhaAoLer("dominio_topico", dominioConsulta.error.message);
  }
  if (cadernoConsulta.error) {
    throw falhaAoLer("caderno_erros", cadernoConsulta.error.message);
  }
  if (sequenciaConsulta.error) {
    throw falhaAoLer("sequência", sequenciaConsulta.error.message);
  }

  const dominioLinhas = (dominioConsulta.data ?? []) as DominioBanco[];
  const cadernoLinhas = (cadernoConsulta.data ?? []) as CadernoBanco[];
  const ids = [
    ...new Set([
      ...dominioLinhas.map((linha) => linha.topico_id),
      ...cadernoLinhas.map((linha) => linha.topico_id),
    ]),
  ];

  let topicos: TopicoBanco[] = [];
  if (ids.length > 0) {
    const topicosConsulta = await cliente
      .from("topicos")
      .select("id, nome")
      .in("id", ids);

    if (topicosConsulta.error) {
      throw falhaAoLer("tópicos", topicosConsulta.error.message);
    }
    topicos = (topicosConsulta.data ?? []) as TopicoBanco[];

    if (topicos.length !== ids.length) {
      throw new Error("projeção de progresso aponta para tópico que não existe");
    }
  }

  const nomes = new Map(topicos.map((topico) => [topico.id, topico.nome]));
  const historico: LinhaHistorico[] = dominioLinhas.map((linha) => ({
    topicoId: linha.topico_id,
    topico: nomes.get(linha.topico_id)!,
    nRespostas: numero(linha.n_respostas, "dominio_topico.n_respostas"),
    nAcertos: numero(linha.n_acertos, "dominio_topico.n_acertos"),
    score: numero(linha.score, "dominio_topico.score"),
  }));

  const cadernoMapeado: LinhaCaderno[] = cadernoLinhas.map((linha) => {
    if (!(CAUSAS_DO_CADERNO as readonly string[]).includes(linha.causa_erro)) {
      throw new Error("caderno_erros contém causa inválida");
    }

    return {
      topicoId: linha.topico_id,
      topico: nomes.get(linha.topico_id)!,
      causa: linha.causa_erro as CausaDoCaderno,
      nErros: numero(linha.n_erros, "caderno_erros.n_erros"),
      ultimoErroEm: linha.ultimo_erro_em,
    };
  });

  const sequencia = mapearSequencia(
    ((sequenciaConsulta.data ?? []) as SequenciaBanco[])[0],
  );
  const temHistorico =
    sequencia?.temHistorico ?? (historico.length > 0 || cadernoMapeado.length > 0);

  return {
    filtros,
    historico,
    caderno: cadernoMapeado,
    topicos: topicos
      .map(({ id, nome }) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    sequencia,
    estadoInicial: !temHistorico,
  };
}
