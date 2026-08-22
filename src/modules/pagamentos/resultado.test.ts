import { describe, expect, it } from "vitest";

import { apresentarResultado, mascararEmail } from "./resultado";

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

describe("aviso de criação de senha (SPEC 12 · homologação 2026-08-22)", () => {
  const ativada = (email?: string | null) =>
    apresentarResultado({
      estado: "ativada",
      email,
      meio: "BOLETO",
      statusGateway: "RECEIVED",
      url: null,
      boletoUrl: null,
      pixQrCode: null,
      pixCopiaECola: null,
    });

  it("diz onde procurar o e-mail de senha, com o endereço mascarado", () => {
    const aviso = ativada("caiolacerda07@gmail.com").avisoDeSenha;

    expect(aviso).toContain("ca•••07@gmail.com");
    expect(aviso).toContain("criar sua senha");
    // O endereço inteiro nunca aparece: a página é pública por capability token.
    expect(aviso).not.toContain("caiolacerda07@gmail.com");
  });

  it("sem e-mail conhecido ainda manda abrir a caixa de entrada", () => {
    expect(ativada(null).avisoDeSenha).toContain("criar sua senha");
    expect(ativada(undefined).avisoDeSenha).toContain("criar sua senha");
  });

  it("não aparece quando não há acesso liberado nem depois do reembolso", () => {
    expect(
      apresentarResultado({
        estado: "pendente",
        email: "alguem@exemplo.com",
        meio: "PIX",
        statusGateway: "PENDING",
        url: null,
        boletoUrl: null,
        pixQrCode: "qr",
        pixCopiaECola: "copia",
      }).avisoDeSenha,
    ).toBeNull();

    expect(
      apresentarResultado({
        estado: "reembolsada",
        email: "alguem@exemplo.com",
        meio: "PIX",
        statusGateway: "REFUNDED",
        url: null,
        boletoUrl: null,
        pixQrCode: null,
        pixCopiaECola: null,
      }).avisoDeSenha,
    ).toBeNull();
  });
});

describe("mascararEmail", () => {
  it("preserva as pontas do local part e o domínio inteiro", () => {
    expect(mascararEmail("caiolacerda07@gmail.com")).toBe("ca•••07@gmail.com");
    expect(mascararEmail("suporte.vektor.ia@gmail.com")).toBe("su•••ia@gmail.com");
  });

  it("esconde o fim quando o endereço é curto demais para sobrar mistério", () => {
    // Com 4 caracteres, duas letras de cada ponta mostrariam tudo.
    expect(mascararEmail("caio@gmail.com")).toBe("ca•••@gmail.com");
    expect(mascararEmail("ab@gmail.com")).toBe("a•••@gmail.com");
  });

  it("não quebra com entrada que não é endereço", () => {
    expect(mascararEmail("sem-arroba")).toBe("•••");
    expect(mascararEmail("@so-dominio.com")).toBe("•••");
  });
});
