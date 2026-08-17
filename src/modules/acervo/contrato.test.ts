import { describe, expect, it } from "vitest";

import {
  DIMENSAO_EMBEDDING,
  ENUMS_DO_ACERVO,
  LETRAS,
  alternativasSchema,
  alternativasValidasParaTipo,
  fonteCitacaoSchema,
  imagensSchema,
  respostaValidaParaTipo,
} from "./contrato";

/**
 * AD-039 (enums) · AD-040 (formato) · BANCO-09 AC3
 *
 * O espelho em TypeScript do que a tabela aceita. O teste de banco
 * (`tests/db/acervo-contrato.test.ts`) confere que os dois lados nao divergiram.
 */

const ALTERNATIVAS_VALIDAS = [
  { letra: "A", texto: "R$ 1.000,00" },
  { letra: "B", texto: "R$ 1.100,00" },
  { letra: "C", texto: "R$ 1.210,00" },
  { letra: "D", texto: "R$ 1.331,00" },
  { letra: "E", texto: "R$ 1.464,10" },
];

const FONTE_VALIDA = {
  banca: "Cesgranrio",
  ano: 2023,
  orgao: "Banco do Brasil",
  cargo: "Escriturario",
  numero: 12,
};

describe("enums do acervo (AD-039)", () => {
  it("declara os seis enums com os valores do AD-039", () => {
    expect(ENUMS_DO_ACERVO.tipo_questao).toEqual([
      "multipla_escolha",
      "certo_errado",
    ]);
    expect(ENUMS_DO_ACERVO.origem_questao).toEqual(["real", "gerada_ia"]);
    expect(ENUMS_DO_ACERVO.status_questao).toEqual([
      "rascunho",
      "em_revisao",
      "publicada",
      "rejeitada",
      "precisa_ocr",
    ]);
    expect(ENUMS_DO_ACERVO.tipo_mudanca).toEqual(["cosmetica", "substantiva"]);
    expect(ENUMS_DO_ACERVO.status_prova).toHaveLength(7);
    expect(ENUMS_DO_ACERVO.status_candidato).toEqual([
      "pendente",
      "aprovado",
      "rejeitado",
    ]);
  });
});

describe("dimensao do embedding", () => {
  it("e 1536, o default do Cohere embed-v4", () => {
    // Cabe no limite de 2.000 do HNSW do pgvector (verificado 2026-08-17), o que
    // e a razao de nao existir halfvec nem quantizacao no schema.
    expect(DIMENSAO_EMBEDDING).toBe(1536);
    expect(DIMENSAO_EMBEDDING).toBeLessThanOrEqual(2000);
  });
});

describe("alternativas (AD-040)", () => {
  it("aceita o array de cinco letras do AD-040", () => {
    expect(alternativasSchema.safeParse(ALTERNATIVAS_VALIDAS).success).toBe(true);
  });

  it("aceita quatro alternativas: nem toda banca usa cinco", () => {
    expect(
      alternativasSchema.safeParse(ALTERNATIVAS_VALIDAS.slice(0, 4)).success,
    ).toBe(true);
  });

  it("recusa letra fora de A-E", () => {
    const comF = [...ALTERNATIVAS_VALIDAS, { letra: "F", texto: "outra" }];
    expect(alternativasSchema.safeParse(comF).success).toBe(false);
  });

  it("recusa letra repetida", () => {
    // O CHECK do banco nao pega isso, e duas alternativas "C" e uma questao que
    // nao da para responder.
    const repetida = [
      { letra: "A", texto: "primeira" },
      { letra: "A", texto: "segunda" },
    ];
    const resultado = alternativasSchema.safeParse(repetida);
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(JSON.stringify(resultado.error.issues)).toMatch(/repetida/);
    }
  });

  it("recusa texto vazio ou so com espaco", () => {
    for (const texto of ["", "   "]) {
      const lista = [
        { letra: "A", texto },
        { letra: "B", texto: "valida" },
      ];
      expect(alternativasSchema.safeParse(lista).success).toBe(false);
    }
  });

  it("recusa array vazio e array com uma alternativa so", () => {
    expect(alternativasSchema.safeParse([]).success).toBe(false);
    expect(
      alternativasSchema.safeParse([{ letra: "A", texto: "unica" }]).success,
    ).toBe(false);
  });

  it("recusa item sem as chaves do AD-040", () => {
    expect(alternativasSchema.safeParse([{ letra: "A" }]).success).toBe(false);
    expect(alternativasSchema.safeParse(["A) texto"]).success).toBe(false);
  });
});

