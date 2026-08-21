/**
 * O texto que saiu do PDF e legivel? (BANCO-12 AC3)
 *
 * A decisao de `precisa_ocr` era ingenua: bastava sair **alguma coisa**. Isso
 * cobre a prova escaneada, que nao sai nada — mas nao cobre o caso pior.
 *
 * Alguns PDFs usam fonte com codificacao propria. O leitor devolve os codigos
 * dos glifos em vez das letras, e o resultado e uma pagina cheia de caracteres
 * que nao formam palavra nenhuma. **Isso e pior do que nada**: como saiu muito
 * texto, a prova nao cairia em `precisa_ocr`, o lixo iria ao modelo, e a conta
 * viria. Aqui a prova cai em `precisa_ocr`, que e o lado seguro do erro.
 *
 * ## A medida e por escrita alfabetica, nao por idioma
 *
 * Prova de concurso bancario tem secao de **Lingua Inglesa**, e prova de outra
 * banca pode ter espanhol. Uma medida calibrada em portugues reprovaria uma
 * pagina legitima e mandaria a prova inteira para a fila de OCR — o erro mais
 * caro possivel, porque e silencioso e joga fora acervo bom.
 *
 * As duas medidas abaixo sao propriedades de **texto escrito em alfabeto**, e
 * nao de um idioma:
 *
 * - **proporcao de caracteres plausiveis**: letra, numero, espaco e pontuacao
 *   comum. Codigo de glifo cai em faixas de simbolo e de controle;
 * - **proporcao de vogais**: toda lingua alfabetica alterna vogal e consoante.
 *   Sequencia de codigo de glifo nao tem essa regularidade.
 *
 * Medido nos PDFs reais do BB 2021 (que tem uma secao inteira em ingles):
 * 96% de caracteres plausiveis e 34% de vogais nos tres cadernos.
 */

/** O que a medicao viu. Vai para o log e para a tela de inspecao. */
export type Legibilidade = {
  /** 0 a 1. Letra, numero, espaco e pontuacao comum. */
  plausiveis: number;
  /** 0 a 1. Vogal de qualquer lingua alfabetica, com ou sem acento. */
  vogais: number;
  legivel: boolean;
  motivo: string | null;
};

/**
 * Os pisos.
 *
 * Nao vivem em configuracao de proposito: nao sao parametro de negocio que se
 * calibra, sao a fronteira entre "texto" e "lixo". Estao **bem abaixo** do
 * medido (96% e 34%) porque o custo dos dois erros e assimetrico — reprovar uma
 * prova boa manda ela para uma fila de OCR que nao existe no MVP, enquanto
 * aprovar uma ruim custa alguns centavos e um bloco recusado.
 */
export const PISO_DE_PLAUSIVEIS = 0.6;
export const PISO_DE_VOGAIS = 0.15;

/** Abaixo disto nao ha amostra para medir nada. */
const MINIMO_DE_CARACTERES = 200;

const PLAUSIVEIS =
  /[\p{L}\p{N}\s.,;:!?()[\]{}\-–—'"“”‘’/\\%$€£&*+=<>@#°ºª§|~^`]/gu;

/**
 * Vogais do alfabeto latino, com os acentos que portugues, ingles, espanhol e
 * frances usam. Nao ha lista de idioma aqui: e a mesma faixa para todos.
 */
const VOGAIS = /[aeiouáàâãäéèêëíìîïóòôõöúùûüyAEIOUÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜY]/g;

function proporcao(texto: string, padrao: RegExp): number {
  if (texto.length === 0) return 0;
  return (texto.match(padrao) ?? []).length / texto.length;
}

/**
 * Mede o texto extraido de um PDF inteiro.
 *
 * Texto vazio ou muito curto **nao e ilegivel**: e ausencia de texto, que e o
 * caso da prova escaneada e que quem trata e `temTextoNativo`. Distinguir os
 * dois importa porque a mensagem para o operador e diferente.
 */
export function medirLegibilidade(texto: string): Legibilidade {
  const plausiveis = proporcao(texto, PLAUSIVEIS);
  const vogais = proporcao(texto, VOGAIS);

  if (texto.length < MINIMO_DE_CARACTERES) {
    return { plausiveis, vogais, legivel: false, motivo: "texto curto demais para medir" };
  }
  if (plausiveis < PISO_DE_PLAUSIVEIS) {
    return {
      plausiveis,
      vogais,
      legivel: false,
      motivo: `so ${(plausiveis * 100).toFixed(0)}% dos caracteres formam texto escrito`,
    };
  }
  if (vogais < PISO_DE_VOGAIS) {
    return {
      plausiveis,
      vogais,
      legivel: false,
      motivo: `so ${(vogais * 100).toFixed(0)}% de vogais: o texto nao forma palavras`,
    };
  }

  return { plausiveis, vogais, legivel: true, motivo: null };
}
