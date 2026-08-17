/**
 * Interface publica do registro de tentativas (M4 — ALUNO-01/ALUNO-03).
 *
 * Monolito modular do AD-002: nada de fora importa arquivo interno deste modulo.
 */
export {
  CAUSAS_DO_TREINO,
  CAUSA_SO_DO_SIMULADO,
  CONTEXTOS,
  type CausaDoTreino,
  type Contexto,
  type EntradaTentativa,
  LETRAS_POR_TIPO,
  type MotivoDaRecusa,
  type ResultadoTentativa,
  TentativaRecusada,
  type TipoQuestao,
} from "./contrato";

export { registrarTentativa, validar, validarResposta } from "./registrar";
