import { describe, expect, it, vi } from "vitest";

import { executarCheckout } from "./checkout";
import { calcularPrecosPublicos } from "./preco";

const precos = calcularPrecosPublicos({
  precoAnualCentavos: 19_700,
  descontoAVistaPercentual: 0.1,
  garantiaDias: 7,
});

function entrada(meio: "CREDIT_CARD" | "PIX" | "BOLETO" = "PIX") {
  return {
    email: "aluno@exemplo.com",
    nomeCompleto: "Aluno Exemplo",
    cpfCnpj: "12345678909",
    meio,
    maiorDeIdade: true,
    aceitouTermos: true,
    termosVersao: "v1",
  };
}

function dependencias() {
  const gateway = {
    criarCliente: vi.fn(async () => ({ id: "cus_1" })),
    criarCobranca: vi.fn(async () => ({
      id: "pay_1",
      status: "PENDING",
      billingType: "PIX",
      externalReference: "checkout-fixo",
      invoiceUrl: "https://sandbox.asaas.com/i/pay_1",
      bankSlipUrl: null,
      pixQrCode: "qr",
      pixCopiaECola: "copia-e-cola",
    })),
  };
  const repositorio = {
    existeMatriculaAtivaPorEmail: vi.fn(async () => false),
    criarPagamentoPendente: vi.fn(async (input: {
      email: string;
      valorCentavos: number;
      meio: "CREDIT_CARD" | "PIX" | "BOLETO";
      parcelas: number;
      referenciaInterna: string;
    }) => ({
      id: "pag_1",
      email: input.email,
      valor_centavos: input.valorCentavos,
      meio: input.meio,
      parcelas: input.parcelas,
      referencia_interna: input.referenciaInterna,
      estado: "pendente",
    })),
    salvarResultadoGateway: vi.fn(async () => undefined),
    criarTokenResultado: vi.fn(async () => "resultado-token-teste"),
  };

  return {
    precos,
    gateway,
    repositorio,
    agora: new Date("2026-08-21T12:00:00.000Z"),
    gerarReferencia: () => "checkout-fixo",
  };
}

describe("orquestrador do checkout", () => {
  it("bloqueia matrícula ativa antes de criar cliente, pagamento ou cobrança", async () => {
    const deps = dependencias();
    deps.repositorio.existeMatriculaAtivaPorEmail.mockResolvedValue(true);

    const resultado = await executarCheckout(entrada(), deps);

    expect(resultado).toEqual({ tipo: "matricula_ativa", email: "aluno@exemplo.com" });
    expect(deps.repositorio.criarPagamentoPendente).not.toHaveBeenCalled();
    expect(deps.gateway.criarCliente).not.toHaveBeenCalled();
    expect(deps.gateway.criarCobranca).not.toHaveBeenCalled();
  });

  it("congela o preço à vista, grava o aceite com data do servidor e persiste o retorno", async () => {
    const deps = dependencias();

    const resultado = await executarCheckout(entrada("PIX"), deps);

    expect(resultado).toMatchObject({
      tipo: "criado",
      resultadoToken: "resultado-token-teste",
    });
    expect(deps.repositorio.criarPagamentoPendente).toHaveBeenCalledWith(
      expect.objectContaining({
        valorCentavos: 17_730,
        parcelas: 1,
        termosVersao: "inicial-2026-08",
        aceitoEm: "2026-08-21T12:00:00.000Z",
        maiorDeIdade: true,
      }),
    );
    expect(deps.gateway.criarCobranca).toHaveBeenCalledWith(
      expect.objectContaining({ meio: "PIX", valorCentavos: 17_730 }),
    );
    expect(deps.repositorio.salvarResultadoGateway).toHaveBeenCalledWith(
      "pag_1",
      expect.objectContaining({ cobrancaId: "pay_1", clienteId: "cus_1" }),
    );
    expect(deps.repositorio.criarTokenResultado).toHaveBeenCalledWith("pag_1");
  });

  it("cartão usa o total parcelado em 12 parcelas e rejeita maioridade/termos ausentes", async () => {
    const deps = dependencias();

    await executarCheckout(entrada("CREDIT_CARD"), deps);

    expect(deps.repositorio.criarPagamentoPendente).toHaveBeenCalledWith(
      expect.objectContaining({ valorCentavos: 19_700, parcelas: 12 }),
    );

    await expect(
      executarCheckout({ ...entrada(), maiorDeIdade: false }, deps),
    ).rejects.toThrow();
    expect(deps.repositorio.criarPagamentoPendente).toHaveBeenCalledTimes(1);
  });

  it("rejeita data de nascimento e outras chaves no servidor", async () => {
    const deps = dependencias();

    await expect(
      executarCheckout({ ...entrada(), dataNascimento: "1990-01-01" }, deps),
    ).rejects.toThrow();
    expect(deps.repositorio.criarPagamentoPendente).not.toHaveBeenCalled();
  });
});
