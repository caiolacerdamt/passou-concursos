import { describe, expect, it, vi } from "vitest";

import {
  calcularGarantia,
  diasCorridosEntre,
  mensagemDaRecusaDaGarantia,
  solicitarReembolso,
} from "./garantia";
import type { FaturaOperacional, PagamentoOperacional } from "./repositorio";

describe("garantia de pagamento", () => {
  const confirmado = "2026-08-01T12:00:00.000Z";

  it("conta dias corridos e deixa o quinto dia disponível", () => {
    expect(
      diasCorridosEntre(confirmado, "2026-08-06T01:00:00.000Z"),
    ).toBe(5);

    const resultado = calcularGarantia({
      estadoPagamento: "ativada",
      confirmadoEm: confirmado,
      garantiaDias: 7,
      agora: "2026-08-06T01:00:00.000Z",
    });

    expect(resultado.disponivel).toBe(true);
    expect(resultado.diasRestantes).toBe(2);
    expect(mensagemDaRecusaDaGarantia(resultado)).toBeNull();
  });

  it("recusa depois da janela, sem depender do relógio da UI", () => {
    const resultado = calcularGarantia({
      estadoPagamento: "ativada",
      confirmadoEm: confirmado,
      garantiaDias: 7,
      agora: "2026-08-10T01:00:00.000Z",
    });

    expect(resultado.disponivel).toBe(false);
    expect(resultado.diasPassados).toBe(9);
    expect(resultado.diasRestantes).toBe(0);
    expect(mensagemDaRecusaDaGarantia(resultado)).toMatch(/sete dias/);
  });

  it("recusa antes de confirmar e depois de reembolsar", () => {
    const antes = calcularGarantia({
      estadoPagamento: "pendente",
      confirmadoEm: null,
      garantiaDias: 7,
      agora: "2026-08-06T01:00:00.000Z",
    });
    const depois = calcularGarantia({
      estadoPagamento: "reembolsada",
      confirmadoEm: confirmado,
      garantiaDias: 7,
      agora: "2026-08-06T01:00:00.000Z",
    });

    expect(mensagemDaRecusaDaGarantia(antes)).toMatch(/confirmação/);
    expect(mensagemDaRecusaDaGarantia(depois)).toMatch(/já foi reembolsado/);
  });

  it("no quinto dia estorna, registra o solicitante e encerra o acesso", async () => {
    const dependencias = criarDependencias();

    const resultado = await solicitarReembolso(
      "user_1",
      7,
      new Date("2026-08-06T01:00:00.000Z"),
      dependencias,
    );

    expect(resultado.estado).toBe("solicitado");
    expect(dependencias.estornarCobranca).toHaveBeenCalledWith(
      "pay_1",
      "PIX",
      "Garantia do plano anual",
      null,
    );
    expect(dependencias.confirmarReembolsoLocal).toHaveBeenCalledWith({
      pagamentoId: "pag_1",
      userId: "user_1",
      meio: "PIX",
      quando: "2026-08-06T01:00:00.000Z",
      motivo: "reembolso_confirmado",
    });
  });

  // F-11: a compra por cartao e um parcelamento. Se o id do parcelamento nao
  // chegar ao gateway, o estorno bate no endpoint da parcela e o Asaas recusa.
  it("repassa o id do parcelamento quando a compra foi por cartão", async () => {
    const dependencias = criarDependencias({
      meio: "CREDIT_CARD",
      parcelas: 12,
      asaas_parcelamento_id: "d1b2c3",
    });

    await solicitarReembolso(
      "user_1",
      7,
      new Date("2026-08-06T01:00:00.000Z"),
      dependencias,
    );

    expect(dependencias.estornarCobranca).toHaveBeenCalledWith(
      "pay_1",
      "CREDIT_CARD",
      "Garantia do plano anual",
      "d1b2c3",
    );
  });

  it("recusa o nono dia e uma tentativa antes da confirmação sem chamar o gateway", async () => {
    const foraDaJanela = criarDependencias();
    const resultadoFora = await solicitarReembolso(
      "user_1",
      7,
      new Date("2026-08-10T01:00:00.000Z"),
      foraDaJanela,
    );

    expect(resultadoFora.estado).toBe("recusado");
    expect(resultadoFora.mensagem).toMatch(/sete dias/);
    expect(foraDaJanela.estornarCobranca).not.toHaveBeenCalled();
    expect(foraDaJanela.abrirPendencia).toHaveBeenCalledWith(
      "pag_1",
      "alerta",
      "tentativa_reembolso_invalida",
    );

    const antesDaConfirmacao = criarDependencias({
      estado: "pendente",
      confirmado_em: null,
    });
    const resultadoAntes = await solicitarReembolso(
      "user_1",
      7,
      new Date("2026-08-02T01:00:00.000Z"),
      antesDaConfirmacao,
    );

    expect(resultadoAntes.estado).toBe("recusado");
    expect(resultadoAntes.mensagem).toMatch(/confirmação/);
    expect(antesDaConfirmacao.estornarCobranca).not.toHaveBeenCalled();
    expect(antesDaConfirmacao.confirmarReembolsoLocal).not.toHaveBeenCalled();
    expect(antesDaConfirmacao.abrirPendencia).toHaveBeenCalledWith(
      "pag_1",
      "alerta",
      "tentativa_reembolso_invalida",
    );
  });

  it("mantém o acesso quando o gateway falha ou ainda não confirmou o estorno", async () => {
    const gatewayFalhou = criarDependencias();
    gatewayFalhou.estornarCobranca.mockRejectedValue(new Error("falha externa"));

    const resultadoFalha = await solicitarReembolso(
      "user_1",
      7,
      new Date("2026-08-06T01:00:00.000Z"),
      gatewayFalhou,
    );

    expect(resultadoFalha.estado).toBe("pendente");
    expect(gatewayFalhou.confirmarReembolsoLocal).not.toHaveBeenCalled();
    expect(gatewayFalhou.abrirPendencia).toHaveBeenCalledWith(
      "pag_1",
      "alerta",
      "falha_no_estorno",
    );

    const aguardando = criarDependencias();
    aguardando.estornarCobranca.mockResolvedValue({ status: "PENDING" });
    const resultadoAguardando = await solicitarReembolso(
      "user_1",
      7,
      new Date("2026-08-06T01:00:00.000Z"),
      aguardando,
    );

    expect(resultadoAguardando.estado).toBe("pendente");
    expect(aguardando.confirmarReembolsoLocal).not.toHaveBeenCalled();
    expect(aguardando.abrirPendencia).toHaveBeenCalledWith(
      "pag_1",
      "alerta",
      "estorno_aguardando_confirmacao",
    );
  });

  it("permite retry local quando pagamento reembolsado ainda deixou matrícula ativa", async () => {
    const primeira = criarDependencias();
    primeira.confirmarReembolsoLocal.mockRejectedValueOnce(new Error("falha local"));

    const resultadoPrimeiro = await solicitarReembolso(
      "user_1",
      7,
      new Date("2026-08-06T01:00:00.000Z"),
      primeira,
    );

    expect(resultadoPrimeiro.estado).toBe("pendente");
    expect(primeira.abrirPendencia).toHaveBeenCalledWith(
      "pag_1",
      "alerta",
      "falha_fechamento_reembolso",
    );

    const retry = criarDependencias({ estado: "reembolsada" });
    const resultadoRetry = await solicitarReembolso(
      "user_1",
      7,
      new Date("2026-08-06T01:00:00.000Z"),
      retry,
    );

    expect(resultadoRetry.estado).toBe("solicitado");
    expect(retry.estornarCobranca).not.toHaveBeenCalled();
    expect(retry.confirmarReembolsoLocal).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["PROCESSING_CANCELLATION", "cancelamento_processando", "nota_fiscal", "cancelamento_nf_em_processamento"],
    ["CANCELED", "cancelada", null, null],
    ["CANCELLATION_DENIED", "cancelamento_negado", "nota_fiscal", "cancelamento_nf_negado"],
  ])("trata status de cancelamento de NF %s sem reabrir acesso", async (status, estado, tipo, codigo) => {
    const dependencias = criarDependencias({
      fatura: { asaas_fatura_id: "nf_1", estado: "emitida" },
      cancelamentoNF: { status },
    });

    const resultado = await solicitarReembolso(
      "user_1",
      7,
      new Date("2026-08-06T01:00:00.000Z"),
      dependencias,
    );

    expect(resultado.estado).toBe("solicitado");
    expect(dependencias.confirmarReembolsoLocal).toHaveBeenCalled();
    expect(dependencias.registrarResultadoCancelamentoNF).toHaveBeenCalledWith(
      expect.objectContaining({
        pagamentoId: "pag_1",
        estado,
        statusGateway: status,
      }),
    );
    if (tipo && codigo) {
      expect(dependencias.abrirPendencia).toHaveBeenCalledWith("pag_1", tipo, codigo);
    } else {
      expect(dependencias.abrirPendencia).not.toHaveBeenCalledWith(
        "pag_1",
        "nota_fiscal",
        expect.any(String),
      );
    }
  });

  it("não bloqueia reembolso quando não existe NF Asaas", async () => {
    const dependencias = criarDependencias();

    const resultado = await solicitarReembolso(
      "user_1",
      7,
      new Date("2026-08-06T01:00:00.000Z"),
      dependencias,
    );

    expect(resultado.estado).toBe("solicitado");
    expect(dependencias.cancelarNotaFiscal).not.toHaveBeenCalled();
  });
});

