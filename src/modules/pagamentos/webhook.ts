import { timingSafeEqual } from "node:crypto";

import type { PagamentoOperacional } from "./repositorio";

const EVENTOS_DE_CONFIRMACAO = new Set([
  "PAYMENT_RECEIVED",
  "PAYMENT_CONFIRMED",
]);

/**
 * O estorno do Asaas nao conclui na mesma chamada: em Pix nasce pendente e a
 * conta pode exigir autorizacao por codigo do titular. A confirmacao chega
 * aqui, e so aqui o acesso cai (F-15).
 */
const EVENTOS_DE_ESTORNO = new Set(["PAYMENT_REFUNDED"]);

/**
 * Estorno que nao concluiu como esperado. Nenhum deles encerra acesso sozinho:
 * negado nao devolveu dinheiro, e parcial e decisao humana — devolver metade
 * nao diz o que fazer com a matricula.
 */
const EVENTOS_DE_ESTORNO_SEM_FECHAMENTO = new Map([
  ["PAYMENT_REFUND_DENIED", "estorno_negado"],
  ["PAYMENT_PARTIALLY_REFUNDED", "estorno_parcial"],
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
  | "encaminhado"
  | "reembolsado";

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
    tipo: "ativacao" | "reconciliacao" | "alerta" | "nota_fiscal",
    codigo: string,
  ): Promise<void>;
  encaminharParaAtivacao(pagamentoId: string): Promise<void>;
  atualizarStatusGateway(pagamentoId: string, status: string): Promise<void>;
  fecharReembolso?(pagamento: PagamentoOperacional): Promise<void>;
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
  const conhecido =
    EVENTOS_DE_CONFIRMACAO.has(evento.tipo)
    || EVENTOS_DE_ESTORNO.has(evento.tipo)
    || EVENTOS_DE_ESTORNO_SEM_FECHAMENTO.has(evento.tipo);

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

  const estadoAceitavel = estadoAceitaOEvento(evento.tipo, pagamento.estado);
  const inserido = await dependencias.registrarEvento({
    eventoId: evento.id,
    tipo: evento.tipo,
    cobrancaId: evento.cobrancaId,
    pagamentoId: pagamento.id,
    resultado: estadoAceitavel ? "recebido" : "rejeitado",
  });
  if (!inserido) return "duplicado";

  await registrarStatusDoGateway(evento, pagamento.id, dependencias);

  if (!estadoAceitavel) {
    await dependencias.abrirPendencia(pagamento.id, "reconciliacao", "evento_fora_de_ordem");
    return "rejeitado";
  }

  const codigoSemFechamento = EVENTOS_DE_ESTORNO_SEM_FECHAMENTO.get(evento.tipo);
  if (codigoSemFechamento) {
    await dependencias.abrirPendencia(pagamento.id, "alerta", codigoSemFechamento);
    return "rejeitado";
  }

  if (EVENTOS_DE_ESTORNO.has(evento.tipo)) {
    if (!dependencias.fecharReembolso) {
      await dependencias.abrirPendencia(pagamento.id, "alerta", "fechamento_reembolso_indisponivel");
      return "rejeitado";
    }
    // Deixa estourar de proposito: um 202 faz o Asaas reenviar, e o reenvio
    // e o unico jeito de o acesso cair sozinho depois de o dinheiro voltar.
    await dependencias.fecharReembolso(pagamento);
    return "reembolsado";
  }

  if (pagamento.estado === "pendente") {
    await dependencias.mudarEstado(pagamento.id, "confirmada", "webhook_confirmacao");
  }

  dependencias.emitirPagamentoConfirmado?.();
  await dependencias.encaminharParaAtivacao(pagamento.id);
  return "encaminhado";
}

/**
 * O status do gateway servia so a operacao e a reconciliacao, e congelava em
 * PENDING porque so era escrito na criacao da cobranca (defeito F-12). Falhar
 * aqui nao pode derrubar a ativacao: o evento ja foi registrado, entao um 202
 * viraria replay descartado como duplicado e o acesso nunca abriria.
 */
async function registrarStatusDoGateway(
  evento: EventoAsaas,
  pagamentoId: string,
  dependencias: DependenciasDoWebhook,
): Promise<void> {
  if (!evento.status) return;
  try {
    await dependencias.atualizarStatusGateway(pagamentoId, evento.status);
  } catch {
    // silencio proposital: ver comentario acima.
  }
}

/**
 * Confirmacao so vale antes de o acesso abrir; estorno so vale depois. Repetir
 * um estorno ja fechado nao e erro — a linha ja esta `reembolsada` e a RPC de
 * fechamento e idempotente.
 */
function estadoAceitaOEvento(tipo: string, estado: string): boolean {
  if (EVENTOS_DE_CONFIRMACAO.has(tipo)) {
    return estado === "pendente" || estado === "confirmada";
  }
  return estado === "confirmada" || estado === "ativada" || estado === "reembolsada";
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
