import { describe, expect, it } from "vitest";

import type { ReferenciaEntregue } from "@/modules/acervo";

import {
  INSTRUCAO_DA_EXPLICACAO,
  NOME_DO_FORMATO_DA_EXPLICACAO,
  SCHEMA_DA_EXPLICACAO,
  QuestaoSemGabaritoParaExplicacao,
  alvoDaExplicacao,
  conferirExplicacao,
  explicacaoGeradaSchema,
  chaveDedupDaExplicacao,
  montarPedidoDeExplicacao,
  normalizarTrecho,
} from "./explicacao";

const referencia: ReferenciaEntregue = {
  id: "base:documento-1",
  titulo: "Manual conferido",
  conteudo:
    "A poupança tem remuneração definida pela regra entregue. A taxa é calculada no aniversário.",
  origem: "oficial",
  baseReferenciaId: "documento-1",
  topicoId: "topico-1",
};

const base = {
  texto: "A alternativa B é a correta porque o documento descreve a remuneração.",
  alternativa_correta: "B",
  fontes_citadas: [
    {
      doc_id: referencia.id,
      trecho: "taxa e calculada no aniversario",
    },
  ],
  afirmacoes_externas: [],
};

const questao = {
  id: "11111111-1111-1111-1111-111111111111",
  questaoVersao: 3,
  enunciado: "Qual alternativa está correta?",
  alternativas: [
    { letra: "A", texto: "Primeira" },
    { letra: "B", texto: "Segunda" },
  ],
  respostaCorreta: "B",
  gabaritoVersao: "definitivo-2024",
};

