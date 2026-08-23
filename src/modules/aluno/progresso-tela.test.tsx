import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ProgressoTela } from "./progresso-tela";
import type { DadosProgresso } from "./progresso";

const base: DadosProgresso = {
  filtros: { causa: null, topicoId: null },
  historico: [
    { topicoId: "topico-1", topico: "Matemática", nRespostas: 4, nAcertos: 3, score: 0.75 },
  ],
  caderno: [
    { topicoId: "topico-1", topico: "Matemática", causa: "errei_a_conta", nErros: 1, ultimoErroEm: "2026-08-21" },
  ],
  topicos: [{ id: "topico-1", nome: "Matemática" }],
  sequencia: {
    data: "2026-08-22",
    sequencia: 2,
    estado: "folga",
    pisoEntregue: false,
    pisoCumprido: true,
    temHistorico: true,
  },
  estadoInicial: false,
};

describe("ProgressoTela", () => {
  it("mostra sequência, histórico, caderno e filtro de tópico", () => {
    const html = renderToStaticMarkup(<ProgressoTela dados={base} />);
    expect(html).toContain("2 dias de sequência");
    expect(html).toContain("Hoje é uma folga declarada");
    expect(html).toContain("Matemática");
    expect(html).toContain("name=\"causa\"");
    expect(html).toContain("name=\"topico\"");
  });

  it("distingue filtro sem resultado e não cria posição relativa", () => {
    const html = renderToStaticMarkup(
      <ProgressoTela
        dados={{
          ...base,
          filtros: { causa: "chute", topicoId: "topico-1" },
          caderno: [],
        }}
      />,
    );
    expect(html).toContain("Nenhum erro encontrado com esses filtros");
    expect(html.toLowerCase()).not.toContain("ranking");
    expect(html.toLowerCase()).not.toContain("posição");
  });

  it("mostra início explícito quando ainda não há dados", () => {
    const html = renderToStaticMarkup(
      <ProgressoTela
        dados={{
          ...base,
          historico: [],
          caderno: [],
          sequencia: null,
          estadoInicial: true,
        }}
      />,
    );
    expect(html).toContain("Seu ponto de partida");
    expect(html).toContain("Seu caderno ainda está vazio");
  });
});
