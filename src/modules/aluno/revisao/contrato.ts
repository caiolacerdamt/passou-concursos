/**
 * Contrato da agenda de revisao (ALUNO-09).
 *
 * A regra que este arquivo protege esta no AC3: **o que sai deste modulo e uma
 * data**. Quem consome — o motor de prioridade do plano — so pergunta "este
 * topico esta devendo revisao?". Nem `Card`, nem estabilidade, nem dificuldade
 * do FSRS aparecem aqui, e e por isso que trocar o algoritmo nao mexe no plano.
 */

/** Qual algoritmo calculou a data. `regua_fixa` e o plano B do AC4. */
export const ALGORITMOS = ["fsrs", "regua_fixa"] as const;
export type Algoritmo = (typeof ALGORITMOS)[number];

/**
 * O `Rating` do FSRS, nomeado no vocabulario das faixas de configuracao.
 *
 * Os numeros sao os da biblioteca (`Rating.Again` = 1 … `Rating.Easy` = 4) e nao
 * podem mudar: eles entram no calculo do proprio FSRS e ficam gravados em
 * `revisao_evento.nota`.
 */
export const NOTA = {
  errei: 1,
  dificil: 2,
  bom: 3,
  facil: 4,
} as const;
export type Nota = (typeof NOTA)[keyof typeof NOTA];

export type EntradaRevisao = {
  userId: string;
  topicoId: string;
  /** Acertos / total do bloco Revisar naquele topico, de 0 a 1. */
  percentualAcerto: number;
  /** Injetavel para o teste fixar o dia. Producao nunca passa. */
  agora?: Date;
};

/**
 * O que `agendarRevisao` devolve.
 *
 * `due` e o unico campo que interessa a quem chama. `nota` e `algoritmo` estao
 * aqui para a tela poder dizer ao aluno o que aconteceu ("voce foi bem, volto a
 * te cobrar isto em 8 dias") — nao para outro modulo tomar decisao com eles.
 */
export type ResultadoRevisao = {
  due: Date;
  nota: Nota;
  algoritmo: Algoritmo;
};

export class RevisaoRecusada extends Error {
  readonly motivo: "percentual_invalido";

  constructor(mensagem: string) {
    super(mensagem);
    this.name = "RevisaoRecusada";
    this.motivo = "percentual_invalido";
  }
}
