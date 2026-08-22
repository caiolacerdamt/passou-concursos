import { z } from "zod";

export const MEIOS_DE_PAGAMENTO = ["CREDIT_CARD", "PIX", "BOLETO"] as const;
export type MeioDePagamento = (typeof MEIOS_DE_PAGAMENTO)[number];

/** Versão registrada junto do aceite; trocar o texto exige publicar uma versão nova. */
export const VERSAO_ATUAL_DOS_TERMOS = "inicial-2026-08";

export const ESTADOS_DE_PAGAMENTO = [
  "pendente",
  "confirmada",
  "ativada",
  "expirada",
  "reembolsada",
] as const;
export type EstadoDePagamento = (typeof ESTADOS_DE_PAGAMENTO)[number];

/**
 * Entrada mínima do checkout. A data do aceite não vem do navegador: a
 * função `validarEntradaCheckout` cria o timestamp no servidor.
 */
export const entradaCheckoutSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(320),
    nomeCompleto: z.string().trim().min(2).max(120),
    cpfCnpj: z
      .string()
      .trim()
      .regex(/^[0-9.\-/\s]+$/)
      .transform((valor) => valor.replace(/\D/g, ""))
      .refine((valor) => valor.length === 11 || valor.length === 14),
    meio: z.enum(MEIOS_DE_PAGAMENTO),
    maiorDeIdade: z.literal(true),
    aceitouTermos: z.literal(true),
    termosVersao: z.string().trim().min(1).max(80),
  })
  .strict();

export type EntradaCheckout = z.input<typeof entradaCheckoutSchema>;
export type CheckoutValidado = z.output<typeof entradaCheckoutSchema> & {
  aceiteEm: string;
};

export function validarEntradaCheckout(
  entrada: unknown,
  agora = new Date(),
): CheckoutValidado {
  const valida = entradaCheckoutSchema.parse(entrada);
  if (Number.isNaN(agora.getTime())) {
    throw new Error("relogio do servidor invalido");
  }

  return {
    ...valida,
    aceiteEm: agora.toISOString(),
  };
}

const TRANSICOES_PERMITIDAS: Readonly<
  Record<EstadoDePagamento, readonly EstadoDePagamento[]>
> = {
  pendente: ["confirmada", "expirada"],
  confirmada: ["ativada", "reembolsada"],
  ativada: ["reembolsada"],
  expirada: [],
  reembolsada: [],
};

export function transicaoDePagamentoPermitida(
  de: EstadoDePagamento,
  para: EstadoDePagamento,
): boolean {
  return TRANSICOES_PERMITIDAS[de].includes(para);
}

export function exigirTransicaoDePagamento(
  de: EstadoDePagamento,
  para: EstadoDePagamento,
): void {
  if (!transicaoDePagamentoPermitida(de, para)) {
    throw new Error(`transicao de pagamento invalida: ${de} -> ${para}`);
  }
}

export const CODIGOS_DE_ERRO_DE_PAGAMENTO = [
  "entrada_invalida",
  "gateway_indisponivel",
  "gateway_recusou",
  "configuracao_invalida",
  "transicao_invalida",
  "pendencia_de_ativacao",
] as const;

export type CodigoDeErroDePagamento =
  (typeof CODIGOS_DE_ERRO_DE_PAGAMENTO)[number];

export type ErroSeguroDePagamento = {
  codigo: CodigoDeErroDePagamento;
  mensagem: string;
};

const MENSAGENS_DE_ERRO: Record<CodigoDeErroDePagamento, string> = {
  entrada_invalida: "Confira os dados informados e tente novamente.",
  gateway_indisponivel:
    "Não foi possível falar com o meio de pagamento. Tente novamente.",
  gateway_recusou:
    "O meio de pagamento recusou a cobrança. Confira a opção escolhida.",
  configuracao_invalida:
    "O pagamento está temporariamente indisponível. Tente novamente mais tarde.",
  transicao_invalida:
    "Este pagamento não pode avançar a partir do estado atual.",
  pendencia_de_ativacao:
    "O pagamento foi recebido e a ativação será concluída automaticamente.",
};

/** Mensagem controlada para o usuário; nunca repassa texto do gateway. */
export function erroSeguroDePagamento(
  codigo: CodigoDeErroDePagamento,
): ErroSeguroDePagamento {
  return { codigo, mensagem: MENSAGENS_DE_ERRO[codigo] };
}

/**
 * Converte qualquer falha externa em um contrato pequeno e sem PII.
 * O erro original continua disponível para o ponto de observabilidade, mas a
 * mensagem que chega à UI ou a um alerta operacional é controlada.
 */
export function sanitizarErroDePagamento(erro: unknown): ErroSeguroDePagamento {
  void erro;
  return erroSeguroDePagamento("gateway_indisponivel");
}
