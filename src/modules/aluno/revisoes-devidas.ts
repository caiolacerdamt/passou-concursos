import type { SupabaseClient } from "@supabase/supabase-js";

import { dataHojeDoProduto } from "./plano";

export type RevisaoDevida = {
  topicoId: string;
  due: string;
};

type LinhaDeRevisao = {
  topico_id: string;
  due: string;
};

/** Lê somente as revisões do próprio aluno que já venceram. */
export async function consultarRevisoesDevidas(
  cliente: SupabaseClient,
  data = dataHojeDoProduto(),
): Promise<readonly RevisaoDevida[]> {
  const consulta = await cliente
    .from("revisao_agenda")
    .select("topico_id, due")
    .lte("due", data)
    .order("due", { ascending: true })
    .order("topico_id", { ascending: true });

  if (consulta.error) {
    throw new Error(`falha ao ler revisões devidas: ${consulta.error.message}`);
  }

  return ((consulta.data ?? []) as LinhaDeRevisao[])
    .filter(
      (linha) =>
        typeof linha.topico_id === "string" &&
        linha.topico_id.length > 0 &&
        typeof linha.due === "string" &&
        linha.due.length > 0,
    )
    .map((linha) => ({ topicoId: linha.topico_id, due: linha.due }));
}
