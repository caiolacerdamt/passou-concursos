/**
 * Interface publica do modulo do acervo (M1 — BANCO-*).
 *
 * Monolito modular do AD-002: nada de fora importa arquivo interno deste modulo.
 * Alem do contrato de dados (SPEC 04), o modulo entrega o pipeline de ingestao
 * da SPEC 09: ler o PDF, fatiar, conferir o que o modelo devolveu, classificar
 * o topico, gravar e cruzar o gabarito.
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

export {
  type ImagemDoPdf,
  type PaginaDoPdf,
  type PdfLido,
  PdfIlegivel,
  lerPdf,
  textoDoConteudo,
} from "./pdf";

export {
  type BlocoDaProva,
  type OrcamentoDeTokens,
  PaginaMaiorQueOTeto,
  cabecalhoDaPagina,
  estimarTokens,
  fatiarEmBlocos,
  orcamentoPadrao,
  orcamentoVigente,
} from "./fatiamento";

export {
  type BlocoValidado,
  INSTRUCAO as INSTRUCAO_DA_EXTRACAO,
  NOME_DO_FORMATO,
  type QuestaoExtraida,
  type QuestaoRecusada,
  SCHEMA_DA_EXTRACAO,
  questaoExtraidaSchema,
  validarBloco,
} from "./extracao";

export {
  type Classificacao,
  type TopicoCanonico,
  casarTopico,
  classificar,
  lerCatalogo,
  normalizarNome,
} from "./classificacao";

export {
  type ContextoDaGravacao,
  type ProvaCatalogada,
  ProvaNaoCatalogada,
  type ResumoDaGravacao,
  type SubidorDeImagem,
  type BlocoPendente,
  blocosParaEnviar,
  caminhoDaImagem,
  fonteCitacaoDe,
  gravarQuestoes,
  lerProva,
  marcarProva,
  registrarBlocos,
} from "./ingestao";

export {
  type Gabarito,
  GabaritoInvalido,
  type ItemDoGabarito,
  type ResumoDoCruzamento,
  cruzarGabarito,
  lerGabarito,
} from "./gabarito";

export {
  type Legibilidade,
  PISO_DE_PLAUSIVEIS,
  PISO_DE_VOGAIS,
  medirLegibilidade,
} from "./legibilidade";

export {
  CONSULTA_DA_BASE_CONFERIDA,
  FonteMinimaSemGabarito,
  type DocumentoDeReferencia,
  type QuestaoParaReferencia,
  type ReferenciaEntregue,
  montarFonteMinima,
  selecionarReferencia,
} from "./base-referencia";

export {
  type ExplicacaoParaGravar,
  type ResultadoDaGravacao,
  gravarExplicacaoAprovada,
  gravarExplicacaoRejeitada,
} from "./explicacao";

export {
  CONSULTA_DO_ESTADO,
  type EstadoDaProva,
  type EstadoDoBloco,
  type Inspecao,
  estadoDaProva,
  inspecionar,
  relatorioDaInspecao,
  relatorioDoEstado,
  vereditoDaInspecao,
} from "./inspecao";

export {
  TIPOS_RECURSO_ESTUDO,
  type TipoRecursoEstudo,
  type RecursoParaCarga,
  type RecursoDeEstudo,
  lerRecursosCsv,
  lerRecursosJson,
  lerRecursosEstudo,
  consultarRecursosDoTopico,
  consultarRecursosAtivos,
} from "./recursos";

export {
  CONSULTA_DO_INVENTARIO_ACERVO,
  type LinhaDoInventarioAcervo,
  consultarInventarioAcervo,
} from "./relatorio";
