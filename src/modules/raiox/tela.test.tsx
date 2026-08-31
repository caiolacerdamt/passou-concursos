import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { DadosRaioX, LinhaMateriaRaioX } from "./index";
import type { DadosMapaPorMateria } from "./mapa-por-materia";
import { posicoesDosRotulos, RaioXTela, type PontoDoMapa } from "./tela";

const perfil = {
  orgao: "Banco do Brasil",
  banca: "indefinida",
  dataProva: null,
  formato: "multipla_escolha",
  programaEdital: [],
};

const bancarios: LinhaMateriaRaioX = {
  materiaId: "materia-1",
  materia: "Conhecimentos Bancários",
  peso: 0.29,
  fatia: 0.8,
  nQuestoes: 297,
  nTopicos: 16,
  tendencia: "subindo",
  amostraBaixa: false,
  topicos: [
    {
      topicoId: "topico-1",
      topico: "SFN e mercados",
      peso: 0.069,
      nQuestoes: 72,
      tendencia: "subindo",
      amostraBaixa: false,
      fatia: 0.5,
    },
    {
      topicoId: "topico-2",
      topico: "Garantias",
      peso: 0.018,
      nQuestoes: 3,
      tendencia: "estavel",
      amostraBaixa: true,
      fatia: 0.3,
    },
  ],
};

const financeira: LinhaMateriaRaioX = {
  materiaId: "materia-2",
  materia: "Matemática Financeira",
  peso: 0.07,
  fatia: 0.2,
  nQuestoes: 9,
  nTopicos: 7,
  tendencia: "caindo",
  amostraBaixa: true,
  topicos: [
    {
      topicoId: "topico-3",
      topico: "Juros compostos",
      peso: 0.03,
      nQuestoes: 3,
      tendencia: "caindo",
      amostraBaixa: true,
      fatia: 0.2,
    },
  ],
};

const dados: DadosRaioX = {
  perfil,
  linhas: [],
  materias: [bancarios, financeira],
};

