import { describe, expect, it } from "vitest";

import {
  RESULTADO_TOKEN_TTL_HORAS,
  criarTokenDeResultado,
  hashTokenDeResultado,
} from "./resultado-token";

describe("capability token do resultado do checkout", () => {
  it("é aleatório, guarda somente hash e expira no TTL definido", () => {
    const agora = new Date("2026-08-21T12:00:00.000Z");
    const primeiro = criarTokenDeResultado(agora);
    const segundo = criarTokenDeResultado(agora);

    expect(primeiro.token).not.toBe(segundo.token);
    expect(primeiro.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(primeiro.hash).toBe(hashTokenDeResultado(primeiro.token));
    expect(primeiro.hash).not.toContain(primeiro.token);
    expect(primeiro.expiraEm.toISOString()).toBe(
      new Date(
        agora.getTime() + RESULTADO_TOKEN_TTL_HORAS * 60 * 60 * 1_000,
      ).toISOString(),
    );
  });
});
