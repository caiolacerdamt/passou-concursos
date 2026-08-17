import * as Sentry from "@sentry/nextjs";

/**
 * Boot do Sentry no servidor (INFRA-09 AC1).
 *
 * O Next chama `register()` uma vez, antes de servir qualquer requisicao, e
 * `NEXT_RUNTIME` diz em qual dos dois runtimes de servidor estamos.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

/**
 * **Este export e o contexto de rota que o AC1 pede.** O Next entrega aqui todo
 * erro nao tratado de Server Component, de rota e de middleware, junto de qual
 * rota era (`routerKind`, `routePath`, `routeType`) — informacao que o
 * `Sentry.init` sozinho nao tem como saber.
 */
export const onRequestError = Sentry.captureRequestError;
