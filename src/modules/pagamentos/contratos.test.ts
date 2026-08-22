import { describe, expect, it } from "vitest";

import {
  entradaCheckoutSchema,
  exigirTransicaoDePagamento,
  sanitizarErroDePagamento,
  transicaoDePagamentoPermitida,
  validarEntradaCheckout,
} from "./contratos";

describe("contratos do checkout", () => {
  it("normaliza e data o aceite no servidor", () => {
    const validado = validarEntradaCheckout(
      {
        email: "  ALUNO@EXEMPLO.COM ",
        nomeCompleto: "Aluno Exemplo",
        cpfCnpj: "123.456.789-09",
        meio: "PIX",
        maiorDeIdade: true,
        aceitouTermos: true,
        termosVersao: "v1",
      },
      new Date("2026-08-21T15:00:00.000Z"),
    );

    expect(validado.email).toBe("aluno@exemplo.com");
    expect(validado.aceiteEm).toBe("2026-08-21T15:00:00.000Z");
  });

  it("recusa menoridade, termo não aceito, data de nascimento e chave extra", () => {
    expect(
      entradaCheckoutSchema.safeParse({
        email: "aluno@exemplo.com",
        nomeCompleto: "Aluno Exemplo",
        cpfCnpj: "12345678909",
        meio: "PIX",
        maiorDeIdade: false,
        aceitouTermos: true,
        termosVersao: "v1",
      }).success,
    ).toBe(false);
    expect(
      entradaCheckoutSchema.safeParse({
        email: "aluno@exemplo.com",
        nomeCompleto: "Aluno Exemplo",
        cpfCnpj: "12345678909",
        meio: "PIX",
        maiorDeIdade: true,
        aceitouTermos: false,
        termosVersao: "v1",
      }).success,
    ).toBe(false);
    expect(
      entradaCheckoutSchema.safeParse({
        email: "aluno@exemplo.com",
        nomeCompleto: "Aluno Exemplo",
        cpfCnpj: "12345678909",
        meio: "PIX",
        maiorDeIdade: true,
        aceitouTermos: true,
        termosVersao: "v1",
        dataNascimento: "1990-01-01",
      }).success,
    ).toBe(false);
  });

  it("normaliza o documento para o provedor e não cria data de nascimento", () => {
    const validado = validarEntradaCheckout({
      email: "aluno@exemplo.com",
      nomeCompleto: "Aluno Exemplo",
      cpfCnpj: "12.345.678/0001-90",
      meio: "BOLETO",
      maiorDeIdade: true,
      aceitouTermos: true,
      termosVersao: "v1",
    });

    expect(validado.cpfCnpj).toBe("12345678000190");
    expect(validado).not.toHaveProperty("dataNascimento");
  });

  it("mantém a máquina pura igual à máquina SQL", () => {
    expect(transicaoDePagamentoPermitida("pendente", "confirmada")).toBe(true);
    expect(transicaoDePagamentoPermitida("confirmada", "ativada")).toBe(true);
    expect(transicaoDePagamentoPermitida("ativada", "reembolsada")).toBe(true);
    expect(transicaoDePagamentoPermitida("pendente", "reembolsada")).toBe(false);
    expect(() => exigirTransicaoDePagamento("pendente", "reembolsada")).toThrow(
      /transicao de pagamento invalida/,
    );
  });

  it("não repassa mensagem de gateway nem dados sensíveis", () => {
    const seguro = sanitizarErroDePagamento(
      new Error("token=segredo email=aluno@exemplo.com cpf=123"),
    );

    expect(seguro.codigo).toBe("gateway_indisponivel");
    expect(seguro.mensagem).not.toContain("segredo");
    expect(seguro.mensagem).not.toContain("aluno@exemplo.com");
  });
});
