import {
  type EventoFunilAceito,
  type EventoDoFunil,
  type PropriedadesAnonimas,
} from "./funil";

const HOSTS_POSTHOG_EUA = new Set(["us.i.posthog.com", "us.posthog.com"]);

export type ResultadoDoPostHog =
  | { enviado: true }
  | { enviado: false; motivo: "desligado" | "indisponivel" };

export type PublicadorDeAnalytics = (
  evento: EventoDoFunil,
  propriedades: PropriedadesAnonimas,
) => Promise<ResultadoDoPostHog>;

export type FetchDoPostHog = typeof fetch;

let publicadorAtual: PublicadorDeAnalytics = publicarNoPostHog;

/** Seam para teste; a rota continua sempre same-origin. */
export function definirPublicadorDeAnalytics(
  publicador: PublicadorDeAnalytics,
): void {
  publicadorAtual = publicador;
}

export function restaurarPublicadorDeAnalytics(): void {
  publicadorAtual = publicarNoPostHog;
}

export function publicarEventoDoFunil(
  evento: EventoFunilAceito,
): Promise<ResultadoDoPostHog> {
  return publicadorAtual(evento.evento, evento.propriedades);
}

export async function publicarNoPostHog(
  evento: EventoDoFunil,
  propriedades: PropriedadesAnonimas,
  dependencias: { fetchImpl?: FetchDoPostHog; timeoutMs?: number } = {},
): Promise<ResultadoDoPostHog> {
  const chave = process.env.POSTHOG_API_KEY?.trim();
  const endereco = process.env.POSTHOG_API_URL?.trim();
  if (!chave || !endereco) {
    return { enviado: false, motivo: "desligado" };
  }

  const url = validarUrlDoPostHog(endereco);
  if (!url) {
    return { enviado: false, motivo: "desligado" };
  }

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    dependencias.timeoutMs ?? 1_500,
  );

  try {
    const resposta = await (dependencias.fetchImpl ?? fetch)(url, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        api_key: chave,
        event: evento,
        properties: {
          // Identificador não pessoal e único para o funil agregado. A flag
          // de analytics logado nunca é consultada aqui.
          distinct_id: "anonimo",
          ...propriedades,
        },
      }),
      signal: controller.signal,
    });

    if (!resposta.ok) return { enviado: false, motivo: "indisponivel" };
    return { enviado: true };
  } catch {
    return { enviado: false, motivo: "indisponivel" };
  } finally {
    clearTimeout(timer);
  }
}

function validarUrlDoPostHog(valor: string): URL | null {
  try {
    const url = new URL("/capture/", valor);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !HOSTS_POSTHOG_EUA.has(url.hostname.toLowerCase())
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}
