import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ResumoDaSessao } from "./resumo-sessao";
import { ResumoTela } from "./resumo-tela";

const resumo: ResumoDaSessao = {
  id: "sessao-1",
  blocoId: "bloco-1",
  encerradaEm: "2026-08-23T21:00:00.000Z",
  nQuestoes: 2,
  nAcertos: 1,
  itens: [
    {
      ordem: 1,
      respostaDada: "B",
      correta: false,
      questao: {
        id: "questao-1",
        questaoVersao: 2,
        origem: "real",
        tipoQuestao: "multipla_escolha",
        enunciado: "Quanto deverá pagar?",
        fonteCitacao: {
          banca: "Fundação Cesgranrio",
          ano: 2021,
          orgao: "Banco do Brasil",
          cargo: "Escriturário",
          numero: 28,
        },
        respostaCorreta: "D",
      },
    },
    {
      ordem: 2,
      respostaDada: "C",
      correta: true,
      questao: {
        id: "questao-2",
        questaoVersao: 1,
        origem: "real",
        tipoQuestao: "certo_errado",
        enunciado: "A afirmação está correta.",
        fonteCitacao: null,
        respostaCorreta: "C",
      },
    },
  ],
};

describe("ResumoTela", () => {
  it("mostra placar e correção de cada questão, sem explicação", () => {
    const html = renderToStaticMarkup(<ResumoTela resumo={resumo} />);

    expect(html).toContain("1 de 2 acertos");
    expect(html).toContain("50% de aproveitamento");
    expect(html).toContain("Quanto deverá pagar?");
    expect(html).toContain("Sua resposta");
    expect(html).toContain(">B<");
    expect(html).toContain("Gabarito");
    expect(html).toContain(">D<");
    expect(html).toContain("Fundação Cesgranrio · 2021 · Banco do Brasil");
    expect(html).not.toContain("Explicação");
  });
});
