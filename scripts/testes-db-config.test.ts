import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { formatarResumoDasConexoes } from "../tests/db/conexao";

const config = readFileSync("vitest.config.mts", "utf8");
const pacote = JSON.parse(readFileSync("package.json", "utf8")) as {
  scripts: Record<string, string>;
};

describe("contrato operacional da suite db (AD-104)", () => {
  it("mantem um worker sequencial com modulos compartilhados", () => {
    expect(config).toContain("fileParallelism: false");
    expect(config).toContain("isolate: false");
    expect(config).toContain('runner: "tests/db/runner.ts"');
  });

  it("publica a metrica no comando oficial da CI", () => {
    expect(pacote.scripts["test:db"]).toBe(
      "vitest run --project db --disableConsoleIntercept",
    );
    expect(formatarResumoDasConexoes({ usos: 350, conexoes: 1 })).toBe(
      "[db] usos_do_helper=350 conexoes_fisicas=1",
    );
  });
});
