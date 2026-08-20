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
  definirAdaptador,
  definirRepositorioDeIa,
  executarTarefa,
  montarChaveDeDedup,
  restaurarAdaptadorPadrao,
  restaurarRepositorioAusente,
} from "./gateway";

export { type Conferidor, type ResultadoDeRefazer, refazerUmaVez } from "./refazer";

export { type ContadorDeGasto, calcularCusto, conferirGasto, periodoDe } from "./gasto";

export {
  type ClienteSql,
  leitorDeConfigPorPg,
  repositorioPorPg,
} from "./repositorio-pg";
