import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import {
  definirLeitorDeConfig,
  restaurarLeitorPadrao,
} from "@/modules/config";

import Checkout from "./page";

afterEach(() => {
  restaurarLeitorPadrao();
});

describe("resumo público do checkout", () => {
  it("mostra os dois preços, garantia, termos e não coleta data de nascimento", async () => {
    definirLeitorDeConfig(async () => ({}));

    const html = renderToStaticMarkup(await Checkout());

    expect(html).toContain("Checkout");
    expect(html).toContain("12x");
    expect(html).toContain("177,30");
    expect(html).toContain("18 anos");
    expect(html).toContain("Não solicitamos data de nascimento");
    expect(html).toContain('href="/termos"');
    expect(html).toContain('href="/privacidade"');
    expect(html).toContain("processamento da cobrança será conectado");
  });
});
