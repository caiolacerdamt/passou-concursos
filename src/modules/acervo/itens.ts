import type { BlocoDeclarado, GradeDeclarada } from "./grade";
import type { PaginaDoPdf } from "./pdf";

/**
 * A separacao da prova em itens, por regra de texto (BANCO-16 AC1/AC2).
 *
 * A ordem do BANCO-16 e uma frase: **codigo primeiro, modelo so quando o codigo
 * nao fecha**. Medido em 2026-09-05, a separacao deterministica fechou 6 das 23
 * provas testadas e perdeu itens nas outras — entao ela nao e suficiente, mas e
 * gratis, e nas provas em que fecha nenhuma chamada a modelo acontece.
 *
 * O que faz a regra funcionar sem lista de excecao e uma observacao boba: a
 * CESGRANRIO escreve o numero do item numa linha sozinha, acima do enunciado
 * ("As questoes objetivas sao identificadas pelo numero que se situa acima de
 * seu enunciado", nas proprias instrucoes) — **e escreve o numero da pagina do
 * mesmo jeito**. Na pagina 4 da CAIXA 2021 o numero `5` aparece duas vezes: o
 * rodape e o item. A regra sequencial desempata sozinha: procurando o item `n`,
 * olha-se so o que vem antes da primeira linha que e `n+1`, e fica-se com a
 * **ultima** ocorrencia. O rodape perde porque vem antes do item.
 *
 * O nome do bloco tambem sai daqui, e pela mesma economia: o ultimo bloco de
 * linhas em caixa alta antes do primeiro item da faixa. Cabecalho de pagina e
 * descartado por **contagem** — linha em caixa alta que aparece em mais da
 * metade das paginas e cabecalho de pagina, nao de materia. Nenhuma lista fixa
 * de nomes de materia existe neste arquivo, e isso e o desenho: lista fixa
 * quebraria na primeira banca nova.
 */

/** Um item separado do caderno. */
export type ItemSeparado = {
  /** O numero oficial impresso, que e o que a etiqueta grava. */
  numero: number;
  /** O texto do item: do numero ate o comeco do proximo. */
  texto: string;
  /** 1-based, a pagina onde o item comeca. */
  pagina: number;
};

export type Separacao = {
  itens: ItemSeparado[];
  /** Nome impresso do bloco por item inicial de faixa, quando o corpo entregou. */
  nomesPorItemInicial: Map<number, string>;
};

/** Uma linha do caderno, com a pagina de onde veio. */
type Linha = { texto: string; pagina: number; indice: number };

function linhasDoCaderno(paginas: readonly PaginaDoPdf[]): Linha[] {
  const linhas: Linha[] = [];
  for (const pagina of paginas) {
    for (const bruta of pagina.texto.split("\n")) {
      linhas.push({ texto: bruta.trim(), pagina: pagina.numero, indice: linhas.length });
    }
  }
  return linhas;
}

/** Linha que e so um numero de ate tres digitos. Item ou rodape — ainda nao se sabe. */
const SO_UM_NUMERO = /^\d{1,3}$/;

/**
 * Caixa alta, curta, sem pontuacao de fim: o formato de um cabecalho impresso.
 *
 * `texto === texto.toUpperCase()` sozinho aceitaria "(A) 11.124,12", que nao tem
 * minuscula nenhuma; a exigencia de pelo menos tres letras corta isso.
 */
function pareceCabecalho(texto: string): boolean {
  if (texto.length < 4 || texto.length > 60) return false;
  if (texto !== texto.toUpperCase()) return false;
  if (/[.:;?!]$/.test(texto)) return false;
  const letras = texto.match(/\p{Letter}/gu);
  return letras !== null && letras.length >= 3;
}

/**
 * Separa os itens pela sequencia 1, 2, 3…
 *
 * Para no primeiro numero que nao aparece mais: prova em que o codigo perde um
 * item entrega menos itens do que a grade declara, e e exatamente esse buraco
 * que manda a prova para a reserva por modelo. **Nunca** se pula um numero para
 * continuar contando — isso esconderia o furo.
 */
export function separarItens(paginas: readonly PaginaDoPdf[]): Separacao {
  const linhas = linhasDoCaderno(paginas);

  const ocorrencias = new Map<number, number[]>();
  for (const linha of linhas) {
    if (!SO_UM_NUMERO.test(linha.texto)) continue;
    const n = Number(linha.texto);
    const lista = ocorrencias.get(n);
    if (lista) lista.push(linha.indice);
    else ocorrencias.set(n, [linha.indice]);
  }

  const inicios: { numero: number; indice: number }[] = [];
  let anterior = -1;
  for (let esperado = 1; ; esperado += 1) {
    const candidatos = (ocorrencias.get(esperado) ?? []).filter((i) => i > anterior);
    if (candidatos.length === 0) break;

    const seguintes = (ocorrencias.get(esperado + 1) ?? []).filter((i) => i > candidatos[0]);
    const limite = seguintes.length > 0 ? seguintes[0] : Number.POSITIVE_INFINITY;
    const antesDoProximo = candidatos.filter((i) => i < limite);
    const escolhido =
      antesDoProximo.length > 0 ? antesDoProximo[antesDoProximo.length - 1] : candidatos[0];

    inicios.push({ numero: esperado, indice: escolhido });
    anterior = escolhido;
  }

  const itens: ItemSeparado[] = inicios.map((inicio, posicao) => {
    const fim = inicios[posicao + 1]?.indice ?? linhas.length;
    return {
      numero: inicio.numero,
      texto: linhas
        .slice(inicio.indice + 1, fim)
        .map((l) => l.texto)
        .join("\n")
        .trim(),
      pagina: linhas[inicio.indice].pagina,
    };
  });

  return {
    itens,
    nomesPorItemInicial: nomesDeBloco(linhas, inicios, paginas.length),
  };
}

