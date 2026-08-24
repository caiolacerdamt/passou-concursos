import { describe, expect, it } from "vitest";

import { consultarInventarioAcervo } from "./relatorio";

describe("relatório do acervo", () => {
  it("mapeia as quatro contagens vindas do banco sem inventar valores", async () => {
    const cliente = {
      query: async () => ({
        rows: [
          {
            materia_id: "materia-1",
            materia: "Matemática",
            topico_id: "topico-1",
            topico: "Juros",
            total: "10",
            importadas: "8",
            publicadas: "5",
            aptas_sessao: "4",
          },
        ],
      }),
    };

    await expect(consultarInventarioAcervo(cliente)).resolves.toEqual([
      {
        materiaId: "materia-1",
        materia: "Matemática",
        topicoId: "topico-1",
        topico: "Juros",
        total: 10,
        importadas: 8,
        publicadas: 5,
        aptasSessao: 4,
      },
    ]);
  });
});
