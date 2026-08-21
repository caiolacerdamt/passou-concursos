import { z } from "zod";

import {
  MEIOS_DE_PAGAMENTO,
  type MeioDePagamento,
} from "@/modules/pagamentos/contratos";

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

export type PropriedadesAnonimas = { meio?: MeioDePagamento };

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
 * Allowlist do funil. O resultado não carrega as chaves rejeitadas, então uma
 * chamada posterior não consegue reenviar e-mail, CPF, telefone ou user_id.
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
  const chavesPermitidas =
    resultado.data.evento === "meio_escolhido" ||
    resultado.data.evento === "pagamento_confirmado"
      ? new Set(["meio"])
      : new Set<string>();
  const quantidadeDescartada = Object.keys(propriedades).filter(
    (chave) => !chavesPermitidas.has(chave),
  ).length;
  const meio = propriedades.meio;

  return {
    aceito: true,
    evento: resultado.data.evento,
    propriedades: {
      ...(typeof meio === "string" &&
      (MEIOS_DE_PAGAMENTO as readonly string[]).includes(meio)
        ? { meio: meio as MeioDePagamento }
        : {}),
    },
    quantidadeDescartada,
  };
}