/**
 * O nome impresso de cada bloco, lido do corpo.
 *
 * Volta do primeiro item da faixa ate o item anterior, procurando o **ultimo**
 * grupo de linhas em caixa alta contiguas — contiguas porque "NOCOES DE
 * PROBABILIDADE" e "E ESTATISTICA" sao um nome so quebrado em duas linhas, e o
 * cabecalho de pagina que as separaria de outro grupo ja foi descartado.
 */
function nomesDeBloco(
  linhas: readonly Linha[],
  inicios: readonly { numero: number; indice: number }[],
  totalDePaginas: number,
): Map<number, string> {
  const paginasPorCabecalho = new Map<string, Set<number>>();
  for (const linha of linhas) {
    if (!pareceCabecalho(linha.texto)) continue;
    const paginas = paginasPorCabecalho.get(linha.texto) ?? new Set<number>();
    paginas.add(linha.pagina);
    paginasPorCabecalho.set(linha.texto, paginas);
  }

  const ehCabecalhoDePagina = (texto: string) =>
    (paginasPorCabecalho.get(texto)?.size ?? 0) > totalDePaginas / 2;

  const nomes = new Map<number, string>();
  inicios.forEach((inicio, posicao) => {
    const desde = posicao === 0 ? 0 : inicios[posicao - 1].indice;
    const grupo: string[] = [];
    for (let i = inicio.indice - 1; i >= desde; i -= 1) {
      const texto = linhas[i].texto;
      if (texto === "") continue;
      if (pareceCabecalho(texto) && !ehCabecalhoDePagina(texto)) {
        grupo.unshift(texto);
        continue;
      }
      // Linha comum **antes** de achar cabecalho nao encerra a busca: entre o
      // cabecalho "LINGUA PORTUGUESA" e o item 1 costuma haver o texto de apoio
      // inteiro, e parar nele deixaria justamente o primeiro bloco sem nome
      // (medido na CAIXA 2021 e na BB 2021). Depois de achado, ela encerra — e o
      // que mantem o nome contiguo e impede colar duas materias.
      if (grupo.length > 0) break;
    }
    if (grupo.length > 0) nomes.set(inicio.numero, grupo.join(" "));
  });

  return nomes;
}

/** O veredito da conferencia da separacao contra a grade (BANCO-16 AC2/AC5). */
export type Conferencia = {
  /** `true` = fecha com a grade e **nenhuma chamada a modelo acontece**. */
  fecha: boolean;
  itensSeparados: number;
  itensDeclarados: number;
  /** Diferenca por bloco: `[nome ou faixa, declarado, separado]`. */
  divergenciasPorBloco: { faixa: string; declarados: number; separados: number }[];
  /** Preenchido quando a divergencia passa da tolerancia — vira conferencia humana. */
  motivo: string | null;
};

/**
 * Confere a separacao contra a grade declarada.
 *
 * O AC2 exige as **duas** condicoes: a contagem total igual ao declarado e a
 * distribuicao por bloco batendo. Contagem certa com distribuicao errada e o
 * caso perigoso — a prova pareceria completa e mandaria peso para a materia
 * errada.
 */
export function conferirComGrade(
  itens: readonly ItemSeparado[],
  grade: GradeDeclarada,
  tolerancia: number,
): Conferencia {
  const declarados = grade.totalDeclarado ?? 0;
  const numeros = new Set(itens.map((i) => i.numero));

  const divergencias = grade.blocos
    .map((bloco: BlocoDeclarado) => {
      let separados = 0;
      for (let n = bloco.itemInicial; n <= bloco.itemFinal; n += 1) {
        if (numeros.has(n)) separados += 1;
      }
      return {
        faixa: bloco.nomeImpresso ?? `${bloco.itemInicial}-${bloco.itemFinal}`,
        declarados: bloco.itemFinal - bloco.itemInicial + 1,
        separados,
      };
    })
    .filter((linha) => Math.abs(linha.declarados - linha.separados) > tolerancia);

  const totalBate = Math.abs(itens.length - declarados) <= tolerancia;
  const fecha = grade.status === "lida" && totalBate && divergencias.length === 0;

  const motivo = fecha
    ? null
    : grade.status !== "lida"
      ? `grade ${grade.status}`
      : `separacao divergiu da grade: ${itens.length} itens separados contra ${declarados} declarados` +
        (divergencias.length > 0
          ? `; blocos fora: ${divergencias.map((d) => `${d.faixa} ${d.separados}/${d.declarados}`).join(", ")}`
          : "");

  return {
    fecha,
    itensSeparados: itens.length,
    itensDeclarados: declarados,
    divergenciasPorBloco: divergencias,
    motivo,
  };
}

/** Cola no bloco o nome que o corpo entregou. Bloco sem nome fica sem nome. */
export function nomearBlocos(
  blocos: readonly BlocoDeclarado[],
  nomes: ReadonlyMap<number, string>,
): BlocoDeclarado[] {
  return blocos.map((bloco) => ({
    ...bloco,
    nomeImpresso: nomes.get(bloco.itemInicial) ?? bloco.nomeImpresso,
  }));
}
