import { timingSafeEqual } from "node:crypto";

import type { PagamentoOperacional } from "./repositorio";

const EVENTOS_DE_CONFIRMACAO = new Set([
  "PAYMENT_RECEIVED",
  "PAYMENT_CONFIRMED",
]);

export type EventoAsaas = {
  id: string;
  tipo: string;
  cobrancaId: string | null;
  referencia: string | null;
  status: string | null;
};

export type ResultadoDoWebhook =
  | "duplicado"
  | "ignorado"
  | "rejeitado"
  | "encaminhado";

export type DependenciasDoWebhook = {
  buscarPagamentoPorCobranca(cobrancaId: string): Promise<PagamentoOperacional | null>;
  buscarPagamentoPorReferencia(referencia: string): Promise<PagamentoOperacional | null>;
  registrarEvento(input: {
    eventoId: string;
    tipo: string;
    cobrancaId: string | null;
    pagamentoId: string | null;
    resultado: "recebido" | "ignorado" | "rejeitado";
  }): Promise<boolean>;
  mudarEstado(
    pagamentoId: string,
    novoEstado: "confirmada",
    motivo: string,
  ): Promise<void>;
  abrirPendencia(
    pagamentoId: string,
    tipo: "ativacao" | "reconciliacao" | "alerta",
    codigo: string,
  ): Promise<void>;
  encaminharParaAtivacao(pagamentoId: string): Promise<void>;
  emitirPagamentoConfirmado?: () => void;
};

export function tokenWebhookValido(
  recebido: string | null,
  esperado: string | undefined,
): boolean {
  if (!recebido || !esperado) return false;
  const recebidoBytes = Buffer.from(recebido, "utf8");
  const esperadoBytes = Buffer.from(esperado, "utf8");
  if (recebidoBytes.length !== esperadoBytes.length) return false;
  return timingSafeEqual(recebidoBytes, esperadoBytes);
}

export function contentTypeWebhookValido(contentType: string | null): boolean {
  return contentType?.split(";", 1)[0].trim().toLowerCase() === "application/json";
}

export function interpretarCorpoWebhook(corpo: string): EventoAsaas {
  let bruto: unknown;
  try {
    bruto = JSON.parse(corpo);
  } catch {
    throw new Error("corpo do webhook invalido");
  }

  if (!bruto || typeof bruto !== "object") {
    throw new Error("corpo do webhook invalido");
  }

  const envelope = bruto as Record<string, unknown>;
  const pagamento = objeto(envelope.payment);
  const id = texto(envelope.id);
  const tipo = texto(envelope.event);
  const cobrancaId = textoOuNulo(pagamento?.id);
  const referencia = textoOuNulo(pagamento?.externalReference);
  const status = textoOuNulo(pagamento?.status);

  if (!id || !tipo) throw new Error("corpo do webhook invalido");

  return { id, tipo, cobrancaId, referencia, status };
}

export async function processarEventoAsaas(
  evento: EventoAsaas,
  dependencias: DependenciasDoWebhook,
): Promise<ResultadoDoWebhook> {
  const pagamento = await localizarPagamento(evento, dependencias);
  const conhecido = EVENTOS_DE_CONFIRMACAO.has(evento.tipo);

  if (!conhecido || !pagamento) {
    const inserido = await dependencias.registrarEvento({
      eventoId: evento.id,
      tipo: evento.tipo,
      cobrancaId: evento.cobrancaId,
      pagamentoId: pagamento?.id ?? null,
      resultado: "ignorado",
    });
    return inserido ? "ignorado" : "duplicado";
  }

  const estadoAceitavel = pagamento.estado === "pendente" || pagamento.estado === "confirmada";
  const inserido = await dependencias.registrarEvento({
    eventoId: evento.id,
    tipo: evento.tipo,
    cobrancaId: evento.cobrancaId,
    pagamentoId: pagamento.id,
    resultado: estadoAceitavel ? "recebido" : "rejeitado",
  });
  if (!inserido) return "duplicado";

  if (!estadoAceitavel) {
    await dependencias.abrirPendencia(pagamento.id, "reconciliacao", "evento_fora_de_ordem");
    return "rejeitado";
  }

  if (pagamento.estado === "pendente") {
    await dependencias.mudarEstado(pagamento.id, "confirmada", "webhook_confirmacao");
  }

  dependencias.emitirPagamentoConfirmado?.();
  await dependencias.encaminharParaAtivacao(pagamento.id);
  return "encaminhado";
}

async function localizarPagamento(
  evento: EventoAsaas,
  dependencias: DependenciasDoWebhook,
): Promise<PagamentoOperacional | null> {
  if (evento.cobrancaId) {
    const porCobranca = await dependencias.buscarPagamentoPorCobranca(evento.cobrancaId);
    if (porCobranca) return porCobranca;
  }
  if (evento.referencia) {
    return dependencias.buscarPagamentoPorReferencia(evento.referencia);
  }
  return null;
}

function objeto(valor: unknown): Record<string, unknown> | null {
  return valor !== null && typeof valor === "object"
    ? (valor as Record<string, unknown>)
    : null;
}

function texto(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() ? valor.trim() : null;
}

function textoOuNulo(valor: unknown): string | null {
  return texto(valor);
}
