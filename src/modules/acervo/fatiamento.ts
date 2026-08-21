import { getParam } from "@/modules/config";

import type { PaginaDoPdf } from "./pdf";

/**
 * O fatiamento da prova em blocos (IA-17 / BANCO-03 AC2).
 *
 * A regra e uma frase: **nenhum pedido ao modelo passa de 272K tokens**. Acima
 * disso a OpenAI cobra 2x a entrada e 1,5x a saida (AD-073), e o desconto que
 * justificou a escolha do modelo desaparece — a prova inteira num pedido so nao
 * e "mais simples", e mais cara.
 *
 * O teto, a margem e a razao caractere/token vivem em **configuracao**: o degrau
 * de preco e do fornecedor e muda sem o nosso deploy.
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
  const [teto, margem, charsPorToken] = await Promise.all([
    getParam("param.m1.teto_tokens_por_pedido"),
    getParam("param.m1.margem_do_teto"),
    getParam("param.m1.chars_por_token"),
  ]);

  return { teto, tetoUtil: Math.floor(teto * (1 - margem)), charsPorToken };
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
 * @throws {PaginaMaiorQueOTeto} uma pagina sozinha nao cabe
 */
export function fatiarEmBlocos(
  paginas: readonly PaginaDoPdf[],
  orcamento: OrcamentoDeTokens,
): BlocoDaProva[] {
  const blocos: BlocoDaProva[] = [];
  let atual: PaginaDoPdf[] = [];

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
    if (sozinha > orcamento.tetoUtil) {
      throw new PaginaMaiorQueOTeto(pagina.numero, sozinha, orcamento.tetoUtil);
    }

    const comEla = estimarTokens(juntar([...atual, pagina]), orcamento.charsPorToken);
    if (atual.length > 0 && comEla > orcamento.tetoUtil) fechar();

    atual.push(pagina);
  }

  fechar();
  return blocos;
}
