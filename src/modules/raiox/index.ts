import type { SupabaseClient } from "@supabase/supabase-js";

import { clienteDeServico } from "@/lib/db/servidor";

export type TendenciaRaioX = "subindo" | "estavel" | "caindo";

export type PerfilRaioX = {
  orgao: string;
  banca: string;
  dataProva: string | null;
  formato: string;
  /** IDs do programa vigente; a tela usa-os para cruzar o retrato pessoal. */
  programaEdital: string[];
};

export type LinhaRaioX = {
  topicoId: string;
  topico: string;
  peso: number;
  nQuestoes: number;
  tendencia: TendenciaRaioX;
  amostraBaixa: boolean;
};

export type DadosRaioX = {
  perfil: PerfilRaioX | null;
  linhas: LinhaRaioX[];
};

/**
 * As faixas usam o mesmo score 0..1 gravado em `dominio_topico`. Os limites
 * são fechados à esquerda no primeiro intervalo útil para que uma borda não
 * mude de faixa por arredondamento: 0,5 ainda é Fraco; 0,7 ainda é Em
 * desenvolvimento; 0,9 já é Dominado.
 */
export const LIMITES_DOMINIO = {
  fraco: 0.5,
  emDesenvolvimento: 0.7,
  forte: 0.9,
} as const;

export type FaixaDominio =
  | "nao_iniciado"
  | "fraco"
  | "em_desenvolvimento"
  | "forte"
  | "dominado";

export type EstadoCobertura = "coberto" | "nao_iniciado";
export type EstadoRevisao = "em_dia" | "devida" | "sem_agenda";

export type NivelPrioridade =
  | "maior_atencao"
  | "acompanhar"
  | "rotacao"
  | "sem_projecao";

export type LinhaMapaPrioridade = {
  topicoId: string;
  topico: string;
  /** Peso público. Nulo significa que a projeção da banca não existe. */
  peso: number | null;
  score: number | null;
  nRespostas: number;
  dominio: FaixaDominio;
  cobertura: EstadoCobertura;
  revisao: EstadoRevisao;
  due: string | null;
  /** Peso × fraqueza, sem fingir reproduzir o agendador SQL. */
  prioridade: number | null;
  nivel: NivelPrioridade;
  motivo: string;
  ordem: number;
};

export type DadosMapaPrioridade = {
  dataReferencia: string;
  linhas: LinhaMapaPrioridade[];
};

type PerfilBanco = {
  id: string;
  orgao: string;
  banca: string;
  data_prova: string | null;
  formato: string;
  programa_edital?: unknown;
};

type ProjecaoBanco = {
  topico_id: string;
  peso: number | string;
  n_questoes: number;
  tendencia: TendenciaRaioX;
  amostra_baixa: boolean;
};

type TopicoBanco = { id: string; nome: string };

type DominioBanco = {
  topico_id: string;
  n_respostas: number | string;
  score: number | string;
};

type RevisaoBanco = {
  topico_id: string;
  due: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function falhaAoLer(recurso: string, mensagem: string): Error {
  return new Error(`falha ao ler ${recurso}: ${mensagem}`);
}

function idsDoPrograma(valor: unknown): string[] {
  if (valor === undefined) return [];
  if (!Array.isArray(valor)) {
    throw falhaAoLer(
      "perfil_concurso",
      "programa_edital precisa ser uma lista de tópicos",
    );
  }

  const ids = valor.map((item) => (typeof item === "string" ? item : ""));
  if (ids.some((id) => !UUID.test(id))) {
    throw falhaAoLer("perfil_concurso", "programa_edital contém tópico inválido");
  }

  return [...new Set(ids)];
}

function numero(valor: number | string, campo: string): number {
  if (valor === null || valor === undefined || valor === "") {
    throw falhaAoLer(campo, "contém número inválido");
  }
  const convertido = Number(valor);
  if (!Number.isFinite(convertido)) {
    throw falhaAoLer(campo, "contém número inválido");
  }
  return convertido;
}

function dataValida(data: string, campo: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    throw falhaAoLer(campo, "contém data inválida");
  }
  const [ano, mes, dia] = data.split("-").map(Number);
  const calendario = new Date(Date.UTC(ano, mes - 1, dia));
  if (
    calendario.getUTCFullYear() !== ano ||
    calendario.getUTCMonth() !== mes - 1 ||
    calendario.getUTCDate() !== dia
  ) {
    throw falhaAoLer(campo, "contém data inválida");
  }
  return data;
}

