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
  it("mostra os dois preços, campos necessários, garantia e não coleta data de nascimento", async () => {
    definirLeitorDeConfig(async () => ({}));

    const html = renderToStaticMarkup(await Checkout());

    expect(html).toContain("Checkout");
    expect(html).toContain("12x");
    expect(html).toContain("177,30");
    expect(html).toContain("18 anos");
    expect(html).toContain("Não solicitamos data de nascimento");
    expect(html).toContain('name="nomeCompleto"');
    expect(html).toContain('name="cpfCnpj"');
    expect(html).toContain('name="maiorDeIdade"');
    expect(html).toContain('name="aceitouTermos"');
    expect(html).toContain('value="PIX"');
    expect(html).toContain('href="/termos"');
    expect(html).toContain('href="/privacidade"');
    /*
     * O rótulo do botão segue o meio escolhido — quem marcou boleto não é
     * levado para uma tela que promete cartão. `CREDIT_CARD` é o padrão, então
     * é o rótulo dele que sai no primeiro render.
     */
    expect(html).toContain("Ir para o pagamento no cartão");
  });
});
