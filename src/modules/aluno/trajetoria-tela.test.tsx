import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TrajetoriaEmUmaLinha, TrajetoriaTela } from "./trajetoria-tela";
import type { Trajetoria } from "./trajetoria";

const BASE: Trajetoria = {
  porMateria: [
    {
      materiaId: "m1",
      nome: "Matemática Financeira",
      ordem: 1,
      nTopicos: 10,
      nTocados: 6,
      nDominados: 2,
      pesoRaioX: 0.4,
    },
    {
      materiaId: "m2",
      nome: "Conhecimentos Bancários",
      ordem: 2,
      nTopicos: 12,
      nTocados: 3,
      nDominados: 0,
      pesoRaioX: 0.6,
    },
  ],
  total: { nTopicos: 22, nTocados: 9, nDominados: 2, coberturaPonderada: 0.41 },
  ritmo: { topicosNovosPorSemana: 2, semanasObservadas: 4 },
  contagem: { dataProva: "2027-01-27", dias: 148, estado: "futura" },
  previsao: { dataEstimada: "2026-11-10", diasAntesDaProva: 78, confiavel: true },
};

describe("TrajetoriaTela", () => {
  it("o número que manda é a cobertura ponderada, e o resto é texto", () => {
    const html = renderToStaticMarkup(<TrajetoriaTela trajetoria={BASE} />);

    expect(html).toContain("41% do que mais cai");
    expect(html).toContain("9 de 22 assuntos tocados");
    expect(html).toContain("2 dominados");
    // A régua do DESIGN.md proíbe a grade de cartões de métrica.
    expect(html).not.toContain("grid-cols-4");
  });

  it("uma barra por matéria, na ordem do edital", () => {
    const html = renderToStaticMarkup(<TrajetoriaTela trajetoria={BASE} />);

    expect(html.indexOf("Matemática Financeira")).toBeLessThan(
      html.indexOf("Conhecimentos Bancários"),
    );
    expect(html).toContain("6 de 10");
    expect(html).toContain("3 de 12");
    // Tocado e dominado são traços distintos: um número só faria o aluno achar
    // que "cobriu" o que respondeu uma vez.
    expect(html).toContain("6 de 10 assuntos tocados, 2 dominados");
  });

  it("aluno que nunca respondeu recebe convite, não barra zerada", () => {
    const html = renderToStaticMarkup(
      <TrajetoriaTela
        trajetoria={{
          ...BASE,
          porMateria: BASE.porMateria.map((materia) => ({
            ...materia,
            nTocados: 0,
            nDominados: 0,
          })),
          total: { nTopicos: 22, nTocados: 0, nDominados: 0, coberturaPonderada: 0 },
        }}
      />,
    );

    expect(html).toContain("Você ainda não tocou o edital");
    expect(html).not.toContain("0% do que mais cai");
  });

  it("sem base para projetar, diz isso — não inventa data", () => {
    const html = renderToStaticMarkup(
      <TrajetoriaTela
        trajetoria={{
          ...BASE,
          ritmo: { topicosNovosPorSemana: 0, semanasObservadas: 1 },
          previsao: { dataEstimada: null, diasAntesDaProva: null, confiavel: false },
        }}
      />,
    );

    expect(html).toContain("Ainda não dá para projetar o fim do edital");
    expect(html).not.toContain("por volta de");
  });

  it("sem data de prova mostra a cobertura e manda cadastrar a data", () => {
    const html = renderToStaticMarkup(
      <TrajetoriaTela
        trajetoria={{
          ...BASE,
          contagem: { dataProva: null, dias: null, estado: "indefinida" },
          previsao: { dataEstimada: "2026-11-10", diasAntesDaProva: null, confiavel: true },
        }}
      />,
    );

    expect(html).toContain("41% do que mais cai");
    expect(html).toContain('href="/app/preferencias"');
    expect(html).toContain("Cadastre a data da prova");
  });

  it("edital que fecha depois da prova não é escondido", () => {
    const html = renderToStaticMarkup(
      <TrajetoriaTela
        trajetoria={{
          ...BASE,
          previsao: { dataEstimada: "2027-03-02", diasAntesDaProva: -34, confiavel: true },
        }}
      />,
    );

    expect(html).toContain("34 dias depois da prova");
  });
});

describe("TrajetoriaEmUmaLinha", () => {
  it("é uma linha clicável para o Progresso, e nada mais", () => {
    const html = renderToStaticMarkup(<TrajetoriaEmUmaLinha trajetoria={BASE} />);

    expect(html).toContain('href="/app/progresso"');
    expect(html).toContain("41% do edital coberto · prova em 148 dias");
    expect(html).not.toContain("Matemática Financeira");
  });

  it("some para quem ainda não respondeu nada", () => {
    const html = renderToStaticMarkup(
      <TrajetoriaEmUmaLinha
        trajetoria={{
          ...BASE,
          total: { nTopicos: 22, nTocados: 0, nDominados: 0, coberturaPonderada: 0 },
        }}
      />,
    );

    expect(html).toBe("");
  });

  it("sem prova cadastrada mostra só a cobertura", () => {
    const html = renderToStaticMarkup(
      <TrajetoriaEmUmaLinha
        trajetoria={{
          ...BASE,
          contagem: { dataProva: null, dias: null, estado: "indefinida" },
        }}
      />,
    );

    expect(html).toContain("41% do edital coberto");
    expect(html).not.toContain("prova em");
  });
});
