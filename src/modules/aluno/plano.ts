import type { SupabaseClient } from "@supabase/supabase-js";

export const TIPOS_DE_BLOCO = [
  "revisar",
  "avancar",
  "treinar",
  "simulado",
] as const;
export type TipoDeBloco = (typeof TIPOS_DE_BLOCO)[number];

export type NivelDoPlano = "piso" | "meta_cheia";

export type BlocoDoPlano = {
  id: string;
  tipo: TipoDeBloco;
  nivel: NivelDoPlano;
  ordem: number;
  topicoId: string | null;
  minutosEstimados: number;
  motivo: string | null;
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
  };
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

  return {
    id: plano.id,
    data: plano.data,
    frase: plano.frase,
    piso: blocos.filter((bloco) => bloco.nivel === "piso"),
    metaCheia: blocos.filter((bloco) => bloco.nivel === "meta_cheia"),
  };
}
