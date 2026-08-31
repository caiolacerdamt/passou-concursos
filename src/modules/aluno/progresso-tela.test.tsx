import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ProgressoTela } from "./progresso-tela";
import type { DadosProgresso } from "./progresso";

const base: DadosProgresso = {
  filtros: { causa: null, topicoId: null },
  historico: [
    {
      topicoId: "topico-1",
      topico: "Matemática",
      nRespostas: 4,
      nAcertos: 3,
      score: 0.75,
      dominio: "forte",
      tendencia: "sem_base",
    },
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
  relatorioSemanal: {
    inicio: "2026-08-15T00:00:00Z",
    fim: "2026-08-22T00:00:00Z",
    questoesRespondidas: 4,
    acertos: 3,
    percentualAcertos: 0.75,
    topicosTocados: 1,
    revisoesConcluidas: 1,
    tendencia: "subindo",
    porDia: [
      { data: "2026-08-16", questoes: 0, acertos: 0 },
      { data: "2026-08-17", questoes: 1, acertos: 1 },
      { data: "2026-08-18", questoes: 0, acertos: 0 },
      { data: "2026-08-19", questoes: 1, acertos: 1 },
      { data: "2026-08-20", questoes: 0, acertos: 0 },
      { data: "2026-08-21", questoes: 1, acertos: 0 },
      { data: "2026-08-22", questoes: 1, acertos: 1 },
    ],
  },
};

describe("ProgressoTela", () => {
  it("mostra sequência, histórico, caderno e filtro de tópico", () => {
    const html = renderToStaticMarkup(<ProgressoTela dados={base} />);
    expect(html).toContain("2 dias de sequência");
    expect(html).toContain("Hoje é uma folga declarada");
    expect(html).toContain("Matemática");
    expect(html).toContain("Domínio: Forte");
    expect(html).toContain("Tendência: Sem base");
    expect(html).toContain("Relatório semanal");
    expect(html).toContain("Refazer questões deste erro");
    expect(html).toContain("refacao=1");
    expect(html).toContain("name=\"causa\"");
    expect(html).toContain("name=\"topico\"");
  });

  it("distingue filtro sem resultado e não cria posição relativa", () => {
    const html = renderToStaticMarkup(
      <ProgressoTela
        dados={{
          ...base,
          filtros: { causa: "chutei", topicoId: "topico-1" },
          caderno: [],
        }}
      />,
    );
    expect(html).toContain("Nenhum erro encontrado com esses filtros");
    const texto = html.toLowerCase();
    for (const palavra of ["ranking", "liga", "placar", "percentil", "posição"]) {
      expect(texto).not.toContain(palavra);
    }
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

  it("mostra erros com três causas diferentes para revisão", () => {
    const html = renderToStaticMarkup(
      <ProgressoTela
        dados={{
          ...base,
          caderno: [
            { topicoId: "topico-1", topico: "Matemática", causa: "errei_a_conta", nErros: 2, ultimoErroEm: "2026-08-21" },
            { topicoId: "topico-1", topico: "Matemática", causa: "chutei", nErros: 1, ultimoErroEm: "2026-08-20" },
            { topicoId: "topico-1", topico: "Matemática", causa: "faltou_tempo", nErros: 1, ultimoErroEm: "2026-08-19" },
          ],
        }}
      />,
    );

    expect(html).toContain("Errei a conta");
    expect(html).toContain("Chutei");
    expect(html).toContain("Faltou tempo");
  });
});
