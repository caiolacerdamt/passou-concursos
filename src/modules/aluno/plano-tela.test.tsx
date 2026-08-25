import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PlanoTela } from "./plano-tela";
import type { BlocoDoPlano, PlanoDoDia } from "./plano";

const rotulos = new Map([
  ["topico-1", { materia: "Matemática", topico: "Matemática Financeira" }],
]);

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
  motivo: "TEXTO CRU DO BANCO",
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
  it("renomeia o estudo, descreve o bloco e remove o texto cru do banco", () => {
    const html = renderToStaticMarkup(
      <PlanoTela plano={planoBase} rotulosDosTopicos={rotulos} />,
    );

    expect(html).toContain("Estudo de hoje");
    expect(html).not.toContain("Comece pelo essencial.");
    expect(html).toContain("Revisar");
    expect(html).toContain("Assunto que já está na sua memória e venceu a data de revisão.");
    expect(html).not.toContain("A revisão vence hoje.");
    expect(html).not.toContain("TEXTO CRU DO BANCO");
    expect(html).toContain("Matemática · Matemática Financeira");
    expect(html).toContain("20 min · 10 questões");
    expect(html).not.toContain("topico-1");
  });

  it("exibe os rótulos e descrições novos para cada tipo de bloco", () => {
    const casos: Array<{
      tipo: BlocoDoPlano["tipo"];
      titulo: string;
      descricao: string;
    }> = [
      {
        tipo: "revisar",
        titulo: "Revisar",
        descricao: "Assunto que já está na sua memória e venceu a data de revisão.",
      },
      {
        tipo: "avancar",
        titulo: "Aprender",
        descricao: "Assunto novo, escolhido pelo seu ponto mais fraco entre os que mais caem.",
      },
      {
        tipo: "treinar",
        titulo: "Praticar",
        descricao: "Assunto que você já viu, para firmar o que ainda não está firme.",
      },
      {
        tipo: "simulado",
        titulo: "Simulado",
        descricao: "Uma prova curta para medir seu ritmo.",
      },
    ];

    for (const caso of casos) {
      const html = renderToStaticMarkup(
        <PlanoTela
          plano={{
            ...planoBase,
            piso: [],
            metaCheia: [{ ...blocoBase, id: `bloco-${caso.tipo}`, tipo: caso.tipo }],
          }}
          rotulosDosTopicos={rotulos}
        />,
      );

      expect(html).toContain(caso.titulo);
      expect(html).toContain(caso.descricao);
    }
  });

  it("mantém o cabeçalho da superfície Plano e troca o estado de dia fechado", () => {
    const planoHtml = renderToStaticMarkup(
      <PlanoTela plano={planoBase} superficie="plano" rotulosDosTopicos={rotulos} />,
    );
    const fechadoHtml = renderToStaticMarkup(
      <PlanoTela
        plano={{
          ...planoBase,
          piso: planoBase.piso.map((bloco) => ({
            ...bloco,
            conclusao: {
              sessaoId: "sessao-piso",
              nQuestoes: 5,
              nAcertos: 4,
              encerradaEm: "2026-08-22T21:00:00Z",
            },
          })),
          metaCheia: planoBase.metaCheia.map((bloco) => ({
            ...bloco,
            conclusao: {
              sessaoId: "sessao-meta",
              nQuestoes: 10,
              nAcertos: 8,
              encerradaEm: "2026-08-22T21:00:00Z",
            },
          })),
        }}
      />,
    );

    expect(planoHtml).toContain("Ciclo do edital");
    expect(planoHtml).toContain("Seu plano, na ordem que faz sentido.");
    expect(planoHtml).not.toContain("Estudo de hoje");
    expect(fechadoHtml).toContain("Você fechou o dia.");
  });

  it("renomeia os níveis, expõe a âncora do mínimo e remove os controles antigos", () => {
    const html = renderToStaticMarkup(
      <PlanoTela plano={planoBase} rotulosDosTopicos={rotulos} />,
    );

    expect(html).toContain("MÍNIMO");
    expect(html).toContain("O mínimo para contar sua ofensiva de hoje");
    expect(html).toContain("META");
    expect(html).toContain("Estudo completo do dia");
    expect(html).toContain('id="nivel-minimo"');
    expect(html).toContain("scroll-mt-24");
    expect(html).not.toContain("Piso");
    expect(html).not.toContain("Meta cheia");
    expect(html).not.toContain("Escolher versão curta");
    expect(html).not.toContain("Versão curta");
    expect(html).not.toContain("Adiar");
    expect(html).not.toContain("para outro dia");
    expect(html).not.toContain("para cima");
    expect(html).not.toContain("para baixo");
    expect(html).not.toContain("<form");
  });

  it("mantém placar e resumo para bloco concluído", () => {
    const html = renderToStaticMarkup(
      <PlanoTela
        plano={{
          ...planoBase,
          piso: [
            {
              ...planoBase.piso[0],
              conclusao: {
                sessaoId: "sessao-1",
                nQuestoes: 5,
                nAcertos: 4,
                encerradaEm: "2026-08-22T21:00:00Z",
              },
            },
          ],
        }}
        rotulosDosTopicos={rotulos}
      />,
    );

    expect(html).toContain("Ver resumo");
    expect(html).toContain("5 questões · 4 acertos");
    expect(html).not.toContain("/app/estudo?bloco=bloco-piso");
  });

  it("usa o piso apenas como fallback quando a meta cheia está vazia", () => {
    const html = renderToStaticMarkup(
      <PlanoTela plano={{ ...planoBase, metaCheia: [] }} />,
    );

    expect(html).toContain("15");
    expect(html).toContain("no piso disponível");
    expect(html).not.toContain("previstas na meta cheia");
  });

  it("exibe apenas a matéria quando o tópico é Geral", () => {
    const html = renderToStaticMarkup(
      <PlanoTela
        plano={planoBase}
        rotulosDosTopicos={new Map([
          ["topico-1", { materia: "Língua Portuguesa", topico: "Geral" }],
        ])}
      />,
    );

    expect(html).toContain("Língua Portuguesa");
    expect(html).not.toContain("Língua Portuguesa · Geral");
  });
});
