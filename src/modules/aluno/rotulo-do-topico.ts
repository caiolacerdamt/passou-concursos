export type RotuloDoTopico = {
  materia: string | null;
  topico: string;
};

/** Monta o nome que o aluno reconhece, sem transformar ausência em UUID. */
export function nomeDoRotuloDoTopico(
  rotulo: { materia?: string | null; topico?: string | null } | null | undefined,
): string | null {
  const materia = textoValido(rotulo?.materia);
  const topico = textoValido(rotulo?.topico);

  if (materia === null && topico === null) return null;
  if (materia === null) return topico;
  if (topico === null || topico === "Geral") return materia;
  return `${materia} · ${topico}`;
}

function textoValido(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim().length > 0 ? valor.trim() : null;
}
