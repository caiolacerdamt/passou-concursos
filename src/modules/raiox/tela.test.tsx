import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { DadosMapaPrioridade, DadosRaioX } from "./index";
import { RaioXTela } from "./tela";

const perfil = {
  orgao: "Banco do Brasil",
  banca: "indefinida",
  dataProva: null,
  formato: "multipla_escolha",
  programaEdital: [],
};

describe("RaioXTela", () => {
  it("mostra peso, tendência, questões e aviso de amostra baixa", () => {
    const dados: DadosRaioX = {
      perfil,
      linhas: [
        {
          topicoId: "topico-1",
          topico: "Matemática Financeira",
          peso: 0.72,
          nQuestoes: 3,
          tendencia: "subindo",
          amostraBaixa: true,
        },
      ],
    };

    const html = renderToStaticMarkup(<RaioXTela dados={dados} />);

    expect(html).toContain("O que mais cai no seu concurso");
    expect(html).toContain("Banca ainda não definida");
    expect(html).toContain("Data da prova ainda não definida");
    expect(html).toContain("Matemática Financeira");
    expect(html).toContain("72%");
    expect(html).toContain("Subindo");
    expect(html).toContain("3 questões reais");
    expect(html).toContain("Baseado em poucas questões");
  });

  it("mostra estado orientado sem perfil ou sem linhas", () => {
    const semPerfil = renderToStaticMarkup(
      <RaioXTela dados={{ perfil: null, linhas: [] }} />,
    );
    const semLinhas = renderToStaticMarkup(
      <RaioXTela dados={{ perfil, linhas: [] }} />,
    );

    expect(semPerfil).toContain("Seu perfil de concurso ainda não está configurado");
    expect(semPerfil).toContain("Quando o edital estiver cadastrado");
    expect(semLinhas).toContain("O programa ainda não tem questões publicadas");
    expect(semLinhas).toContain("assim que houver questões reais publicadas");
  });

  it("não cria largura fixa em pixels", () => {
    const html = renderToStaticMarkup(
      <RaioXTela
        dados={{
          perfil,
          linhas: [
            {
              topicoId: "topico-1",
              topico: "Conhecimentos Bancários",
              peso: 0.4,
              nQuestoes: 12,
              tendencia: "estavel",
              amostraBaixa: false,
            },
          ],
        }}
      />,
    );

    expect(html).not.toMatch(/(?:width|min-width|max-width):[^;]*px/);
    expect(html).not.toMatch(/(?:w|min-w|max-w)-\[\d+px\]/);
  });

  it("mostra o mapa como leitura separada dos quatro sinais", () => {
    const mapa: DadosMapaPrioridade = {
      dataReferencia: "2026-08-24",
      linhas: [
        {
          topicoId: "topico-1",
          topico: "Matemática Financeira",
          peso: 0.72,
          score: 0.4,
          nRespostas: 10,
          dominio: "fraco",
          cobertura: "coberto",
          revisao: "devida",
          due: "2026-08-24",
          prioridade: 0.432,
          nivel: "maior_atencao",
          motivo: "A revisão está devida; veja este tópico antes de deixar o conteúdo se afastar.",
          ordem: 1,
        },
        {
          topicoId: "topico-2",
          topico: "Conhecimentos Bancários",
          peso: null,
          score: null,
          nRespostas: 0,
          dominio: "nao_iniciado",
          cobertura: "nao_iniciado",
          revisao: "em_dia",
          due: "2026-09-01",
          prioridade: null,
          nivel: "sem_projecao",
          motivo: "A frequência da banca ainda não tem projeção para este tópico.",
          ordem: 2,
        },
      ],
    };

    const html = renderToStaticMarkup(<RaioXTela dados={{ perfil, linhas: [] }} mapa={mapa} />);

    expect(html).toContain("Mapa de Prioridade");
    expect(html).toContain("Peso da banca");
    expect(html).toContain("Faixa de domínio");
    expect(html).toContain("Cobertura observada");
    expect(html).toContain("Revisão e data");
    expect(html).toContain("Em dia");
    expect(html).toContain("Devida");
    expect(html).toContain("Não é outro plano");
  });

  it("nomeia estado degradado do mapa sem expor detalhe técnico", () => {
    const html = renderToStaticMarkup(<RaioXTela dados={{ perfil, linhas: [] }} mapa={null} />);

    expect(html).toContain("Mapa de Prioridade está indisponível agora");
    expect(html).not.toContain("stack");
  });
});
