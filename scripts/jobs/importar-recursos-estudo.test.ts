import { describe, expect, it, vi } from "vitest";

import {
  importarRecursosEstudo,
  lerArgumentos,
} from "./importar-recursos-estudo.mts";

describe("carga de recursos de estudo", () => {
  it("aceita formato explícito e arquivo nomeado", () => {
    expect(lerArgumentos(["--arquivo", "recursos.csv", "--formato", "csv"])).toEqual({
      arquivo: "recursos.csv",
      formato: "csv",
      dryRun: false,
    });
  });

  it("faz upsert por tópico e URL, contando retomada sem duplicar", async () => {
    let existe = false;
    const cliente = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("select t.id")) return { rows: [{ id: "topico-1" }] };
        if (sql.includes("select id") && sql.includes("recursos_estudo")) {
          return { rows: existe ? [{ id: "recurso-1" }] : [] };
        }
        if (sql.includes("insert into public.recursos_estudo")) {
          existe = true;
          return { rows: [] };
        }
        throw new Error(`consulta inesperada: ${sql}`);
      }),
    };
    const recurso = {
      materia: "Matemática",
      topico: "Juros",
      titulo: "Aula",
      url: "https://conteudo.test/aula",
      tipo: "video" as const,
      duracaoMinutos: 20,
      ordem: 1,
      ativo: true,
    };

    await expect(importarRecursosEstudo(cliente, [recurso], { transacao: false })).resolves.toEqual({
      lidas: 1,
      inseridas: 1,
      atualizadas: 0,
    });
    await expect(importarRecursosEstudo(cliente, [recurso], { transacao: false })).resolves.toEqual({
      lidas: 1,
      inseridas: 0,
      atualizadas: 1,
    });
  });
});
