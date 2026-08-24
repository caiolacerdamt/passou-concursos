import type { SupabaseClient } from "@supabase/supabase-js";

export const TIPOS_DE_BLOCO = [
  "revisar",
  "avancar",
  "treinar",
  "simulado",
] as const;
export type TipoDeBloco = (typeof TIPOS_DE_BLOCO)[number];

export type NivelDoPlano = "piso" | "meta_cheia";

export type ConclusaoDoBloco = {
  sessaoId: string;
  nQuestoes: number;
  nAcertos: number;
  encerradaEm: string;
};

export type BlocoDoPlano = {
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
  conclusao: ConclusaoDoBloco | null;
};

export type PlanoDoDia = {
  id: string;
  data: string;
  frase: string | null;
  piso: BlocoDoPlano[];
  metaCheia: BlocoDoPlano[];
};

type PlanoBanco = { id: string; data: string; frase: string | null };
type BlocoBanco = {
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
type SessaoEncerradaBanco = {
  id: string;
  plano_bloco_id: string;
  encerrada_em: string;
};
type TentativaDoPlacarBanco = { sessao_id: string; correta: boolean };

export function dataHojeDoProduto(data = new Date()): string {
  const partes = new Intl.DateTimeFormat("en", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(data);

  const porTipo = new Map(partes.map((parte) => [parte.type, parte.value]));
  return `${porTipo.get("year")}-${porTipo.get("month")}-${porTipo.get("day")}`;
}

function falhaAoLer(recurso: string, mensagem: string): Error {
  return new Error(`falha ao ler ${recurso}: ${mensagem}`);
}

function mapearBloco(bloco: BlocoBanco): BlocoDoPlano {
  return {
    id: bloco.id,
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
    conclusao: null,
  };
}

async function conclusoesDosBlocos(
  cliente: SupabaseClient,
  blocos: readonly BlocoDoPlano[],
): Promise<Map<string, ConclusaoDoBloco>> {
  if (blocos.length === 0) return new Map();

  const sessoesConsulta = await cliente
    .from("sessoes")
    .select("id, plano_bloco_id, encerrada_em")
    .in("plano_bloco_id", blocos.map((bloco) => bloco.id))
    .not("encerrada_em", "is", null)
    .order("encerrada_em", { ascending: false });

  if (sessoesConsulta.error) {
    throw falhaAoLer("sessões concluídas do plano", sessoesConsulta.error.message);
  }

  const maisRecentePorBloco = new Map<string, SessaoEncerradaBanco>();
  for (const sessao of (sessoesConsulta.data ?? []) as SessaoEncerradaBanco[]) {
    if (!maisRecentePorBloco.has(sessao.plano_bloco_id)) {
      maisRecentePorBloco.set(sessao.plano_bloco_id, sessao);
    }
  }

  const sessoes = [...maisRecentePorBloco.values()];
  if (sessoes.length === 0) return new Map();

  const tentativasConsulta = await cliente
    .from("tentativas")
    .select("sessao_id, correta")
    .in("sessao_id", sessoes.map((sessao) => sessao.id));

  if (tentativasConsulta.error) {
    throw falhaAoLer("placar dos blocos concluídos", tentativasConsulta.error.message);
  }

  const placares = new Map<string, { nQuestoes: number; nAcertos: number }>();
  for (const tentativa of (tentativasConsulta.data ?? []) as TentativaDoPlacarBanco[]) {
    const atual = placares.get(tentativa.sessao_id) ?? { nQuestoes: 0, nAcertos: 0 };
    atual.nQuestoes += 1;
    if (tentativa.correta) atual.nAcertos += 1;
    placares.set(tentativa.sessao_id, atual);
  }

  return new Map(
    [...maisRecentePorBloco.entries()].map(([blocoId, sessao]) => {
      const placar = placares.get(sessao.id) ?? { nQuestoes: 0, nAcertos: 0 };
      return [
        blocoId,
        {
          sessaoId: sessao.id,
          nQuestoes: placar.nQuestoes,
          nAcertos: placar.nAcertos,
          encerradaEm: sessao.encerrada_em,
        },
      ];
    }),
  );
}

export async function consultarPlanoDoDia(
  cliente: SupabaseClient,
  data = dataHojeDoProduto(),
): Promise<PlanoDoDia | null> {
  const planoConsulta = await cliente
    .from("plano_dia")
    .select("id, data, frase")
    .eq("data", data)
    .maybeSingle();

  if (planoConsulta.error) {
    throw falhaAoLer("plano_dia", planoConsulta.error.message);
  }
  if (!planoConsulta.data) return null;

  const plano = planoConsulta.data as PlanoBanco;
  const blocosConsulta = await cliente
    .from("plano_bloco")
    .select(
      "id, tipo, nivel, ordem, topico_id, n_questoes, n_questoes_cheias, minutos_estimados, minutos_estimados_cheios, motivo, ajuste_usuario, adiado_de",
    )
    .eq("plano_dia_id", plano.id)
    .order("nivel", { ascending: true })
    .order("ordem", { ascending: true });

  if (blocosConsulta.error) {
    throw falhaAoLer("plano_bloco", blocosConsulta.error.message);
  }

  const blocos = ((blocosConsulta.data ?? []) as BlocoBanco[]).map(mapearBloco);
  const conclusoes = await conclusoesDosBlocos(cliente, blocos);
  for (const bloco of blocos) bloco.conclusao = conclusoes.get(bloco.id) ?? null;

  return {
    id: plano.id,
    data: plano.data,
    frase: plano.frase,
    piso: blocos.filter((bloco) => bloco.nivel === "piso"),
    metaCheia: blocos.filter((bloco) => bloco.nivel === "meta_cheia"),
  };
}

export type ReordenarBlocosEntrada = {
  planoId: string;
  blocoIds: readonly string[];
  nivel?: NivelDoPlano | null;
};

export type ErroDeOperacaoDoPlano =
  | "usuario_ausente"
  | "plano_alheio"
  | "bloco_alheio"
  | "bloco_concluido"
  | "permutacao_invalida"
  | "agenda_invalida"
  | "falha_operacao";

export class PlanoRecusado extends Error {
  readonly motivo: ErroDeOperacaoDoPlano;

  constructor(motivo: ErroDeOperacaoDoPlano, mensagem: string) {
    super(mensagem);
    this.name = "PlanoRecusado";
    this.motivo = motivo;
  }
}

function recusarOperacao(erro: { message?: string } | null, acao: string): never {
  const mensagem = erro?.message ?? `não foi possível ${acao}`;
  const motivo = (Object.keys({
    usuario_ausente: true,
    plano_alheio: true,
    bloco_alheio: true,
    bloco_concluido: true,
    permutacao_invalida: true,
    agenda_invalida: true,
  }).find((chave) => mensagem.includes(chave)) ?? "falha_operacao") as ErroDeOperacaoDoPlano;
  throw new PlanoRecusado(motivo, mensagem);
}

/** Reordena atomicamente uma permutação completa de blocos pendentes. */
export async function reordenarBlocosDoPlano(
  cliente: SupabaseClient,
  entrada: ReordenarBlocosEntrada,
): Promise<void> {
  const { error } = await cliente.rpc("reordenar_plano_do_dia", {
    p_plano_id: entrada.planoId,
    p_nivel: entrada.nivel ?? null,
    p_ordens: [...entrada.blocoIds],
  });
  if (error) recusarOperacao(error, "reordenar os blocos");
}

/** Leva um bloco pendente para o próximo dia declarado, sem apagar sessão. */
export async function adiarBlocoDoPlano(
  cliente: SupabaseClient,
  blocoId: string,
): Promise<string> {
  const { data, error } = await cliente.rpc("adiar_plano_bloco", {
    p_bloco_id: blocoId,
  });
  if (error) recusarOperacao(error, "adiar o bloco");

  const linha = Array.isArray(data) ? data[0] : data;
  if (typeof linha === "string") return linha;
  if (linha && typeof linha === "object" && "adiar_plano_bloco" in linha) {
    const dataDestino = (linha as { adiar_plano_bloco?: unknown }).adiar_plano_bloco;
    if (typeof dataDestino === "string") return dataDestino;
  }
  throw new PlanoRecusado("falha_operacao", "o adiamento não devolveu a data de destino");
}

/** Escolhe a versão curta sem reduzir novamente um bloco já encurtado. */
export async function encurtarBlocoDoPlano(
  cliente: SupabaseClient,
  blocoId: string,
): Promise<Pick<BlocoDoPlano, "nQuestoes" | "minutosEstimados">> {
  const { data, error } = await cliente.rpc("encurtar_plano_bloco", {
    p_bloco_id: blocoId,
  });
  if (error) recusarOperacao(error, "encurtar o bloco");

  const linha = Array.isArray(data) ? data[0] : data;
  const bruto = linha as { n_questoes?: unknown; minutos_estimados?: unknown } | null;
  if (
    bruto === null ||
    typeof bruto !== "object" ||
    typeof bruto.n_questoes !== "number" ||
    typeof bruto.minutos_estimados !== "number"
  ) {
    throw new PlanoRecusado("falha_operacao", "a versão curta não devolveu o tamanho do bloco");
  }
  return {
    nQuestoes: bruto.n_questoes,
    minutosEstimados: bruto.minutos_estimados,
  };
}

// Nomes curtos para os consumidores de área logada. Os aliases mantêm o
// contrato do módulo no domínio sem expor nomes de função SQL à Onda 3.
export const reordenarBlocosPendentes = reordenarBlocosDoPlano;
export const adiarBloco = adiarBlocoDoPlano;
export const escolherVersaoCurta = encurtarBlocoDoPlano;
