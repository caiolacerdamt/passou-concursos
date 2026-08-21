import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import {
  definirLeitorDeConfig,
  restaurarLeitorPadrao,
} from "@/modules/config";

import Home from "./page";

afterEach(() => {
  restaurarLeitorPadrao();
});

describe("pagina de vendas", () => {
  it("exibe método, evidências, estado atual, dois preços, garantia e CTA", async () => {
    definirLeitorDeConfig(async () => ({}));

    const html = renderToStaticMarkup(await Home());

    expect(html).toContain("Questões reais");
    expect(html).toContain("Revisão espaçada");
    expect(html).toContain("Donoghue");
    expect(html).toContain("197,00");
    expect(html).toContain("177,30");
    expect(html).toContain("Garantia de 7 dias");
    expect(html).toContain('href="/checkout"');
    expect(html).toContain('href="/termos"');
    expect(html).toContain('href="/privacidade"');
    expect(html).toContain("não fazem parte desta oferta atual");
    expect(html).not.toContain("data-nascimento");
  });
});
