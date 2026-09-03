import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ResumoDaSessao } from "./resumo-sessao";
import { ResumoTela } from "./resumo-tela";

const resumo: ResumoDaSessao = {
  id: "sessao-1",
  blocoId: "bloco-1",
  encerradaEm: "2026-08-23T21:00:00.000Z",
  proximaRevisao: "2026-08-30",
  nQuestoes: 2,
  nAcertos: 1,
  itens: [
    {
      ordem: 1,
      respostaDada: "B",
      correta: false,
      causaErro: "errei_a_conta",
      questao: {
        id: "questao-1",
        questaoVersao: 2,
        origem: "real",
        tipoQuestao: "multipla_escolha",
        enunciado: "**Financiamento.**\n\nQuanto deverá pagar?",
        alternativas: [
          { letra: "A", texto: "R$ 100,00" },
          { letra: "B", texto: "R$ 200,00" },
          { letra: "C", texto: "R$ 300,00" },
          { letra: "D", texto: "R$ 400,00" },
        ],
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
      causaErro: null,
      questao: {
        id: "questao-2",
        questaoVersao: 1,
        origem: "real",
        tipoQuestao: "certo_errado",
        enunciado: "A afirmação está correta.",
        alternativas: null,
        fonteCitacao: null,
        respostaCorreta: "C",
      },
    },
  ],
};

describe("ResumoTela", () => {
  it("mostra placar e correção da questão aberta, sem explicação", () => {
    const html = renderToStaticMarkup(<ResumoTela resumo={resumo} />);

    expect(html).toContain("1 de 2 acertos");
    expect(html).toContain("50% de aproveitamento");
    expect(html).toContain("Próxima revisão: 30 de agosto de 2026");
    expect(html).toContain("Quanto deverá pagar?");
    expect(html).toContain("Sua resposta");
    expect(html).toContain("Gabarito");
    expect(html).toContain("Fundação Cesgranrio · 2021 · Banco do Brasil");
    expect(html).not.toContain("Explicação");
  });

  it("mostra as alternativas inteiras, não só as duas letras (AD-127)", () => {
    const html = renderToStaticMarkup(<ResumoTela resumo={resumo} />);

    expect(html).toContain("R$ 100,00");
    expect(html).toContain("R$ 200,00");
    expect(html).toContain("R$ 400,00");
  });

  it("abre uma questão por vez, com quadrado numerado para pular (AD-127)", () => {
    const html = renderToStaticMarkup(<ResumoTela resumo={resumo} />);

    // A segunda questão existe na navegação, mas o texto dela não está na tela.
    expect(html).toContain("Rever questão 2, acertou");
    expect(html).not.toContain("A afirmação está correta.");
    expect(html).toContain('aria-label="Próxima questão"');
  });

  it("formata a marcação do enunciado", () => {
    const html = renderToStaticMarkup(<ResumoTela resumo={resumo} />);

    expect(html).toContain("<strong");
    expect(html).not.toContain("**Financiamento");
  });

  it("mostra a causa que o aluno registrou no erro", () => {
    const html = renderToStaticMarkup(<ResumoTela resumo={resumo} />);

    expect(html).toContain("Você registrou:");
    expect(html).toContain("Errei a conta");
  });

  it("não inventa uma data quando a sessão não agendou revisão", () => {
    const html = renderToStaticMarkup(
      <ResumoTela resumo={{ ...resumo, proximaRevisao: null }} />,
    );

    expect(html).not.toContain("Próxima revisão");
    expect(html).not.toContain("—");
  });
});
