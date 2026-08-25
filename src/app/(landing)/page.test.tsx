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

/**
 * Guarda o AC de PAG-08, nao a redacao.
 *
 * O visual da pagina mudou inteiro na rodada de design; o contrato nao. Por isso
 * as assercoes abaixo miram o que a spec exige que exista — metodo, evidencia,
 * declaracao honesta, os dois precos, garantia, links legais antes do CTA — e
 * nao a frase exata, que e decisao de marketing e vai mudar de novo.
 */
describe("pagina de vendas", () => {
  it("exibe método, evidências, estado atual, dois preços, garantia e CTA", async () => {
    definirLeitorDeConfig(async () => ({}));

    const html = renderToStaticMarkup(await Home());

    // Método: a origem da questão e a revisão espaçada são os dois pilares.
    expect(html).toContain("prova real");
    expect(html).toContain("revisão");

    // Evidência científica citada, não inventada.
    expect(html).toContain("Donoghue");
    expect(html).toContain("242");

    // Os dois preços, ambos antes da escolha (AC4 de PAG-09).
    expect(html).toContain("197,00");
    expect(html).toContain("177,30");
    expect(html).toContain("Garantia de 7 dias");

    expect(html).toContain('href="/checkout"');
    expect(html).toContain('href="/termos"');
    expect(html).toContain('href="/privacidade"');

    // AC4: os dois links legais aparecem antes do botão que leva ao pagamento.
    expect(html.indexOf("Termos de uso")).toBeLessThan(
      html.indexOf("Conferir o checkout"),
    );
    expect(html.indexOf("Política de privacidade")).toBeLessThan(
      html.indexOf("Conferir o checkout"),
    );

    // Rodada de copy de 2026-08-25 (AD-110): a página deixou de listar o que
    // ainda não existe — decisão do dono, registrada em STATE.md, que revoga
    // a AC2 original de PAG-08 só para esta página.
    expect(html).toContain("O que você recebe quando assina");

    // Invariante 15: sem ranking entre alunos.
    expect(html).toContain("Ranking entre alunos não faz parte");

    expect(html).not.toContain("data-nascimento");
  });
});
