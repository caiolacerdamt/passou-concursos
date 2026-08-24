import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PlanoTela } from "./plano-tela";
import type { PlanoDoDia } from "./plano";

const blocoBase = {
  id: "bloco-1",
  tipo: "avancar" as const,
  nivel: "meta_cheia" as const,
  ordem: 1,
  topicoId: "topico-1",
  nQuestoes: 10,
  nQuestoesCheias: 10,
  minutosEstimados: 20,
  minutosEstimadosCheios: 20,
  motivo: "Tema importante para a prova.",
  ajusteUsuario: false,
  adiadoDe: null,
  conclusao: null,
};

const planoBase: PlanoDoDia = {
  id: "plano-1",
  data: "2026-08-22",
  frase: "Consistência antes de velocidade.",
  piso: [
    {
      ...blocoBase,
      id: "bloco-piso",
      tipo: "revisar",
      nivel: "piso",
      minutosEstimados: 15,
      minutosEstimadosCheios: 15,
      motivo: "A revisão vence hoje.",
    },
  ],
  metaCheia: [{ ...blocoBase }],
};

describe("PlanoTela", () => {
  it("orienta o próximo bloco e usa rótulo de tópico sem exibir UUID", () => {
    const html = renderToStaticMarkup(
      <PlanoTela
        plano={planoBase}
        rotulosDosTopicos={new Map([["topico-1", "Matemática Financeira"]])}
      />,
    );

    expect(html).toContain("Próximo bloco");
    expect(html).toContain("Matemática Financeira");
    expect(html).toContain("/app/estudo?bloco=bloco-piso");
    expect(html).toContain("20");
    expect(html).toContain("1");
    expect(html).toContain("na meta cheia");
    expect(html).not.toMatch(/>35</);
    expect(html).not.toContain("topico-1");
  });

  it("usa o piso apenas como fallback quando a meta cheia está vazia", () => {
    const html = renderToStaticMarkup(
      <PlanoTela plano={{ ...planoBase, metaCheia: [] }} />,
    );

    expect(html).toContain("15");
    expect(html).toContain("na meta cheia");
  });

  it("separa piso e meta e expõe controles apenas para pendências", () => {
    const html = renderToStaticMarkup(
      <PlanoTela
        plano={{
          ...planoBase,
          piso: [{ ...planoBase.piso[0], conclusao: { sessaoId: "sessao-1", nQuestoes: 5, nAcertos: 4, encerradaEm: "2026-08-22T21:00:00Z" } }],
        }}
        rotulosDosTopicos={new Map([["topico-1", "Matemática Financeira"]])}
      />,
    );

    expect(html).toContain("Piso");
    expect(html).toContain("Meta cheia");
    expect(html).toContain("Ver resumo");
    expect(html).toContain("Escolher versão curta");
    expect(html).toContain("Adiar para outro dia");
    expect(html).not.toContain("/app/estudo?bloco=bloco-piso");
  });

  it("não oferece nova redução depois da versão curta", () => {
    const html = renderToStaticMarkup(
      <PlanoTela
        plano={{
          ...planoBase,
          piso: [],
          metaCheia: [{ ...blocoBase, nQuestoes: 5, minutosEstimados: 10 }],
        }}
      />,
    );

    expect(html).toContain("Versão curta escolhida");
    expect(html).not.toContain("Escolher versão curta");
  });
});