function criarDependencias(
  opcoes: Partial<PagamentoOperacional> & {
    fatura?: { asaas_fatura_id: string | null; estado: string } | null;
    cancelamentoNF?: { status: string | null };
  } = {},
) {
  const { fatura = null, cancelamentoNF = { status: "CANCELED" }, ...sobrescritas } = opcoes;
  const pagamento: PagamentoOperacional = {
    id: "pag_1",
    produto_id: "produto_1",
    email: "aluno@example.com",
    valor_centavos: 19700,
    meio: "PIX",
    parcelas: 1,
    referencia_interna: "ref_1",
    estado: "ativada",
    asaas_cliente_id: "cus_1",
    asaas_cobranca_id: "pay_1",
    asaas_parcelamento_id: null,
    asaas_status: "RECEIVED",
    resultado_url: null,
    resultado_boleto_url: null,
    resultado_pix_qr_code: null,
    resultado_pix_copia_e_cola: null,
    user_id: "user_1",
    matricula_id: "mat_1",
    confirmado_em: "2026-08-01T12:00:00.000Z",
    ativado_em: "2026-08-01T12:01:00.000Z",
    criado_em: "2026-08-01T12:00:00.000Z",
    ...sobrescritas,
  };

  return {
    buscarPagamentoDoUsuario: vi.fn(async () => pagamento),
    estornarCobranca: vi.fn(async () => ({ status: "DONE" })),
    confirmarReembolsoLocal: vi.fn(async () => undefined),
    buscarFatura: vi.fn(async (): Promise<FaturaOperacional | null> =>
      fatura
        ? {
            pagamento_id: "pag_1",
            asaas_fatura_id: fatura.asaas_fatura_id,
            estado: fatura.estado,
            status_gateway: null,
          }
        : null,
    ),
    cancelarNotaFiscal: vi.fn(async () => cancelamentoNF),
    registrarResultadoCancelamentoNF: vi.fn(async () => undefined),
    abrirPendencia: vi.fn(async () => undefined),
  };
}