function dataDeReferencia(agora: Date | string): string {
  if (typeof agora === "string") return dataValida(agora, "data de referência");

  if (Number.isNaN(agora.getTime())) {
    throw new Error("data de referência inválida");
  }

  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(agora)
    .reduce<Record<string, string>>((resultado, parte) => {
      if (parte.type !== "literal") resultado[parte.type] = parte.value;
      return resultado;
    }, {});

  return `${partes.year}-${partes.month}-${partes.day}`;
}

/** Classifica somente o retrato observado; a ausência de linha é o início. */
export function faixaDeDominio(
  score: number | null,
  nRespostas: number | null = null,
): FaixaDominio {
  if (
    nRespostas !== null &&
    (!Number.isInteger(nRespostas) || nRespostas < 0)
  ) {
    throw new Error("dominio_topico contém n_respostas inválido");
  }
  if (score !== null && (!Number.isFinite(score) || score < 0 || score > 1)) {
    throw new Error("dominio_topico contém score inválido");
  }
  if (nRespostas === 0) return "nao_iniciado";
  if (score === null) return "nao_iniciado";

  if (score <= LIMITES_DOMINIO.fraco) return "fraco";
  if (score <= LIMITES_DOMINIO.emDesenvolvimento) return "em_desenvolvimento";
  if (score < LIMITES_DOMINIO.forte) return "forte";
  return "dominado";
}

/** Nome alternativo explícito para consumidores que preferem o verbo. */
export const classificarDominio = faixaDeDominio;

function fraquezaDoMapa(score: number | null): number {
  // O motor W2 usa 0,9 como semente segura quando ainda não há domínio.
  return score === null ? 0.9 : 1 - score;
}

function motivoDaLinha(linha: {
  peso: number | null;
  cobertura: EstadoCobertura;
  dominio: FaixaDominio;
  revisao: EstadoRevisao;
}): string {
  if (linha.peso === null) {
    return "A frequência da banca ainda não tem projeção para este tópico.";
  }
  if (linha.revisao === "devida") {
    return "A revisão está devida; veja este tópico antes de deixar o conteúdo se afastar.";
  }
  if (linha.cobertura === "nao_iniciado") {
    return "Você ainda não respondeu este tópico; a cobertura do edital vem primeiro.";
  }
  if (linha.dominio === "fraco") {
    return "Seu domínio está fraco aqui, combinado com o peso observado da banca.";
  }
  if (linha.dominio === "em_desenvolvimento") {
    return "Seu domínio está em desenvolvimento; mantenha este tópico na rotação.";
  }
  return "Peso da banca, domínio e revisão estão estáveis; o ciclo mantém a rotação.";
}

function nivelDaLinha(linha: {
  peso: number | null;
  cobertura: EstadoCobertura;
  dominio: FaixaDominio;
  revisao: EstadoRevisao;
}): NivelPrioridade {
  if (linha.peso === null) return "sem_projecao";
  if (
    linha.revisao === "devida" ||
    linha.cobertura === "nao_iniciado" ||
    linha.dominio === "fraco"
  ) {
    return "maior_atencao";
  }
  if (linha.dominio === "em_desenvolvimento") return "acompanhar";
  return "rotacao";
}

