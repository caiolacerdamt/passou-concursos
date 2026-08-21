import { afterEach, describe, expect, it, vi } from "vitest";

import { enviarEventoDoFunilNoNavegador } from "./navegador";

const fetchOriginal = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

describe("emissão do funil no navegador", () => {
  it("envia evento same-origin sem propriedades e não propaga falha", async () => {
    const fetchFake = vi.fn<typeof fetch>(async () => {
      throw new Error("bloqueador");
    });
    globalThis.fetch = fetchFake;

    expect(() => enviarEventoDoFunilNoNavegador("meio_escolhido")).not.toThrow();
    await new Promise((resolver) => setTimeout(resolver, 0));

    expect(fetchFake).toHaveBeenCalledWith(
      "/api/analytics",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ evento: "meio_escolhido" }),
      }),
    );
  });
});
