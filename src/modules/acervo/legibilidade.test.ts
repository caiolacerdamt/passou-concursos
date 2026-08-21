import { describe, expect, it } from "vitest";

import {
  PISO_DE_PLAUSIVEIS,
  PISO_DE_VOGAIS,
  medirLegibilidade,
} from "./legibilidade";

/** Um trecho de prova em portugues, do tamanho que a medicao exige. */
const PORTUGUES = `
QUESTAO 26
Um negociador de investimentos de uma instituicao financeira pergunta ao gerente
qual a taxa de juros anual maxima que pode oferecer a um cliente investidor, e o
gerente afirma que ficara satisfeito com uma taxa anual maxima de 8,36%.
(A) 2,16%
(B) 2,24%
(C) 3,20%
(D) 7,96%
(E) 16,72%
`.repeat(2);

/**
 * Um trecho de prova em **ingles**. A secao de Lingua Inglesa e parte legitima
 * de toda prova bancaria, e reprovar essa pagina mandaria a prova inteira para
 * uma fila de OCR que nem existe no MVP — o erro mais caro, porque e silencioso
 * e joga fora acervo bom.
 */
const INGLES = `
QUESTION 11
WASHINGTON - American intelligence officials have found no evidence that aerial
phenomena observed by Navy pilots in recent years are alien spacecraft, but they
still cannot explain the unusual movements that have mystified scientists.
One of the purposes of the text is to confirm that the report determines the
(A) existence of life on other planets
(B) imminent possibility of an attack
(C) superiority of American technology
(D) authorities ignorance about unusual aircraft
(E) danger of enemy nations attacks
`.repeat(2);

/** Espanhol, porque outra banca pode ter. Nenhuma lista de idioma no codigo. */
const ESPANHOL = `
PREGUNTA 15
El banco central establece la tasa de interes de referencia para la economia,
y las instituciones financieras ajustan sus operaciones segun esa decision.
(A) la inflacion aumenta siempre
(B) el credito se vuelve mas caro
(C) los depositos pierden valor
(D) la moneda se deprecia
(E) ninguna de las anteriores
`.repeat(3);

/**
 * O que uma fonte com codificacao propria produz: codigos de glifo em vez de
 * letras. Muito texto, nenhuma palavra.
 */
const LIXO_DE_FONTE = Array.from({ length: 400 }, (_, i) =>
  String.fromCharCode(0x2400 + (i % 90)),
).join("");

describe("medirLegibilidade — a medida e de escrita, nao de idioma", () => {
  it("aprova portugues", () => {
    const m = medirLegibilidade(PORTUGUES);
    expect(m.legivel).toBe(true);
    expect(m.motivo).toBeNull();
  });

  it("aprova ingles — a secao de Lingua Inglesa e prova legitima", () => {
    // Este e o teste que existe para impedir uma regressao especifica: uma
    // medida calibrada em portugues reprovaria esta pagina.
    const m = medirLegibilidade(INGLES);
    expect(m.legivel).toBe(true);
    expect(m.plausiveis).toBeGreaterThan(PISO_DE_PLAUSIVEIS);
    expect(m.vogais).toBeGreaterThan(PISO_DE_VOGAIS);
  });

  it("aprova espanhol", () => {
    expect(medirLegibilidade(ESPANHOL).legivel).toBe(true);
  });

  it("as tres linguas ficam com folga confortavel sobre o piso", () => {
    // Nao basta passar: tem que passar longe, senao o piso esta no lugar errado
    // e a primeira prova diferente reprova por acaso.
    for (const texto of [PORTUGUES, INGLES, ESPANHOL]) {
      const m = medirLegibilidade(texto);
      expect(m.plausiveis).toBeGreaterThan(0.9);
      expect(m.vogais).toBeGreaterThan(0.25);
    }
  });

  it("reprova o lixo de fonte com codificacao propria", () => {
    const m = medirLegibilidade(LIXO_DE_FONTE);
    expect(m.legivel).toBe(false);
    expect(m.motivo).not.toBeNull();
  });

  it("reprova texto sem vogal nenhuma, ainda que os caracteres sejam plausiveis", () => {
    // O caso que a proporcao de caracteres sozinha nao pega: consoantes e
    // pontuacao sao todas "plausiveis", mas nao formam palavra.
    const m = medirLegibilidade("bcdfg hjklm npqrs tvwxz. ".repeat(20));
    expect(m.legivel).toBe(false);
    expect(m.motivo).toContain("vogais");
  });

  it("texto curto nao e medido: e ausencia de texto, nao ilegibilidade", () => {
    // Prova escaneada nao chega aqui — quem trata dela e `temTextoNativo`.
    const m = medirLegibilidade("QUESTAO 1");
    expect(m.legivel).toBe(false);
    expect(m.motivo).toContain("curto");
    expect(medirLegibilidade("").legivel).toBe(false);
  });

  it("devolve os numeros medidos, e nao so o veredito", () => {
    // A tela de inspecao mostra estes numeros ao operador antes de ele gastar.
    const m = medirLegibilidade(PORTUGUES);
    expect(m.plausiveis).toBeGreaterThan(0);
    expect(m.plausiveis).toBeLessThanOrEqual(1);
    expect(m.vogais).toBeGreaterThan(0);
  });
});
