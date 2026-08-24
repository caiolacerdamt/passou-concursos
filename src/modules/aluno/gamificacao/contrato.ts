import type { SupabaseClient } from "@supabase/supabase-js";

/** Estados que a missão calculada pelo servidor pode assumir. */
export const ESTADOS_DA_MISSAO = [
  "pendente",
  "em_andamento",
  "concluida",
  "indisponivel",
] as const;
export type EstadoDaMissao = (typeof ESTADOS_DA_MISSAO)[number];

/** Missões determinísticas; não existe moeda, loja, liga ou vida. */
export const TIPOS_DE_MISSAO = [
  "concluir_piso",
  "responder_questoes",
  "sem_plano",
] as const;
export type TipoDeMissao = (typeof TIPOS_DE_MISSAO)[number];

/** Catálogo pessoal pequeno e explícito. O servidor devolve apenas desbloqueios. */
export const CATALOGO_DE_CONQUISTAS = [
  {
    id: "primeiro_bloco",
    titulo: "Primeiro bloco",
    descricao: "Concluiu o primeiro bloco do plano com respostas registradas.",
  },
  {
    id: "primeira_revisao",
    titulo: "Primeira revisão",
    descricao: "Concluiu a primeira revisão do plano com respostas registradas.",
  },
  {
    id: "sequencia_pessoal",
    titulo: "Ritmo pessoal",
    descricao: "Atingiu a meta configurada de dias cumpridos em sequência.",
  },
  {
    id: "cem_questoes",
    titulo: "Cem questões",
    descricao: "Respondeu a meta configurada de questões no próprio ritmo.",
  },
] as const;
export type IdDaConquista = (typeof CATALOGO_DE_CONQUISTAS)[number]["id"];

export type DimensaoDoAnel = {
  /** Progresso visual, sempre limitado à meta. */
  progresso: number;
  /** Teto derivado da `meta_cheia` do plano de hoje. */
  meta: number;
  /** Valor bruto server-trusted, preservado para auditoria. */
  bruto: number;
  /** Proporção pronta para apresentação, entre 0 e 1. */
  percentual: number;
  concluido: boolean;
};

export type AnelDoDia = {
  estudo: DimensaoDoAnel;
  questoes: DimensaoDoAnel;
  revisao: DimensaoDoAnel;
};

export type DiscriminacaoDePontos = {
  estudoPrioritario: number;
  conclusao: number;
  revisaoNoPrazo: number;
  recuperacaoErro: number;
};

export type PontosDaGamificacao = {
  dia: number;
  total: number;
  discriminacao: DiscriminacaoDePontos;
};

export type MissaoDoDia = {
  id: string;
  tipo: TipoDeMissao;
  progresso: number;
  /** Valor bruto antes do teto visual da meta. */
  progressoBruto: number;
  meta: number;
  estado: EstadoDaMissao;
};

export type SequenciaVigente = {
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

export type ConquistaPessoal = {
  id: IdDaConquista;
  titulo: string;
  descricao: string;
  desbloqueada: boolean;
  desbloqueadaEm: string | null;
};

export type EstadoDaGamificacao = "ok" | "desligada";

export type DadosGamificacao = {
  data: string;
  habilitada: boolean;
  estado: EstadoDaGamificacao;
  anel: AnelDoDia;
  pontos: PontosDaGamificacao;
  missao: MissaoDoDia | null;
  /** O contrato reutiliza a mesma semântica da RPC de sequência vigente. */
  sequencia: SequenciaVigente | null;
  conquistas: readonly ConquistaPessoal[];
};

export type MotivoDaRecusaDaGamificacao =
  | "falha_leitura"
  | "resposta_invalida"
  | "estado_erro";

export class GamificacaoRecusada extends Error {
  readonly motivo: MotivoDaRecusaDaGamificacao;

  constructor(motivo: MotivoDaRecusaDaGamificacao, mensagem: string) {
    super(mensagem);
    this.name = "GamificacaoRecusada";
    this.motivo = motivo;
  }
}

type LinhaDaDimensao = {
  progresso?: unknown;
  meta?: unknown;
  bruto?: unknown;
  percentual?: unknown;
  concluido?: unknown;
};

type LinhaDaResposta = {
  data?: unknown;
  habilitada?: unknown;
  estado?: unknown;
  codigo_erro?: unknown;
  anel?: {
    estudo?: LinhaDaDimensao;
    questoes?: LinhaDaDimensao;
    revisao?: LinhaDaDimensao;
  };
  pontos?: {
    dia?: unknown;
    total?: unknown;
    discriminacao?: {
      estudo_prioritario?: unknown;
      conclusao?: unknown;
      revisao_no_prazo?: unknown;
      recuperacao_erro?: unknown;
    };
  };
  missao?: {
    id?: unknown;
    tipo?: unknown;
    progresso?: unknown;
    progresso_bruto?: unknown;
    meta?: unknown;
    estado?: unknown;
  } | null;
  sequencia?: unknown;
  conquistas?: unknown;
};

type LinhaDaSequencia = {
  data?: unknown;
  sequencia?: unknown;
  estado?: unknown;
  piso_entregue?: unknown;
  piso_cumprido?: unknown;
  tem_historico?: unknown;
};

type LinhaDaConquista = {
  id?: unknown;
  desbloqueada_em?: unknown;
};

const ESTADOS_DA_SEQUENCIA = [
  "cumprido",
  "piso_pendente",
  "fora_agenda",
  "folga",
  "plano_indisponivel",
] as const;

function objeto(valor: unknown, campo: string): Record<string, unknown> {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) {
    throw new GamificacaoRecusada("resposta_invalida", `${campo} inválido`);
  }
  return valor as Record<string, unknown>;
}

