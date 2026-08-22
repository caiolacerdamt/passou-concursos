import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/ci.yml", "utf8");

function jobEntre(inicio: string, fim: string): string {
  const de = workflow.indexOf(`\n  ${inicio}:`);
  const ate = workflow.indexOf(`\n  ${fim}:`, de + 1);
  if (de < 0 || ate < 0) throw new Error(`jobs ${inicio}/${fim} nao encontrados`);
  return workflow.slice(de, ate);
}

describe("CI — app e banco independentes (AD-104)", () => {
  it("roda o caminho rapido sem esperar a suite de banco", () => {
    const app = jobEntre("app", "db");

    expect(app).toContain("name: App rápido");
    expect(app).toContain("run: npm run build");
    expect(app).toContain("run: npm run lint");
    expect(app).toContain("run: npm run test:unit");
    expect(app).not.toContain("test:db");
  });

  it("isola o banco e preserva o check agregado da main", () => {
    const db = jobEntre("db", "gate");
    const gate = jobEntre("gate", "alerta");

    expect(db).toContain("group: testes-banco-supabase-dev");
    expect(db).toContain("cancel-in-progress: false");
    expect(db).toContain("run: npm run test:db");
    expect(gate).toContain("name: Typecheck, teste e build");
    expect(gate).toContain("needs: [app, db]");
  });

  it("cancela somente a execucao obsoleta do mesmo PR ou ref", () => {
    expect(workflow).toContain(
      "group: ci-${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}",
    );
    expect(workflow).toContain("cancel-in-progress: true");
  });
});
