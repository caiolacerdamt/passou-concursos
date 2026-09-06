import { describe, expect, it } from "vitest";

import type { TopicoCanonico } from "./classificacao";
import {
  CARACTERES_POR_ITEM,
  casarEtiquetas,
  catalogoParaOPedido,
  cortarPorTrechos,
  entradaDoPedido,
  etiquetasParaOBanco,
  etiquetasSugeridasSchema,
  instrucaoComCatalogo,
  itensSeparadosPorModeloSchema,
  lotesDeItens,
} from "./etiqueta";
import type { ItemSeparado } from "./itens";

const CATALOGO: TopicoCanonico[] = [
  { id: "t1", nome: "Juros Compostos", materiaId: "m1", materiaNome: "Matemática Financeira" },
  { id: "t2", nome: "Distribuição Binomial", materiaId: "m2", materiaNome: "Probabilidade" },
  { id: "t3", nome: "Juros Simples", materiaId: "m1", materiaNome: "Matemática Financeira" },
  { id: "t4", nome: "Juros Simples", materiaId: "m3", materiaNome: "Conhecimentos Bancários" },
];

function item(numero: number, texto: string): ItemSeparado {
  return { numero, texto, pagina: 1 };
}

describe("o pedido do etiquetador", () => {
  it("manda o catalogo agrupado por materia no trecho estavel", () => {
    const instrucao = instrucaoComCatalogo(CATALOGO);

    expect(instrucao).toContain("Matemática Financeira: Juros Compostos; Juros Simples");
    expect(catalogoParaOPedido(CATALOGO).split("\n")).toHaveLength(3);
  });

  it("proibe o modelo de dizer qual e a alternativa correta", () => {
    // Invariante nº4: a IA nao decide a alternativa correta. A etiqueta e a
    // superficie de IA mais barata do produto, e tambem nao abre excecao.
    expect(instrucaoComCatalogo(CATALOGO)).toContain("nao diga qual e a alternativa correta");
  });

  it("trunca o item: o assunto se reconhece pelo comeco do enunciado", () => {
    const longo = item(1, "a".repeat(CARACTERES_POR_ITEM + 500));

    expect(entradaDoPedido([longo])).toHaveLength(`[1] `.length + CARACTERES_POR_ITEM);
  });

  it("quebra os itens no tamanho de lote configurado", () => {
    const itens = Array.from({ length: 45 }, (_, i) => item(i + 1, "texto"));

    expect(lotesDeItens(itens, 20).map((l) => l.length)).toEqual([20, 20, 5]);
  });

  it("recusa lote de tamanho zero em vez de girar para sempre", () => {
    expect(() => lotesDeItens([item(1, "x")], 0)).toThrow();
  });
});

describe("casarEtiquetas", () => {
  const pedidos = [1, 2, 3];

  it("casa o assunto do catalogo e devolve o topico canonico", () => {
    const { casadas, naoCasadas } = casarEtiquetas(
      [{ numero: 1, assunto: "juros compostos", materia: "Matemática Financeira", confianca: 0.9 }],
      CATALOGO,
      pedidos,
    );

    expect(casadas).toEqual([{ numero: 1, topicoId: "t1", confianca: 0.9 }]);
    expect(naoCasadas).toEqual([]);
  });

  it("nao casa assunto ambiguo sem materia — poria o item na materia errada", () => {
    const { casadas, naoCasadas } = casarEtiquetas(
      [{ numero: 1, assunto: "Juros Simples", materia: "", confianca: 0.8 }],
      CATALOGO,
      pedidos,
    );

    expect(casadas).toEqual([]);
    expect(naoCasadas[0].assunto).toBe("Juros Simples");
  });

  it("manda para a curadoria o assunto que nao existe na taxonomia", () => {
    const { casadas, naoCasadas } = casarEtiquetas(
      [{ numero: 2, assunto: "Pix e arranjos de pagamento", materia: "Bancários", confianca: 0.7 }],
      CATALOGO,
      pedidos,
    );

    expect(casadas).toEqual([]);
    expect(naoCasadas).toEqual([
      { numero: 2, assunto: "Pix e arranjos de pagamento", materia: "Bancários" },
    ]);
  });

  it("descarta numero que ninguem pediu", () => {
    const { casadas } = casarEtiquetas(
      [{ numero: 99, assunto: "Juros Compostos", materia: "Matemática Financeira", confianca: 1 }],
      CATALOGO,
      pedidos,
    );

    expect(casadas).toEqual([]);
  });

  it("fica com a primeira quando o modelo se contradiz sobre o mesmo item", () => {
    const { casadas } = casarEtiquetas(
      [
        { numero: 1, assunto: "Juros Compostos", materia: "Matemática Financeira", confianca: 0.9 },
        { numero: 1, assunto: "Distribuição Binomial", materia: "Probabilidade", confianca: 0.9 },
      ],
      CATALOGO,
      pedidos,
    );

    expect(casadas).toEqual([{ numero: 1, topicoId: "t1", confianca: 0.9 }]);
  });
});

describe("etiquetasParaOBanco", () => {
  it("usa os nomes de coluna que a funcao SQL le", () => {
    expect(etiquetasParaOBanco([{ numero: 3, topicoId: "t1", confianca: 0.5 }])).toEqual([
      { numero: 3, topico_id: "t1", confianca: 0.5 },
    ]);
  });
});

describe("a saida estruturada", () => {
  it("aceita a forma do etiquetador e recusa confianca fora de 0-1", () => {
    expect(
      etiquetasSugeridasSchema.safeParse({
        etiquetas: [{ numero: 1, assunto: "x", materia: "y", confianca: 0.5 }],
      }).success,
    ).toBe(true);

    expect(
      etiquetasSugeridasSchema.safeParse({
        etiquetas: [{ numero: 1, assunto: "x", materia: "y", confianca: 2 }],
      }).success,
    ).toBe(false);
  });

  it("aceita a forma da separacao de reserva", () => {
    expect(
      itensSeparadosPorModeloSchema.safeParse({
        itens: [{ numero: 1, trecho_inicial: "O texto tem o objetivo" }],
      }).success,
    ).toBe(true);
  });
});

describe("cortarPorTrechos", () => {
  const paginas = [
    { numero: 1, texto: "1\nO texto tem o objetivo de\n(A) ensinar" },
    { numero: 2, texto: "2\nConsidere a palavra destacada\n(A) básico" },
  ];

  it("corta o texto original nos pontos que o modelo apontou", () => {
    const itens = cortarPorTrechos(paginas, [
      { numero: 1, trecho_inicial: "O texto tem o objetivo" },
      { numero: 2, trecho_inicial: "Considere a palavra" },
    ]);

    expect(itens.map((i) => i.numero)).toEqual([1, 2]);
    expect(itens[0].texto).toContain("(A) ensinar");
    expect(itens[1].pagina).toBe(2);
  });

  it("descarta trecho que o modelo parafraseou: o corte e sempre do documento", () => {
    const itens = cortarPorTrechos(paginas, [
      { numero: 1, trecho_inicial: "O texto tem como finalidade" },
    ]);

    expect(itens).toEqual([]);
  });
});
