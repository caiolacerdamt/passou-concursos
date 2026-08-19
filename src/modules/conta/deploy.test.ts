import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * A regiao do deploy (INFRA-01 AC1, AD-035).
 *
 * `gru1` e Sao Paulo. Nao e preferencia de latencia: o AD-035 amarra a escolha
 * a premissa de LGPD de manter o dado no Brasil, e o Supabase ja esta em
 * `sa-east-1`. Uma funcao rodando fora do pais leria dado de aluno de fora do
 * pais — e o default da Vercel para conta nova nao e SP.
 */
describe("vercel.json", () => {
  const arquivo = path.resolve(import.meta.dirname, "../../../vercel.json");
  const config = JSON.parse(readFileSync(arquivo, "utf8"));

  it("declara Sao Paulo como regiao", () => {
    expect(config.regions).toEqual(["gru1"]);
  });

  it("nao lista uma segunda regiao", () => {
    // Multi-regiao esta no Out of Scope do M9: espalharia dado de aluno.
    expect(config.regions).toHaveLength(1);
  });
});
