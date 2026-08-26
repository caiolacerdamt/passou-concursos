import type { SupabaseClient } from "@supabase/supabase-js";

import {
  consultarRecursosDoTopico,
  consultarRecursosVistos,
  type RecursoDeEstudoComVisto,
} from "@/modules/acervo/recursos";
import type { NivelDoPlano, TipoDeBloco } from "@/modules/aluno/plano";

type LinhaDoBloco = {
  id: string;
  tipo: TipoDeBloco;
  nivel: NivelDoPlano;
  ordem: number;
  topico_id: string | null;
  n_questoes?: number | null;
  n_questoes_cheias?: number | null;
  minutos_estimados: number;
  minutos_estimados_cheios?: number | null;
  motivo: string | null;
  ajuste_usuario?: boolean | null;
  adiado_de?: string | null;
};

type LinhaDoTopico = {
  id: string;
  materia_id: string;
  nome: string;
};

type LinhaDaMateria = { id: string; nome: string };

type LinhaDaSessaoDoBloco = {
  id: string;
  encerrada_em: string | null;
};

type LinhaDoItemDaSessao = {
  id: string;
  respondido_em: string | null;
};

export type SnapshotDoBlocoDeEstudo = {
  id: string;
  tipo: TipoDeBloco;
  nivel: NivelDoPlano;
  ordem: number;
  topicoId: string | null;
  nQuestoes: number;
  nQuestoesCheias: number;
  minutosEstimados: number;
  minutosEstimadosCheios: number;
  motivo: string | null;
  ajusteUsuario: boolean;
  adiadoDe: string | null;
};

export type DadosDoEstudoGuiado = {
  bloco: SnapshotDoBlocoDeEstudo;
  materia: string | null;
  topico: string | null;
  recursos: readonly RecursoDeEstudoComVisto[];
  andamento: AndamentoDoBloco | null;
};

export type AndamentoDoBloco = {
  respondidas: number;
  total: number;
};

export class EstudoGuiadoRecusado extends Error {
  readonly motivo:
    | "bloco_inexistente"
    | "bloco_concluido"
    | "falha_leitura";

  constructor(
    motivo: EstudoGuiadoRecusado["motivo"],
    mensagem: string,
  ) {
    super(mensagem);
    this.name = "EstudoGuiadoRecusado";
    this.motivo = motivo;
  }
}

/**
 * Lê a mesa de estudo com o cliente autenticado. A RLS é a fronteira de
 * propriedade do bloco, tópicos e recursos; nenhuma consulta usa a
 * chave de serviço ou tenta descobrir conteúdo fora do banco.
 */
export async function consultarEstudoGuiado(
  cliente: SupabaseClient,
  blocoId: string,
): Promise<DadosDoEstudoGuiado> {
  const bloco = await lerUma<LinhaDoBloco>(
    cliente
      .from("plano_bloco")
      .select(
        "id, tipo, nivel, ordem, topico_id, n_questoes, n_questoes_cheias, minutos_estimados, minutos_estimados_cheios, motivo, ajuste_usuario, adiado_de",
      )
      .eq("id", blocoId)
      .maybeSingle(),
    "bloco de estudo",
  );

  if (bloco === null) {
    throw new EstudoGuiadoRecusado(
      "bloco_inexistente",
      "O bloco não existe ou não pertence ao aluno.",
    );
  }

  const sessoesDoBloco = await lerLista<LinhaDaSessaoDoBloco>(
    cliente
      .from("sessoes")
      .select("id, encerrada_em")
      .eq("plano_bloco_id", bloco.id)
      .order("iniciada_em", { ascending: false }),
    "sessões do bloco",
  );

  if (sessoesDoBloco.some((sessao) => sessao.encerrada_em !== null)) {
    throw new EstudoGuiadoRecusado(
      "bloco_concluido",
      "Este bloco já foi concluído.",
    );
  }

  const sessaoAberta = sessoesDoBloco.find((sessao) => sessao.encerrada_em === null) ?? null;
  const andamento = sessaoAberta === null ? null : await lerAndamento(cliente, sessaoAberta.id);
  const snapshot = mapearSnapshot(bloco);
  if (bloco.topico_id === null) {
    return {
      bloco: snapshot,
      materia: null,
      topico: null,
      recursos: [],
      andamento,
    };
  }

  const topico = await lerUma<LinhaDoTopico>(
    cliente
      .from("topicos")
      .select("id, materia_id, nome")
      .eq("id", bloco.topico_id)
      .maybeSingle(),
    "tópico do bloco",
  );

  const recursos = await lerRecursos(cliente, bloco.topico_id);

  let materia: LinhaDaMateria | null = null;
  if (topico !== null) {
    materia = await lerUma<LinhaDaMateria>(
      cliente
        .from("materias")
        .select("id, nome")
        .eq("id", topico.materia_id)
        .maybeSingle(),
      "matéria do tópico",
    );
  }

  return {
    bloco: snapshot,
    materia: materia?.nome ?? null,
    topico: topico?.nome ?? null,
    recursos,
    andamento,
  };
}

function mapearSnapshot(bloco: LinhaDoBloco): SnapshotDoBlocoDeEstudo {
  return {
    id: String(bloco.id),
    tipo: bloco.tipo,
    nivel: bloco.nivel,
    ordem: Number(bloco.ordem),
    topicoId: bloco.topico_id,
    nQuestoes: Number(bloco.n_questoes ?? 0),
    nQuestoesCheias: Number(bloco.n_questoes_cheias ?? bloco.n_questoes ?? 0),
    minutosEstimados: Number(bloco.minutos_estimados),
    minutosEstimadosCheios: Number(
      bloco.minutos_estimados_cheios ?? bloco.minutos_estimados,
    ),
    motivo: bloco.motivo,
    ajusteUsuario: bloco.ajuste_usuario === true,
    adiadoDe: bloco.adiado_de ?? null,
  };
}

async function lerRecursos(
  cliente: SupabaseClient,
  topicoId: string,
): Promise<readonly RecursoDeEstudoComVisto[]> {
  try {
    const recursos = await consultarRecursosDoTopico(cliente, topicoId);
    const vistos = await consultarRecursosVistos(
      cliente,
      recursos.map((recurso) => recurso.id),
    );
    return recursos.map((recurso) => ({ ...recurso, visto: vistos.has(recurso.id) }));
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "resposta inválida";
    throw new EstudoGuiadoRecusado(
      "falha_leitura",
      `Falha ao ler recursos curados: ${mensagem}`,
    );
  }
}

async function lerUma<T>(
  consulta: PromiseLike<{ data: T | null; error: { message: string } | null }>,
  nome: string,
): Promise<T | null> {
  const { data, error } = await consulta;
  if (error) {
    throw new EstudoGuiadoRecusado(
      "falha_leitura",
      `Falha ao ler ${nome}: ${error.message}`,
    );
  }
  return data;
}

async function lerLista<T>(
  consulta: PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  nome: string,
): Promise<T[]> {
  const { data, error } = await consulta;
  if (error) {
    throw new EstudoGuiadoRecusado(
      "falha_leitura",
      `Falha ao ler ${nome}: ${error.message}`,
    );
  }
  return data ?? [];
}

async function lerAndamento(
  cliente: SupabaseClient,
  sessaoId: string,
): Promise<AndamentoDoBloco> {
  const itens = await lerLista<LinhaDoItemDaSessao>(
    cliente
      .from("sessao_itens")
      .select("id, respondido_em")
      .eq("sessao_id", sessaoId),
    "andamento da sessão",
  );
  return {
    respondidas: itens.filter((item) => item.respondido_em !== null).length,
    total: itens.length,
  };
}
