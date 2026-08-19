import { describe, expect, it } from "vitest";

import { MINIMO_DE_CARACTERES, problemaDaSenha } from "./senha";

describe("problemaDaSenha", () => {
  it("recusa abaixo do minimo e aceita no minimo", () => {
    const curta = "a".repeat(MINIMO_DE_CARACTERES - 1);
    const exata = "a".repeat(MINIMO_DE_CARACTERES);

    expect(problemaDaSenha(curta)).toContain(String(MINIMO_DE_CARACTERES));
    expect(problemaDaSenha(exata)).toBeNull();
  });

  it("o minimo do produto e mais alto que o default do supabase", () => {
    // O Supabase aceita 6. Se alguem baixar a regra daqui para 6, este teste
    // cai — a regra e do produto, nao herdada do provedor.
    expect(MINIMO_DE_CARACTERES).toBeGreaterThanOrEqual(8);
  });

  it("nao exige mistura de caracteres", () => {
    expect(problemaDaSenha("senhalonga")).toBeNull();
  });
});
