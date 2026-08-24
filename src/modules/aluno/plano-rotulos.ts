import type { SupabaseClient } from "@supabase/supabase-js";

import type { PlanoDoDia } from "./plano";

type TopicoBanco = {
  id: string;
  nome: string;
};

/**
 * Lê somente os rótulos canônicos que já existem no acervo.
 *
 * O plano guarda o id para não congelar uma cópia de taxonomia. A tela pode
 * receber um plano antigo ou uma leitura parcial, então um rótulo ausente é
 * simplesmente omitido pelo consumidor — nunca vira UUID ou nome inventado.
 */
export async function consultarRotulosDosTopicos(
  cliente: SupabaseClient,
  plano: PlanoDoDia,
): Promise<ReadonlyMap<string, string>> {
  const ids = [...new Set([...plano.piso, ...plano.metaCheia]
    .map((bloco) => bloco.topicoId)
    .filter((id): id is string => typeof id === "string" && id.length > 0))];

  if (ids.length === 0) return new Map();

  // Mantém a tela de fallback testável quando a fonte opcional de rótulos não
  // está disponível. Em produção o cliente da sessão sempre oferece `from`.
  if (typeof (cliente as unknown as { from?: unknown }).from !== "function") {
    return new Map();
  }

  const consulta = await cliente
    .from("topicos")
    .select("id, nome")
    .in("id", ids);

  if (consulta.error) {
    throw new Error(`falha ao ler rótulos dos tópicos: ${consulta.error.message}`);
  }

  return new Map(
    ((consulta.data ?? []) as TopicoBanco[])
      .filter(
        (topico) =>
          ids.includes(topico.id) &&
          typeof topico.nome === "string" &&
          topico.nome.trim().length > 0,
      )
      .map((topico) => [topico.id, topico.nome.trim()]),
  );
}
