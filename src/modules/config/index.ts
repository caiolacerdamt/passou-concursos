/**
 * Interface publica do modulo de configuracao (INFRA-11).
 *
 * Monolito modular do AD-002: nada de fora importa arquivo interno deste modulo
 * — o que e publico e o que sai daqui.
 */
export {
  CATALOGO,
  CHAVES,
  type Chave,
  type ChaveFlag,
  type ChaveParam,
  type ModuloDono,
  type TipoDe,
  chavesOrfas,
  existeNoCatalogo,
} from "./catalogo";

export {
  JANELA_DE_CACHE_SEGUNDOS,
  type ReporteDeErro,
  TAG_DE_CACHE,
  definirReporteDeErro,
  getParam,
  getParams,
  isFlagOn,
} from "./leitura";

export { ConfiguracaoRecusada, setConfig } from "./escrita";
