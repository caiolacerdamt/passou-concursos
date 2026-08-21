import { z } from "zod";

import type { ReferenciaEntregue } from "@/modules/acervo";

/** O nome enviado ao provedor junto do JSON Schema estrito. */
export const NOME_DO_FORMATO_DA_EXPLICACAO = "explicacao_conferida";

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