function numero(valor: unknown, campo: string): number {
  const convertido = typeof valor === "number" ? valor : Number(valor);
  if (!Number.isFinite(convertido) || convertido < 0) {
    throw new GamificacaoRecusada("resposta_invalida", `${campo} contém número inválido`);
  }
  return convertido;
}

function booleano(valor: unknown, campo: string): boolean {
  if (typeof valor !== "boolean") {
    throw new GamificacaoRecusada("resposta_invalida", `${campo} contém booleano inválido`);
  }
  return valor;
}

function texto(valor: unknown, campo: string): string {
  if (typeof valor !== "string" || valor.trim() === "") {
    throw new GamificacaoRecusada("resposta_invalida", `${campo} contém texto inválido`);
  }
  return valor;
}

function limitar(valor: number, meta: number): number {
  return Math.min(valor, meta);
}

function mapearDimensao(
  linha: LinhaDaDimensao | undefined,
  campo: string,
): DimensaoDoAnel {
  const bruto = numero(linha?.bruto, `${campo}.bruto`);
  const meta = numero(linha?.meta, `${campo}.meta`);
  const progressoInformado = numero(linha?.progresso, `${campo}.progresso`);
  const progresso = limitar(progressoInformado, meta);
  const percentualInformado = numero(linha?.percentual, `${campo}.percentual`);
  if (percentualInformado > 1) {
    throw new GamificacaoRecusada(
      "resposta_invalida",
      `${campo}.percentual ultrapassa 100%`,
    );
  }

  return {
    progresso,
    meta,
    bruto,
    percentual: percentualInformado,
    concluido: booleano(linha?.concluido, `${campo}.concluido`),
  };
}

function mapearSequencia(valor: unknown): SequenciaVigente | null {
  if (valor === null || valor === undefined) return null;
  const linha = objeto(valor, "sequencia") as LinhaDaSequencia;
  const estado = texto(linha.estado, "sequencia.estado");
  if (!(ESTADOS_DA_SEQUENCIA as readonly string[]).includes(estado)) {
    throw new GamificacaoRecusada("resposta_invalida", "sequencia.estado inválido");
  }
  return {
    data: texto(linha.data, "sequencia.data"),
    sequencia: numero(linha.sequencia, "sequencia.sequencia"),
    estado: estado as SequenciaVigente["estado"],
    pisoEntregue: booleano(linha.piso_entregue, "sequencia.piso_entregue"),
    pisoCumprido: booleano(linha.piso_cumprido, "sequencia.piso_cumprido"),
    temHistorico: booleano(linha.tem_historico, "sequencia.tem_historico"),
  };
}

function mapearConquistas(valor: unknown): ConquistaPessoal[] {
  if (!Array.isArray(valor)) {
    throw new GamificacaoRecusada("resposta_invalida", "conquistas inválidas");
  }
  const desbloqueios = new Map<IdDaConquista, string>();
  for (const item of valor) {
    const linha = objeto(item, "conquista") as LinhaDaConquista;
    const id = texto(linha.id, "conquista.id");
    if (!(CATALOGO_DE_CONQUISTAS as readonly { id: string }[]).some((x) => x.id === id)) {
      throw new GamificacaoRecusada("resposta_invalida", "conquista desconhecida");
    }
    const desbloqueadaEm = texto(linha.desbloqueada_em, "conquista.desbloqueada_em");
    desbloqueios.set(id as IdDaConquista, desbloqueadaEm);
  }

  return CATALOGO_DE_CONQUISTAS.map((conquista) => ({
    ...conquista,
    desbloqueada: desbloqueios.has(conquista.id),
    desbloqueadaEm: desbloqueios.get(conquista.id) ?? null,
  }));
}

function vazioDoAnel(): AnelDoDia {
  const vazio: DimensaoDoAnel = {
    progresso: 0,
    meta: 0,
    bruto: 0,
    percentual: 0,
    concluido: false,
  };
  return { estudo: vazio, questoes: vazio, revisao: vazio };
}

function vaziosDePontos(): PontosDaGamificacao {
  return {
    dia: 0,
    total: 0,
    discriminacao: {
      estudoPrioritario: 0,
      conclusao: 0,
      revisaoNoPrazo: 0,
      recuperacaoErro: 0,
    },
  };
}

