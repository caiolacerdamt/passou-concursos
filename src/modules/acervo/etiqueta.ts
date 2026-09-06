import { z } from "zod";

import { type TopicoCanonico, casarTopico } from "./classificacao";
import type { ItemSeparado } from "./itens";

/**
 * A etiqueta de item: a unidade de **medicao** do AD-138 (BANCO-14).
 *
 * O que este arquivo pede ao modelo e uma frase curta: *"para cada item, qual
 * assunto do catalogo?"*. Nao pede enunciado, nao pede alternativa, nao pede
 * gabarito — e por isso etiquetar uma prova inteira custou R$ 0,024 na medicao
 * do AD-138, contra o preco de montar acervo.
 *
 * **A IA sugere, o codigo casa.** O modelo devolve o *nome* do assunto; quem
 * transforma nome em `topico_id` e `casarTopico`, o mesmo da SPEC 09. Assunto
 * que nao existe na taxonomia vira candidato para a curadoria (SPEC 40) — nunca
 * um `insert into topicos`, que nao existe em lugar nenhum deste arquivo.
 *
 * O item vai **truncado** para o modelo. Reconhecer o assunto de uma questao
 * depende do comeco do enunciado, nao das alternativas: mandar o item inteiro
 * multiplicaria a entrada por tres para responder a mesma pergunta.
 */

/** Quantos caracteres de cada item vao ao modelo. */
export const CARACTERES_POR_ITEM = 600;

export const NOME_DO_FORMATO_DA_ETIQUETA = "etiquetas_de_item";

/** A saida estruturada do etiquetador (`json_schema` strict). */
export const SCHEMA_DA_ETIQUETA = {
  type: "object",
  additionalProperties: false,
  required: ["etiquetas"],
  properties: {
    etiquetas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["numero", "assunto", "materia", "confianca"],
        properties: {
          numero: { type: "integer" },
          assunto: { type: "string" },
          materia: { type: "string" },
          confianca: { type: "number" },
        },
      },
    },
  },
} as const satisfies Record<string, unknown>;

export const etiquetaSugeridaSchema = z.object({
  numero: z.number().int().positive(),
  assunto: z.string(),
  materia: z.string(),
  confianca: z.number().min(0).max(1),
});

export const etiquetasSugeridasSchema = z.object({
  etiquetas: z.array(etiquetaSugeridaSchema),
});

export type EtiquetaSugerida = z.infer<typeof etiquetaSugeridaSchema>;

export const INSTRUCAO_DA_ETIQUETA = [
  "Voce classifica itens de prova de concurso bancario por assunto.",
  "",
  "Para cada item recebido, devolva o assunto do CATALOGO abaixo que melhor o descreve,",
  "junto da materia daquele assunto e de uma confianca de 0 a 1.",
  "",
  "Regras:",
  "- Use o nome do assunto EXATAMENTE como esta no catalogo quando ele servir.",
  "- Quando nenhum assunto do catalogo servir, escreva o nome do assunto que voce",
  "  usaria, e baixe a confianca. NUNCA force um assunto do catalogo que nao e o do item.",
  "- Devolva uma linha para CADA item recebido, com o mesmo numero que veio.",
  "- Nao transcreva o enunciado, nao resolva a questao e nao diga qual e a alternativa correta.",
].join("\n");

/** O catalogo, na forma curta que vai no pedido. */
export function catalogoParaOPedido(
  catalogo: readonly TopicoCanonico[],
): string {
  const porMateria = new Map<string, string[]>();
  for (const topico of catalogo) {
    const lista = porMateria.get(topico.materiaNome) ?? [];
    lista.push(topico.nome);
    porMateria.set(topico.materiaNome, lista);
  }
  return [...porMateria.entries()]
    .map(([materia, assuntos]) => `${materia}: ${assuntos.join("; ")}`)
    .join("\n");
}

/**
 * A instrucao completa de um pedido — parte **estavel** e por isso separada.
 *
 * Catalogo e instrucao vao juntos no trecho estavel de proposito: e o mesmo
 * texto em todos os lotes da mesma prova, e e o que o prompt caching cobra a
 * 0,1x (IA-02 AC9).
 */
export function instrucaoComCatalogo(
  catalogo: readonly TopicoCanonico[],
): string {
  return `${INSTRUCAO_DA_ETIQUETA}\n\nCATALOGO DE ASSUNTOS:\n${catalogoParaOPedido(catalogo)}`;
}

/** A parte variavel: os itens deste lote, truncados. */
export function entradaDoPedido(itens: readonly ItemSeparado[]): string {
  return itens
    .map((item) => `[${item.numero}] ${item.texto.slice(0, CARACTERES_POR_ITEM)}`)
    .join("\n\n");
}

/** Quebra os itens em lotes do tamanho que a configuracao mandar. */
export function lotesDeItens(
  itens: readonly ItemSeparado[],
  tamanho: number,
): ItemSeparado[][] {
  if (tamanho < 1) throw new Error("o lote de itens precisa de pelo menos 1 item");
  const lotes: ItemSeparado[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) {
    lotes.push(itens.slice(i, i + tamanho));
  }
  return lotes;
}

/** Uma etiqueta pronta para o banco, ja casada com o assunto canonico. */
export type EtiquetaCasada = {
  numero: number;
  topicoId: string;
  confianca: number;
};

