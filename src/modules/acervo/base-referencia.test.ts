import { describe, expect, it } from "vitest";

import {
  FonteMinimaSemGabarito,
  montarFonteMinima,
  selecionarReferencia,
  type QuestaoParaReferencia,
} from "./base-referencia";

const QUESTAO: QuestaoParaReferencia = {
  id: "questao-1",
  questaoVersao: 2,
  topicoId: "topico-1",
  provaId: "prova-1",
  numero: 7,
  enunciado: "Qual alternativa está correta?",
  alternativas: [
    { letra: "A", texto: "Primeira" },
    { letra: "B", texto: "Segunda" },
  ],
  respostaCorreta: "B",
  gabaritoVersao: "definitivo-2021",
  fonteCitacao: {
    banca: "Cesgranrio",
    ano: 2021,
    orgao: "Banco do Brasil",
    cargo: "Escriturario",
    numero: 7,
  },
};

function clienteFalso(documentos: Record<string, unknown>[] = []) {
  const consultas: { texto: string; valores?: unknown[] }[] = [];
  return {
    consultas,
    cliente: {
      async query(texto: string, valores?: unknown[]) {
        consultas.push({ texto, valores });
        if (texto.includes("from public.base_referencia")) return { rows: documentos };
        return { rows: [{ id: "revisao-1" }] };
      },
    },
  };
}

describe("base de referencia para explicacao", () => {
  it("monta fonte minima com proveniencia, enunciado, alternativas e gabarito", () => {
    const fonte = montarFonteMinima(QUESTAO);

    expect(fonte).toMatchObject({
      id: "minima:prova-1:questao-1:v2",
      origem: "minima",
      baseReferenciaId: null,
    });
    expect(fonte.conteudo).toContain("Cesgranrio");
    expect(fonte.conteudo).toContain("Qual alternativa está correta?");
    expect(fonte.conteudo).toContain("A) Primeira");
    expect(fonte.conteudo).toContain("Gabarito oficial (definitivo-2021): B");
  });

  it("recusa fonte minima sem gabarito oficial", () => {
    expect(() => montarFonteMinima({ ...QUESTAO, respostaCorreta: null })).toThrow(
      FonteMinimaSemGabarito,
    );
  });

  it("usa documento conferido e deixa a preferencia oficial para a consulta", async () => {
    const { cliente, consultas } = clienteFalso([
      {
        id: "base-oficial",
        topico_id: "topico-1",
        titulo: "Norma oficial",
        conteudo: "Trecho conferido",
        origem: "oficial",
      },
    ]);

    const fonte = await selecionarReferencia(cliente, QUESTAO);

    expect(fonte).toMatchObject({
      id: "base:base-oficial",
      origem: "oficial",
      baseReferenciaId: "base-oficial",
      conteudo: "Trecho conferido",
    });
    expect(consultas[0].texto).toContain("status = 'conferido'");
    expect(consultas[0].texto).toContain("origem = 'oficial'");
  });

  it("cai para fonte minima e registra pendencia quando nao ha base", async () => {
    const { cliente, consultas } = clienteFalso();

    const fonte = await selecionarReferencia(cliente, QUESTAO);

    expect(fonte.origem).toBe("minima");
    expect(fonte.conteudo).toContain("Gabarito oficial");
    expect(consultas[1].texto).toContain("base_referencia_pendente");
    expect(consultas[1].valores).toEqual([
      "questao-1",
      2,
      "topico-1",
    ]);
  });
});

