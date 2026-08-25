import { describe, expect, it } from "vitest";

import {
  consolidarResultados,
  particionar,
  validarMapa,
  type Manifesto,
  type Mapa,
  type Taxonomia,
} from "./grupo3-classificacao.mts";

const taxonomia: Taxonomia = {
  materias: [
    { nome: "A", ordem: 1, topicos: ["X", "Geral"] },
    { nome: "B", ordem: 2, topicos: ["Y", "Geral"] },
    { nome: "C", ordem: 3, topicos: ["Z", "Geral"] },
    { nome: "D", ordem: 4, topicos: ["W", "Geral"] },
    { nome: "E", ordem: 5, topicos: ["V", "Geral"] },
    { nome: "F", ordem: 6, topicos: ["U", "Geral"] },
    { nome: "G", ordem: 7, topicos: ["T", "Geral"] },
    { nome: "H", ordem: 8, topicos: ["S", "Geral"] },
  ],
};

function questao(id: string, ordem: number) {
  return {
    id,
    ordem,
    sourceId: id,
    numero: ordem,
    enunciado: "enunciado",
    alternativas: null,
    imagens: [],
    materiaAtual: "A",
    topicoAtual: "Geral",
  };
}

describe("orquestração do Grupo 3", () => {
  it("divide em lotes contíguos sem perder a ordem", () => {
    const lotes = particionar([questao("1", 1), questao("2", 2), questao("3", 3)], 2);
    expect(lotes.map((lote) => lote.questoes.map((item) => item.id))).toEqual([["1", "2"], ["3"]]);
    expect(lotes.map((lote) => [lote.inicio, lote.fim])).toEqual([[1, 2], [3, 3]]);
  });

  it("recusa matéria ou tópico inventado", () => {
    const mapa: Mapa = { "1": { materia: "A", topico: "inventado" } };
    expect(() => validarMapa(mapa, ["1"], taxonomia)).toThrow(/fora da taxonomia/);
  });

  it("recusa questão faltante", () => {
    expect(() => validarMapa({}, ["1"], taxonomia)).toThrow(/sem classificação/);
  });

  it("recusa resultado de lote ausente", () => {
    const manifesto: Manifesto = {
      versao: 1,
      criadoEm: "agora",
      total: 1,
      tamanhoLote: 1,
      questoes: "questoes.json",
      baseline: "baseline.json",
      lotes: [{ numero: 1, inicio: 1, fim: 1, questoes: [questao("1", 1)], resultado: "resultado.json" }],
    };
    expect(() => consolidarResultados(manifesto, "diretorio-inexistente", taxonomia)).toThrow(/ausente/);
  });
});
