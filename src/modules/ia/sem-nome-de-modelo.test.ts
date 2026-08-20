import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * O sensor do Success Criterion "nenhum teste automatizado cita nome de modelo"
 * (SPEC 08) e da proibicao do `AGENTS.md` / IA-02 AC1.
 *
 * Varre **codigo e teste**, nunca documento: spec, AD e comentario de documento
 * PODEM citar o default vigente, porque isso e registro do que esta configurado
 * hoje e nao acoplamento (AD-068).
 *
 * Os padroes abaixo sao **familias**, nao modelos: `gpt-` alcanca qualquer
 * variante da OpenAI sem que este arquivo precise escrever o nome de nenhuma.
 */
const FAMILIAS = [
  { nome: "OpenAI", regex: /\bgpt-/i },
  { nome: "Anthropic", regex: /\bclaude-\d/i },
  { nome: "Google", regex: /\bgemini-/i },
  { nome: "Meta", regex: /\bllama-/i },
  { nome: "raciocinio da OpenAI", regex: /\bo[134]-(?:mini|pro)\b/i },
];

/** So codigo. `docs/`, `.specs/` e `README` ficam de fora de proposito. */
const PASTAS_VARRIDAS = ["src/", "scripts/", "tests/"];

const ESTE_ARQUIVO = "src/modules/ia/sem-nome-de-modelo.test.ts";

function arquivosDeCodigo(): string[] {
  return execFileSync("git", ["ls-files", "-z", ...PASTAS_VARRIDAS], {
    encoding: "utf8",
  })
    .split("\0")
    .filter((caminho) => caminho !== "" && caminho !== ESTE_ARQUIVO);
}

describe("nenhum nome de modelo em codigo ou teste (IA-02 AC1, AD-068)", () => {
  it("varre alguma coisa — sensor cego passaria sempre", () => {
    expect(arquivosDeCodigo().length).toBeGreaterThan(50);
  });

  it("nao acha familia de modelo nenhuma em src/, scripts/ e tests/", () => {
    const achados: string[] = [];

    for (const caminho of arquivosDeCodigo()) {
      let texto: string;
      try {
        texto = readFileSync(caminho, "utf8");
      } catch {
        continue; // arquivo sumiu no meio da varredura
      }

      const linhas = texto.split(/\r?\n/);
      for (let i = 0; i < linhas.length; i += 1) {
        for (const { nome, regex } of FAMILIAS) {
          if (regex.test(linhas[i])) {
            achados.push(`${caminho}:${i + 1} — modelo ${nome}`);
          }
        }
      }
    }

    expect(achados).toEqual([]);
  });

  it("o sensor enxerga: um texto com nome de modelo casa com o padrao", () => {
    const familiaDaOpenAI = FAMILIAS[0].regex;
    expect(familiaDaOpenAI.test("modelo: gpt-9.9-qualquer")).toBe(true);
    expect(familiaDaOpenAI.test("modelo: modelo-de-teste")).toBe(false);
  });
});
