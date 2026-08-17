import { z } from "zod";

/**
 * Contrato de dados do acervo (AD-039 identidade/enums, AD-040 formato).
 *
 * Este arquivo e o **espelho em TypeScript** do que a tabela `questoes` aceita.
 * Existe por dois motivos concretos, e nenhum deles e gosto:
 *
 * 1. **Quem escreve valida antes de bater no banco.** A SPEC 08 vai receber JSON
 *    de um modelo e inserir em lote. Descobrir formato errado por `CHECK`
 *    violado no meio de 120 questoes e caro; validar antes e o padrao que o
 *    projeto ja usa em `src/modules/config/catalogo.ts`.
 * 2. **`CHECK` de jsonb nao alcanca tudo.** O banco consegue exigir "e array" e
 *    "tem estas chaves"; exigir "cada item tem `letra` em A-E, sem letra
 *    repetida, com texto nao vazio" em SQL fica ilegivel.
 *
 * As duas pontas seguram, e ha teste conferindo que continuam dizendo a mesma
 * coisa — mesma reparticao de trabalho do `PADRAO_DA_CHAVE` da SPEC 02.
 */

// ── Enums (AD-039). A ordem e a mesma do `create type` da migracao. ──────────

export const TIPO_QUESTAO = ["multipla_escolha", "certo_errado"] as const;
export const ORIGEM_QUESTAO = ["real", "gerada_ia"] as const;
export const STATUS_QUESTAO = [
  "rascunho",
  "em_revisao",
  "publicada",
  "rejeitada",
  "precisa_ocr",
] as const;
export const TIPO_MUDANCA = ["cosmetica", "substantiva"] as const;
export const STATUS_PROVA = [
  "catalogada",
  "extraindo",
  "extraida",
  "gabarito_cruzado",
  "concluida",
  "precisa_ocr",
  "falhou",
] as const;
export const STATUS_CANDIDATO = ["pendente", "aprovado", "rejeitado"] as const;

export type TipoQuestao = (typeof TIPO_QUESTAO)[number];
export type OrigemQuestao = (typeof ORIGEM_QUESTAO)[number];
export type StatusQuestao = (typeof STATUS_QUESTAO)[number];
export type TipoMudanca = (typeof TIPO_MUDANCA)[number];
export type StatusProva = (typeof STATUS_PROVA)[number];
export type StatusCandidato = (typeof STATUS_CANDIDATO)[number];

/** Os enums e o nome do tipo Postgres correspondente. O teste de banco compara. */
export const ENUMS_DO_ACERVO = {
  tipo_questao: TIPO_QUESTAO,
  origem_questao: ORIGEM_QUESTAO,
  status_questao: STATUS_QUESTAO,
  tipo_mudanca: TIPO_MUDANCA,
  status_prova: STATUS_PROVA,
  status_candidato: STATUS_CANDIDATO,
} as const;

// ── Dimensao do embedding ────────────────────────────────────────────────────

/**
 * Cohere `embed-v4`, dimensao default do fornecedor (AD-005/AD-040), confirmada
 * em fonte primaria em 2026-08-17. E o mesmo numero do `vector(1536)` da coluna:
 * trocar exige `alter table` **e** re-embeddar o acervo em lote, entao o valor
 * NAO vive na tabela de configuracao — config nao muda tipo de coluna, e duas
 * fontes para o mesmo numero divergiriam.
 */
export const DIMENSAO_EMBEDDING = 1536;

// ── Formato dos jsonb (AD-040) ───────────────────────────────────────────────

export const LETRAS = ["A", "B", "C", "D", "E"] as const;
export type Letra = (typeof LETRAS)[number];

const textoNaoVazio = z.string().trim().min(1);

export const alternativaSchema = z.object({
  letra: z.enum(LETRAS),
  texto: textoNaoVazio,
});

/**
 * `alternativas` de multipla escolha. Nao vale para certo-errado, onde a coluna
 * e NULL (o banco recusa array la).
 *
 * Letra repetida e o erro que o `CHECK` do banco nao pega e que quebraria a tela:
 * duas alternativas "C" e uma questao que nao da para responder.
 */
export const alternativasSchema = z
  .array(alternativaSchema)
  .min(2, "questao de multipla escolha tem pelo menos duas alternativas")
  .max(LETRAS.length)
  .refine(
    (lista) => new Set(lista.map((a) => a.letra)).size === lista.length,
    "letra de alternativa repetida",
  );

export const POSICAO_DA_IMAGEM = /^(enunciado|alternativa_[A-E])$/;

export const imagemSchema = z.object({
  /** Caminho no Supabase Storage (AD-041). */
  storage_path: textoNaoVazio,
  posicao: z
    .string()
    .regex(POSICAO_DA_IMAGEM, "posicao e 'enunciado' ou 'alternativa_X' com X em A-E"),
  /** Acessibilidade: imagem sem descricao e questao que o leitor de tela nao le. */
  alt_text: textoNaoVazio,
});

export const imagensSchema = z.array(imagemSchema);

/**
 * Proveniencia (AD-040/BANCO-01). As cinco chaves sao obrigatorias juntas: a
 * proveniencia e o conjunto, nao o campo — o mesmo que o `CHECK`
 * `fonte_citacao_completa` cobra do lado do banco.
 */
export const fonteCitacaoSchema = z.object({
  banca: textoNaoVazio,
  ano: z.number().int().min(1990).max(2100),
  orgao: textoNaoVazio,
  cargo: textoNaoVazio,
  numero: z.number().int().positive(),
});

export type Alternativa = z.infer<typeof alternativaSchema>;
export type Imagem = z.infer<typeof imagemSchema>;
export type FonteCitacao = z.infer<typeof fonteCitacaoSchema>;

// ── Regras de coerencia entre campos ─────────────────────────────────────────

/**
 * A letra do gabarito existe no tipo da questao? Espelha o `CHECK`
 * `resposta_conforme_tipo`: A-E para multipla, C/E para certo-errado.
 */
export function respostaValidaParaTipo(
  tipo: TipoQuestao,
  resposta: string,
): boolean {
  return tipo === "multipla_escolha"
    ? (LETRAS as readonly string[]).includes(resposta)
    : resposta === "C" || resposta === "E";
}

/**
 * `alternativas` combina com o tipo? Espelha o `CHECK`
 * `alternativas_conforme_tipo`: multipla tem lista, certo-errado nao tem nenhuma.
 */
export function alternativasValidasParaTipo(
  tipo: TipoQuestao,
  alternativas: unknown,
): boolean {
  if (tipo === "certo_errado") {
    return alternativas === null || alternativas === undefined;
  }
  return alternativasSchema.safeParse(alternativas).success;
}
