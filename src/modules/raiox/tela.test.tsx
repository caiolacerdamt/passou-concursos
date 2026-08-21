import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { DadosRaioX } from "./index";
import { RaioXTela } from "./tela";

const perfil = {
  orgao: "Banco do Brasil",
  banca: "indefinida",
  dataProva: null,
  formato: "multipla_escolha",
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
});