/**
 * Mapeia a única resposta pública de gamificação.
 *
 * O navegador recebe fatos já calculados pelo SQL: o único limite aplicado
 * aqui é uma defesa adicional do contrato visual. `bruto` nunca é descartado.
 */
export function mapearGamificacao(valor: unknown): DadosGamificacao {
  const linha = objeto(valor, "gamificação") as LinhaDaResposta;
  const data = texto(linha.data, "data");
  const habilitada = booleano(linha.habilitada, "habilitada");
  const estado = texto(linha.estado, "estado");
  if (estado === "erro") {
    throw new GamificacaoRecusada(
      "estado_erro",
      typeof linha.codigo_erro === "string"
        ? `gamificação indisponível: ${linha.codigo_erro}`
        : "gamificação indisponível",
    );
  }
  if (estado !== "ok" && estado !== "desligada") {
    throw new GamificacaoRecusada("resposta_invalida", "estado da gamificação inválido");
  }
  if (habilitada !== (estado === "ok")) {
    throw new GamificacaoRecusada(
      "resposta_invalida",
      "estado e flag da gamificação não combinam",
    );
  }

  const anel = habilitada
    ? {
        estudo: mapearDimensao(linha.anel?.estudo, "anel.estudo"),
        questoes: mapearDimensao(linha.anel?.questoes, "anel.questoes"),
        revisao: mapearDimensao(linha.anel?.revisao, "anel.revisao"),
      }
    : vazioDoAnel();

  const pontos = habilitada
    ? (() => {
        const discriminacao = linha.pontos?.discriminacao;
        return {
          dia: numero(linha.pontos?.dia, "pontos.dia"),
          total: numero(linha.pontos?.total, "pontos.total"),
          discriminacao: {
            estudoPrioritario: numero(
              discriminacao?.estudo_prioritario,
              "pontos.discriminacao.estudo_prioritario",
            ),
            conclusao: numero(
              discriminacao?.conclusao,
              "pontos.discriminacao.conclusao",
            ),
            revisaoNoPrazo: numero(
              discriminacao?.revisao_no_prazo,
              "pontos.discriminacao.revisao_no_prazo",
            ),
            recuperacaoErro: numero(
              discriminacao?.recuperacao_erro,
              "pontos.discriminacao.recuperacao_erro",
            ),
          },
        };
      })()
    : vaziosDePontos();

  let missao: MissaoDoDia | null = null;
  if (habilitada && linha.missao !== null && linha.missao !== undefined) {
    const id = texto(linha.missao.id, "missao.id");
    const tipo = texto(linha.missao.tipo, "missao.tipo");
    if (!(TIPOS_DE_MISSAO as readonly string[]).includes(tipo)) {
      throw new GamificacaoRecusada("resposta_invalida", "missao.tipo inválido");
    }
    const estadoDaMissao = texto(linha.missao.estado, "missao.estado");
    if (!(ESTADOS_DA_MISSAO as readonly string[]).includes(estadoDaMissao)) {
      throw new GamificacaoRecusada("resposta_invalida", "missao.estado inválido");
    }
    const meta = numero(linha.missao.meta, "missao.meta");
    const progressoBruto = numero(linha.missao.progresso_bruto, "missao.progresso_bruto");
    missao = {
      id,
      tipo: tipo as TipoDeMissao,
      progresso: limitar(numero(linha.missao.progresso, "missao.progresso"), meta),
      progressoBruto,
      meta,
      estado: estadoDaMissao as EstadoDaMissao,
    };
  }

  return {
    data,
    habilitada,
    estado: estado as EstadoDaGamificacao,
    anel,
    pontos,
    missao,
    sequencia: mapearSequencia(linha.sequencia),
    conquistas: habilitada ? mapearConquistas(linha.conquistas) : CATALOGO_DE_CONQUISTAS.map((conquista) => ({
      ...conquista,
      desbloqueada: false,
      desbloqueadaEm: null,
    })),
  };
}

/** Lê a projeção segura de hoje; a identidade vem de `auth.uid()` no servidor. */
export async function consultarGamificacao(
  cliente: SupabaseClient,
): Promise<DadosGamificacao> {
  const { data, error } = await cliente.rpc("consultar_gamificacao_do_dia");
  if (error) {
    throw new GamificacaoRecusada(
      "falha_leitura",
      `falha ao ler gamificação: ${error.message}`,
    );
  }

  const linha = Array.isArray(data) ? data[0] : data;
  if (linha === null || linha === undefined) {
    throw new GamificacaoRecusada(
      "resposta_invalida",
      "a consulta de gamificação não devolveu dados",
    );
  }
  return mapearGamificacao(linha);
}

/** Alias nominal para consumidores que falam diretamente no vocabulário SQL. */
export const consultarGamificacaoDoDia = consultarGamificacao;
