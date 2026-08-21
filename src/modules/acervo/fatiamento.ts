import { getParams } from "@/modules/config";

import type { PaginaDoPdf } from "./pdf";

/**
 * O fatiamento da prova em blocos (IA-17 / BANCO-03 AC2).
 *
 * A regra e uma frase: **nenhum pedido ao modelo passa de 272K tokens**. Acima
 * disso a OpenAI cobra 2x a entrada e 1,5x a saida (AD-073), e o desconto que
 * justificou a escolha do modelo desaparece — a prova inteira num pedido so nao
 * e "mais simples", e mais cara.
 *
 * Mas o teto de tokens **sozinho nao corta prova nenhuma**: medido nas provas do
 * BB 2021, uma prova inteira sao ~19 mil tokens contra um teto util de ~218 mil.
 * Sem um segundo limite, "fatiar em blocos" seria um bloco so — que e
 * exatamente o que o BANCO-03 AC2 proibe. Por isso ha **duas** travas: o teto de
 * tokens (o custo) e o teto de paginas (a fronteira). Bloco menor tambem falha
 * menor: um bloco ruim custa 4 paginas, nao a prova.
 *
 * O teto, a margem, a razao caractere/token e o tamanho do bloco vivem em
 * **configuracao**: o degrau de preco e do fornecedor e muda sem o nosso deploy.
 *
 * A unidade do bloco e a **pagina**, e nao a questao. A fronteira de questao so
 * existe depois que o modelo leu a prova; a de pagina o PDF entrega de graca. O
 * custo disso e uma questao ocasionalmente partida entre dois blocos — e por
 * isso o bloco carrega, na instrucao, a ordem de ignorar questao truncada.
 */

/** Um bloco pronto para virar um pedido. */
export type BlocoDaProva = {
  /** 0-based: e o que vai na chave de dedup, e ela nao pode mudar de sentido. */
  indice: number;
  /** 1-based, inclusivo nas duas pontas. */
  primeiraPagina: number;
  ultimaPagina: number;
  texto: string;
  tokensEstimados: number;
};

export type OrcamentoDeTokens = {
  /** O teto do fornecedor. */
  teto: number;
  /** O que sobra depois da margem — o numero que o fatiamento realmente usa. */
  tetoUtil: number;
  charsPorToken: number;
  /** Quantas paginas, no maximo, cabem num bloco. E o corte que sempre acontece. */
  paginasPorBloco: number;
};

/**
 * Uma pagina sozinha nao cabe no teto.
 *
 * **Parada visivel, nunca truncar.** Truncar significaria mandar meia pagina ao
 * modelo e receber questoes pela metade, que entrariam no acervo parecendo
 * inteiras. O operador precisa saber que aquela prova precisa de outro corte.
 */
export class PaginaMaiorQueOTeto extends Error {
  readonly pagina: number;

  constructor(pagina: number, tokens: number, teto: number) {
    super(
      `a pagina ${pagina} sozinha estimou ${tokens} tokens, acima do teto util de ${teto}. ` +
        "Nenhum pedido passa do teto (IA-17): a prova nao foi fatiada.",
    );
    this.name = "PaginaMaiorQueOTeto";
    this.pagina = pagina;
  }
}

/** O orcamento vigente, lido da configuracao. */
export async function orcamentoVigente(): Promise<OrcamentoDeTokens> {
  // `getParams`, e nao quatro `getParam` em `Promise.all`: o job fala com o banco
  // por uma conexao `pg` unica, que **nao** aceita consultas concorrentes — o
  // driver avisa e promete remover o suporte na versao 9. Uma leitura so tambem
  // e um round-trip so.
  const [teto, margem, charsPorToken, paginasPorBloco] = await getParams(
    "param.m1.teto_tokens_por_pedido",
    "param.m1.margem_do_teto",
    "param.m1.chars_por_token",
    "param.m1.paginas_por_bloco",
  );

  return {
    teto,
    tetoUtil: Math.floor(teto * (1 - margem)),
    charsPorToken,
    paginasPorBloco,
  };
}

/**
 * Quantos tokens um texto deve custar.
 *
 * E **estimativa**, e assumida como tal: contar de verdade exigiria o
 * tokenizador do fornecedor, que muda com o modelo — exatamente o acoplamento
 * que a matriz de configuracao existe para evitar. A margem do orcamento e o
 * que cobre o erro, e o `usage` que volta em `ia_geracoes` e o que permite
 * calibrar `chars_por_token` medindo, em vez de chutar de novo.
 */
export function estimarTokens(texto: string, charsPorToken: number): number {
  return Math.ceil(texto.length / charsPorToken);
}

/** O cabecalho que marca de onde saiu cada pedaco dentro de um bloco. */
export function cabecalhoDaPagina(numero: number): string {
  return `--- pagina ${numero} ---`;
}

function juntar(paginas: PaginaDoPdf[]): string {
  return paginas
    .map((pagina) => `${cabecalhoDaPagina(pagina.numero)}\n${pagina.texto}`)
    .join("\n\n");
}

/**
 * Agrupa as paginas em blocos que cabem no orcamento.
 *
 * Paginas sem texto **entram no bloco assim mesmo**: uma pagina em branco no
 * meio da prova nao pode deslocar a numeracao das que vem depois, e o cabecalho
 * de pagina e o que deixa o modelo saber que ali nao havia nada.
 *
 * `custoFixo` sao os tokens que o pedido gasta **antes** do texto da prova — a
 * instrucao estavel e o schema da saida estruturada, que viajam em toda linha do
 * lote. O criterio do IA-17 e sobre o pedido, nao sobre o bloco: medir so o
 * texto mediria outra coisa.
 *
 * @throws {PaginaMaiorQueOTeto} uma pagina sozinha nao cabe
 */
export function fatiarEmBlocos(
  paginas: readonly PaginaDoPdf[],
  orcamento: OrcamentoDeTokens,
  custoFixo = 0,
): BlocoDaProva[] {
  const blocos: BlocoDaProva[] = [];
  let atual: PaginaDoPdf[] = [];
  const disponivel = orcamento.tetoUtil - custoFixo;

  const fechar = (): void => {
    if (atual.length === 0) return;
    const texto = juntar(atual);
    blocos.push({
      indice: blocos.length,
      primeiraPagina: atual[0].numero,
      ultimaPagina: atual[atual.length - 1].numero,
      texto,
      tokensEstimados: estimarTokens(texto, orcamento.charsPorToken),
    });
    atual = [];
  };

  for (const pagina of paginas) {
    const sozinha = estimarTokens(
      juntar([pagina]),
      orcamento.charsPorToken,
    );
    if (sozinha > disponivel) {
      throw new PaginaMaiorQueOTeto(pagina.numero, sozinha + custoFixo, orcamento.tetoUtil);
    }

    const comEla = estimarTokens(juntar([...atual, pagina]), orcamento.charsPorToken);
    const cheio =
      atual.length >= orcamento.paginasPorBloco || comEla > disponivel;
    if (atual.length > 0 && cheio) fechar();

    atual.push(pagina);
  }

  fechar();
  return blocos;
}
