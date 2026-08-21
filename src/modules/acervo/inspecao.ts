import type { ClienteSql } from "@/modules/ia";

import {
  type BlocoDaProva,
  type OrcamentoDeTokens,
  fatiarEmBlocos,
} from "./fatiamento";
import type { ProvaCatalogada } from "./ingestao";
import { lerProva } from "./ingestao";
import { type Legibilidade, medirLegibilidade } from "./legibilidade";
import { lerPdf } from "./pdf";

/**
 * As duas perguntas que o operador precisa responder **sem** abrir o banco.
 *
 * As duas nasceram do primeiro lote real (SPEC 09), e as duas eram feitas com
 * SQL na mao ate agora:
 *
 * 1. **"Esta prova vai funcionar?"** — a unica etapa do pipeline que depende do
 *    layout do PDF e a leitura do texto; tudo depois dela e agnostico. Entao a
 *    pergunta e respondida lendo o PDF, de graca, antes de gastar. `inspecionar`
 *    nao encosta no banco nem no provedor.
 * 2. **"O que aconteceu com esta prova?"** — um bloco que falha some do fluxo:
 *    `colher` nao o enxerga (so olha o que esta em voo) e `enviar` so diz quantos
 *    mandou. As duas falhas do primeiro lote real so foram descobertas porque
 *    alguem foi escrever SQL — e isso nao pode ser o procedimento.
 */

// ── Inspecionar ─────────────────────────────────────────────────────────────

export type Inspecao = {
  paginas: number;
  caracteres: number;
  temTextoNativo: boolean;
  legibilidade: Legibilidade;
  imagens: number;
  blocos: number;
  tokensEstimados: number;
  amostra: string;
};

/** Lê o PDF e conta o que ele tem. Nenhum efeito, nenhum gasto. */
export function inspecionar(
  bruto: Buffer,
  orcamento: OrcamentoDeTokens,
  custoFixo = 0,
): Inspecao {
  const pdf = lerPdf(bruto);
  const texto = pdf.paginas.map((pagina) => pagina.texto).join("\n");

  // Fatiar pode recusar (pagina maior que o teto). Numa inspecao isso e
  // informacao, nao parada: o operador quer o diagnostico inteiro, e "0 blocos"
  // ja diz o que precisa dizer.
  let blocos: BlocoDaProva[] = [];
  try {
    blocos = fatiarEmBlocos(pdf.paginas, orcamento, custoFixo);
  } catch {
    blocos = [];
  }

  return {
    paginas: pdf.totalDePaginas,
    caracteres: texto.length,
    temTextoNativo: pdf.temTextoNativo,
    legibilidade: medirLegibilidade(texto),
    imagens: pdf.paginas.reduce((soma, pagina) => soma + pagina.imagens.length, 0),
    blocos: blocos.length,
    tokensEstimados: blocos.reduce((soma, bloco) => soma + bloco.tokensEstimados, 0),
    // Uma pagina com texto de verdade, e nao a primeira: a capa da prova nao
    // diz nada sobre a qualidade da extracao.
    amostra: (pdf.paginas.find((pagina) => pagina.texto.length > 400)?.texto ?? texto)
      .slice(0, 600),
  };
}

/** O veredito, na forma de uma frase que decide se vale gastar. */
export function vereditoDaInspecao(inspecao: Inspecao): string {
  if (!inspecao.temTextoNativo) {
    return "SEM TEXTO NATIVO — cairia em precisa_ocr, sem gastar nada";
  }
  if (!inspecao.legibilidade.legivel) {
    return `ILEGIVEL — cairia em precisa_ocr (${inspecao.legibilidade.motivo})`;
  }
  if (inspecao.blocos === 0) {
    return "NAO FATIAVEL — alguma pagina sozinha nao cabe no teto de tokens";
  }
  return "PRONTA PARA EXTRAIR";
}

