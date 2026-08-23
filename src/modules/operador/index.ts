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
  consultarTaxonomia,
} from "./consultas";

export {
  alterarConfiguracao,
  corrigirQuestao,
  decidirRevisoesEmLote,
  decidirTopicoCandidato,
  editarTaxonomia,
} from "./comandos";

export type {
  AlteracaoDeConfiguracaoInput,
  CandidatoDeTopico,
  CorrecaoDeQuestaoInput,
  DecisaoDaFila,
  DecisaoDaFilaInput,
  DecisaoDeCandidatoInput,
  EdicaoDeTaxonomiaInput,
  MateriaDoOperador,
  QuestaoDaFila,
  ResultadoDaConfiguracao,
  RevisaoDaFila,
  TaxonomiaDoOperador,
  TopicoDoOperador,
} from "./contratos";
