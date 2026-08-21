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
 *
 * ## O texto-base vem separado, e quem junta e este arquivo
 *
 * Um grupo de questoes de interpretacao se apoia num texto (um artigo, um poema,
 * uma reportagem em ingles). A questao sozinha, sem esse texto, e impossivel de
 * responder — e ela vai ser servida sozinha a um aluno.
 *
 * A primeira versao mandava o modelo **copiar o texto dentro de cada questao**.
 * Funcionava e custou caro: na Prova C do BB 2021, uma pagina de Lingua Inglesa
 * com cinco questoes sobre uma reportagem a respeito de aparicoes aereas fez o
 * modelo reescrever a reportagem cinco vezes, e o **filtro de conteudo do
 * provedor cortou a geracao** (`incomplete_details.reason = "content_filter"`).
 * O bloco inteiro morria, sempre no mesmo lugar — reenviar nao adiantava.
 *
 * Agora o modelo transcreve cada texto-base **uma vez**, em `textos_base`, e a
 * questao aponta para ele por `texto_base_id`. **`validarBloco` faz a juncao**
 * antes de gravar, entao a coluna `enunciado` continua autocontida e o banco nao
 * muda. Medido: a mesma pagina passa a voltar completa, com as 5 questoes.
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
  "",
  "O texto vem de um PDF de duas colunas, e isso deixa tres marcas que voce SHALL",
  "tratar, porque nenhuma delas esta na prova impressa:",
  "- **palavra partida por hifen no fim da linha** ('pa-' + 'ragrafo'): junte de",
  "  volta em 'paragrafo'. Hifen que faz parte da palavra ('bem-vindo') fica;",
  "- **cabecalho e rodape repetidos** em toda pagina (nome do orgao, do cargo, da",
  "  prova, do gabarito, e o numero da pagina solto): ignore, nao sao enunciado;",
  "- **numeros de linha do texto de apoio**, que aparecem sozinhos em sequencia",
  "  (1, 2, 3, 4...) ao lado de um texto para leitura: NAO sao numero de questao.",
  "  Numero de questao vem imediatamente antes do enunciado dela.",
  "",
  "Pagina de redacao, de rascunho ou de instrucoes gerais nao tem questao nenhuma.",
  "",
  "**Texto-base.** Quando um grupo de questoes se apoia num mesmo texto de leitura",
  "(um artigo, um poema, uma tabela, uma reportagem em ingles), transcreva esse",
  "texto **uma unica vez** em `textos_base`, com um `id` curto seu ('T1', 'T2'), e",
  "ponha esse `id` em `texto_base_id` de cada questao que depende dele. **NAO**",
  "repita o texto dentro do `enunciado`: quem junta as duas partes e o sistema que",
  "le esta resposta. Questao que nao depende de texto-base leva `texto_base_id`",
  "nulo. A prova e transcrita para estudo, e a transcricao e literal — inclusive",
  "quando o assunto do texto e polemico.",
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
  required: ["textos_base", "questoes"],
  properties: {
    textos_base: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "conteudo"],
        properties: {
          id: { type: "string", description: "rotulo curto, referenciado pelas questoes" },
          conteudo: texto,
        },
      },
    },
    questoes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "numero",
          "tipo_questao",
          "enunciado",
          "texto_base_id",
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
          texto_base_id: {
            type: ["string", "null"],
            description: "o id em textos_base, ou null quando a questao nao depende de um",
          },
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
    texto_base_id: z.string().nullable().optional(),
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

const textoBaseSchema = z.object({ id: z.string().trim().min(1), conteudo: naoVazio });

export const respostaDaExtracaoSchema = z.object({
  textos_base: z.array(z.unknown()).optional(),
  questoes: z.array(z.unknown()),
});

/** Uma questao que nao entra, e por que. Vai para o log, nunca para o banco. */
export type QuestaoRecusada = { numero: number | null; motivo: string };

export type BlocoValidado = {
  aceitas: QuestaoExtraida[];
  recusadas: QuestaoRecusada[];
};

/** Separa o texto-base do comando da questao dentro do enunciado gravado. */
export const SEPARADOR_DO_TEXTO_BASE = "\n\n";

/**
 * Confere o que o modelo devolveu para um bloco, e junta o texto-base.
 *
 * **Uma questao ruim nao derruba as irmas.** Um bloco tem dezenas de questoes e
 * vem de um pedido ja pago; descartar as 39 boas porque a 40ª veio torta seria
 * jogar dinheiro fora e adiar o acervo. A recusada vai nomeada para o log, que e
 * o que permite o operador ir olhar aquela questao na prova.
 *
 * `texto_base_id` que nao existe em `textos_base` **nao derruba a questao**: ela
 * entra sem o texto. O comando da questao continua sendo o que a banca escreveu,
 * e questao de interpretacao sem o texto e problema da revisao humana (SPEC 10),
 * nao motivo para jogar fora o que foi pago.
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

  const textos = new Map<string, string>();
  for (const cru of envelope.data.textos_base ?? []) {
    const conferido = textoBaseSchema.safeParse(cru);
    if (conferido.success) textos.set(conferido.data.id, conferido.data.conteudo);
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

    aceitas.push(comTextoBase(conferida.data, textos));
  }

  return { aceitas, recusadas };
}

/**
 * Junta o texto-base ao enunciado.
 *
 * A juncao acontece **aqui**, e nao no modelo, porque foi pedir ao modelo que
 * ele repetisse o texto que fez o filtro de conteudo do provedor cortar a
 * geracao — e porque repetir o mesmo texto cinco vezes e cinco vezes o custo de
 * saida. O resultado gravado e identico: `enunciado` autocontido.
 */
function comTextoBase(
  questao: QuestaoExtraida,
  textos: ReadonlyMap<string, string>,
): QuestaoExtraida {
  const id = questao.texto_base_id;
  if (id == null) return questao;

  const base = textos.get(id);
  if (base === undefined) return questao;

  // Modelo que ignorou a instrucao e copiou o texto assim mesmo nao vira
  // enunciado com o texto duas vezes.
  if (questao.enunciado.includes(base.slice(0, 120))) return questao;

  return {
    ...questao,
    enunciado: base + SEPARADOR_DO_TEXTO_BASE + questao.enunciado,
  };
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
