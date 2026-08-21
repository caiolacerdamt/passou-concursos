import { describe, expect, it, vi } from "vitest";

import {
  contentTypeWebhookValido,
  interpretarCorpoWebhook,
  processarEventoAsaas,
  tokenWebhookValido,
} from "./webhook";

const evento = {
  id: "evt_1",
  tipo: "PAYMENT_RECEIVED",
  cobrancaId: "pay_1",
  referencia: "checkout-1",
  status: "RECEIVED",
};

function dependencias(estado: string = "pendente") {
  let registros = 0;
  return {
    buscarPagamentoPorCobranca: vi.fn(async () => ({
      id: "pag_1",
      produto_id: "prod_1",
      email: "aluno@exemplo.com",
      valor_centavos: 17_730,
      meio: "PIX" as const,
      parcelas: 1,
      referencia_interna: "checkout-1",
      estado,
      asaas_cliente_id: "cus_1",
      asaas_cobranca_id: "pay_1",
      asaas_status: "PENDING",
      resultado_url: null,
      resultado_boleto_url: null,
      resultado_pix_qr_code: null,
      resultado_pix_copia_e_cola: null,
      user_id: null,
      matricula_id: null,
      confirmado_em: null,
      ativado_em: null,
      criado_em: "2026-08-21T00:00:00Z",
    })),
    buscarPagamentoPorReferencia: vi.fn(async () => null),
    registrarEvento: vi.fn(async () => {
      registros += 1;
      return registros === 1;
    }),
    mudarEstado: vi.fn(async () => undefined),
    abrirPendencia: vi.fn(async () => undefined),
    encaminharParaAtivacao: vi.fn(async () => undefined),
  };
}

describe("contratos do webhook Asaas", () => {
  it("compara token em tempo constante e recusa ausência/tamanho diferente", () => {
    expect(tokenWebhookValido("segredo", "segredo")).toBe(true);
    expect(tokenWebhookValido("errado", "segredo")).toBe(false);
    expect(tokenWebhookValido(null, "segredo")).toBe(false);
    expect(tokenWebhookValido("segredo", undefined)).toBe(false);
  });

  it("aceita apenas JSON e extrai o mínimo do evento, sem guardar corpo bruto", () => {
    expect(contentTypeWebhookValido("application/json; charset=utf-8")).toBe(true);
    expect(contentTypeWebhookValido("text/plain")).toBe(false);

    expect(
      interpretarCorpoWebhook(JSON.stringify({
        id: "evt_1",
        event: "PAYMENT_RECEIVED",
        payment: { id: "pay_1", externalReference: "checkout-1", status: "RECEIVED", email: "nao-deve-sair" },
      })),
    ).toEqual(evento);
  });

  it("três replays do mesmo evento produzem uma única mudança e uma única ativação", async () => {
    const deps = dependencias();

    expect(await processarEventoAsaas(evento, deps)).toBe("encaminhado");
    expect(await processarEventoAsaas(evento, deps)).toBe("duplicado");
    expect(await processarEventoAsaas(evento, deps)).toBe("duplicado");

    expect(deps.mudarEstado).toHaveBeenCalledTimes(1);
    expect(deps.encaminharParaAtivacao).toHaveBeenCalledTimes(1);
  });

  it("evento desconhecido é ignorado sem liberar conteúdo", async () => {
    const deps = dependencias();

    const resultado = await processarEventoAsaas(
      { ...evento, tipo: "PAYMENT_CREATED" },
      deps,
    );

    expect(resultado).toBe("ignorado");
    expect(deps.encaminharParaAtivacao).not.toHaveBeenCalled();
    expect(deps.registrarEvento).toHaveBeenCalledWith(
      expect.objectContaining({ resultado: "ignorado" }),
    );
  });

  it("confirmação fora de ordem é rejeitada e vai para a fila de reconciliação", async () => {
    const deps = dependencias("expirada");

    const resultado = await processarEventoAsaas(evento, deps);

    expect(resultado).toBe("rejeitado");
    expect(deps.registrarEvento).toHaveBeenCalledWith(
      expect.objectContaining({ resultado: "rejeitado" }),
    );
    expect(deps.abrirPendencia).toHaveBeenCalledWith(
      "pag_1",
      "reconciliacao",
      "evento_fora_de_ordem",
    );
    expect(deps.encaminharParaAtivacao).not.toHaveBeenCalled();
  });
});
