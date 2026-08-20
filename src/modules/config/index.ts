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

/**
 * `definirLeitorDeConfig` e publico de proposito, e nao e so seam de teste: um
 * **job** roda fora de requisicao do Next (AD-085) e nao tem o cliente Supabase
 * de servidor a mao, so a conexao `pg` do `DATABASE_URL`. Injetar o proprio
 * leitor deixa o job usar a validacao, o default e as quedas deste modulo em
 * vez de reimplementar a leitura de `configuracoes_vigentes` em SQL solto — que
 * e como o default duplica e depois diverge.
 */
export {
  JANELA_DE_CACHE_SEGUNDOS,
  type LeitorDeConfig,
  type ReporteDeErro,
  TAG_DE_CACHE,
  definirLeitorDeConfig,
  definirReporteDeErro,
  getParam,
  getParams,
  isFlagOn,
  restaurarLeitorPadrao,
} from "./leitura";

export { ConfiguracaoRecusada, setConfig } from "./escrita";
