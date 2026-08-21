import { z } from "zod";

import { LETRAS, alternativasSchema, alternativasValidasParaTipo } from "./contrato";
import { TIPO_QUESTAO } from "./contrato";

/**
 * O contrato da extracao PDF -> JSON (BANCO-03 AC1).
 *
 * Duas metades que precisam existir separadas:
 *
 * - **`SCHEMA_DA_EXTRACAO`** e o que vai ao modelo como saida estruturada
 *   (`json_schema` `strict`). Ele impede a forma errada.
 * - **`questaoExtraidaSchema`** e o que conferimos aqui, depois. Ele impede o
 *   **conteudo** errado: letra repetida, confianca fora de 0-1, certo-errado com
 *   alternativa. Saida estruturada garante campo, nao garante coerencia.
 *
 * O que **nao** existe em nenhuma das duas: `status`, `resposta_correta` e
 * `fonte_citacao`. Nao e esquecimento. O gabarito e do cruzamento (BANCO-04) e
 * nunca da IA (invariante nº4); a proveniencia sai da linha da prova, que um
 * humano catalogou; e o status quem escolhe e a persistencia, entre `rascunho`
 * e `em_revisao` — `publicada` nao e alcancavel a partir daqui.
 */

/**
 * O trecho **estavel** do pedido: e ele que o prompt caching reaproveita a 0,1x
 * da entrada (IA-02 AC9). Mudou este texto? Suba `VERSAO_DO_PROMPT.extracao_pdf`
 * — a versao entra na chave de dedup, e e assim que a fabrica reprocessa o que
 * precisa ser reprocessado, e so isso.
 */
export const INSTRUCAO = [
  "Voce transcreve questoes de uma prova oficial de concurso publico brasileiro.",
  "O texto abaixo saiu do PDF da prova, pagina a pagina, com um cabecalho",
  "'--- pagina N ---' antes de cada uma.",
  "",
  "Regras:",
  "- transcreva **literalmente**; nao corrija, nao resuma e nao reescreva enunciado;",
  "- `numero` e o numero **oficial impresso** na prova, nunca a ordem de leitura;",
  "- questao de certo-errado nao tem alternativas: devolva null;",
  "- questao de multipla escolha tem as alternativas com a letra impressa (A a E);",
  "- `confianca_ia` de 0 a 1 e o quanto voce confia nesta transcricao;",
  "- `dificuldade` de 1 a 5 e uma estimativa; na duvida use 3;",
  "- `topico_sugerido` e `materia_sugerida` sao palpite de assunto, em portugues;",
  "- `tem_imagem` e true quando a questao depende de grafico, tabela ou figura;",
  "- `truncada` e true quando a questao comeca ou termina fora deste trecho;",
  "- **nao invente questao**: se o trecho nao tem nenhuma, devolva a lista vazia.",
].join("\n");

/** O nome da saida estruturada, que a Responses API exige junto do schema. */
export const NOME_DO_FORMATO = "questoes_extraidas";

const texto = { type: "string" } as const;

/**
 * O JSON Schema que vai ao provedor.
 *
 * `strict: true` exige `additionalProperties: false` e **todo** campo em
 * `required` — inclusive os que podem vir nulos, que declaram o nulo no proprio
 * tipo. Faixa numerica fica de fora de proposito: nem todo provedor a honra em
 * modo estrito, e ela e conferida do lado de ca por `questaoExtraidaSchema`.
 */
export const SCHEMA_DA_EXTRACAO: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["questoes"],
  properties: {
    questoes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "numero",
          "tipo_questao",
          "enunciado",
          "alternativas",
          "materia_sugerida",
          "topico_sugerido",
          "dificuldade",
          "confianca_ia",
          "tem_imagem",
          "pagina",
          "truncada",
        ],
        properties: {
          numero: { type: "integer", description: "o numero impresso na prova" },
          tipo_questao: { type: "string", enum: [...TIPO_QUESTAO] },
          enunciado: texto,
          alternativas: {
            type: ["array", "null"],
            items: {
              type: "object",
              additionalProperties: false,
              required: ["letra", "texto"],
              properties: { letra: { type: "string", enum: [...LETRAS] }, texto },
            },
          },
          materia_sugerida: texto,
          topico_sugerido: texto,
          dificuldade: { type: "integer" },
          confianca_ia: { type: "number" },
          tem_imagem: { type: "boolean" },
          pagina: { type: "integer" },
          truncada: { type: "boolean" },
        },
      },
    },
  },
};

