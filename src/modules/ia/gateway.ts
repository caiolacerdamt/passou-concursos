import { reportarErro } from "@/modules/observabilidade";

import {
  type Adaptador,
  type PedidoDeIa,
  adaptadorDaOpenAI,
  tetoDeSaidaDe,
} from "./adaptador-openai";
import {
  type ContadorDeGasto,
  calcularCusto,
  conferirGasto,
  precosVigentes,
} from "./gasto";
import {
  type DestinoDeIa,
  type PerfilDeTarefa,
  fallbackDe,
  perfilDaTarefa,
  principalDe,
} from "./matriz";
import { type Tarefa, VERSAO_DO_PROMPT } from "./tarefas";

/**
 * O gateway: **o unico caminho** entre o produto e um modelo de IA (IA-02).
 *
 * Ele resolve o perfil por configuracao, tenta o principal, cai no fallback
 * registrando o evento, para de forma visivel quando o fallback tambem falha, e
 * grava com que modelo, versao, esforco e versao de prompt cada resultado
 * nasceu. Spec que precisar de tarefa nova acrescenta linha na matriz de
 * configuracao — nunca um cliente novo.
 */

/** O que uma geracao deixa registrado (IA-02 AC4, IA-12). */
export type RegistroDeGeracao = {
  chaveDedup: string | null;
  tarefa: Tarefa;
  questaoId: string | null;
  questaoVersao: number | null;
  modelo: string;
  modeloVersao: string;
  esforco: string;
  versaoPrompt: string;
  batch: boolean;
  usouFallback: boolean;
  tokensEntrada: number | null;
  tokensCacheados: number | null;
  tokensSaida: number | null;
  custoUsd: number | null;
  /** `null` quando a tarefa nao guarda o resultado (texto de aluno). */
  resultado: unknown;
};

/** Uma geracao ja feita, achada pela chave de dedup. */
export type GeracaoGuardada = {
  resultado: unknown;
  modelo: string;
  usouFallback: boolean;
};

/**
 * Onde as geracoes ficam. Injetavel porque quem chama o gateway roda em dois
 * lugares diferentes: o **job**, que so tem a conexao `pg` do `DATABASE_URL`
 * (AD-036), e a **aplicacao**, que tem o cliente do Supabase.
 */
export type RepositorioDeIa = ContadorDeGasto & {
  buscarPorChave(chave: string): Promise<GeracaoGuardada | null>;
  gravar(registro: RegistroDeGeracao): Promise<void>;
};

const SEM_REPOSITORIO =
  "nenhum repositorio de IA foi configurado: chame definirRepositorioDeIa antes de usar o gateway";

const REPOSITORIO_AUSENTE: RepositorioDeIa = {
  async buscarPorChave() {
    throw new Error(SEM_REPOSITORIO);
  },
  async gravar() {
    throw new Error(SEM_REPOSITORIO);
  },
  async gastoDoPeriodo() {
    throw new Error(SEM_REPOSITORIO);
  },
  async registrarAlerta() {
    throw new Error(SEM_REPOSITORIO);
  },
};

let repositorio: RepositorioDeIa = REPOSITORIO_AUSENTE;

export function definirRepositorioDeIa(novo: RepositorioDeIa): void {
  repositorio = novo;
}

export function restaurarRepositorioAusente(): void {
  repositorio = REPOSITORIO_AUSENTE;
}

let adaptador: Adaptador = adaptadorDaOpenAI;

/** Seam de teste. Em producao o adapter e um so (AD-074). */
export function definirAdaptador(novo: Adaptador): void {
  adaptador = novo;
}

export function restaurarAdaptadorPadrao(): void {
  adaptador = adaptadorDaOpenAI;
}

/**
 * Nem o principal nem o fallback responderam (IA-02 AC5).
 *
 * O job que pegar isto SHALL parar de forma visivel e SHALL NOT publicar
 * resultado parcial. A causa original vai em `causa`, para o Sentry agrupar
 * pela falha de verdade e nao por esta.
 */
export class GatewayParou extends Error {
  readonly tarefa: Tarefa;
  readonly causa: unknown;

  constructor(tarefa: Tarefa, causa: unknown) {
    super(`a tarefa de IA "${tarefa}" falhou no principal e no fallback`);
    this.name = "GatewayParou";
    this.tarefa = tarefa;
    this.causa = causa;
  }
}

/** Tarefa marcada `batch: true` nao roda sincrona (IA-02 AC9). */
export class TarefaEhDeLote extends Error {
  constructor(tarefa: Tarefa) {
    super(
      `a tarefa "${tarefa}" esta marcada batch: true na configuracao e SHALL NOT ` +
        "ser empurrada para a chamada sincrona. Use a montagem de lote.",
    );
    this.name = "TarefaEhDeLote";
  }
}

/** Identifica a geracao para o dedup (IA-14). */
export type AlvoDaTarefa =
  | { questaoId: string; questaoVersao: number }
  | { livre: string }
  | null;

export type ChamadaDeTarefa = {
  tarefa: Tarefa;
  pedido: PedidoDeIa;
  /**
   * `null` = esta chamada nao se reaproveita e nao guarda resultado. E o caso
   * da frase do plano, cujo texto e do aluno e cuja idempotencia mora na
   * propria `plano_dia`.
   */
  alvo?: AlvoDaTarefa;
};

export type ResultadoDaTarefa = {
  texto: string;
  estruturado?: unknown;
  /** Veio do registro, sem chamar modelo nenhum nem gastar nada (IA-14). */
  reaproveitada: boolean;
  usouFallback: boolean;
  custoUsd: number | null;
};

