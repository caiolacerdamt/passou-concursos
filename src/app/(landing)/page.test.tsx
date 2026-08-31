import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import { definirLeitorDeConfig, restaurarLeitorPadrao } from "@/modules/config";

import Home from "./page";

afterEach(() => {
  restaurarLeitorPadrao();
});

/**
 * Guarda o AC de PAG-08, nao a redacao.
 *
 * O visual da pagina mudou inteiro duas vezes; o contrato nao. Por isso as
 * assercoes miram o que a spec exige que exista — metodo, evidencia, os dois
 * precos, garantia, links legais antes do CTA — e nao a frase exata, que e
 * decisao de marketing e ja mudou de novo.
 *
 * **Duas assercoes trocaram de ancora na rodada v2** (landing de 8 atos,
 * `scrollcraft/builds/passou-lp-v2/PLANO.md`). Nao foram afrouxadas: o mesmo
 * AC passou a ser carregado por outro ato.
 *
 *   · "O que voce recebe quando assina" era a secao `Hoje`, que a v2 removeu.
 *     Quem carrega "por que isto se sustenta" agora e o ato 7, o trilho de
 *     garantias — e o que a lista de beneficios dizia continua nos dois
 *     cartoes de preco.
 *   · "Ranking entre alunos nao faz parte" era a nota de rodape da mesma
 *     secao. O invariante 15 agora e o ultimo cartao do trilho, "Sem placar".
 *
 * As tres assercoes novas travam decisoes desta rodada que sao faceis de
 * desfazer sem perceber: o dial e um grupo de radio de verdade (teclado), a
 * questao da vitrine se declara exemplo, e o plano do dia sai renderizado do
 * servidor em vez de depender de JS.
 */
describe("pagina de vendas", () => {
  it("exibe método, evidências, os dois preços, garantia e CTA", async () => {
    definirLeitorDeConfig(async () => ({}));

    const html = renderToStaticMarkup(await Home());

    // Método: a origem da questão e a revisão espaçada são os dois pilares.
    expect(html).toContain("prova real");
    expect(html).toContain("revisão espaçada");

    // Evidência científica citada, não inventada. Mora no ato 6.
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
      html.indexOf("Quero começar meu plano"),
    );
    expect(html.indexOf("Política de privacidade")).toBeLessThan(
      html.indexOf("Quero começar meu plano"),
    );

    // O método fecha como uma rotina completa, sem depender de jargão interno.
    expect(html).toContain("Seu dia de estudo, do começo ao fim.");
    expect(html).toContain("Abra o que está no seu plano");
    expect(html).toContain("Amanhã tem um novo plano");

    // Invariante 15: sem ranking entre alunos.
    expect(html).toContain("Sem ranking entre alunos");

    expect(html).not.toContain("data-nascimento");
  });

  it("entrega o plano do dia sem depender de JavaScript", async () => {
    definirLeitorDeConfig(async () => ({}));

    const html = renderToStaticMarkup(await Home());

    // O ato 4 renderiza o plano padrão no servidor. `assinatura.ts` reescreve a
    // lista quando o dial muda, mas nunca é ele quem a cria: sem isto a folha
    // do pico nasceria vazia para quem chega sem JS e para o rastreador.
    expect(html).toContain("Interpretação de textos");
    expect(html).toContain("Segurança da informação");
    expect(html).toContain("Revisão programada");
  });

  it("dá ao dial um grupo de rádio de verdade, alcançável por teclado", async () => {
    definirLeitorDeConfig(async () => ({}));

    const html = renderToStaticMarkup(await Home());

    // Três rádios nativos com o mesmo `name`: é o que dá seta, Home/End e um
    // único ponto de tabulação de graça. Trocar por <button role="radio"> passa
    // despercebido no olho e quebra o teclado, que o PLANO.md exige.
    expect(html.match(/type="radio" name="tempo-do-dia"/g)).toHaveLength(3);
    expect(html).toContain("Quanto tempo você tem hoje?");
  });

  it("declara que a questão da vitrine é exemplo", async () => {
    definirLeitorDeConfig(async () => ({}));

    const html = renderToStaticMarkup(await Home());

    // A página promete proveniência em banca, ano, órgão, cargo e número duas
    // seções antes. Um item de vitrine com etiqueta inventada seria a página se
    // contradizendo — a etiqueta diz "exemplo" enquanto não houver questão real
    // liberada para mostrar.
    expect(html).toContain("exemplo");
    expect(html).not.toMatch(/CESGRANRIO|CESPE|FGV|Cebraspe/);
  });

  it("encerra a landing na oferta e não revive a etiqueta ou o ato removido", async () => {
    definirLeitorDeConfig(async () => ({}));

    const html = renderToStaticMarkup(await Home());

    expect(html.match(/data-sc-act=/g)).toHaveLength(10);
    expect(html).toContain("Estudar fica melhor quando tem gente fazendo junto.");
    expect(html).not.toContain("3 blocos · 47 questões");
    expect(html).not.toContain("Amanhã tem outro.");
    expect(html).not.toContain("secao--amanha");
  });
});
