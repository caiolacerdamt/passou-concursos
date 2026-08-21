import { describe, expect, it, vi } from "vitest";

import {
  calcularGarantia,
  diasCorridosEntre,
  mensagemDaRecusaDaGarantia,
  solicitarReembolso,
} from "./garantia";
import type { PagamentoOperacional } from "./repositorio";

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
    );
    expect(dependencias.registrarSolicitacaoReembolso).toHaveBeenCalledWith(
      "pag_1",
      "user_1",
      "PIX",
      "2026-08-06T01:00:00.000Z",
    );
    expect(dependencias.mudarEstado).toHaveBeenCalledWith(
      "pag_1",
      "reembolso_confirmado",
    );
    expect(dependencias.marcarMatriculaReembolsada).toHaveBeenCalledWith(
      "mat_1",
      "user_1",
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
    expect(antesDaConfirmacao.mudarEstado).not.toHaveBeenCalled();
    expect(antesDaConfirmacao.marcarMatriculaReembolsada).not.toHaveBeenCalled();
    expect(antesDaConfirmacao.abrirPendencia).toHaveBeenCalledWith(
      "pag_1",
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
    expect(gatewayFalhou.mudarEstado).not.toHaveBeenCalled();
    expect(gatewayFalhou.marcarMatriculaReembolsada).not.toHaveBeenCalled();
    expect(gatewayFalhou.abrirPendencia).toHaveBeenCalledWith(
      "pag_1",
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
    expect(aguardando.mudarEstado).not.toHaveBeenCalled();
    expect(aguardando.marcarMatriculaReembolsada).not.toHaveBeenCalled();
    expect(aguardando.abrirPendencia).toHaveBeenCalledWith(
      "pag_1",
      "estorno_aguardando_confirmacao",
    );
  });
});

function criarDependencias(
  sobrescritas: Partial<PagamentoOperacional> = {},
) {
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
    registrarSolicitacaoReembolso: vi.fn(async () => undefined),
    mudarEstado: vi.fn(async () => undefined),
    marcarMatriculaReembolsada: vi.fn(async () => undefined),
    abrirPendencia: vi.fn(async () => undefined),
  };
}
