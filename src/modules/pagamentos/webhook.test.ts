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
      asaas_parcelamento_id: null,
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
    atualizarStatusGateway: vi.fn(async () => undefined),
    fecharReembolso: vi.fn(async () => undefined),
    emitirPagamentoConfirmado: vi.fn(),
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
    expect(deps.emitirPagamentoConfirmado).toHaveBeenCalledTimes(1);
  });

  it("emite confirmação antes de uma falha de ativação", async () => {
    const deps = dependencias();
    deps.encaminharParaAtivacao.mockRejectedValueOnce(new Error("fila indisponivel"));

    await expect(processarEventoAsaas(evento, deps)).rejects.toThrow("fila indisponivel");
    expect(deps.emitirPagamentoConfirmado).toHaveBeenCalledTimes(1);
  });

  // F-12: o `asaas_status` so era escrito na criacao da cobranca e ficava
  // PENDING para sempre — inclusive nos pagamentos ja ativados.
  it("grava o status do gateway uma vez, e uma falha ali não derruba a ativação", async () => {
    const deps = dependencias();

    await processarEventoAsaas(evento, deps);
    await processarEventoAsaas(evento, deps);

    expect(deps.atualizarStatusGateway).toHaveBeenCalledTimes(1);
    expect(deps.atualizarStatusGateway).toHaveBeenCalledWith("pag_1", "RECEIVED");

    const comFalha = dependencias();
    comFalha.atualizarStatusGateway.mockRejectedValueOnce(new Error("banco fora"));

    expect(await processarEventoAsaas(evento, comFalha)).toBe("encaminhado");
    expect(comFalha.encaminharParaAtivacao).toHaveBeenCalledTimes(1);
  });

  // F-15: o estorno do Asaas nao conclui na mesma chamada. Sem tratar o evento
  // de confirmacao, o dinheiro voltava e o acesso continuava ligado.
  it("estorno confirmado encerra o acesso uma vez, mesmo com replay", async () => {
    const deps = dependencias("ativada");
    const estorno = { ...evento, id: "evt_ref", tipo: "PAYMENT_REFUNDED", status: "REFUNDED" };

    expect(await processarEventoAsaas(estorno, deps)).toBe("reembolsado");
    expect(await processarEventoAsaas(estorno, deps)).toBe("duplicado");

    expect(deps.fecharReembolso).toHaveBeenCalledTimes(1);
    expect(deps.fecharReembolso).toHaveBeenCalledWith(
      expect.objectContaining({ id: "pag_1" }),
    );
    expect(deps.encaminharParaAtivacao).not.toHaveBeenCalled();
  });

  it("falha ao fechar o estorno estoura, para o Asaas reenviar", async () => {
    const deps = dependencias("ativada");
    deps.fecharReembolso.mockRejectedValueOnce(new Error("banco fora"));

    await expect(
      processarEventoAsaas(
        { ...evento, id: "evt_ref", tipo: "PAYMENT_REFUNDED", status: "REFUNDED" },
        deps,
      ),
    ).rejects.toThrow("banco fora");
  });

  it("estorno negado e estorno parcial alertam sem encerrar o acesso", async () => {
    for (const [tipo, codigo] of [
      ["PAYMENT_REFUND_DENIED", "estorno_negado"],
      ["PAYMENT_PARTIALLY_REFUNDED", "estorno_parcial"],
    ]) {
      const deps = dependencias("ativada");

      const resultado = await processarEventoAsaas(
        { ...evento, id: `evt_${codigo}`, tipo, status: "RECEIVED" },
        deps,
      );

      expect(resultado).toBe("rejeitado");
      expect(deps.abrirPendencia).toHaveBeenCalledWith("pag_1", "alerta", codigo);
      expect(deps.fecharReembolso).not.toHaveBeenCalled();
    }
  });

  it("estorno de cobrança ainda pendente é rejeitado, não fecha nada", async () => {
    const deps = dependencias("pendente");

    const resultado = await processarEventoAsaas(
      { ...evento, id: "evt_ref", tipo: "PAYMENT_REFUNDED", status: "REFUNDED" },
      deps,
    );

    expect(resultado).toBe("rejeitado");
    expect(deps.fecharReembolso).not.toHaveBeenCalled();
    expect(deps.abrirPendencia).toHaveBeenCalledWith(
      "pag_1",
      "reconciliacao",
      "evento_fora_de_ordem",
    );
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
