/**
 * Saneamento de dado pessoal (contrato da SPEC 03, antecipa DADOS-07 AC6).
 *
 * Nenhum erro sai deste processo com dado pessoal em texto claro. Isso vale
 * duas vezes aqui: o Sentry deste projeto fica na **regiao dos Estados Unidos**,
 * entao o que passa por aqui atravessa fronteira. A defesa real nao e o contrato
 * com o fornecedor, e nao mandar o dado.
 *
 * **Por que este arquivo e `.mjs` e nao `.ts`:** e o unico pedaco que a
 * aplicacao Next **e** os scripts de job (AD-036, Node cru) precisam. O Node
 * desta maquina (22.17) ainda nao le TypeScript sozinho e o runner da CI leria —
 * construir em cima dessa diferenca e bug esperando. O projeto ja tem o padrao
 * (`scripts/alvo-do-banco.mjs` com JSDoc + teste `.ts`) e o `tsconfig.json` traz
 * `allowJs: true`, entao a aplicacao importa sem cerimonia.
 */

const MARCA_REMOVIDO = "[removido]";
const MARCA_PROFUNDO = "[profundo]";
const MARCA_CIRCULAR = "[circular]";

/**
 * Teto de profundidade. 12 e folgado de proposito: um evento do Sentry chega a
 * `exception.values[0].stacktrace.frames[0].vars` — sete niveis — e cortar a
 * pilha de chamada para proteger dado pessoal seria trocar um problema por outro.
 */
export const PROFUNDIDADE_MAXIMA = 12;

/**
 * Casadas por **pedaco** dentro do nome normalizado da chave. Sao longas o
 * bastante para nao produzir falso positivo.
 */
const PEDACOS_SENSIVEIS = [
  "senha",
  "password",
  "token",
  "secret",
  "authorization",
  "cookie",
  "email",
  "cpf",
  "apikey",
  "servicerole",
  "telefone",
  "celular",
  "cartao",
];

/**
 * Casadas **inteiras**. Curtas demais para casar por pedaco: `nome` apagaria
 * `nome_do_modulo`, e `ip` apagaria metade do dicionario.
 *
 * `chave` e `chaves` **nao** entram em nenhuma das duas listas de proposito: no
 * vocabulario deste projeto `chave` e chave de configuracao (INFRA-11), nao
 * credencial — e e exatamente o campo que o reporte de config precisa carregar
 * para ser util.
 */
const CHAVES_EXATAS_SENSIVEIS = [
  "nome",
  "nomecompleto",
  "sobrenome",
  "endereco",
  "ip",
  "ipaddress",
];

/** A lista inteira, exportada para o teste conferir que nada sumiu. */
export const CHAVES_SENSIVEIS = [
  ...PEDACOS_SENSIVEIS,
  ...CHAVES_EXATAS_SENSIVEIS,
];

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/**
 * CPF com ou sem pontuacao. A forma sem pontuacao (11 digitos seguidos) tambem
 * apanha algum numero que nao e CPF — apagar demais e o lado seguro do erro.
 */
const CPF = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|\b\d{11}\b/g;

/**
 * Nome de chave sem maiuscula, sem acento de pontuacao e sem separador, para
 * `e-mail`, `E_MAIL` e `email` virarem a mesma coisa.
 *
 * @param {unknown} chave
 * @returns {string}
 */
export function normalizarChave(chave) {
  return String(chave)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * O valor desta chave deve ser apagado inteiro?
 *
 * @param {unknown} chave
 * @returns {boolean}
 */
export function chaveEhSensivel(chave) {
  const normalizada = normalizarChave(chave);
  if (CHAVES_EXATAS_SENSIVEIS.includes(normalizada)) return true;
  return PEDACOS_SENSIVEIS.some((pedaco) => normalizada.includes(pedaco));
}

/**
 * Tira e-mail e CPF de dentro de um texto solto — mensagem de erro, `detail` do
 * Postgres, `return_message` de job. Chave sensivel nao ajuda aqui: o dado esta
 * no meio da frase, sem nome.
 *
 * @param {string} texto
 * @returns {string}
 */
export function sanitizarTexto(texto) {
  if (typeof texto !== "string") return texto;
  return texto.replace(EMAIL, "[email]").replace(CPF, "[cpf]");
}

/**
 * Copia saneada de qualquer valor.
 *
 * Ciclo e detectado pela **cadeia de ancestrais**, nao por um conjunto de
 * visitados: o mesmo objeto aparecendo duas vezes lado a lado e reuso, nao
 * ciclo, e marcar o segundo como circular esconderia dado legitimo.
 *
 * @param {unknown} valor
 * @param {number} [profundidade]
 * @param {unknown[]} [ancestrais]
 * @returns {unknown}
 */
export function sanitizar(valor, profundidade = 0, ancestrais = []) {
  if (typeof valor === "string") return sanitizarTexto(valor);
  if (valor === null || typeof valor !== "object") return valor;
  if (ancestrais.includes(valor)) return MARCA_CIRCULAR;
  if (profundidade >= PROFUNDIDADE_MAXIMA) return MARCA_PROFUNDO;

  const proximos = [...ancestrais, valor];

  if (Array.isArray(valor)) {
    return valor.map((item) => sanitizar(item, profundidade + 1, proximos));
  }

  /** @type {Record<string, unknown>} */
  const saida = {};
  for (const [chave, item] of Object.entries(valor)) {
    saida[chave] = chaveEhSensivel(chave)
      ? MARCA_REMOVIDO
      : sanitizar(item, profundidade + 1, proximos);
  }
  return saida;
}

/**
 * `beforeSend` de todo `Sentry.init` do projeto — aplicacao e script de job.
 *
 * Saneia o evento inteiro e depois **apaga** `user.email` e `user.ip_address`.
 * O saneamento sozinho ja trocaria os dois por `[removido]`; apagar e mais
 * forte, porque nem o formato do campo viaja.
 *
 * @template T
 * @param {T} evento
 * @returns {T}
 */
export function sanearEventoSentry(evento) {
  if (evento === null || typeof evento !== "object") return evento;

  const saneado = /** @type {Record<string, unknown>} */ (sanitizar(evento));
  const usuario = saneado.user;
  if (usuario !== null && typeof usuario === "object") {
    delete (/** @type {Record<string, unknown>} */ (usuario).email);
    delete (/** @type {Record<string, unknown>} */ (usuario).ip_address);
  }

  return /** @type {T} */ (/** @type {unknown} */ (saneado));
}
