import { z } from "zod";

import type { ReferenciaEntregue } from "@/modules/acervo";

import type { PedidoDeIa } from "./adaptador-openai";
import { montarChaveDeDedup } from "./gateway";

/** O nome enviado ao provedor junto do JSON Schema estrito. */
export const NOME_DO_FORMATO_DA_EXPLICACAO = "explicacao_conferida";

/** Instrução estável; a referência entra abaixo dela no mesmo pedido. */
export const INSTRUCAO_DA_EXPLICACAO = [
  "Você escreve a explicação de uma questão de concurso público brasileiro.",
  "",
  "Regras obrigatórias:",
  "- o gabarito oficial já foi decidido pelo acervo; não escolha nem altere a alternativa correta;",
  "- explique somente o raciocínio que pode ser apoiado pela referência entregue neste pedido;",
  "- cite pelo menos um trecho literal da referência, usando o doc_id recebido;",
  "- não use recurso de citação do provedor e não invente fonte, número, prazo ou regra;",
  "- quando a origem for 'minima', não afirme norma, prazo, percentual ou regra externa: omita;",
  "- devolva afirmacoes_externas como [] quando todo o texto estiver apoiado na referência.",
].join("\n");

const textoNaoVazio = z.string().trim().min(1);

export const fonteCitacaoDaExplicacaoSchema = z
  .object({
    doc_id: textoNaoVazio,
    trecho: textoNaoVazio,
  })
  .strict();

/**
 * O modelo precisa declarar também se tentou usar fatos externos. A lista
 * precisa voltar vazia: ela é uma trava explícita para a fonte mínima, que não
 * pode autorizar norma, prazo, percentual ou regra que não esteja no material.
 */
export const explicacaoGeradaSchema = z
  .object({
    texto: textoNaoVazio,
    alternativa_correta: textoNaoVazio,
    fontes_citadas: z.array(fonteCitacaoDaExplicacaoSchema).min(1),
    afirmacoes_externas: z.array(textoNaoVazio),
  })
  .strict();

export type FonteCitacaoDaExplicacao = z.infer<
  typeof fonteCitacaoDaExplicacaoSchema
>;
export type ExplicacaoGerada = z.infer<typeof explicacaoGeradaSchema>;

/** JSON Schema enviado ao provedor; o Zod abaixo é a segunda conferência local. */
export const SCHEMA_DA_EXPLICACAO: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: [
    "texto",
    "alternativa_correta",
    "fontes_citadas",
    "afirmacoes_externas",
  ],
  properties: {
    texto: { type: "string", description: "explicacao curta e objetiva" },
    alternativa_correta: {
      type: "string",
      description: "eco do gabarito oficial recebido no pedido",
    },
    fontes_citadas: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["doc_id", "trecho"],
        properties: {
          doc_id: { type: "string" },
          trecho: { type: "string" },
        },
      },
    },
    afirmacoes_externas: {
      type: "array",
      items: { type: "string" },
      description: "deve ser []: fatos sem suporte no documento não podem entrar",
    },
  },
};

export type QuestaoParaExplicacao = {
  respostaCorreta: string | null;
};

export type QuestaoParaPedidoDeExplicacao = QuestaoParaExplicacao & {
  id: string;
  questaoVersao: number;
  enunciado: string;
  alternativas: readonly { letra: string; texto: string }[] | null;
  gabaritoVersao: string | null;
};

export class QuestaoSemGabaritoParaExplicacao extends Error {
  constructor() {
    super("o pedido da explicacao exige resposta_correta e gabarito_versao");
    this.name = "QuestaoSemGabaritoParaExplicacao";
  }
}

export type MotivoDaRejeicaoDaExplicacao =
  | "saida_estruturada_invalida"
  | "gabarito_ausente"
  | "gabarito_contradito"
  | "afirmacao_externa_sem_fonte"
  | "documento_citacao_desconhecido"
  | "citacao_vazia"
  | "citacao_fora_da_fonte";

/** Erro operacional que o job transforma em pendência da fila humana. */
export class ExplicacaoRejeitada extends Error {
  readonly motivo: MotivoDaRejeicaoDaExplicacao;

  constructor(motivo: MotivoDaRejeicaoDaExplicacao, detalhe: string) {
    super(`explicacao rejeitada (${motivo}): ${detalhe}`);
    this.name = "ExplicacaoRejeitada";
    this.motivo = motivo;
  }
}

function alternativasDa(questao: QuestaoParaPedidoDeExplicacao): string {
  if (questao.alternativas === null) return "Formato: certo ou errado";
  return questao.alternativas
    .map((alternativa) => `${alternativa.letra}) ${alternativa.texto}`)
    .join("\n");
}

/** Monta o request provider-agnostic usado pela tarefa `explicacao`. */
export function montarPedidoDeExplicacao(
  questao: QuestaoParaPedidoDeExplicacao,
  referencia: ReferenciaEntregue,
): PedidoDeIa {
  if (questao.respostaCorreta === null || questao.gabaritoVersao === null) {
    throw new QuestaoSemGabaritoParaExplicacao();
  }

  const instrucao = [
    INSTRUCAO_DA_EXPLICACAO,
    "",
    `REFERÊNCIA ENTREGUE — doc_id: ${referencia.id}`,
    `origem: ${referencia.origem}`,
    referencia.conteudo,
  ].join("\n");

  const entrada = [
    `questao_id: ${questao.id}`,
    `questao_versao: ${questao.questaoVersao}`,
    `enunciado:\n${questao.enunciado}`,
    `alternativas:\n${alternativasDa(questao)}`,
    `gabarito oficial (${questao.gabaritoVersao}): ${questao.respostaCorreta}`,
    `responda usando somente o doc_id ${referencia.id}`,
  ].join("\n\n");

  return {
    instrucao,
    entrada,
    formato: {
      nome: NOME_DO_FORMATO_DA_EXPLICACAO,
      schema: SCHEMA_DA_EXPLICACAO,
    },
  };
}