/**
 * A chave de dedup do IA-14: `questao_id` + `questao_versao` + tarefa + versao
 * do prompt. Mudar o prompt muda a chave, e e assim que a fabrica regera o que
 * precisa ser regerado — e so isso.
 */
export function montarChaveDeDedup(
  tarefa: Tarefa,
  alvo: AlvoDaTarefa,
): string | null {
  if (alvo === null || alvo === undefined) return null;

  const versao = VERSAO_DO_PROMPT[tarefa];
  if ("livre" in alvo) return `${tarefa}:${versao}:${alvo.livre}`;
  return `${tarefa}:${versao}:${alvo.questaoId}:${alvo.questaoVersao}`;
}

function questaoDoAlvo(alvo: AlvoDaTarefa): {
  questaoId: string | null;
  questaoVersao: number | null;
} {
  if (alvo && "questaoId" in alvo) {
    return { questaoId: alvo.questaoId, questaoVersao: alvo.questaoVersao };
  }
  return { questaoId: null, questaoVersao: null };
}

/**
 * Devolve uma geracao que ja existia, na mesma forma de uma recem-feita.
 *
 * `custoUsd: 0` nao e "de graca por descuido": e a afirmacao de que esta
 * chamada nao gastou nada, e e o que faz a soma do mes nao contar duas vezes o
 * que foi pago uma.
 */
function reaproveitar(guardada: GeracaoGuardada): ResultadoDaTarefa {
  const bruto = guardada.resultado;
  const ehTexto = typeof bruto === "string";

  return {
    texto: ehTexto ? bruto : JSON.stringify(bruto),
    estruturado: ehTexto ? undefined : bruto,
    reaproveitada: true,
    usouFallback: guardada.usouFallback,
    custoUsd: 0,
  };
}

/** Uma tentativa contra um destino. Nao trata erro: quem trata e o caminho. */
async function tentar(
  destino: DestinoDeIa,
  perfil: PerfilDeTarefa,
  pedido: PedidoDeIa,
) {
  return adaptador(destino, pedido, {
    cache: perfil.cache,
    tetoDeSaida: tetoDeSaidaDe(perfil),
  });
}

/**
 * Executa uma tarefa de IA. **Sincrona**: tarefa de lote e recusada.
 *
 * @throws {TarefaSemPerfil} a tarefa nao esta na matriz de configuracao
 * @throws {TarefaEhDeLote} a tarefa esta marcada `batch: true`
 * @throws {GatewayParou} principal e fallback falharam
 */
export async function executarTarefa(
  chamada: ChamadaDeTarefa,
): Promise<ResultadoDaTarefa> {
  const { tarefa, pedido } = chamada;
  const alvo = chamada.alvo ?? null;

  const perfil = await perfilDaTarefa(tarefa);
  if (perfil.batch) throw new TarefaEhDeLote(tarefa);

  const chaveDedup = montarChaveDeDedup(tarefa, alvo);

  // IA-14: rerodar o job **nao** regera nem cobra de novo. Esta consulta vem
  // antes de qualquer coisa que custe dinheiro — e o ponto inteiro do AD-036,
  // que exige job retomavel: uma fabrica interrompida no meio recomeça do zero
  // e so paga pelo que ainda nao existia.
  if (chaveDedup !== null) {
    const guardada = await repositorio.buscarPorChave(chaveDedup);
    if (guardada !== null) return reaproveitar(guardada);
  }

  let destinoUsado = principalDe(perfil);
  let usouFallback = false;
  let resposta;

  try {
    resposta = await tentar(destinoUsado, perfil, pedido);
  } catch (falhaDoPrincipal) {
    const reserva = fallbackDe(perfil);

    // O registro do evento e o AC5 inteiro: sem ele, um provedor degradado
    // ficaria invisivel ate a conta do mes chegar diferente.
    reportarErro(falhaDoPrincipal, {
      modulo: "ia",
      tarefa,
      motivo: reserva
        ? "o modelo principal falhou; acionando o fallback"
        : "o modelo principal falhou e nao ha fallback configurado",
    });

    if (reserva === null) throw new GatewayParou(tarefa, falhaDoPrincipal);

    try {
      destinoUsado = reserva;
      usouFallback = true;
      resposta = await tentar(reserva, perfil, pedido);
    } catch (falhaDoFallback) {
      reportarErro(falhaDoFallback, {
        modulo: "ia",
        tarefa,
        motivo: "o fallback tambem falhou; a tarefa para sem resultado parcial",
      });
      throw new GatewayParou(tarefa, falhaDoFallback);
    }
  }

  const custoUsd = calcularCusto(await precosVigentes(), destinoUsado.modelo, resposta);

  await repositorio.gravar({
    chaveDedup,
    tarefa,
    ...questaoDoAlvo(alvo),
    modelo: destinoUsado.modelo,
    modeloVersao: destinoUsado.versao,
    esforco: destinoUsado.esforco,
    versaoPrompt: VERSAO_DO_PROMPT[tarefa],
    batch: false,
    usouFallback,
    tokensEntrada: resposta.tokensEntrada,
    tokensCacheados: resposta.tokensCacheados,
    tokensSaida: resposta.tokensSaida,
    custoUsd,
    // Sem chave de dedup nao ha o que reaproveitar, entao guardar o texto so
    // criaria uma segunda copia de dado de aluno fora do inventario do grupo 1.
    resultado: chaveDedup === null ? null : (resposta.estruturado ?? resposta.texto),
  });

  // Depois de gravar, nunca antes: a soma do mes tem que enxergar a linha que
  // acabou de nascer, senao o alerta sai sempre um passo atras.
  await conferirGasto(repositorio);

  return {
    texto: resposta.texto,
    estruturado: resposta.estruturado,
    reaproveitada: false,
    usouFallback,
    custoUsd,
  };
}
