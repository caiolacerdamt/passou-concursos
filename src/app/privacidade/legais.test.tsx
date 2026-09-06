import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import { definirLeitorDeConfig, restaurarLeitorPadrao } from "@/modules/config";

import Privacidade from "./page";
import Termos from "../termos/page";

afterEach(() => {
  restaurarLeitorPadrao();
});

/**
 * Item 8 do TRIAL-2. Deixou de ser hipotetico em 2026-09-04: com a flag ligada,
 * ja existe titular de trial no banco. Enquanto for a conta do dono e
 * irrelevante; no primeiro aluno de verdade, deixa de ser.
 *
 * O que os dois textos precisam dizer esta no plano, e e isto que as assercoes
 * guardam — nao a redacao, que sobe com redacao propria e vai ser revisada por
 * advogado depois (o risco esta registrado no AD-090).
 */
describe("os textos legais falam da conta gratuita", () => {
  it("os termos dizem o prazo e que NAO ha cobranca automatica no fim", async () => {
    const html = renderToStaticMarkup(Termos());

    expect(html).toContain("7 dias");
    expect(html).toContain("sem cartão");
    expect(html).toContain("Não há cobrança automática no fim");
    // O que sobrevive ao fim do teste, dito no contrato e nao so na tela.
    expect(html).toContain("continua guardado na conta");
  });

  it("a politica diz que so o e-mail e coletado no cadastro gratuito", async () => {
    definirLeitorDeConfig(async () => ({}));

    const html = renderToStaticMarkup(await Privacidade());

    expect(html).toContain("apenas o e-mail");
    expect(html).toContain("nenhum dado de pagamento");
  });

  it("a janela de retencao do lead vem da configuracao, e nao da copy", async () => {
    definirLeitorDeConfig(async () => ({ "param.m7.retencao_trial_meses": 9 }));

    const html = renderToStaticMarkup(await Privacidade());

    expect(html).toContain("9 meses");
    // Trocar o parametro tem de trocar o texto; um numero digitado na copy
    // viraria mentira no dia em que o advogado mudasse o prazo.
    expect(html).not.toContain("6 meses");
  });

  it("a politica aponta o canal do titular para o pedido de exclusao", async () => {
    definirLeitorDeConfig(async () => ({}));

    const html = renderToStaticMarkup(await Privacidade());

    expect(html).toContain("exclusão de conta de teste");
    expect(html).toContain("mailto:");
  });
});