export function alvoDaExplicacao(questao: QuestaoParaPedidoDeExplicacao): {
  questaoId: string;
  questaoVersao: number;
} {
  return { questaoId: questao.id, questaoVersao: questao.questaoVersao };
}

/** Usa exatamente a chave que o gateway consulta antes de chamar o provedor. */
export function chaveDedupDaExplicacao(
  questao: QuestaoParaPedidoDeExplicacao,
): string {
  return montarChaveDeDedup("explicacao", alvoDaExplicacao(questao)) as string;
}

/**
 * Normaliza apenas o que a regra da spec manda ignorar: caixa, acentuação,
 * pontuação e espaçamento. O texto original continua sendo o que gravamos.
 */
export function normalizarTrecho(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A fonte minima prova o que esta na propria questao e no gabarito, mas nao
 * autoriza uma afirmacao normativa por memoria. A lista e deliberadamente
 * conservadora: um falso positivo manda a explicacao para uma pessoa, enquanto
 * um falso negativo publicaria um fato sem fonte.
 */
const PADROES_DE_FATO_EXTERNO = [
  /\b(?:lei|decreto|resolucao|portaria|constituicao|codigo|sumula|legislacao)\b/,
  /\b(?:art|artigo|inciso|paragrafo|caput)\b/,
  /\b(?:prazo|vigencia|vencimento|prescricao|prescreve)\b/,
  /\b(?:dia|dias|mes|meses|ano|anos|hora|horas|semana|semanas)\b/,
  /(?:\d+(?:[.,]\d+)?)\s*%/,
  /\b(?:por cento|percentual|percentuais)\b/,
  /\b(?:regra|regras|norma|normas)\b/,
] as const;

function normalizarParaPolitica(texto: string): string {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function encontrarIndicioDeFatoExterno(texto: string): string | null {
  const normalizado = normalizarParaPolitica(texto);
  return PADROES_DE_FATO_EXTERNO.find((padrao) => padrao.test(normalizado))?.source ?? null;
}

function primeiroMotivo(erro: z.ZodError): string {
  const primeiro = erro.issues[0];
  if (primeiro === undefined) return "fora do contrato estruturado";
  const onde = primeiro.path.join(".");
  return onde ? `${onde}: ${primeiro.message}` : primeiro.message;
}

/**
 * Confere o conteúdo que o JSON Schema não consegue garantir.
 *
 * A alternativa correta nunca vem da IA: ela apenas repete o gabarito que já
 * foi entregue pelo acervo. A citação também não é aceita por confiança no
 * provedor; o código compara o trecho com a referência desta chamada.
 */
export function conferirExplicacao(
  bruto: unknown,
  questao: QuestaoParaExplicacao,
  referencia: ReferenciaEntregue,
): ExplicacaoGerada {
  const resultado = explicacaoGeradaSchema.safeParse(bruto);
  if (!resultado.success) {
    throw new ExplicacaoRejeitada(
      "saida_estruturada_invalida",
      primeiroMotivo(resultado.error),
    );
  }

  if (questao.respostaCorreta === null) {
    throw new ExplicacaoRejeitada(
      "gabarito_ausente",
      "não existe resposta oficial para conferir",
    );
  }

  if (resultado.data.alternativa_correta !== questao.respostaCorreta) {
    throw new ExplicacaoRejeitada(
      "gabarito_contradito",
      `a IA devolveu ${resultado.data.alternativa_correta}, mas o gabarito é ${questao.respostaCorreta}`,
    );
  }

  if (resultado.data.afirmacoes_externas.length > 0) {
    throw new ExplicacaoRejeitada(
      "afirmacao_externa_sem_fonte",
      "a saída declarou fato que não está no documento entregue",
    );
  }

  if (referencia.origem === "minima") {
    const indicio = encontrarIndicioDeFatoExterno(resultado.data.texto);
    if (indicio !== null) {
      throw new ExplicacaoRejeitada(
        "afirmacao_externa_sem_fonte",
        "a fonte minima nao autoriza norma, prazo, percentual ou regra externa",
      );
    }
  }

  for (const citacao of resultado.data.fontes_citadas) {
    if (citacao.doc_id !== referencia.id) {
      throw new ExplicacaoRejeitada(
        "documento_citacao_desconhecido",
        `a citação aponta para ${citacao.doc_id}, mas o pedido entregou ${referencia.id}`,
      );
    }

    const trecho = normalizarTrecho(citacao.trecho);
    if (trecho === "") {
      throw new ExplicacaoRejeitada(
        "citacao_vazia",
        "a citação não tem conteúdo comparável",
      );
    }

    if (!normalizarTrecho(referencia.conteudo).includes(trecho)) {
      throw new ExplicacaoRejeitada(
        "citacao_fora_da_fonte",
        "o trecho citado não existe na referência entregue",
      );
    }
  }

  return {
    ...resultado.data,
    fontes_citadas: resultado.data.fontes_citadas.map((citacao) => ({
      doc_id: citacao.doc_id.trim(),
      trecho: citacao.trecho.trim(),
    })),
  };
}
