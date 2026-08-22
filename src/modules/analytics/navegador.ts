import type { EventoDoFunil } from "./funil";

/**
 * O navegador só fala com a rota same-origin. O payload não tem propriedades:
 * em especial, a escolha do meio nunca vira dado de analytics (M9/INFRA-12).
 */
export function enviarEventoDoFunilNoNavegador(evento: EventoDoFunil): void {
  void Promise.resolve()
    .then(() =>
      fetch("/api/analytics", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ evento }),
        keepalive: true,
      }),
    )
    .catch(() => undefined);
}
