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
        rotulosDosTopicos={new Map([[
          "topico-1",
          { materia: "Matemática", topico: "Matemática Financeira" },
        ]])}
      />,
    );

    expect(html).toContain("Próximo bloco");
    expect(html).toContain("Matemática · Matemática Financeira");
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
    expect(html).toContain("no piso disponível");
    expect(html).not.toContain("previstas na meta cheia");
  });

  it("separa piso e meta e expõe controles apenas para pendências", () => {
    const html = renderToStaticMarkup(
      <PlanoTela
        plano={{
          ...planoBase,
          piso: [{ ...planoBase.piso[0], conclusao: { sessaoId: "sessao-1", nQuestoes: 5, nAcertos: 4, encerradaEm: "2026-08-22T21:00:00Z" } }],
        }}
        rotulosDosTopicos={new Map([[
          "topico-1",
          { materia: "Matemática", topico: "Matemática Financeira" },
        ]])}
      />,
    );

    expect(html).toContain("Piso");
    expect(html).toContain("Meta cheia");
    expect(html).toContain("Ver resumo");
    // O cartão mostra rótulo curto e carrega o sentido inteiro no aria-label:
    // "Adiar" sozinho não diz para quando, e o leitor de tela precisa disso.
    // O cartão mostra rótulo curto e carrega o sentido inteiro no aria-label:
    // "Adiar" sozinho não diz para quando, e o leitor de tela precisa disso.
    expect(html).toContain("Versão curta");
    expect(html).toContain("Adiar");
    expect(html).toContain("para outro dia");
    expect(html).not.toContain("/app/estudo?bloco=bloco-piso");
  });

  it("só desenha as setas de ordem quando há para onde mover", () => {
    const umPendente = renderToStaticMarkup(<PlanoTela plano={planoBase} />);

    // Um pendente só: duas setas desabilitadas seriam ruído, não controle.
    expect(umPendente).not.toContain("para cima");
    expect(umPendente).not.toContain("para baixo");

    const doisPendentes = renderToStaticMarkup(
      <PlanoTela
        plano={{
          ...planoBase,
          piso: [],
          metaCheia: [{ ...blocoBase }, { ...blocoBase, id: "bloco-2", ordem: 2 }],
        }}
      />,
    );

    expect(doisPendentes).toContain("para cima");
    expect(doisPendentes).toContain("para baixo");
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

    expect(html).toContain("Versão curta ativa");
    expect(html).not.toContain("Escolher versão curta de");
  });

  it("exibe apenas a matéria quando o tópico é Geral", () => {
    const html = renderToStaticMarkup(
      <PlanoTela
        plano={planoBase}
        rotulosDosTopicos={new Map([[
          "topico-1",
          { materia: "Língua Portuguesa", topico: "Geral" },
        ]])}
      />,
    );

    expect(html).toContain("Língua Portuguesa");
    expect(html).not.toContain("Língua Portuguesa · Geral");
  });
});
