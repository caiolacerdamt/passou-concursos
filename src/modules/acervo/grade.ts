import type { PaginaDoPdf } from "./pdf";

/**
 * A grade que a prova declara sobre si mesma (BANCO-15).
 *
 * O AD-138 mede: o peso da materia vem do numero **oficial** impresso na prova,
 * nao da participacao no acervo. Este arquivo le esse numero, e le de graca —
 * regex sobre o texto que o leitor de PDF ja entregou, sem nenhuma chamada a
 * modelo.
 *
 * A grade da CESGRANRIO mora na pagina de instrucoes, sempre no mesmo formato:
 * uma frase com o total ("60 (sessenta) questoes objetivas") e, por grupo, uma
 * linha com as faixas **coladas**:
 *
 *     1 a 101,0 ponto cada11 a 201,0 ponto cada21 a 301,0 ponto cada
 *
 * Isso e "1 a 10 / 1,0 ponto cada" tres vezes, sem separador. E o unico ponto
 * sutil deste arquivo: sem exigir decimal na pontuacao, a regex le a faixa como
 * "1 a 101". A exigencia do decimal e o que desfaz a ambiguidade, e por isso a
 * prova que escreve "1 ponto cada" (inteiro) tem um segundo padrao, com espaco.
 *
 * **O nome do bloco nao sai daqui.** Na tabela de instrucoes os nomes vem
 * colados ("Lingua PortuguesaLingua Inglesa") ou quebrados em duas linhas; quem
 * entrega nome legivel e o corpo da prova, e isso e `itens.ts`.
 */

/** Um bloco como a prova o declarou. */
export type BlocoDeclarado = {
  /** 1-based, na ordem impressa. */
  ordem: number;
  itemInicial: number;
  itemFinal: number;
  /** `null` = a prova nao declarou pontuacao, e o peso do bloco e em itens. */
  pontuacaoPorItem: number | null;
  /** BANCO-15 AC3: qual das duas bases a linha usou. */
  base: "pontos" | "itens";
  /** Preenchido depois, pelo corpo da prova. */
  nomeImpresso: string | null;
};

export type GradeDeclarada = {
  /** `null` quando a prova nao declarou total nenhum. */
  totalDeclarado: number | null;
  blocos: BlocoDeclarado[];
  /**
   * `ausente` = nao deu para ler; `lida` = a soma bate com o total;
   * `inconsistente` = leu, mas a soma nao fecha. O banco recalcula este
   * veredito em `registrar_grade_declarada` — aqui ele existe para o relatorio
   * do comando dizer a verdade antes de gravar.
   */
  status: "ausente" | "lida" | "inconsistente";
  /** Soma dos itens dos blocos. Serve ao relatorio quando nao fecha. */
  somaDosBlocos: number;
};

/**
 * "60 (sessenta) questoes objetivas" / "70 questoes objetivas".
 *
 * O parenteses por extenso e opcional porque as duas provas medidas divergem
 * nele — a CAIXA 2021 escreve, a BB 2021 nao.
 */
const TOTAL_DECLARADO =
  /(\d{1,3})\s*(?:\([^)]{1,40}\)\s*)?quest(?:o|õ|ó)es\s+objetivas/i;

/**
 * Faixa com pontuacao **decimal** colada: `1 a 101,0 ponto cada`.
 *
 * O fim da faixa e **guloso** e a pontuacao exige separador decimal. A engine
 * tenta `101` primeiro, falha porque o que sobra (`,0`) nao tem parte inteira,
 * volta para `10` e casa `1,0`. E o backtracking que resolve a colagem — nao ha
 * como separar por posicao, o PDF nao guarda a fronteira. Fim preguicoso faria o
 * oposto: pararia em `1` e leria a pontuacao como `01,0`.
 */
const FAIXA_COM_PONTUACAO_DECIMAL =
  /(\d{1,3})\s*a\s*(\d{1,3})(\d{1,3}[.,]\d{1,2})\s*pontos?\s*cada/gi;

/** `1 a 10  2 pontos cada`: pontuacao inteira, e ai o separador e o espaco. */
const FAIXA_COM_PONTUACAO_INTEIRA =
  /(\d{1,3})\s*a\s*(\d{1,3})\s+(\d{1,2})\s*pontos?\s*cada/gi;

/** `Questoes 1 a 10`: a prova declara a faixa e nao declara pontuacao. */
const FAIXA_SEM_PONTUACAO = /quest(?:o|õ|ó)es\s+(\d{1,3})\s*a\s*(\d{1,3})\b/gi;

function numero(texto: string): number {
  return Number(texto.replace(",", "."));
}

