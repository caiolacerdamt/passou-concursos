import { describe, expect, it } from "vitest";

import {
  calcularGarantia,
  diasCorridosEntre,
  mensagemDaRecusaDaGarantia,
} from "./garantia";

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
});
