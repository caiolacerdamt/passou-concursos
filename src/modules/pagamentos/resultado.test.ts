import { describe, expect, it } from "vitest";

import { apresentarResultado } from "./resultado";

describe("resultado operacional do checkout", () => {
  it("mostra instrução Pix sem liberar acesso antes da ativação", () => {
    const resultado = apresentarResultado({
      estado: "pendente",
      meio: "PIX",
      statusGateway: "PENDING",
      url: null,
      boletoUrl: null,
      pixQrCode: "qr",
      pixCopiaECola: "copia",
    });

    expect(resultado).toMatchObject({
      titulo: "Cobrança criada",
      mostraPix: true,
      acessoLiberado: false,
    });
  });

  it("libera a entrada somente quando ativada e mantém fechado após reembolso", () => {
    expect(
      apresentarResultado({
        estado: "ativada",
        meio: "CREDIT_CARD",
        statusGateway: "RECEIVED",
        url: null,
        boletoUrl: null,
        pixQrCode: null,
        pixCopiaECola: null,
      }).acessoLiberado,
    ).toBe(true);
    expect(
      apresentarResultado({
        estado: "reembolsada",
        meio: "PIX",
        statusGateway: "REFUNDED",
        url: null,
        boletoUrl: null,
        pixQrCode: null,
        pixCopiaECola: null,
      }).acessoLiberado,
    ).toBe(false);
  });
});