function ordenarMapa(a: LinhaMapaPrioridade, b: LinhaMapaPrioridade): number {
  // É uma ordem de leitura, não uma segunda implementação do agendador. O
  // peso × fraqueza segue o sinal do W2; due e cobertura permanecem sinais
  // separados e só desempatem, para não ocultar um tópico muito relevante.
  const prioridadeA = a.prioridade ?? -1;
  const prioridadeB = b.prioridade ?? -1;
  if (prioridadeA !== prioridadeB) return prioridadeB - prioridadeA;
  if (a.revisao !== b.revisao) return a.revisao === "devida" ? -1 : 1;
  if (a.cobertura !== b.cobertura) {
    return a.cobertura === "nao_iniciado" ? -1 : 1;
  }
  const porNome = a.topico.localeCompare(b.topico, "pt-BR");
  return porNome !== 0 ? porNome : a.topicoId.localeCompare(b.topicoId);
}

/**
 * Leitura pública do M5. O cliente de serviço fica aqui, no servidor; a tela
 * recebe apenas o perfil e os campos que precisa apresentar.
 */
export async function consultarRaioX(
  cliente: SupabaseClient = clienteDeServico(),
): Promise<DadosRaioX> {
  const perfilConsulta = await cliente
    .from("perfil_concurso")
    .select("id, orgao, banca, data_prova, formato, programa_edital")
    .eq("ativo", true)
    .maybeSingle();

  if (perfilConsulta.error) {
    throw falhaAoLer("perfil_concurso", perfilConsulta.error.message);
  }

  const perfil = perfilConsulta.data as PerfilBanco | null;
  if (!perfil) return { perfil: null, linhas: [] };

  const projecoesConsulta = await cliente
    .from("raiox_projecoes")
    .select("topico_id, peso, n_questoes, tendencia, amostra_baixa")
    .eq("perfil_concurso_id", perfil.id)
    .order("peso", { ascending: false })
    .order("topico_id", { ascending: true });

  if (projecoesConsulta.error) {
    throw falhaAoLer("raiox_projecoes", projecoesConsulta.error.message);
  }

  const projecoes = (projecoesConsulta.data ?? []) as ProjecaoBanco[];
  if (projecoes.length === 0) {
    return {
      perfil: {
        orgao: perfil.orgao,
        banca: perfil.banca,
        dataProva: perfil.data_prova,
        formato: perfil.formato,
        programaEdital: idsDoPrograma(perfil.programa_edital),
      },
      linhas: [],
    };
  }

  const topicoIds = projecoes.map((projecao) => projecao.topico_id);
  const topicosConsulta = await cliente
    .from("topicos")
    .select("id, nome")
    .in("id", topicoIds);

  if (topicosConsulta.error) {
    throw falhaAoLer("topicos", topicosConsulta.error.message);
  }

  const nomes = new Map(
    ((topicosConsulta.data ?? []) as TopicoBanco[]).map((topico) => [
      topico.id,
      topico.nome,
    ]),
  );

  if (nomes.size !== new Set(topicoIds).size) {
    throw new Error("raiox_projecoes aponta para tópico que não existe");
  }

  return {
    perfil: {
      orgao: perfil.orgao,
      banca: perfil.banca,
      dataProva: perfil.data_prova,
      formato: perfil.formato,
      programaEdital: idsDoPrograma(perfil.programa_edital),
    },
    linhas: projecoes.map((projecao) => {
      const peso = Number(projecao.peso);
      if (!Number.isFinite(peso)) {
        throw new Error("raiox_projecoes contém peso inválido");
      }

      return {
        topicoId: projecao.topico_id,
        topico: nomes.get(projecao.topico_id)!,
        peso,
        nQuestoes: Number(projecao.n_questoes),
        tendencia: projecao.tendencia,
        amostraBaixa: projecao.amostra_baixa,
      };
    }),
  };
}

/**
 * Cruza o retrato público com o retrato do aluno.
 *
 * O segundo retrato sempre usa o cliente da sessão: as três tabelas abaixo
 * têm RLS por `auth.uid()`. O perfil e suas projeções chegam em `dados` pela
 * leitura pública anterior e nunca são relidos com a chave de serviço aqui.
 */
