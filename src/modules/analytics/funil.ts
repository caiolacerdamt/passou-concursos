import { z } from "zod";

export const EVENTOS_DO_FUNIL = [
  "pagina_vista",
  "checkout_iniciado",
  "meio_escolhido",
  "pagamento_confirmado",
] as const;

export type EventoDoFunil = (typeof EVENTOS_DO_FUNIL)[number];

const entradaEventoSchema = z
  .object({
    evento: z.enum(EVENTOS_DO_FUNIL),
    propriedades: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

/** M9/INFRA-12: o funil pré-login não transporta propriedades de pagamento. */
export type PropriedadesAnonimas = Record<string, never>;

export type EventoFunilAceito = {
  aceito: true;
  evento: EventoDoFunil;
  propriedades: PropriedadesAnonimas;
  quantidadeDescartada: number;
};

export type EventoFunilRejeitado = {
  aceito: false;
  motivo: "entrada_invalida";
  quantidadeDescartada: number;
};

export type ResultadoDaNormalizacao =
  | EventoFunilAceito
  | EventoFunilRejeitado;

/**
 * Allowlist do funil. O resultado não carrega nenhuma propriedade, então uma
 * chamada posterior não consegue reenviar e-mail, CPF, telefone, user_id ou
 * meio de pagamento.
 */
export function normalizarEventoDoFunil(input: unknown): ResultadoDaNormalizacao {
  const resultado = entradaEventoSchema.safeParse(input);
  if (!resultado.success) {
    return {
      aceito: false,
      motivo: "entrada_invalida",
      quantidadeDescartada: 0,
    };
  }

  const propriedades = resultado.data.propriedades ?? {};
  const quantidadeDescartada = Object.keys(propriedades).length;

  return {
    aceito: true,
    evento: resultado.data.evento,
    propriedades: {},
    quantidadeDescartada,
  };
}
