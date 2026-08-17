/**
 * Interface publica do modulo do acervo (M1 — BANCO-*).
 *
 * Monolito modular do AD-002: nada de fora importa arquivo interno deste modulo.
 * Hoje o modulo e so contrato de dados — o pipeline de ingestao entra na SPEC 08.
 */
export {
  type Alternativa,
  DIMENSAO_EMBEDDING,
  ENUMS_DO_ACERVO,
  type FonteCitacao,
  type Imagem,
  LETRAS,
  type Letra,
  ORIGEM_QUESTAO,
  POSICAO_DA_IMAGEM,
  type OrigemQuestao,
  STATUS_CANDIDATO,
  STATUS_PROVA,
  STATUS_QUESTAO,
  type StatusCandidato,
  type StatusProva,
  type StatusQuestao,
  TIPO_MUDANCA,
  TIPO_QUESTAO,
  type TipoMudanca,
  type TipoQuestao,
  alternativaSchema,
  alternativasSchema,
  alternativasValidasParaTipo,
  fonteCitacaoSchema,
  imagemSchema,
  imagensSchema,
  respostaValidaParaTipo,
} from "./contrato";