export type CasamentoDeEtiquetas = {
  casadas: EtiquetaCasada[];
  /** Sugestoes que nao existem na taxonomia: viram candidato na curadoria. */
  naoCasadas: { numero: number; assunto: string; materia: string }[];
};

/**
 * Casa as sugestoes com a taxonomia canonica.
 *
 * Item que veio duas vezes na resposta fica com a **primeira** ocorrencia: a
 * chave `(prova, numero)` e unica no banco, e escolher em silencio no `insert`
 * esconderia um modelo que se contradisse.
 */
export function casarEtiquetas(
  sugestoes: readonly EtiquetaSugerida[],
  catalogo: readonly TopicoCanonico[],
  itensPedidos: readonly number[],
): CasamentoDeEtiquetas {
  const permitidos = new Set(itensPedidos);
  const vistos = new Set<number>();
  const casadas: EtiquetaCasada[] = [];
  const naoCasadas: CasamentoDeEtiquetas["naoCasadas"] = [];

  for (const sugestao of sugestoes) {
    // Numero que ninguem pediu e alucinacao de indice: entra como etiqueta de um
    // item que talvez nem exista na prova.
    if (!permitidos.has(sugestao.numero) || vistos.has(sugestao.numero)) continue;
    vistos.add(sugestao.numero);

    const topico = casarTopico(sugestao.assunto, sugestao.materia, catalogo);
    if (topico === null) {
      naoCasadas.push({
        numero: sugestao.numero,
        assunto: sugestao.assunto,
        materia: sugestao.materia,
      });
      continue;
    }

    casadas.push({
      numero: sugestao.numero,
      topicoId: topico.id,
      confianca: sugestao.confianca,
    });
  }

  return { casadas, naoCasadas };
}

/** A forma que `gravar_etiquetas_ia` espera no `jsonb`. */
export function etiquetasParaOBanco(
  etiquetas: readonly EtiquetaCasada[],
): Record<string, unknown>[] {
  return etiquetas.map((e) => ({
    numero: e.numero,
    topico_id: e.topicoId,
    confianca: e.confianca,
  }));
}

// ── A reserva: separacao por modelo (BANCO-16 AC3) ──────────────────────────
//
// Ela nao devolve o item inteiro. Devolve, por item, o **trecho inicial** do
// enunciado copiado literalmente — e o codigo procura esse trecho no texto e
// corta ali. Duas razoes: a saida fica pequena (60 itens x 80 caracteres em vez
// da prova reescrita), e quem corta continua sendo o nosso codigo, entao um
// modelo que invente texto nao consegue inserir enunciado nenhum no acervo.

export const NOME_DO_FORMATO_DA_SEPARACAO = "itens_da_prova";

export const SCHEMA_DA_SEPARACAO = {
  type: "object",
  additionalProperties: false,
  required: ["itens"],
  properties: {
    itens: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["numero", "trecho_inicial"],
        properties: {
          numero: { type: "integer" },
          trecho_inicial: { type: "string" },
        },
      },
    },
  },
} as const satisfies Record<string, unknown>;

export const itensSeparadosPorModeloSchema = z.object({
  itens: z.array(
    z.object({ numero: z.number().int().positive(), trecho_inicial: z.string().min(4) }),
  ),
});

export const INSTRUCAO_DA_SEPARACAO = [
  "Voce localiza onde comeca cada questao objetiva no texto de uma prova.",
  "",
  "Para cada questao, devolva o numero impresso e o TRECHO INICIAL do enunciado:",
  "as primeiras palavras do enunciado, copiadas LITERALMENTE do texto recebido.",
  "",
  "Regras:",
  "- Copie o trecho exatamente como esta, sem corrigir, sem resumir e sem traduzir.",
  "- Nao invente questao que nao esta no texto e nao pule questao que esta.",
  "- Ignore numero de pagina, cabecalho e rodape.",
].join("\n");

/**
 * Corta o texto nos trechos que o modelo apontou.
 *
 * Trecho que nao e achado **no texto** e descartado: o modelo pode ter
 * parafraseado, e um corte por trecho inventado produziria um item cujo texto
 * nao e o da prova. O que sobra e sempre um recorte do documento original.
 */
export function cortarPorTrechos(
  paginas: readonly { numero: number; texto: string }[],
  apontados: readonly { numero: number; trecho_inicial: string }[],
): ItemSeparado[] {
  const texto = paginas.map((p) => p.texto).join("\n");
  const paginaDe = (posicao: number): number => {
    let acumulado = 0;
    for (const pagina of paginas) {
      acumulado += pagina.texto.length + 1;
      if (posicao < acumulado) return pagina.numero;
    }
    return paginas[paginas.length - 1]?.numero ?? 1;
  };

  const achados = apontados
    .map((apontado) => ({
      numero: apontado.numero,
      posicao: texto.indexOf(apontado.trecho_inicial.trim()),
    }))
    .filter((a) => a.posicao >= 0)
    .sort((a, b) => a.posicao - b.posicao);

  return achados.map((achado, i) => ({
    numero: achado.numero,
    texto: texto.slice(achado.posicao, achados[i + 1]?.posicao ?? texto.length).trim(),
    pagina: paginaDe(achado.posicao),
  }));
}
