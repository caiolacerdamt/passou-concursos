/**
 * Interface publica do modulo de IA (IA-02).
 *
 * **Nenhuma chamada de IA do produto acontece fora daqui.** Spec que precisar
 * de tarefa nova acrescenta linha na matriz de configuracao e um nome em
 * `TAREFAS`; nunca um cliente novo do provedor.
 */
export {
  TAREFA_DE_REFAZER,
  TAREFAS,
  VERSAO_DO_PROMPT,
  type Tarefa,
  existeTarefa,
} from "./tarefas";

export {
  type DestinoDeIa,
  type PerfilDeTarefa,
  TarefaSemPerfil,
  fallbackDe,
  perfilDaTarefa,
  principalDe,
} from "./matriz";

export {
  type Adaptador,
  type PedidoDeIa,
  type RespostaDeIa,
  SemChaveDaOpenAI,
  montarLinhaDeLote,
  tetoDeSaidaDe,
} from "./adaptador-openai";

export {
  type AlvoDaTarefa,
  type ChamadaDeTarefa,
  GatewayParou,
  type GeracaoGuardada,
  type RegistroDeGeracao,
  type RepositorioDeIa,
  type ResultadoDaTarefa,
  TarefaEhDeLote,
  TarefaNaoEhDeLote,
  definirAdaptador,
  definirRepositorioDeIa,
  executarTarefa,
  geracaoJaExiste,
  montarChaveDeDedup,
  registrarGeracaoDeLote,
  restaurarAdaptadorPadrao,
  restaurarRepositorioAusente,
} from "./gateway";

/**
 * O lote (SPEC 09). A SPEC 08 montou a linha JSONL e parou ali; o envio e a
 * colheita moram aqui, junto da spec que tem volume para exercita-los.
 */
export {
  type ClienteDeLote,
  type Colheita,
  ENDPOINT_DO_LOTE,
  type EstadoDoLote,
  type LinhaColhida,
  type LoteMontado,
  LoteFalhou,
  type PedidoDeLote,
  SUFIXO_DE_PAGINA,
  chaveDaPagina,
  chaveDoBloco,
  chaveDoBlocoDe,
  colherLote,
  definirClienteDeLote,
  enviarLote,
  juntarPaginas,
  lerSaida,
  montarLote,
  restaurarClienteDeLotePadrao,
  textoDaResposta,
} from "./lote";

export { type Conferidor, type ResultadoDeRefazer, refazerUmaVez } from "./refazer";

export {
  ExplicacaoRejeitada,
  NOME_DO_FORMATO_DA_EXPLICACAO,
  SCHEMA_DA_EXPLICACAO,
  type ExplicacaoGerada,
  type FonteCitacaoDaExplicacao,
  type MotivoDaRejeicaoDaExplicacao,
  type QuestaoParaExplicacao,
  conferirExplicacao,
  explicacaoGeradaSchema,
  fonteCitacaoDaExplicacaoSchema,
  normalizarTrecho,
} from "./explicacao";

export { type ContadorDeGasto, calcularCusto, conferirGasto, periodoDe } from "./gasto";

export {
  type ClienteSql,
  leitorDeConfigPorPg,
  repositorioPorPg,
} from "./repositorio-pg";
