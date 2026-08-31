import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ListaComTeto } from "./lista-com-teto";

/**
 * O projeto não tem DOM nos testes (AD-083: `unit` roda em node, sem jsdom),
 * então o que se afirma aqui é o **primeiro quadro** de cada estado — que é
 * onde moram as decisões: quantos itens saem, o que o rodapé oferece e com que
 * número. O comportamento do clique em si é `useState`, e o primeiro quadro de
 * cada estado é o que prova qual ramo o componente escolhe.
 */

function itens(quantos: number) {
  return Array.from({ length: quantos }, (_, indice) => <li key={indice}>{`item ${indice}`}</li>);
}

function render(props: Partial<Parameters<typeof ListaComTeto>[0]> = {}): string {
  return renderToStaticMarkup(
    <ListaComTeto
      itens={itens(4)}
      total={4}
      hrefDoResto="/app/progresso"
      rotuloDoResto="Ver os restantes no Caderno completo"
      nomeDosItens="erros"
      {...props}
    />,
  );
}

describe("ListaComTeto", () => {
  it("some com o rodapé quando a lista inteira já está na tela", () => {
    const html = render();

    expect(html).toContain("item 3");
    expect(html).not.toContain("Mostrar mais");
    expect(html).not.toContain("Mostrar menos");
    expect(html).not.toContain("Caderno completo");
  });

  it("corta em quatro e oferece o lote seguinte", () => {
    const html = render({ itens: itens(30), total: 30 });

    expect(html).toContain("item 3");
    expect(html).not.toContain("item 4");
    expect(html).toContain("Mostrar mais 8");
    expect(html).toContain("· restam 26");
  });

  it("pede só o que sobra quando falta menos de um lote", () => {
    const html = render({ itens: itens(7), total: 7 });

    // Prometer "mais 8" e entregar 3 é o tipo de número que corrói confiança.
    expect(html).toContain("Mostrar mais 3");
    // Abaixo de um lote o "restam" seria a repetição do próprio botão.
    expect(html).not.toContain("restam");
  });

  it("entrega a tela dona quando não há mais lote a abrir aqui", () => {
    // Caso do teto da consulta: o que veio já está todo na tela, mas o banco
    // tem muito mais. Abrir não resolve — quem resolve é `/app/progresso`.
    const html = render({ itens: itens(4), total: 214 });

    expect(html).not.toContain("Mostrar mais");
    expect(html).toContain("Ver os restantes no Caderno completo");
    expect(html).toContain('href="/app/progresso"');
  });

  it("não oferece a tela dona enquanto ainda dá para abrir mais aqui", () => {
    // Mandar embora quem ainda podia resolver na própria tela é o contrário do
    // que o teto existe para fazer.
    const html = render({ itens: itens(30), total: 214 });

    expect(html).toContain("Mostrar mais 8");
    expect(html).not.toContain("Ver os restantes no Caderno completo");
  });

  it("mantém o rodapé grudado no pé do cartão", () => {
    // É o que responde ao "abriu, agora como fecho?": por mais que a lista
    // tenha crescido, o rodapé fica à vista em vez de ir para o fim do rolo.
    const html = render({ itens: itens(30), total: 30 });

    expect(html).toMatch(/class="[^"]*sticky[^"]*bottom-0/);
  });
});
