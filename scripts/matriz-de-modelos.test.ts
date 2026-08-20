import { describe, expect, it } from "vitest";

import { CHAVES, CONSULTA, relatorio } from "./matriz-de-modelos.mjs";

describe("relatorio da matriz", () => {
  it("matriz vazia diz que e o desenho, e aponta onde provisionar", () => {
    const texto = relatorio([]);
    expect(texto).toContain("VAZIA");
    expect(texto).toContain("docs/IA.md");
  });

  it("lista as tarefas que tem perfil", () => {
    const texto = relatorio([
      {
        chave: "param.m2.matriz_de_modelos",
        valor: { explicacao: {}, tutor: {} },
        alterado_em: new Date("2026-08-20T00:00:00Z"),
        motivo: "matriz inicial",
      },
    ]);

    expect(texto).toContain("2 tarefa(s)");
    expect(texto).toContain("explicacao");
    expect(texto).toContain("matriz inicial");
  });

  it("preco sem matriz e avisado — sozinho ele nao faz nada rodar", () => {
    const texto = relatorio([
      {
        chave: "param.m2.precos_por_modelo",
        valor: {},
        alterado_em: new Date("2026-08-20T00:00:00Z"),
        motivo: null,
      },
    ]);

    expect(texto).toContain("ATENCAO");
  });

  it("olha as duas chaves do M2, com a regra do valor vigente", () => {
    expect(CHAVES).toEqual([
      "param.m2.matriz_de_modelos",
      "param.m2.precos_por_modelo",
    ]);
    expect(CONSULTA).toContain("distinct on (chave)");
    expect(CONSULTA).toContain("public.configuracoes");
  });
});
