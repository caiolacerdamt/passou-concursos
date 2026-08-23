import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { VERSAO_ATUAL_DOS_TERMOS } from "@/modules/pagamentos/contratos";

import Privacidade from "./privacidade/page";
import Termos from "./termos/page";

describe("páginas públicas legais", () => {
  it("termos e privacidade são alcançáveis e deixam a revisão explícita", () => {
    const termos = renderToStaticMarkup(<Termos />);
    const privacidade = renderToStaticMarkup(<Privacidade />);

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