// ── A conferencia do lado de ca ─────────────────────────────────────────────

const naoVazio = z.string().trim().min(1);

export const questaoExtraidaSchema = z
  .object({
    numero: z.number().int().positive(),
    tipo_questao: z.enum(TIPO_QUESTAO),
    enunciado: naoVazio,
    alternativas: alternativasSchema.nullable(),
    materia_sugerida: z.string().trim(),
    topico_sugerido: z.string().trim(),
    dificuldade: z.number().int().min(1).max(5),
    confianca_ia: z.number().min(0).max(1),
    tem_imagem: z.boolean(),
    pagina: z.number().int().positive(),
    truncada: z.boolean(),
  })
  .refine(
    (questao) =>
      alternativasValidasParaTipo(questao.tipo_questao, questao.alternativas),
    "alternativas nao combinam com o tipo da questao",
  );

export type QuestaoExtraida = z.infer<typeof questaoExtraidaSchema>;

export const respostaDaExtracaoSchema = z.object({
  questoes: z.array(z.unknown()),
});

/** Uma questao que nao entra, e por que. Vai para o log, nunca para o banco. */
export type QuestaoRecusada = { numero: number | null; motivo: string };

export type BlocoValidado = {
  aceitas: QuestaoExtraida[];
  recusadas: QuestaoRecusada[];
};

/**
 * Confere o que o modelo devolveu para um bloco.
 *
 * **Uma questao ruim nao derruba as irmas.** Um bloco tem dezenas de questoes e
 * vem de um pedido ja pago; descartar as 39 boas porque a 40ª veio torta seria
 * jogar dinheiro fora e adiar o acervo. A recusada vai nomeada para o log, que e
 * o que permite o operador ir olhar aquela questao na prova.
 *
 * @throws quando a **resposta inteira** nao tem a forma esperada — ai nao ha o
 *         que aproveitar, e o bloco volta para a fila.
 */
export function validarBloco(bruto: unknown): BlocoValidado {
  const envelope = respostaDaExtracaoSchema.safeParse(bruto);
  if (!envelope.success) {
    throw new Error(
      "a extracao nao devolveu { questoes: [...] }: a resposta do bloco inteiro e inaproveitavel",
    );
  }

  const aceitas: QuestaoExtraida[] = [];
  const recusadas: QuestaoRecusada[] = [];

  for (const crua of envelope.data.questoes) {
    const numero = numeroDeclarado(crua);
    const conferida = questaoExtraidaSchema.safeParse(crua);

    if (!conferida.success) {
      recusadas.push({ numero, motivo: primeiroMotivo(conferida.error) });
      continue;
    }

    // Questao partida entre dois blocos entra pela metade, e meia questao no
    // acervo parece inteira. O bloco vizinho a traz completa; e la que ela entra.
    if (conferida.data.truncada) {
      recusadas.push({
        numero: conferida.data.numero,
        motivo: "a questao esta truncada neste bloco",
      });
      continue;
    }

    aceitas.push(conferida.data);
  }

  return { aceitas, recusadas };
}

function numeroDeclarado(crua: unknown): number | null {
  const numero = (crua as { numero?: unknown } | null)?.numero;
  return typeof numero === "number" && Number.isInteger(numero) ? numero : null;
}

function primeiroMotivo(erro: z.ZodError): string {
  const primeiro = erro.issues[0];
  if (primeiro === undefined) return "questao fora do contrato do acervo";
  const onde = primeiro.path.join(".");
  return onde ? `${onde}: ${primeiro.message}` : primeiro.message;
}
