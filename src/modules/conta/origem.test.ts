import { afterEach, describe, expect, it } from "vitest";

import { origemDoSite } from "./origem";

const cabecalhos = (host?: string) => ({
  get: (nome: string) => (nome === "host" && host ? host : null),
});

const original = { ...process.env };

afterEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = original.NEXT_PUBLIC_SITE_URL;
  process.env.VERCEL_PROJECT_PRODUCTION_URL = original.VERCEL_PROJECT_PRODUCTION_URL;
});

describe("origemDoSite", () => {
  it("o dominio declarado vence o cabecalho do pedido", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://passouconcursos.com.br/";

    // O cabecalho hostil esta la e e ignorado: e o unico caso que importa.
    expect(origemDoSite(cabecalhos("site.invalido"))).toBe(
      "https://passouconcursos.com.br",
    );
  });

  it("cai na URL da vercel quando nao ha dominio declarado", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "passou.vercel.app";

    expect(origemDoSite(cabecalhos("site.invalido"))).toBe("https://passou.vercel.app");
  });

  it("usa o host so em desenvolvimento, e sem https no localhost", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;

    expect(origemDoSite(cabecalhos("localhost:3000"))).toBe("http://localhost:3000");
    expect(origemDoSite(cabecalhos())).toBe("http://localhost:3000");
  });
});
