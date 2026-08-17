/**
 * Sentry para processo **fora** do Next — script de job disparado por GitHub
 * Actions (AD-036) ou rodado a mao. INFRA-09 AC2.
 *
 * A aplicacao usa `@sentry/nextjs`; aqui e `@sentry/node`. Sao pacotes
 * diferentes, e e exatamente por isso que o nucleo em
 * `src/modules/observabilidade` nao importa nenhum dos dois.
 *
 * **Duas regras que este arquivo nunca quebra:**
 * 1. Sem DSN, o script continua funcionando e continua imprimindo no console. A
 *    visibilidade da falha nao depende do Sentry estar de pe.
 * 2. Nada sai daqui sem passar pelo saneamento — `return_message` de job e
 *    `detail` de erro do Postgres carregam valor de linha com facilidade.
 */
import {
  sanearEventoSentry,
  sanitizar,
  sanitizarTexto,
} from "../../src/modules/observabilidade/saneamento.mjs";

/** @type {typeof import("@sentry/node") | null} */
let sdk = null;

/**
 * O SDK e carregado sob demanda porque nem todo job da CI roda `npm ci` antes.
 * Sem o pacote instalado o script degrada para console em vez de explodir — o
 * contrario seria uma falha de reporte escondendo a falha de verdade.
 *
 * @returns {Promise<typeof import("@sentry/node") | null>}
 */
async function carregarSdk() {
  if (sdk !== null) return sdk;
  try {
    sdk = await import("@sentry/node");
  } catch {
    sdk = null;
  }
  return sdk;
}

/** @returns {string} */
export function dsnDoAmbiente() {
  return (process.env.NEXT_PUBLIC_SENTRY_DSN ?? "").trim();
}

/**
 * Liga o Sentry se houver DSN **e** SDK.
 *
 * @returns {Promise<boolean>} `false` quando o reporte vai so para o console.
 */
export async function iniciarSentry() {
  const dsn = dsnDoAmbiente();
  if (dsn === "") return false;

  const Sentry = await carregarSdk();
  if (Sentry === null) return false;

  Sentry.init({
    dsn,
    release: (process.env.GITHUB_SHA ?? "").trim() || "desenvolvimento",
    environment: (process.env.SENTRY_ENVIRONMENT ?? "").trim() || "job",
    tracesSampleRate: 0,
    dataCollection: { userInfo: false, httpBodies: [] },
    beforeSend: sanearEventoSentry,
  });

  return true;
}

/**
 * Reporta um erro. **Sempre** escreve no console; manda ao Sentry so quando ele
 * esta ligado.
 *
 * O console tambem passa pelo saneamento: log de GitHub Actions fica guardado
 * pelo GitHub e e visivel para quem tem o repositorio, entao e dado pessoal
 * fora do schema do mesmo jeito. O caso concreto e o vigia de jobs, que carrega
 * o `return_message` do pg_cron — texto que leva valor de linha com facilidade.
 *
 * @param {unknown} erro
 * @param {Record<string, unknown>} [contexto]
 * @returns {Promise<void>}
 */
export async function reportar(erro, contexto = {}) {
  const mensagem = erro instanceof Error ? `${erro.name}: ${erro.message}` : String(erro);
  console.error("[job]", sanitizar(contexto), sanitizarTexto(mensagem));

  const Sentry = await carregarSdk();
  if (Sentry === null || dsnDoAmbiente() === "") return;

  Sentry.captureException(erro, { extra: contexto });
}

/**
 * Espera a fila esvaziar. Sem isto, `process.exit` mata o processo com o evento
 * ainda em memoria e o alerta nunca sai — que e o modo de falha mais irritante
 * possivel numa peca cujo trabalho e justamente avisar.
 *
 * @returns {Promise<void>}
 */
export async function encerrar() {
  const Sentry = await carregarSdk();
  if (Sentry === null || dsnDoAmbiente() === "") return;
  await Sentry.flush(4000);
}
