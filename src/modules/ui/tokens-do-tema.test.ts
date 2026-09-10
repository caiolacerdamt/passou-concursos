import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * O guarda das duas listas gêmeas do tema escuro (AD-149).
 *
 * `@theme` do Tailwind v4 não pode ser aninhado em seletor nem em `@media`, e a
 * escolha explícita (`[data-tema="escuro"]`) e a delegação ao aparelho
 * (`[data-tema="sistema"]` dentro de `prefers-color-scheme: dark`) não podem
 * viver na mesma regra — a segunda mora num `@media`. O valor aparece duas
 * vezes por necessidade da linguagem.
 *
 * Duas listas mantidas à mão divergem: alguém ajusta o verde num bloco e
 * esquece o outro, e o aluno em "segue o sistema" passa a ver um produto
 * diferente do aluno que escolheu escuro. Nenhum teste de componente pega isso,
 * porque os dois caminhos renderizam o mesmo HTML — a diferença está só no CSS.
 * Este arquivo lê o `globals.css` e falha se um único par sair de sincronia.
 */

const CSS = readFileSync(
  path.resolve(import.meta.dirname, "../../app/globals.css"),
  "utf8",
);

/**
 * Corta o corpo de uma regra a partir da chave de abertura, contando pares.
 * Regex sozinha erraria no `@media`, que tem chave dentro de chave.
 */
function corpoDaRegra(css: string, seletor: string): string {
  const inicio = css.indexOf(seletor);
  expect(inicio, `seletor ausente no globals.css: ${seletor}`).toBeGreaterThan(-1);

  let profundidade = 0;
  const abre = css.indexOf("{", inicio);
  for (let i = abre; i < css.length; i += 1) {
    if (css[i] === "{") profundidade += 1;
    if (css[i] === "}") {
      profundidade -= 1;
      if (profundidade === 0) return css.slice(abre + 1, i);
    }
  }
  throw new Error(`regra sem fechamento: ${seletor}`);
}

function tokens(corpo: string): Record<string, string> {
  const mapa: Record<string, string> = {};
  for (const [, nome, valor] of corpo.matchAll(/(--[\w-]+)\s*:\s*([^;}]+);/g)) {
    mapa[nome] = valor.trim();
  }
  return mapa;
}

const escuro = tokens(corpoDaRegra(CSS, '[data-tema="escuro"] {'));
const sistema = tokens(
  corpoDaRegra(corpoDaRegra(CSS, "@media (prefers-color-scheme: dark) {"), '[data-tema="sistema"] {'),
);

describe("tokens do tema escuro", () => {
  it("as duas listas declaram exatamente os mesmos tokens", () => {
    expect(Object.keys(sistema).sort()).toEqual(Object.keys(escuro).sort());
  });

  it("cada token tem o mesmo valor nas duas listas", () => {
    expect(sistema).toEqual(escuro);
  });

  it("cobre as duas famílias de nome que o app usa em paralelo", () => {
    // Os nomes históricos do app (`fundo`, `texto`, `marca`...) e os da
    // superfície editorial (`papel`, `tinta`, `verde`...) apontam para a mesma
    // matéria e são usados nas mesmas telas. Um par esquecido deixa metade da
    // tela clara — o modo mais provável de a rodada falhar em silêncio.
    for (const [antigo, novo] of [
      ["--color-fundo", "--color-papel"],
      ["--color-painel", "--color-papel-alto"],
      ["--color-fundo-suave", "--color-papel-recuo"],
      ["--color-texto", "--color-tinta"],
      ["--color-suave", "--color-tinta-suave"],
      ["--color-linha", "--color-risco"],
      ["--color-marca", "--color-verde"],
      ["--color-marca-apoio", "--color-verde-texto"],
      ["--color-marca-viva", "--color-verde-vivo"],
      ["--color-marca-suave", "--color-verde-tenue"],
    ]) {
      expect(escuro[antigo], `${antigo} não foi redefinido no escuro`).toBeDefined();
      expect(escuro[novo], `${novo} não foi redefinido no escuro`).toBeDefined();
      expect(escuro[antigo], `${antigo} e ${novo} divergiram`).toBe(escuro[novo]);
    }
  });

  it("não introduz `@theme inline` nem uma variante `escuro`", () => {
    // Ambos foram descartados de propósito: redefinimos o token em si, sem
    // indireção, e nenhum componente precisou de exceção pontual. Se um deles
    // aparecer, a decisão mudou e tem de ser registrada em AD, não caber aqui.
    //
    // Casa a at-rule no início da linha, e não a substring: os comentários do
    // `globals.css` citam os dois nomes ao explicar por que ficaram de fora, e
    // um `toContain` reprovaria a própria justificativa.
    expect(CSS).not.toMatch(/^\s*@theme\s+inline/m);
    expect(CSS).not.toMatch(/^\s*@custom-variant\s+escuro/m);
  });

  it("o `color-scheme` cobre os três estados", () => {
    // Sem isto a barra de rolagem e os widgets nativos ficam claros dentro de
    // uma tela escura, e a área de overscroll do celular fica bege.
    expect(CSS).toMatch(/html\[data-tema="escuro"\]\s*\{\s*color-scheme:\s*dark/);
    expect(CSS).toMatch(/html\[data-tema="sistema"\]\s*\{\s*color-scheme:\s*light dark/);
    expect(CSS).toMatch(/html\[data-tema="claro"\]\s*\{\s*color-scheme:\s*light/);
  });
});