describe("RaioXTela", () => {
  it("abre pela matéria: mostra as matérias e não vaza os tópicos das fechadas", () => {
    const html = renderToStaticMarkup(<RaioXTela dados={dados} />);

    expect(html).toContain("O que mais cai no seu concurso");
    expect(html).toContain("Conhecimentos Bancários");
    expect(html).toContain("Matemática Financeira");
    expect(html).toContain("80,0%");
    expect(html).toContain("16 tópicos · 297 questões reais");
    expect(html).toContain("306 questões reais");

    // A primeira matéria nasce aberta; a segunda, fechada — e tópico de
    // matéria fechada não pode aparecer, que é o problema que esta tela veio
    // resolver.
    expect(html).toContain("SFN e mercados");
    expect(html).not.toContain("Juros compostos");
  });

  it("marca amostra baixa em vez de deixar o número passar como confiável", () => {
    const html = renderToStaticMarkup(<RaioXTela dados={dados} />);

    expect(html).toContain("Poucas questões");
    expect(html).toContain("Poucas questões reais");
  });

  it("mostra estado orientado sem perfil ou sem matérias", () => {
    const semPerfil = renderToStaticMarkup(
      <RaioXTela dados={{ perfil: null, linhas: [], materias: [] }} />,
    );
    const semMaterias = renderToStaticMarkup(
      <RaioXTela dados={{ perfil, linhas: [], materias: [] }} />,
    );

    expect(semPerfil).toContain("Seu perfil de concurso ainda não está configurado");
    expect(semPerfil).toContain("Quando o edital estiver cadastrado");
    expect(semMaterias).toContain("O programa ainda não tem questões publicadas");
    expect(semMaterias).toContain("assim que houver questões reais publicadas");
  });

  it("não cria largura fixa em pixels", () => {
    const html = renderToStaticMarkup(<RaioXTela dados={dados} />);

    // `[^;"]` prende a busca ao valor do próprio `style`: sem as aspas, o
    // trecho atravessava o atributo e casava com qualquer `px-4` de classe
    // lá adiante — o guarda passava por acidente, não por mérito.
    expect(html).not.toMatch(/(?:width|min-width|max-width):[^;"]*px/);
    expect(html).not.toMatch(/(?:w|min-w|max-w)-\[\d+px\]/);
  });

  it("usa um único cartão escuro por tela (AD-111)", () => {
    const html = renderToStaticMarkup(<RaioXTela dados={dados} />);

    // `\b` casaria também com `bg-breu-verde` e `bg-breu-tinta`, que são
    // preenchimento dentro do cartão, não um segundo cartão.
    expect(html.match(/bg-breu(?![-\w])/g) ?? []).toHaveLength(1);
  });

  const mapa: DadosMapaPorMateria = {
    dataReferencia: "2026-08-30",
    linhas: [
      {
        materiaId: "materia-1",
        materia: "Conhecimentos Bancários",
        fatia: 0.8,
        score: 0.34,
        dominio: "fraco",
        nTopicos: 16,
        nTopicosCobertos: 9,
        nRevisoesDevidas: 4,
        cobertura: "coberto",
        revisao: "devida",
        prioridade: 0.528,
        nivel: "maior_atencao",
        motivo: "4 revisões desta matéria estão devidas; elas voltam antes do conteúdo se afastar.",
        ordem: 1,
        topicos: [],
      },
      {
        materiaId: "materia-2",
        materia: "Matemática Financeira",
        fatia: 0.2,
        score: null,
        dominio: "nao_iniciado",
        nTopicos: 7,
        nTopicosCobertos: 0,
        nRevisoesDevidas: 0,
        cobertura: "nao_iniciado",
        revisao: "sem_agenda",
        prioridade: 0.18,
        nivel: "maior_atencao",
        motivo: "Você ainda não respondeu nenhum tópico desta matéria; a cobertura do edital vem primeiro.",
        ordem: 2,
        topicos: [],
      },
    ],
  };

  it("mostra o mapa por matéria, com as duas visualizações à escolha", () => {
    const html = renderToStaticMarkup(<RaioXTela dados={dados} mapa={mapa} />);

    expect(html).toContain("Mapa de Prioridade");
    expect(html).toContain("Peso da banca");
    expect(html).toContain("Seu domínio");
    expect(html).toContain("Cobertura");
    expect(html).toContain("Maior atenção");
    expect(html).toContain("9 de 16");
    expect(html).toContain("4 devidas");
    expect(html).toContain("Sem agenda");
    // As abas existem no HTML servido: a escolha é do aluno, não um estado que
    // só nasce depois do JavaScript.
    expect(html).toContain("Tabela");
    expect(html).toContain("Gráfico");
  });

  it("o cartão escuro fala do maior ganho quando o retrato pessoal existe", () => {
    const semMapa = renderToStaticMarkup(<RaioXTela dados={dados} />);
    const comMapa = renderToStaticMarkup(<RaioXTela dados={dados} mapa={mapa} />);

    expect(semMapa).toContain("A matéria que mais cai");
    expect(comMapa).toContain("Onde está seu maior ganho");
    expect(comMapa).toContain("seu domínio 34%");
  });

  it("nomeia estado degradado do mapa sem expor detalhe técnico", () => {
    const html = renderToStaticMarkup(<RaioXTela dados={dados} mapa={null} />);

    expect(html).toContain("Mapa de Prioridade está indisponível agora");
    expect(html).not.toContain("stack");
  });
});

/*
 * O gráfico do mapa só existe depois que o aluno troca de aba, então ele não
 * chega ao HTML servido. O que precisa de guarda é a matemática que impedia os
 * nomes de empilharem — e ela é testável sozinha.
 */
describe("posicoesDosRotulos", () => {
  function ponto(id: string, cy: number, aEsquerda = false): PontoDoMapa {
    return { id, nome: id, cx: 100, cy, raio: 8, aEsquerda, destaque: false };
  }

  it("deixa o rótulo no lugar quando ninguém disputa espaço", () => {
    const posicoes = posicoesDosRotulos([ponto("a", 100), ponto("b", 300)]);

    expect(posicoes.get("a")).toBe(100);
    expect(posicoes.get("b")).toBe(300);
  });

  it("separa nomes que cairiam um sobre o outro, sem trocar a ordem", () => {
    const posicoes = posicoesDosRotulos([
      ponto("a", 200),
      ponto("b", 202),
      ponto("c", 204),
    ]);

    const [a, b, c] = ["a", "b", "c"].map((id) => posicoes.get(id)!);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
    expect(b - a).toBeGreaterThanOrEqual(19);
    expect(c - b).toBeGreaterThanOrEqual(19);
  });

  it("trata cada lado como pilha própria: quem sai para lados opostos não colide", () => {
    const posicoes = posicoesDosRotulos([ponto("esq", 200, true), ponto("dir", 200, false)]);

    expect(posicoes.get("esq")).toBe(200);
    expect(posicoes.get("dir")).toBe(200);
  });

  it("sobe a pilha inteira em vez de deixar rótulo fora do desenho", () => {
    // Três pontos colados no fundo: empurrar para baixo jogaria o último fora
    // da área, então o bloco sobe mantendo a separação.
    const posicoes = posicoesDosRotulos([
      ponto("a", 440),
      ponto("b", 441),
      ponto("c", 442),
    ]);

    const valores = ["a", "b", "c"].map((id) => posicoes.get(id)!);
    expect(Math.max(...valores)).toBeLessThanOrEqual(444);
    expect(valores[1] - valores[0]).toBeGreaterThanOrEqual(19);
    expect(valores[2] - valores[1]).toBeGreaterThanOrEqual(19);
  });
});
