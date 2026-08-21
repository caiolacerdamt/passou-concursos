import { afterEach, describe, expect, it, vi } from "vitest";

import {
  definirPublicadorDeAnalytics,
  emitirEventoDoFunilNaoBloqueante,
  publicarNoPostHog,
  restaurarPublicadorDeAnalytics,
} from "./posthog";

const ambienteOriginal = { ...process.env };

afterEach(() => {
  restaurarPublicadorDeAnalytics();
  process.env.POSTHOG_API_KEY = ambienteOriginal.POSTHOG_API_KEY;
  process.env.POSTHOG_API_URL = ambienteOriginal.POSTHOG_API_URL;
});

describe("transporte do PostHog", () => {
  it("fica desligado sem chave e não toca a rede", async () => {
    delete process.env.POSTHOG_API_KEY;
    delete process.env.POSTHOG_API_URL;
    let chamou = false;

    const resultado = await publicarNoPostHog("pagina_vista", {}, {
      fetchImpl: async () => {
        chamou = true;
        return new Response(null, { status: 200 });
      },
    });

    expect(resultado).toEqual({ enviado: false, motivo: "desligado" });
    expect(chamou).toBe(false);
  });

  it("envia somente evento e propriedades anônimas para o host EUA permitido", async () => {
    process.env.POSTHOG_API_KEY = "phc_teste";
    process.env.POSTHOG_API_URL = "https://us.i.posthog.com";
    let corpo: Record<string, unknown> | undefined;
    let url = "";

    const resultado = await publicarNoPostHog(
      "pagamento_confirmado",
      {},
      {
        fetchImpl: async (destino, init = {}) => {
          url = String(destino);
          corpo = JSON.parse(String(init.body));
          return new Response("{}", {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        },
      },
    );

    expect(resultado).toEqual({ enviado: true });
    expect(url).toBe("https://us.i.posthog.com/capture/");
    expect(corpo).toEqual({
      api_key: "phc_teste",
      event: "pagamento_confirmado",
      properties: { distinct_id: "anonimo" },
    });
  });

  it("recusa endpoint fora da allowlist sem rede", async () => {
    process.env.POSTHOG_API_KEY = "phc_teste";
    process.env.POSTHOG_API_URL = "https://analytics.exemplo.com";
    let chamou = false;

    const resultado = await publicarNoPostHog("pagina_vista", {}, {
      fetchImpl: async () => {
        chamou = true;
        return new Response(null, { status: 200 });
      },
    });

    expect(resultado).toEqual({ enviado: false, motivo: "desligado" });
    expect(chamou).toBe(false);
  });

  it("não propaga falha síncrona ou assíncrona do publicador não bloqueante", async () => {
    const reportado = vi.spyOn(console, "error").mockImplementation(() => undefined);
    definirPublicadorDeAnalytics(async () => {
      throw new Error("posthog indisponivel");
    });

    expect(() => emitirEventoDoFunilNaoBloqueante("pagamento_confirmado")).not.toThrow();
    await new Promise((resolver) => setTimeout(resolver, 0));

    reportado.mockRestore();
  });
});