describe("imagens (AD-040/AD-041)", () => {
  it("aceita o formato do AD-040", () => {
    const imagens = [
      {
        storage_path: "provas/cesgranrio-2023/q12-grafico.png",
        posicao: "enunciado",
        alt_text: "Grafico de barras da evolucao do saldo",
      },
      {
        storage_path: "provas/cesgranrio-2023/q12-b.png",
        posicao: "alternativa_B",
        alt_text: "Diagrama da alternativa B",
      },
    ];
    expect(imagensSchema.safeParse(imagens).success).toBe(true);
  });

  it("aceita lista vazia: a maioria das questoes nao tem imagem", () => {
    expect(imagensSchema.safeParse([]).success).toBe(true);
  });

  it("recusa posicao fora de enunciado/alternativa_X", () => {
    for (const posicao of ["rodape", "alternativa_F", "alternativa_b", "ALTERNATIVA_A"]) {
      const resultado = imagensSchema.safeParse([
        { storage_path: "x.png", posicao, alt_text: "descricao" },
      ]);
      expect({ posicao, ok: resultado.success }).toEqual({ posicao, ok: false });
    }
  });

  it("recusa imagem sem alt_text: leitor de tela nao le imagem sem descricao", () => {
    expect(
      imagensSchema.safeParse([
        { storage_path: "x.png", posicao: "enunciado", alt_text: "" },
      ]).success,
    ).toBe(false);
  });

  it("recusa imagem sem storage_path", () => {
    expect(
      imagensSchema.safeParse([{ posicao: "enunciado", alt_text: "d" }]).success,
    ).toBe(false);
  });
});

describe("fonte_citacao (AD-040/BANCO-01)", () => {
  it("aceita as cinco chaves preenchidas", () => {
    expect(fonteCitacaoSchema.safeParse(FONTE_VALIDA).success).toBe(true);
  });

  it("recusa quando falta qualquer uma das cinco", () => {
    // Proveniencia e o conjunto, nao o campo — mesma regra do CHECK
    // `fonte_citacao_completa` do banco.
    for (const chave of Object.keys(FONTE_VALIDA)) {
      const incompleta: Record<string, unknown> = { ...FONTE_VALIDA };
      delete incompleta[chave];
      expect({ chave, ok: fonteCitacaoSchema.safeParse(incompleta).success }).toEqual({
        chave,
        ok: false,
      });
    }
  });

  it("recusa ano fora da faixa e numero nao-positivo", () => {
    expect(fonteCitacaoSchema.safeParse({ ...FONTE_VALIDA, ano: 1989 }).success).toBe(
      false,
    );
    expect(fonteCitacaoSchema.safeParse({ ...FONTE_VALIDA, numero: 0 }).success).toBe(
      false,
    );
  });
});

describe("coerencia entre tipo e resposta", () => {
  it("aceita A-E em multipla escolha e recusa o resto", () => {
    for (const letra of LETRAS) {
      expect(respostaValidaParaTipo("multipla_escolha", letra)).toBe(true);
    }
    for (const invalida of ["F", "a", "1", ""]) {
      expect(respostaValidaParaTipo("multipla_escolha", invalida)).toBe(false);
    }
  });

  it("aceita so C e E em certo-errado", () => {
    expect(respostaValidaParaTipo("certo_errado", "C")).toBe(true);
    expect(respostaValidaParaTipo("certo_errado", "E")).toBe(true);
    for (const invalida of ["A", "B", "D", "V", "F"]) {
      expect(respostaValidaParaTipo("certo_errado", invalida)).toBe(false);
    }
  });
});

describe("coerencia entre tipo e alternativas", () => {
  it("multipla escolha precisa da lista", () => {
    expect(alternativasValidasParaTipo("multipla_escolha", ALTERNATIVAS_VALIDAS)).toBe(
      true,
    );
    expect(alternativasValidasParaTipo("multipla_escolha", null)).toBe(false);
    expect(alternativasValidasParaTipo("multipla_escolha", [])).toBe(false);
  });

  it("certo-errado nao tem alternativa nenhuma", () => {
    expect(alternativasValidasParaTipo("certo_errado", null)).toBe(true);
    expect(alternativasValidasParaTipo("certo_errado", undefined)).toBe(true);
    expect(alternativasValidasParaTipo("certo_errado", ALTERNATIVAS_VALIDAS)).toBe(
      false,
    );
  });
});
