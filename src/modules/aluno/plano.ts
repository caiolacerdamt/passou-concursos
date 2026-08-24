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
  minutosEstimados: number;
  motivo: string | null;
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
  minutos_estimados: number;
  motivo: string | null;
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
    minutosEstimados: Number(bloco.minutos_estimados),
    motivo: bloco.motivo,
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
    .select("id, tipo, nivel, ordem, topico_id, minutos_estimados, motivo")
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
