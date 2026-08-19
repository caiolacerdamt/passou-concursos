import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Shell } from "./shell";

describe("Shell", () => {
  it("o link de pulo e o primeiro focavel e aponta para o main (UI-03 AC4)", () => {
    const saida = renderToStaticMarkup(<Shell>conteúdo</Shell>);

    expect(saida).toContain('href="#conteudo"');
    expect(saida).toContain('<main id="conteudo"');
    // "primeiro focavel" nao e opiniao: o link tem que vir antes do cabecalho.
    expect(saida.indexOf('href="#conteudo"')).toBeLessThan(saida.indexOf("<header"));
  });

  it("o link de pulo aparece quando recebe foco (UI-03 AC1)", () => {
    const saida = renderToStaticMarkup(<Shell>x</Shell>);

    expect(saida).toContain("sr-only");
    expect(saida).toContain("focus:not-sr-only");
  });

  it("as acoes do cabecalho entram no proprio cabecalho", () => {
    const saida = renderToStaticMarkup(
      <Shell acoes={<span>Sair</span>}>conteúdo</Shell>,
    );

    expect(saida.indexOf("Sair")).toBeLessThan(saida.indexOf("<main"));
  });
});

/**
 * UI-01 AC1 exige 360px sem rolagem horizontal, e a causa numero um disso e
 * largura fixa em px maior que a tela. Nao da para medir pixel sem navegador,
 * mas da para proibir a causa: **nenhum componente de UI declara largura em
 * px**. O `body` ja tem `overflow-x: hidden` como rede; esta varredura e para o
 * defeito nao chegar la.
 */
describe("camada de UI · largura", () => {
  const pasta = import.meta.dirname;

  const arquivos = readdirSync(pasta).filter(
    (nome) => nome.endsWith(".tsx") && !nome.endsWith(".test.tsx"),
  );

  it("nenhum componente declara largura fixa em px", () => {
    expect(arquivos.length).toBeGreaterThan(0);

    const culpados = arquivos.filter((nome) =>
      /\b(?:max-w|min-w|w|max-h|min-h|h)-\[\d+px\]/.test(
        readFileSync(path.join(pasta, nome), "utf8"),
      ),
    );

    expect(culpados).toEqual([]);
  });
});
