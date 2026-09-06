import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import { definirLeitorDeConfig, restaurarLeitorPadrao } from "@/modules/config";
import { VERSAO_ATUAL_DOS_TERMOS } from "@/modules/pagamentos/contratos";

import Privacidade from "./privacidade/page";
import Termos from "./termos/page";

afterEach(() => {
  restaurarLeitorPadrao();
});

describe("páginas públicas legais", () => {
  /*
   * `Privacidade` virou `async` no item 8 do TRIAL-2: a janela de retenção do
   * lead vem de `param.m7.retencao_trial_meses`, não da copy. Por isso ela é
   * aguardada aqui, e o leitor de config é injetado — sem isso o teste tentaria
   * abrir conexão com o banco.
   */
  it("termos e privacidade são alcançáveis e deixam a revisão explícita", async () => {
    definirLeitorDeConfig(async () => ({}));

    const termos = renderToStaticMarkup(<Termos />);
    const privacidade = renderToStaticMarkup(await Privacidade());

    expect(termos).toContain("Termos de uso");
    expect(termos).toContain("revisão jurídica");
    expect(termos).toContain(`Versão ${VERSAO_ATUAL_DOS_TERMOS}`);
    expect(termos).toContain('href="/privacidade"');
    expect(privacidade).toContain("Política de privacidade");
    expect(privacidade).toContain("revisão jurídica");
    expect(privacidade).toContain(`Versão ${VERSAO_ATUAL_DOS_TERMOS}`);
    expect(privacidade).toContain('href="/termos"');
    expect(privacidade).toContain("Resend");
    expect(privacidade).toContain("Faturas, aceite");
    expect(privacidade).toContain("privacidade@passouconcursos.com");
    expect(privacidade).toContain("checkbox de consentimento");
  });
});
