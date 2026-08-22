import { describe, expect, it } from "vitest";

import { dadosDaTelaDaGarantia } from "./page";

describe("tela de garantia", () => {
  it("mostra o quinto dia e mantém o pedido disponível", () => {
    const tela = dadosDaTelaDaGarantia(
      "ativada",
      "2026-08-01T12:00:00.000Z",
      7,
      new Date("2026-08-06T01:00:00.000Z"),
    );

    expect(tela.resultado.diasPassados).toBe(5);
    expect(tela.resultado.diasRestantes).toBe(2);
    expect(tela.resultado.disponivel).toBe(true);
    expect(tela.recusa).toBeNull();
  });

  it("recusa o nono dia com mensagem clara", () => {
    const tela = dadosDaTelaDaGarantia(
      "ativada",
      "2026-08-01T12:00:00.000Z",
      7,
      new Date("2026-08-10T01:00:00.000Z"),
    );

    expect(tela.resultado.disponivel).toBe(false);
    expect(tela.recusa).toMatch(/sete dias/);
  });
});
