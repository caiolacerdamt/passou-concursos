import { describe, expect, it } from "vitest";

import { blocosParaOBanco, lerGradeDeclarada, pesoDoBloco } from "./grade";
import type { PaginaDoPdf } from "./pdf";

function pagina(numero: number, texto: string): PaginaDoPdf {
  return { numero, texto, imagens: [] };
}

/**
 * As duas linhas abaixo sao **copia literal** do que o leitor de PDF devolve das
 * provas em `fontes/entrada/` (medido em 2026-09-06). Elas nao estao aqui por
 * capricho: e a colagem do `1,0` no `10` que quebra qualquer regex ingenua, e um
 * fixture "arrumado" testaria um problema que a prova real nao tem.
 */
const CAIXA_2021 = [
  "a) este caderno, com o tema da Redação e 60 (sessenta) questões objetivas, sem repetição ou falha, assim distribuídas:",
  "CONHECIMENTOS BÁSICOS",
  "1 a 101,0 ponto cada11 a 201,0 ponto cada21 a 301,0 ponto cada",
  "Total: 10,0 pontosTotal: 10,0 pontosTotal: 10,0 pontos",
  "CONHECIMENTOS ESPECÍFICOS",
  "31 a 351,0 ponto cada36 a 451,0 ponto cada46 a 601,0 ponto cada",
].join("\n");

const BB_2021 = [
  "a) este caderno, com o tema da Redação e 70 questões objetivas, sem repetição ou falha, assim distribuídas:",
  "1 a 101,5 ponto cada11 a 151,0 ponto cada16 a 201,5 ponto cada21 a 251,0 ponto cada",
  "26 a 301,5 ponto cada31 a 401,5 ponto cada41 a 551,5 ponto cada56 a 701,5 ponto cada",
].join("\n");

describe("lerGradeDeclarada", () => {
  it("le os 6 blocos da CAIXA 2021 somando os 60 itens da capa", () => {
    const grade = lerGradeDeclarada([pagina(1, CAIXA_2021)]);

    expect(grade.totalDeclarado).toBe(60);
    expect(grade.status).toBe("lida");
    expect(grade.blocos).toHaveLength(6);
    expect(grade.somaDosBlocos).toBe(60);
    expect(grade.blocos.map((b) => [b.itemInicial, b.itemFinal])).toEqual([
      [1, 10],
      [11, 20],
      [21, 30],
      [31, 35],
      [36, 45],
      [46, 60],
    ]);
  });

  it("desfaz a colagem do numero com a pontuacao em vez de ler a faixa 1 a 101", () => {
    const grade = lerGradeDeclarada([pagina(1, CAIXA_2021)]);

    // O erro que este teste existe para pegar: `1 a 101` com pontuacao `,0`.
    expect(grade.blocos[0].itemFinal).toBe(10);
    expect(grade.blocos[0].pontuacaoPorItem).toBe(1);
    expect(grade.blocos[0].base).toBe("pontos");
  });

  it("le a BB 2021 com pontuacao diferente por bloco", () => {
    const grade = lerGradeDeclarada([pagina(1, BB_2021)]);

    expect(grade.totalDeclarado).toBe(70);
    expect(grade.status).toBe("lida");
    expect(grade.blocos).toHaveLength(8);
    expect(grade.blocos.map((b) => b.pontuacaoPorItem)).toEqual([
      1.5, 1, 1.5, 1, 1.5, 1.5, 1.5, 1.5,
    ]);
  });

  it("marca inconsistente quando a soma dos blocos nao bate com o total", () => {
    // Um cabecalho adulterado: o bloco de 15 itens virou de 5.
    const adulterada = CAIXA_2021.replace("46 a 601,0", "46 a 501,0");
    const grade = lerGradeDeclarada([pagina(1, adulterada)]);

    expect(grade.status).toBe("inconsistente");
    expect(grade.somaDosBlocos).toBe(50);
    expect(grade.totalDeclarado).toBe(60);
  });

  it("marca inconsistente quando duas faixas se sobrepoem", () => {
    const sobreposta = CAIXA_2021.replace("36 a 451,0", "30 a 451,0");
    const grade = lerGradeDeclarada([pagina(1, sobreposta)]);

    expect(grade.status).toBe("inconsistente");
  });

  it("fica ausente, e sem bloco nenhum, quando a grade nao esta no documento", () => {
    const grade = lerGradeDeclarada([
      pagina(1, "PROVA DE CONHECIMENTOS\n1\nO texto tem o objetivo de"),
    ]);

    expect(grade.status).toBe("ausente");
    expect(grade.blocos).toEqual([]);
    // AC4: nada e inferido. Nem o total.
    expect(grade.totalDeclarado).toBeNull();
  });

  it("fica ausente quando ha faixas mas nenhum total declarado", () => {
    const grade = lerGradeDeclarada([pagina(1, "1 a 101,0 ponto cada")]);

    expect(grade.status).toBe("ausente");
    expect(grade.blocos).toEqual([]);
  });

  it("cai para a base itens quando a prova nao declara pontuacao", () => {
    const grade = lerGradeDeclarada([
      pagina(1, "60 questões objetivas\nQuestões 1 a 30\nQuestões 31 a 60"),
    ]);

    expect(grade.status).toBe("lida");
    expect(grade.blocos.map((b) => b.base)).toEqual(["itens", "itens"]);
    expect(grade.blocos.every((b) => b.pontuacaoPorItem === null)).toBe(true);
  });

  it("nao soma duas vezes a mesma faixa impressa em duas paginas", () => {
    const grade = lerGradeDeclarada([pagina(1, CAIXA_2021), pagina(2, CAIXA_2021)]);

    expect(grade.blocos).toHaveLength(6);
    expect(grade.status).toBe("lida");
  });
});

describe("pesoDoBloco", () => {
  it("pesa em pontos quando a prova declarou pontuacao", () => {
    const [primeiro] = lerGradeDeclarada([pagina(1, BB_2021)]).blocos;
    expect(pesoDoBloco(primeiro)).toBe(15);
  });

  it("pesa em contagem de itens quando ela nao declarou", () => {
    const grade = lerGradeDeclarada([
      pagina(1, "60 questões objetivas\nQuestões 1 a 30\nQuestões 31 a 60"),
    ]);
    expect(pesoDoBloco(grade.blocos[0])).toBe(30);
  });
});

describe("blocosParaOBanco", () => {
  it("manda pontuacao nula quando a base e itens, que e o que a funcao SQL le", () => {
    const grade = lerGradeDeclarada([
      pagina(1, "60 questões objetivas\nQuestões 1 a 60"),
    ]);

    expect(blocosParaOBanco(grade.blocos)).toEqual([
      {
        ordem: 1,
        nome_impresso: null,
        item_inicial: 1,
        item_final: 60,
        pontuacao_por_item: null,
      },
    ]);
  });
});
