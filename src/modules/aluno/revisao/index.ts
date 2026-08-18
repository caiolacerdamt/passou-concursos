/**
 * Interface publica da agenda de revisao (M4 — ALUNO-09).
 *
 * O que sai daqui e uma **data** e mais nada (AC3). `Card`, estabilidade e
 * dificuldade do FSRS nao atravessam esta fronteira — e o que permite trocar o
 * algoritmo sem tocar no motor de prioridade do plano.
 */
export {
  ALGORITMOS,
  type Algoritmo,
  type EntradaRevisao,
  NOTA,
  type Nota,
  type ResultadoRevisao,
  RevisaoRecusada,
} from "./contrato";

export { agendarRevisao, notaDoPercentual } from "./agendar";
