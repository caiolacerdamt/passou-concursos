/** API server-side da mesa editorial do operador. */
export {
  EntradaDoOperadorInvalida,
  FalhaNaOperacaoDoOperador,
  OperadorNaoAutorizado,
  comOperador,
  exigirOperadorAtivo,
} from "./fronteira";
export type {
  ClienteDoOperador,
  ContextoDoOperador,
  MotivoDeAcessoNegado,
  OperadorAutorizado,
} from "./fronteira";

export {
  consultarCandidatosDeTopico,
  consultarConfiguracoes,
  consultarFilaRevisao,
  consultarRecursosEstudo,
  consultarTaxonomia,
} from "./consultas";

export {
  alterarConfiguracao,
  corrigirQuestao,
  decidirRevisoesEmLote,
  decidirTopicoCandidato,
  editarTaxonomia,
  salvarRecursoEstudo,
} from "./comandos";

export type {
  AlteracaoDeConfiguracaoInput,
  CandidatoDeTopico,
  CorrecaoDeQuestaoInput,
  DecisaoDaFila,
  DecisaoDaFilaInput,
  DecisaoDeCandidatoInput,
  EdicaoDeTaxonomiaInput,
  RecursoEstudoInput,
  MateriaDoOperador,
  QuestaoDaFila,
  ResultadoDaConfiguracao,
  RevisaoDaFila,
  TaxonomiaDoOperador,
  TopicoDoOperador,
} from "./contratos";
