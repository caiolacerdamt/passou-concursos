import { sanitizar, sanitizarTexto } from "./saneamento.mjs";

/**
 * Ponto unico de reporte de erro do projeto (INFRA-09, AD-037).
 *
 * **Nao importa o Sentry de proposito.** Quem liga o SDK e o ponto de entrada:
 * o boot do Next (`src/sentry.*.config.ts`) ou o boot do script de job. Tres
 * razoes: o teste `unit` do AD-083 nao pode tocar rede; a aplicacao usa
 * `@sentry/nextjs` e o script usa `@sentry/node`, que sao pacotes diferentes; e
 * a SPEC 02 ja publicou esta mesma forma de costura em `modules/config`.
 */

export type ContextoDeErro = Record<string, unknown>;

export type DestinoDeErro = (erro: unknown, contexto: ContextoDeErro) => void;

/** Texto curto do erro, para log. Preserva o nome da classe do erro. */
export function descreverErro(erro: unknown): string {
  if (erro instanceof Error) return `${erro.name}: ${erro.message}`;
  if (erro !== null && typeof erro === "object") {
    try {
      // JSON compacto mantem a mensagem em uma linha e evita perder os campos
      // uteis quando um cliente devolve um objeto puro (como o PostgrestError).
      return JSON.stringify(erro) ?? String(erro);
    } catch {
      // Referencias circulares nao podem impedir o reporte do erro original.
      return String(erro);
    }
  }
  return String(erro);
}

/**
 * Destino de fabrica. Vale em teste, em `npm run dev` e em qualquer processo que
 * nao tenha ligado o Sentry: a queda e silenciosa para o Sentry, **nunca** para
 * o log.
 */
export const DESTINO_CONSOLE: DestinoDeErro = (erro, contexto) => {
  console.error("[erro]", contexto, sanitizarTexto(descreverErro(erro)));
};

let destinoAtual: DestinoDeErro = DESTINO_CONSOLE;

export function definirDestinoDeErro(novo: DestinoDeErro): void {
  destinoAtual = novo;
}

export function restaurarDestinoPadrao(): void {
  destinoAtual = DESTINO_CONSOLE;
}

/**
 * Reporta um erro. O **contexto** chega saneado ao destino; o objeto `Error`
 * chega cru, porque sem ele a pilha de chamada se perde e o Sentry nao agrupa
 * nada. A mensagem e saneada em todo ponto onde vira texto: aqui no destino de
 * console, e no `beforeSend` de cada `Sentry.init`.
 *
 * O destino nunca derruba quem chamou: reportar erro nao pode quebrar uma
 * requisicao que ja estava com problema.
 */
export function reportarErro(
  erro: unknown,
  contexto: ContextoDeErro = {},
): void {
  try {
    destinoAtual(erro, sanitizar(contexto) as ContextoDeErro);
  } catch (falhaDoDestino) {
    console.error(
      "[erro] o destino de reporte falhou",
      sanitizarTexto(descreverErro(falhaDoDestino)),
      sanitizarTexto(descreverErro(erro)),
    );
  }
}
