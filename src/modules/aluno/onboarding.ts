import type { SupabaseClient } from "@supabase/supabase-js";

export const NIVEIS_DECLARADOS = [
  "iniciante",
  "intermediario",
  "avancado",
] as const;
export type NivelDeclarado = (typeof NIVEIS_DECLARADOS)[number];

export type EntradaOnboarding = {
  concursoAlvo: unknown;
  minutosPorDia: unknown;
  diasEstudo: readonly unknown[];
  horarioEstudo: unknown;
  nivelDeclarado: unknown;
};

export type PerfilOnboarding = {
  concursoAlvo: string;
  minutosPorDia: number;
  diasEstudo: number[];
  horarioEstudo: string;
  nivelDeclarado: NivelDeclarado;
};

export type PerfilEstudo = PerfilOnboarding & {
  onboardingConcluido: boolean;
  dataProva: string | null;
};

export type MotivoOnboarding =
  | "concurso_obrigatorio"
  | "concurso_invalido"
  | "minutos_invalidos"
  | "agenda_obrigatoria"
  | "dia_invalido"
  | "horario_invalido"
  | "nivel_invalido";

export class OnboardingRecusado extends Error {
  readonly motivo: MotivoOnboarding;

  constructor(motivo: MotivoOnboarding, mensagem: string) {
    super(mensagem);
    this.name = "OnboardingRecusado";
    this.motivo = motivo;
  }
}

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

function recusar(motivo: MotivoOnboarding, mensagem: string): never {
  throw new OnboardingRecusado(motivo, mensagem);
}

function normalizarHorario(valor: unknown): string {
  const horario = texto(valor);
  const partes = /^(\d{2}):(\d{2})$/.exec(horario);
  if (!partes) {
    return recusar("horario_invalido", "Escolha um horário válido para estudar.");
  }

  const hora = Number(partes[1]);
  const minuto = Number(partes[2]);
  if (hora > 23 || minuto > 59) {
    return recusar("horario_invalido", "Escolha um horário válido para estudar.");
  }

  return `${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}`;
}

function normalizarDias(dias: readonly unknown[]): number[] {
  if (dias.length === 0) {
    return recusar("agenda_obrigatoria", "Escolha pelo menos um dia para estudar.");
  }

  const normalizados = dias.map((dia) => {
    const numero = typeof dia === "number" ? dia : Number(texto(dia));
    if (!Number.isInteger(numero) || numero < 0 || numero > 6) {
      recusar("dia_invalido", "A agenda contém um dia inválido.");
    }
    return numero;
  });

  return [...new Set(normalizados)].sort((a, b) => a - b);
}

export function validarOnboarding(entrada: EntradaOnboarding): PerfilOnboarding {
  const concursoAlvo = texto(entrada.concursoAlvo);
  if (!concursoAlvo) {
    return recusar("concurso_obrigatorio", "Informe qual concurso você quer preparar.");
  }
  if (concursoAlvo.length > 160) {
    return recusar("concurso_invalido", "O nome do concurso é muito longo.");
  }

  const minutosPorDia = Number(texto(entrada.minutosPorDia));
  if (!Number.isInteger(minutosPorDia) || minutosPorDia < 1 || minutosPorDia > 1440) {
    return recusar("minutos_invalidos", "Informe entre 1 e 1.440 minutos por dia.");
  }

  const nivelDeclarado = texto(entrada.nivelDeclarado);
  if (!(NIVEIS_DECLARADOS as readonly string[]).includes(nivelDeclarado)) {
    return recusar("nivel_invalido", "Escolha um nível válido.");
  }

  return {
    concursoAlvo,
    minutosPorDia,
    diasEstudo: normalizarDias(entrada.diasEstudo),
    horarioEstudo: normalizarHorario(entrada.horarioEstudo),
    nivelDeclarado: nivelDeclarado as NivelDeclarado,
  };
}

type PerfilBanco = {
  concurso_alvo: string | null;
  minutos_por_dia: number;
  dias_estudo: number[] | null;
  horario_estudo: string | null;
  nivel_declarado: string | null;
  onboarding_concluido: boolean;
  data_prova: string | null;
};

function falhaAoLer(mensagem: string): Error {
  return new Error(`falha ao ler perfil_estudo: ${mensagem}`);
}

export async function consultarPerfilEstudo(
  cliente: SupabaseClient,
): Promise<PerfilEstudo | null> {
  const consulta = await cliente
    .from("perfil_estudo")
    .select(
      "concurso_alvo, minutos_por_dia, dias_estudo, horario_estudo, nivel_declarado, onboarding_concluido, data_prova",
    )
    .maybeSingle();

  if (consulta.error) throw falhaAoLer(consulta.error.message);
  if (!consulta.data) return null;

  const perfil = consulta.data as PerfilBanco;
  const nivel = (NIVEIS_DECLARADOS as readonly string[]).includes(
    perfil.nivel_declarado ?? "",
  )
    ? (perfil.nivel_declarado as NivelDeclarado)
    : "iniciante";

  return {
    concursoAlvo: perfil.concurso_alvo ?? "",
    minutosPorDia: Number(perfil.minutos_por_dia),
    diasEstudo: (perfil.dias_estudo ?? []).map(Number),
    horarioEstudo: perfil.horario_estudo ?? "",
    nivelDeclarado: nivel,
    onboardingConcluido: perfil.onboarding_concluido,
    dataProva: perfil.data_prova,
  };
}