export async function consultarMapaPrioridade(
  cliente: SupabaseClient,
  dados: DadosRaioX,
  agora: Date | string = new Date(),
): Promise<DadosMapaPrioridade> {
  const dataReferencia = dataDeReferencia(agora);
  const programa = dados.perfil?.programaEdital ?? [];
  if (programa.length === 0) return { dataReferencia, linhas: [] };

  const [dominioConsulta, revisaoConsulta, topicosConsulta] = await Promise.all([
    cliente
      .from("dominio_topico")
      .select("topico_id, n_respostas, score")
      .in("topico_id", programa),
    cliente
      .from("revisao_agenda")
      .select("topico_id, due")
      .in("topico_id", programa),
    cliente.from("topicos").select("id, nome").in("id", programa),
  ]);

  if (dominioConsulta.error) {
    throw falhaAoLer("dominio_topico", dominioConsulta.error.message);
  }
  if (revisaoConsulta.error) {
    throw falhaAoLer("revisao_agenda", revisaoConsulta.error.message);
  }
  if (topicosConsulta.error) {
    throw falhaAoLer("topicos", topicosConsulta.error.message);
  }

  const dominios = (dominioConsulta.data ?? []) as DominioBanco[];
  const revisoes = (revisaoConsulta.data ?? []) as RevisaoBanco[];
  const topicos = (topicosConsulta.data ?? []) as TopicoBanco[];
  const nomes = new Map(topicos.map((topico) => [topico.id, topico.nome]));

  if (nomes.size !== programa.length) {
    throw falhaAoLer(
      "topicos",
      "o programa do perfil aponta para tópico que não existe",
    );
  }

  const dominioPorTopico = new Map<string, DominioBanco>();
  for (const dominio of dominios) {
    if (dominioPorTopico.has(dominio.topico_id)) {
      throw falhaAoLer("dominio_topico", "há mais de uma linha para o mesmo tópico");
    }
    dominioPorTopico.set(dominio.topico_id, dominio);
  }

  const revisaoPorTopico = new Map<string, RevisaoBanco>();
  for (const revisao of revisoes) {
    if (revisaoPorTopico.has(revisao.topico_id)) {
      throw falhaAoLer("revisao_agenda", "há mais de uma linha para o mesmo tópico");
    }
    revisaoPorTopico.set(revisao.topico_id, revisao);
  }

  const linhas = programa.map((topicoId) => {
    const dominio = dominioPorTopico.get(topicoId);
    const nRespostas = dominio
      ? numero(dominio.n_respostas, "dominio_topico.n_respostas")
      : 0;
    if (!Number.isInteger(nRespostas) || nRespostas < 0) {
      throw falhaAoLer("dominio_topico", "n_respostas inválido");
    }

    const score = dominio
      ? numero(dominio.score, "dominio_topico.score")
      : null;
    if (score !== null && (score < 0 || score > 1)) {
      throw falhaAoLer("dominio_topico", "score fora do intervalo 0..1");
    }
    const faixa = faixaDeDominio(score, nRespostas);
    const cobertura: EstadoCobertura = nRespostas > 0 ? "coberto" : "nao_iniciado";
    const agenda = revisaoPorTopico.get(topicoId);
    const due = agenda ? dataValida(agenda.due, "revisao_agenda.due") : null;
    const revisao: EstadoRevisao = due
      ? due <= dataReferencia
        ? "devida"
        : "em_dia"
      : "sem_agenda";
    const projection = dados.linhas.find((linha) => linha.topicoId === topicoId);
    const peso = projection?.peso ?? null;
    const prioridade =
      peso === null
        ? null
        : Number((peso * fraquezaDoMapa(score)).toFixed(6));
    const sinais = { peso, cobertura, dominio: faixa, revisao };

    return {
      topicoId,
      topico: nomes.get(topicoId)!,
      peso,
      score,
      nRespostas,
      dominio: faixa,
      cobertura,
      revisao,
      due,
      prioridade,
      nivel: nivelDaLinha(sinais),
      motivo: motivoDaLinha(sinais),
      ordem: 0,
    } satisfies LinhaMapaPrioridade;
  });

  linhas.sort(ordenarMapa);
  return {
    dataReferencia,
    linhas: linhas.map((linha, indice) => ({ ...linha, ordem: indice + 1 })),
  };
}
