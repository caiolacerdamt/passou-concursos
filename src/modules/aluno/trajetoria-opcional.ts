import type { SupabaseClient } from "@supabase/supabase-js";

import { isFlagOn } from "@/modules/config";
import { reportarErro } from "@/modules/observabilidade/reporte";

import { consultarTrajetoria, type Trajetoria } from "./trajetoria";

/**
 * A trajetória atrás da flag, e nunca derrubando a tela que a hospeda.
 *
 * Mesmo contrato de `consultarGamificacaoOpcional`: flag desligada devolve
 * `null` sem consultar nada, e falha de leitura vira ausência silenciosa com o
 * erro reportado. Trajetória indisponível não pode derrubar o Progresso nem o
 * Hoje — ela é enquadramento, não a informação que o aluno veio buscar.
 *
 * Mora em arquivo separado de `trajetoria.ts` porque este lado importa a
 * configuração e a observabilidade; o módulo de leitura fica puro e testável
 * com cliente falso.
 */
export async function consultarTrajetoriaOpcional(
  cliente: SupabaseClient,
  opcoes: { dataProva?: string | null; agora?: Date } = {},
): Promise<Trajetoria | null> {
  if (!(await isFlagOn("flag.m4.trajetoria"))) return null;

  try {
    return await consultarTrajetoria(cliente, opcoes);
  } catch (erro) {
    reportarErro(erro, { modulo: "aluno", operacao: "consultar_trajetoria" });
    return null;
  }
}
