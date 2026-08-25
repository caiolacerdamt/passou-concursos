import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const ARQUIVO_DA_MIGRATION = resolve(
  process.cwd(),
  "supabase/migrations/20260824104000_gamificacao_dominio.sql",
);

function corpoDaMaterializacao(): string {
  const migration = readFileSync(ARQUIVO_DA_MIGRATION, "utf8");
  const inicio = migration.indexOf(
    "create or replace function public.materializar_gamificacao(",
  );
  const fim = migration.indexOf("\n$$;", inicio);
  if (inicio < 0 || fim < 0) {
    throw new Error("migration W4-B não contém materializar_gamificacao completa");
  }
  return migration.slice(inicio, fim);
}

describe("migration W4-B", () => {
  it("declara todas as variáveis v_* usadas na materialização", () => {
    const corpo = corpoDaMaterializacao();
    const declaracoes = corpo.match(/\bdeclare\b([\s\S]*?)\bbegin\b/i)?.[1] ?? "";
    const declaradas = new Set(declaracoes.match(/\bv_[a-z_]+\b/gi) ?? []);
    const usadas = new Set(corpo.match(/\bv_[a-z_]+\b/gi) ?? []);
    const semDeclaracao = [...usadas].filter((nome) => !declaradas.has(nome));

    expect([...declaradas]).toEqual(
      expect.arrayContaining([
        "v_estudo_progresso",
        "v_questoes_progresso",
        "v_revisao_progresso",
      ]),
    );
    expect(semDeclaracao).toEqual([]);
  });
});