export function relatorioDaInspecao(inspecao: Inspecao): string {
  const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

  return [
    `  veredito:     ${vereditoDaInspecao(inspecao)}`,
    `  paginas:      ${inspecao.paginas}`,
    `  caracteres:   ${inspecao.caracteres}`,
    `  legibilidade: ${pct(inspecao.legibilidade.plausiveis)} de texto escrito, ` +
      `${pct(inspecao.legibilidade.vogais)} de vogais`,
    `  imagens JPEG: ${inspecao.imagens}`,
    `  blocos:       ${inspecao.blocos} (~${inspecao.tokensEstimados} tokens no total)`,
    "  amostra do texto extraido:",
    ...inspecao.amostra.split("\n").slice(0, 12).map((linha) => `    | ${linha}`),
  ].join("\n");
}

// ── Estado ──────────────────────────────────────────────────────────────────

export const CONSULTA_DO_ESTADO = `
  select bloco, status::text as status, primeira_pagina, ultima_pagina,
         questoes_aceitas, questoes_recusadas, erro
    from public.prova_lote
   where prova_id = $1
   order by bloco
`;

export type EstadoDoBloco = {
  bloco: number;
  status: string;
  primeiraPagina: number;
  ultimaPagina: number;
  aceitas: number;
  recusadas: number;
  erro: string | null;
};

export type EstadoDaProva = {
  prova: ProvaCatalogada;
  blocos: EstadoDoBloco[];
};

export async function estadoDaProva(
  cliente: ClienteSql,
  provaId: string,
): Promise<EstadoDaProva> {
  const prova = await lerProva(cliente, provaId);
  const { rows } = await cliente.query(CONSULTA_DO_ESTADO, [provaId]);

  return {
    prova,
    blocos: rows.map((linha) => ({
      bloco: Number(linha.bloco),
      status: String(linha.status),
      primeiraPagina: Number(linha.primeira_pagina),
      ultimaPagina: Number(linha.ultima_pagina),
      aceitas: Number(linha.questoes_aceitas),
      recusadas: Number(linha.questoes_recusadas),
      erro: linha.erro === null ? null : String(linha.erro),
    })),
  };
}

export function relatorioDoEstado(estado: EstadoDaProva): string {
  if (estado.blocos.length === 0) {
    return `  prova ${estado.prova.status}: nenhum bloco registrado (rode --acao enviar).`;
  }

  const linhas = estado.blocos.map((bloco) => {
    const paginas = `p.${bloco.primeiraPagina}-${bloco.ultimaPagina}`.padEnd(9);
    const status = bloco.status.padEnd(9);
    const questoes = `${bloco.aceitas} aceitas, ${bloco.recusadas} recusadas`;
    const erro = bloco.erro === null ? "" : `\n              motivo: ${bloco.erro}`;
    return `  bloco ${bloco.bloco}  ${paginas} ${status} ${questoes}${erro}`;
  });

  const presos = estado.blocos.filter((bloco) => bloco.status === "falhou");
  // Bloco `colhido` **com** motivo gravado e perda parcial: parte das paginas
  // entrou e parte se perdeu. E o caso que some sozinho, porque o bloco parece
  // pronto — e por isso ele tem aviso proprio.
  const parciais = estado.blocos.filter(
    (bloco) => bloco.status === "colhido" && bloco.erro !== null,
  );

  const avisos = [
    presos.length === 0
      ? null
      : `  ${presos.length} bloco(s) falhado(s). Rodar --acao enviar reenvia so eles.`,
    parciais.length === 0
      ? null
      : `  ${parciais.length} bloco(s) com perda PARCIAL: parte das paginas nao voltou. ` +
        "As questoes delas nao estao no acervo — o motivo esta na linha do bloco.",
  ].filter((aviso): aviso is string => aviso !== null);

  return [`  prova: ${estado.prova.status}`, ...linhas, ...avisos].join("\n");
}
