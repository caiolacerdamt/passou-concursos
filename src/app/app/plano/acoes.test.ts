import { describe, expect, it } from "vitest";

const acoes = await import("./acoes");

describe("ações do plano", () => {
  it("não expõe ações revogadas para a superfície do plano", () => {
    expect(Object.keys(acoes)).toEqual([]);
    expect(acoes).not.toHaveProperty("reordenarBlocosPendentes");
    expect(acoes).not.toHaveProperty("adiarBloco");
    expect(acoes).not.toHaveProperty("escolherVersaoCurta");
  });
});
