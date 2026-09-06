import { describe, expect, it } from "vitest";

import { lerGradeDeclarada } from "./grade";
import { conferirComGrade, nomearBlocos, separarItens } from "./itens";
import type { PaginaDoPdf } from "./pdf";

function pagina(numero: number, ...linhas: string[]): PaginaDoPdf {
  return { numero, texto: linhas.join("\n"), imagens: [] };
}

/**
 * Uma prova de brinquedo com a forma da CESGRANRIO: cabecalho de pagina que se
 * repete, cabecalho de materia que nao, numero do item numa linha sozinha — e o
 * numero da pagina escrito do mesmo jeito.
 */
function provaDeBrinquedo(): PaginaDoPdf[] {
  return [
    pagina(
      1,
      "CAIXA ECONÔMICA FEDERAL",
      "TÉCNICO BANCÁRIO NOVO",
      "CONHECIMENTOS BÁSICOS",
      "LÍNGUA PORTUGUESA",
      "1",
      "O texto tem o objetivo de",
      "(A) ensinar",
      "2",
      "Considere a palavra destacada",
      "(A) básico",
    ),
    pagina(
      2,
      "TÉCNICO BANCÁRIO NOVO",
      // O rodape da pagina 3 e o numero do item 3: a colisao que a regra
      // sequencial precisa desempatar sem lista de excecao.
      "3",
      "CAIXA ECONÔMICA FEDERAL",
      "NOÇÕES DE PROBABILIDADE",
      "E ESTATÍSTICA",
      "3",
      "Uma urna contém 200 tíquetes",
      "(A) 1/200",
      "4",
      "A probabilidade de sair par é",
      "(A) 0,5",
    ),
  ];
}

describe("separarItens", () => {
  it("separa os itens pela sequencia impressa", () => {
    const { itens } = separarItens(provaDeBrinquedo());

    expect(itens.map((i) => i.numero)).toEqual([1, 2, 3, 4]);
  });

  it("fica com o item, e nao com o rodape, quando os dois sao o mesmo numero", () => {
    const { itens } = separarItens(provaDeBrinquedo());
    const terceiro = itens.find((i) => i.numero === 3);

    // Se o rodape tivesse vencido, o texto do item 3 comecaria no nome da banca.
    expect(terceiro?.texto.startsWith("Uma urna")).toBe(true);
  });

  it("para no primeiro numero que falta, em vez de pular e esconder o furo", () => {
    const comBuraco = [
      pagina(1, "1", "primeiro item", "2", "segundo item", "4", "quarto item"),
    ];

    expect(separarItens(comBuraco).itens.map((i) => i.numero)).toEqual([1, 2]);
  });

  it("le o nome do bloco do corpo e junta o nome quebrado em duas linhas", () => {
    const { nomesPorItemInicial } = separarItens(provaDeBrinquedo());

    expect(nomesPorItemInicial.get(3)).toBe("NOÇÕES DE PROBABILIDADE E ESTATÍSTICA");
  });

  it("descarta o cabecalho de pagina por contagem, sem lista fixa de nomes", () => {
    const { nomesPorItemInicial } = separarItens(provaDeBrinquedo());

    // "TÉCNICO BANCÁRIO NOVO" aparece nas duas paginas: e cabecalho de pagina.
    // "NOÇÕES DE PROBABILIDADE" aparece numa so: e cabecalho de materia.
    expect(nomesPorItemInicial.get(3)).not.toContain("TÉCNICO BANCÁRIO NOVO");
    expect(nomesPorItemInicial.get(3)).not.toContain("CAIXA ECONÔMICA FEDERAL");
  });

  it("o texto do item vai do numero ate o proximo numero", () => {
    const { itens } = separarItens(provaDeBrinquedo());
    const primeiro = itens[0];

    expect(primeiro.texto).toBe("O texto tem o objetivo de\n(A) ensinar");
    expect(primeiro.pagina).toBe(1);
  });
});

describe("conferirComGrade", () => {
  const grade = lerGradeDeclarada([
    pagina(
      1,
      "4 questões objetivas",
      "1 a 21,0 ponto cada3 a 41,0 ponto cada",
    ),
  ]);

  it("fecha quando a contagem e a distribuicao por bloco batem", () => {
    const { itens } = separarItens(provaDeBrinquedo());
    const veredito = conferirComGrade(itens, grade, 0);

    expect(veredito.fecha).toBe(true);
    expect(veredito.motivo).toBeNull();
    expect(veredito.itensSeparados).toBe(4);
  });

  it("nao fecha quando faltam itens, e diz qual bloco ficou fora", () => {
    const { itens } = separarItens(provaDeBrinquedo());
    const veredito = conferirComGrade(itens.slice(0, 3), grade, 0);

    expect(veredito.fecha).toBe(false);
    expect(veredito.motivo).toContain("3 itens separados contra 4 declarados");
    expect(veredito.divergenciasPorBloco).toHaveLength(1);
  });

  it("nao fecha quando o total bate mas a distribuicao por bloco esta torta", () => {
    // Quatro itens, mas todos no primeiro bloco: a contagem total mente.
    const tortos = [1, 2, 3, 4].map((numero) => ({
      numero: numero <= 2 ? numero : numero - 2,
      texto: "",
      pagina: 1,
    }));

    const veredito = conferirComGrade(tortos, grade, 0);

    expect(veredito.fecha).toBe(false);
    expect(veredito.divergenciasPorBloco.length).toBeGreaterThan(0);
  });

  it("nao fecha quando a grade nao esta lida, mesmo com itens separados", () => {
    const { itens } = separarItens(provaDeBrinquedo());
    const semGrade = lerGradeDeclarada([pagina(1, "prova sem capa")]);

    const veredito = conferirComGrade(itens, semGrade, 0);

    expect(veredito.fecha).toBe(false);
    expect(veredito.motivo).toBe("grade ausente");
  });

  it("aceita a folga configurada na tolerancia", () => {
    const { itens } = separarItens(provaDeBrinquedo());

    expect(conferirComGrade(itens.slice(0, 3), grade, 1).fecha).toBe(true);
  });
});

describe("nomearBlocos", () => {
  it("cola no bloco o nome que o corpo entregou, e deixa nulo o que nao veio", () => {
    const grade = lerGradeDeclarada([
      pagina(1, "4 questões objetivas", "1 a 21,0 ponto cada3 a 41,0 ponto cada"),
    ]);
    const { nomesPorItemInicial } = separarItens(provaDeBrinquedo());

    const nomeados = nomearBlocos(grade.blocos, nomesPorItemInicial);

    expect(nomeados[0].nomeImpresso).toBe("CONHECIMENTOS BÁSICOS LÍNGUA PORTUGUESA");
    expect(nomeados[1].nomeImpresso).toBe("NOÇÕES DE PROBABILIDADE E ESTATÍSTICA");
  });
});
