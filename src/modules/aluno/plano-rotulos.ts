import type { SupabaseClient } from "@supabase/supabase-js";

import type { PlanoDoDia } from "./plano";
export { nomeDoRotuloDoTopico, type RotuloDoTopico } from "./rotulo-do-topico";

type TopicoBanco = {
  id: string;
  nome: string;
  materias?: { nome?: unknown } | { nome?: unknown }[] | null;
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
): Promise<ReadonlyMap<string, RotuloDoTopico>> {
  const ids = [...new Set([...plano.piso, ...plano.metaCheia]
    .map((bloco) => bloco.topicoId)
    .filter((id): id is string => typeof id === "string" && id.length > 0))];

  return consultarRotulosDosTopicosPorIds(cliente, ids);
}

export async function consultarRotulosDosTopicosPorIds(
  cliente: SupabaseClient,
  idsRecebidos: readonly string[],
): Promise<ReadonlyMap<string, RotuloDoTopico>> {
  const ids = [...new Set(idsRecebidos.filter((id) => typeof id === "string" && id.length > 0))];

  if (ids.length === 0) return new Map();

  // Mantém a tela de fallback testável quando a fonte opcional de rótulos não
  // está disponível. Em produção o cliente da sessão sempre oferece `from`.
  if (typeof (cliente as unknown as { from?: unknown }).from !== "function") {
    return new Map();
  }

  const consulta = await cliente
    .from("topicos")
    .select("id, nome, materias(nome)")
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
      .map((topico) => [
        topico.id,
        {
          materia: nomeDaMateria(topico.materias),
          topico: topico.nome.trim(),
        },
      ]),
  );
}

function nomeDaMateria(relacao: TopicoBanco["materias"]): string | null {
  const linha = Array.isArray(relacao) ? relacao[0] : relacao;
  return textoValido(linha?.nome);
}

function textoValido(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim().length > 0 ? valor.trim() : null;
}
