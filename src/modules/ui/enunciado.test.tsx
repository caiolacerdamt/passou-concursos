import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TextoFormatado, separarEnunciado } from "./enunciado";

function html(texto: string): string {
  return renderToStaticMarkup(<TextoFormatado texto={texto} />);
}

describe("separarEnunciado", () => {
  it("separa o texto de apoio do comando, que e sempre o ultimo bloco", () => {
    const { apoio, comando } = separarEnunciado(
      "Privacidade digital: quais sao os limites.\n\nSomos 126 milhoes de usuarios.\n\nO texto desenvolve a ideia de que",
    );

    expect(apoio).toEqual([
      "Privacidade digital: quais sao os limites.",
      "Somos 126 milhoes de usuarios.",
    ]);
    expect(comando).toBe("O texto desenvolve a ideia de que");
  });

  it("questao sem texto de apoio nao inventa apoio vazio", () => {
    const { apoio, comando } = separarEnunciado("Compete ao Conselho Monetario Nacional");

    expect(apoio).toEqual([]);
    expect(comando).toBe("Compete ao Conselho Monetario Nacional");
  });
});

describe("TextoFormatado", () => {
  it("interpreta negrito em vez de imprimir os asteriscos", () => {
    const saida = html("**Povos da floresta.** Alem de acordos de financiamento");

    expect(saida).toContain("<strong");
    expect(saida).toContain("Povos da floresta.");
    expect(saida).not.toContain("**");
  });

  it("interpreta italico sem confundir com negrito", () => {
    expect(html("o termo *compliance* aparece")).toContain("<em>compliance</em>");
    expect(html("**dois** e *um*")).toContain("<em>um</em>");
  });

  it("linha em branco vira paragrafo novo", () => {
    const saida = html("Primeiro bloco.\n\nSegundo bloco.");

    expect(saida.match(/<p>/g)).toHaveLength(2);
  });

  it("abre lista com marcador e lista numerada", () => {
    expect(html("- primeiro\n- segundo")).toContain("<ul");
    expect(html("I. primeira asercao\nII. segunda asercao")).toContain("<ol");
    expect(html("1. primeira\n2. segunda")).toContain("<ol");
  });

  it("asterisco solto nao engole o resto do enunciado", () => {
    const saida = html("a taxa e de 3%* ao mes e o prazo vence hoje");

    expect(saida).not.toContain("<em>");
    expect(saida).toContain("o prazo vence hoje");
  });

  it("nao executa html que venha no texto do acervo", () => {
    const saida = html("<script>alert(1)</script> segue o enunciado");

    expect(saida).not.toContain("<script>");
    expect(saida).toContain("&lt;script&gt;");
  });

  it("marca fora da lista fechada sai como texto literal", () => {
    const saida = html("veja [o link](https://exemplo.com) e <u>isto</u>");

    expect(saida).not.toContain("<a ");
    expect(saida).not.toContain("<u>");
    expect(saida).toContain("[o link](https://exemplo.com)");
  });
});
