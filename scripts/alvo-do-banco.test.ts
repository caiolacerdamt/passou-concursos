import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  PROJETO_REF,
  conferirAlvo,
  lerEnv,
  refDoBanco,
} from "./alvo-do-banco.mjs";

const SENHA = "senha-de-mentira";

describe("alvo do db:push", () => {
  it("so aceita o projeto de desenvolvimento, nao o que o ambiente sugerir", () => {
    // Os dois formatos de conexao que o painel do Supabase entrega.
    const direta = `postgresql://postgres:${SENHA}@db.${PROJETO_REF}.supabase.co:5432/postgres`;
    const pooler = `postgresql://postgres.${PROJETO_REF}:${SENHA}@aws-0-sa-east-1.pooler.supabase.com:5432/postgres`;

    expect(refDoBanco(direta)).toBe(PROJETO_REF);
    expect(refDoBanco(pooler)).toBe(PROJETO_REF);
    expect(conferirAlvo(direta)).toEqual({ ok: true });
    expect(conferirAlvo(pooler)).toEqual({ ok: true });

    // Projeto de outra conta: exatamente o acidente que a variavel global do
    // Windows pode causar.
    const outro = `postgresql://postgres.abcdefghijklmnopqrst:${SENHA}@aws-0-sa-east-1.pooler.supabase.com:5432/postgres`;
    expect(refDoBanco(outro)).toBe("abcdefghijklmnopqrst");
    expect(conferirAlvo(outro).ok).toBe(false);

    // Projeto que nao da para identificar tambem e recusado — nunca segue no escuro.
    expect(refDoBanco("postgresql://postgres:x@localhost:5432/postgres")).toBeNull();
    expect(refDoBanco("nao e uma url")).toBeNull();
    expect(refDoBanco(undefined)).toBeNull();
    expect(conferirAlvo(undefined).ok).toBe(false);
  });

  it("esta ligado de verdade: package.json, script e config.toml apontam para o mesmo projeto", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    expect(pkg.scripts["db:push"]).toBe("node scripts/db-push.mjs");

    // O guardiao nao pode existir sem ser chamado.
    const script = readFileSync("scripts/db-push.mjs", "utf8");
    expect(script).toContain("conferirAlvo");
    expect(script).toContain("--db-url");

    expect(readFileSync("supabase/config.toml", "utf8")).toContain(
      `project_id = "${PROJETO_REF}"`,
    );
  });
});

describe("lerEnv", () => {
  it("le o valor do arquivo, ignorando comentario e linha vazia", () => {
    const texto = [
      "# um comentario",
      "",
      "SUPABASE_ACCESS_TOKEN=sbp_do_arquivo",
      'DATABASE_URL="postgresql://u:s@host:5432/postgres"',
      "  ESPACOS  =  com espaco  ",
    ].join("\n");

    expect(lerEnv(texto)).toEqual({
      SUPABASE_ACCESS_TOKEN: "sbp_do_arquivo",
      DATABASE_URL: "postgresql://u:s@host:5432/postgres",
      ESPACOS: "com espaco",
    });
  });
});