describe("contrato da explicacao conferida", () => {
  it("declara formato estrito com citacoes estruturadas", () => {
    expect(NOME_DO_FORMATO_DA_EXPLICACAO).toBe("explicacao_conferida");
    expect(SCHEMA_DA_EXPLICACAO).toMatchObject({
      type: "object",
      additionalProperties: false,
      required: [
        "texto",
        "alternativa_correta",
        "fontes_citadas",
        "afirmacoes_externas",
      ],
    });
    expect(explicacaoGeradaSchema.safeParse(base).success).toBe(true);
  });

  it("entrega referencia e questao no mesmo pedido, com gabarito oficial", () => {
    const pedido = montarPedidoDeExplicacao(questao, referencia);

    expect(pedido.instrucao).toContain(INSTRUCAO_DA_EXPLICACAO);
    expect(pedido.instrucao).toContain(referencia.id);
    expect(pedido.instrucao).toContain(referencia.conteudo);
    expect(pedido.entrada).toContain(questao.enunciado);
    expect(pedido.entrada).toContain("A) Primeira");
    expect(pedido.entrada).toContain("gabarito oficial (definitivo-2024): B");
    expect(pedido.formato).toEqual({
      nome: NOME_DO_FORMATO_DA_EXPLICACAO,
      schema: SCHEMA_DA_EXPLICACAO,
    });
    expect(pedido.formato?.schema).not.toHaveProperty("questoes");
  });

  it("fixa o alvo e a chave de dedup na questao-versao", () => {
    expect(alvoDaExplicacao(questao)).toEqual({
      questaoId: questao.id,
      questaoVersao: 3,
    });
    expect(chaveDedupDaExplicacao(questao)).toBe(
      `explicacao:1:${questao.id}:3`,
    );
  });

  it("nao monta pedido sem gabarito oficial", () => {
    expect(() =>
      montarPedidoDeExplicacao(
        { ...questao, gabaritoVersao: null },
        referencia,
      ),
    ).toThrow(QuestaoSemGabaritoParaExplicacao);
  });

  it("normaliza caixa, acentos, pontuacao e espacos para comparar trechos", () => {
    expect(normalizarTrecho("  A TAXA é\ncalculada, no aniversário! ")).toBe(
      "a taxa e calculada no aniversario",
    );
  });

  it("aceita uma citacao que existe na fonte apos normalizacao", () => {
    expect(conferirExplicacao(base, { respostaCorreta: "B" }, referencia))
      .toMatchObject({ fontes_citadas: base.fontes_citadas });
  });

  it("rejeita saida estruturada malformada", () => {
    expect(() =>
      conferirExplicacao(
        { texto: "faltam campos" },
        { respostaCorreta: "B" },
        referencia,
      ),
    ).toThrow(/saida_estruturada_invalida/);
  });

  it("rejeita explicacao sem nenhuma citacao", () => {
    expect(() =>
      conferirExplicacao(
        { ...base, fontes_citadas: [] },
        { respostaCorreta: "B" },
        referencia,
      ),
    ).toThrow(/saida_estruturada_invalida|fontes_citadas/);
  });

  it("rejeita trecho que nao existe literalmente na fonte", () => {
    expect(() =>
      conferirExplicacao(
        {
          ...base,
          fontes_citadas: [{ doc_id: referencia.id, trecho: "taxa mensal de 2%" }],
        },
        { respostaCorreta: "B" },
        referencia,
      ),
    ).toThrow(/citacao_fora_da_fonte/);
  });

  it("rejeita citacao de outro documento", () => {
    expect(() =>
      conferirExplicacao(
        {
          ...base,
          fontes_citadas: [{ doc_id: "base:outro", trecho: "taxa" }],
        },
        { respostaCorreta: "B" },
        referencia,
      ),
    ).toThrow(/documento_citacao_desconhecido/);
  });

  it("rejeita explicacao que contradiz o gabarito", () => {
    expect(() =>
      conferirExplicacao(
        { ...base, alternativa_correta: "A" },
        { respostaCorreta: "B" },
        referencia,
      ),
    ).toThrow(/gabarito_contradito/);
  });

  it("rejeita fato externo declarado, inclusive com fonte minima", () => {
    const minima: ReferenciaEntregue = {
      ...referencia,
      id: "minima:prova-1:questao-1:v1",
      origem: "minima",
      baseReferenciaId: null,
      conteudo: "Enunciado da questão. Gabarito oficial: B.",
    };

    expect(() =>
      conferirExplicacao(
        {
          ...base,
          fontes_citadas: [
            { doc_id: minima.id, trecho: "Gabarito oficial: B" },
          ],
          afirmacoes_externas: ["A lei determina prazo de trinta dias."],
        },
        { respostaCorreta: "B" },
        minima,
      ),
      ).toThrow(/afirmacao_externa_sem_fonte/);
  });

  it("rejeita fato externo escrito mesmo quando a IA nao o declara", () => {
    const minima: ReferenciaEntregue = {
      ...referencia,
      id: "minima:prova-1:questao-1:v1",
      origem: "minima",
      baseReferenciaId: null,
      conteudo: "Enunciado da questão. Gabarito oficial: B.",
    };

    expect(() =>
      conferirExplicacao(
        {
          ...base,
          texto: "A lei determina prazo de 30 dias.",
          fontes_citadas: [
            { doc_id: minima.id, trecho: "Gabarito oficial: B" },
          ],
          afirmacoes_externas: [],
        },
        { respostaCorreta: "B" },
        minima,
      ),
    ).toThrow(/afirmacao_externa_sem_fonte/);
  });

  it("continua permitindo explicar o raciocinio apoiado na fonte minima", () => {
    const minima: ReferenciaEntregue = {
      ...referencia,
      id: "minima:prova-1:questao-1:v1",
      origem: "minima",
      baseReferenciaId: null,
      conteudo: "Enunciado da questão. Gabarito oficial: B.",
    };

    expect(
      conferirExplicacao(
        {
          ...base,
          texto: "A alternativa B é a correta porque é o gabarito oficial.",
          fontes_citadas: [
            { doc_id: minima.id, trecho: "Gabarito oficial: B" },
          ],
          afirmacoes_externas: [],
        },
        { respostaCorreta: "B" },
        minima,
      ),
    ).toMatchObject({ alternativa_correta: "B" });
  });

  it("rejeita questao sem gabarito oficial", () => {
    expect(() => conferirExplicacao(base, { respostaCorreta: null }, referencia))
      .toThrow(/gabarito_ausente/);
  });
});