/** Faixa valida: cresce, comeca em item real e nao e absurda. */
function faixaPlausivel(inicio: number, fim: number): boolean {
  return inicio >= 1 && fim >= inicio && fim - inicio < 200;
}

/**
 * Le a grade do texto da prova.
 *
 * A ordem das tentativas e a ordem do custo de estar errado: pontuacao decimal
 * (o formato medido), pontuacao inteira, e so entao faixa sem pontuacao — que
 * cai na base `itens` e registra isso na linha (AC3).
 */
export function lerGradeDeclarada(
  paginas: readonly PaginaDoPdf[],
): GradeDeclarada {
  const texto = paginas.map((p) => p.texto).join("\n");

  const total = texto.match(TOTAL_DECLARADO);
  const totalDeclarado = total ? Number(total[1]) : null;

  const cruas: { inicio: number; fim: number; pontuacao: number | null }[] = [];

  for (const m of texto.matchAll(FAIXA_COM_PONTUACAO_DECIMAL)) {
    const inicio = Number(m[1]);
    const fim = Number(m[2]);
    if (faixaPlausivel(inicio, fim)) {
      cruas.push({ inicio, fim, pontuacao: numero(m[3]) });
    }
  }

  if (cruas.length === 0) {
    for (const m of texto.matchAll(FAIXA_COM_PONTUACAO_INTEIRA)) {
      const inicio = Number(m[1]);
      const fim = Number(m[2]);
      if (faixaPlausivel(inicio, fim)) {
        cruas.push({ inicio, fim, pontuacao: Number(m[3]) });
      }
    }
  }

  if (cruas.length === 0) {
    for (const m of texto.matchAll(FAIXA_SEM_PONTUACAO)) {
      const inicio = Number(m[1]);
      const fim = Number(m[2]);
      if (faixaPlausivel(inicio, fim)) cruas.push({ inicio, fim, pontuacao: null });
    }
  }

  // A capa imprime os grupos fora de ordem em algumas provas (medido na
  // CESGRANRIO 2012, que lista "Conhecimentos Basicos" depois dos
  // "Especificos"). A ordem que vale e a do numero do item, que e a do caderno.
  cruas.sort((a, b) => a.inicio - b.inicio);

  // Faixa repetida acontece quando a mesma tabela e impressa duas vezes (capa e
  // instrucoes). Somar as duas dobraria o peso da materia.
  const vistas = new Set<number>();
  const blocos: BlocoDeclarado[] = [];
  for (const crua of cruas) {
    if (vistas.has(crua.inicio)) continue;
    vistas.add(crua.inicio);
    blocos.push({
      ordem: blocos.length + 1,
      itemInicial: crua.inicio,
      itemFinal: crua.fim,
      pontuacaoPorItem: crua.pontuacao,
      base: crua.pontuacao === null ? "itens" : "pontos",
      nomeImpresso: null,
    });
  }

  const somaDosBlocos = blocos.reduce(
    (soma, b) => soma + (b.itemFinal - b.itemInicial + 1),
    0,
  );

  if (blocos.length === 0 || totalDeclarado === null) {
    // AC4: nao deu para ler = **ausente**, fila humana. Nao existe, em lugar
    // nenhum deste arquivo, um caminho que complete a grade por deducao.
    return { totalDeclarado, blocos: [], status: "ausente", somaDosBlocos: 0 };
  }

  const sobreposta = blocos.some((b, i) =>
    blocos.some((outro, j) => j !== i && b.itemInicial <= outro.itemFinal && outro.itemInicial <= b.itemFinal),
  );

  return {
    totalDeclarado,
    blocos,
    status: somaDosBlocos === totalDeclarado && !sobreposta ? "lida" : "inconsistente",
    somaDosBlocos,
  };
}

/** O peso do bloco, com a base que a linha registrou (BANCO-15 AC3). */
export function pesoDoBloco(bloco: BlocoDeclarado): number {
  const itens = bloco.itemFinal - bloco.itemInicial + 1;
  return bloco.base === "pontos" ? itens * (bloco.pontuacaoPorItem ?? 0) : itens;
}

/** A forma que `registrar_grade_declarada` espera no `jsonb`. */
export function blocosParaOBanco(
  blocos: readonly BlocoDeclarado[],
): Record<string, unknown>[] {
  return blocos.map((b) => ({
    ordem: b.ordem,
    nome_impresso: b.nomeImpresso,
    item_inicial: b.itemInicial,
    item_final: b.itemFinal,
    pontuacao_por_item: b.pontuacaoPorItem,
  }));
}
