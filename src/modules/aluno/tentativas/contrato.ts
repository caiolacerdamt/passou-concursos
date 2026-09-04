/**
 * Contrato de `registrarTentativa` (ALUNO-01, ALUNO-03).
 *
 * Vocabulario em PT-BR porque e dominio (AGENTS.md §Convencoes). Os valores sao
 * os mesmos enums do banco — a lista vive aqui **e** la de proposito: aqui ela
 * recusa antes da ida ao banco, la ela e a rede embaixo do modulo.
 */

export const CONTEXTOS = [
  "diagnostico",
  "plano",
  "treino",
  "simulado",
  "revisao",
] as const;
export type Contexto = (typeof CONTEXTOS)[number];

/** AD-043 / ALUNO-04 AC2: as 6 causas + "nao sei dizer". */
export const CAUSAS_DO_TREINO = [
  "nao_sabia_conteudo",
  "errei_a_conta",
  "entendi_errado_enunciado",
  "confundi_conceitos",
  "fiquei_na_duvida",
  "chutei",
  "nao_sei_dizer",
] as const;
export type CausaDoTreino = (typeof CAUSAS_DO_TREINO)[number];

/**
 * `faltou_tempo` existe no enum do banco mas **nao** entra em `tentativas`: ele
 * so e declarado na revisao pos-prova, em `tentativa_causa_simulado`. Ficar de
 * fora deste tipo e o que impede o codigo de tentar.
 */
export const CAUSA_SO_DO_SIMULADO = "faltou_tempo" as const;

export const LETRAS_POR_TIPO = {
  multipla_escolha: ["A", "B", "C", "D", "E"],
  certo_errado: ["C", "E"],
} as const;
export type TipoQuestao = keyof typeof LETRAS_POR_TIPO;

export type EntradaTentativa = {
  userId: string;
  /** Item da sessao que esta resposta responde. E por ele que o dedup acontece. */
  sessaoItemId: string;
  contexto: Contexto;
  respostaDada: string;
  /** Milissegundos entre a questao aparecer e o aluno responder. */
  tempoMs?: number | null;
  marcouChute?: boolean;
  causaErro?: CausaDoTreino | null;
};

export type ResultadoTentativa = {
  tentativaId: string;
  respondidaEm: string;
  correta: boolean;
  /**
   * `true` quando a resposta ja tinha sido registrada e esta chamada nao inseriu
   * nada. Quem chama precisa saber: a tela do duplo-clique nao pode dizer
   * "resposta registrada" duas vezes.
   */
  duplicada: boolean;
};

export type MotivoDaRecusa =
  | "contexto_invalido"
  | "resposta_invalida"
  | "causa_obrigatoria"
  | "causa_so_com_erro"
  | "causa_invalida"
  | "item_inexistente"
  /** Teto diário do teste grátis, recusado pelo banco (AD-133). */
  | "trial_teto_diario";

/**
 * Recusa **antes** do INSERT (ALUNO-03 AC1: "o sistema SHALL exigir a causa
 * antes de avancar"). O `motivo` e nomeado para a tela saber o que pedir de
 * novo, em vez de ler mensagem de erro do Postgres.
 */
export class TentativaRecusada extends Error {
  readonly motivo: MotivoDaRecusa;

  constructor(motivo: MotivoDaRecusa, mensagem: string) {
    super(mensagem);
    this.name = "TentativaRecusada";
    this.motivo = motivo;
  }
}
