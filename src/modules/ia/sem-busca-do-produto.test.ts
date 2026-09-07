import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { CATALOGO, CHAVES } from "@/modules/config/catalogo";

import { TAREFAS } from "./tarefas";

/**
 * O sensor do AD-145: **a SPEC 40 nao deu ao produto uma busca na web.**
 *
 * A abertura de concurso pesquisa na sessao do Codex ou do Claude Code, com a
 * ferramenta e o limite daquela sessao. O produto continua sem provedor de
 * busca, sem segredo de busca e sem tarefa de IA para pesquisar ou interpretar
 * edital — o que existe em codigo e a fronteira que valida o que o agente
 * trouxe.
 *
 * Sem este arquivo, "custo zero de busca na API" seria promessa de documento.
 * Com ele, e sensor: no dia em que alguem adicionar `tavily`, `serpapi` ou uma
 * tarefa `busca_de_edital`, o teste fica vermelho e obriga uma AD nova.
 */

/**
 * Familias de provedor de busca e de raspagem, nao produtos especificos. O
 * alvo e a **capacidade**: qualquer coisa que faca o produto ir a web procurar
 * documento por conta propria.
 */
const PROVEDORES = [
  // Sem `\b` no fim: o nome costuma vir colado ao resto do identificador
  // (`TavilyClient`, `firecrawlScrape`), e a fronteira final deixaria passar.
  { nome: "Tavily", regex: /\btavily/i },
  { nome: "SerpApi", regex: /\bserp[-_]?api\b/i },
  { nome: "Bing Search", regex: /\bbing[-_.]?(search|api)\b/i },
  { nome: "Google CSE", regex: /\b(google[-_]?cse|customsearch|cx=)\b/i },
  { nome: "Brave Search", regex: /\bbrave[-_]?search\b/i },
  { nome: "Exa", regex: /\bexa[-_.](ai|search)\b/i },
  { nome: "Firecrawl", regex: /\bfirecrawl/i },
  { nome: "ScrapingBee/Apify", regex: /\b(scrapingbee|apify)\b/i },
  { nome: "web_search do provedor de modelo", regex: /\bweb_search(_preview)?\b/i },
];

const PASTAS_VARRIDAS = ["src/", "scripts/", "tests/", ".github/", "supabase/"];

/**
 * Os sensores nao se varrem, nem varrem uns aos outros.
 *
 * Os dois arquivos abaixo existem justamente para **procurar** estes nomes, e
 * por isso precisam escreve-los. Sao a unica excecao aceitavel — qualquer outro
 * arquivo que cite um provedor esta usando um, e e disso que o teste trata.
 */
const SENSORES = [
  "src/modules/ia/sem-busca-do-produto.test.ts",
  "scripts/skills-de-abertura.test.ts",
];

function arquivosDeCodigo(): string[] {
  return execFileSync("git", ["ls-files", "-z", ...PASTAS_VARRIDAS], {
    encoding: "utf8",
  })
    .split("\0")
    .filter((caminho) => caminho !== "" && !SENSORES.includes(caminho));
}

describe("a abertura de concurso nao criou busca no produto (AD-145)", () => {
  it("varre alguma coisa — sensor cego passaria sempre", () => {
    expect(arquivosDeCodigo().length).toBeGreaterThan(50);
  });

  it("nenhum provedor de busca ou raspagem aparece em codigo", () => {
    const achados: string[] = [];

    for (const caminho of arquivosDeCodigo()) {
      let texto: string;
      try {
        texto = readFileSync(caminho, "utf8");
      } catch {
        continue; // arquivo sumiu no meio da varredura
      }

      const linhas = texto.split(/\r?\n/);
      for (let i = 0; i < linhas.length; i += 1) {
        for (const { nome, regex } of PROVEDORES) {
          if (regex.test(linhas[i])) achados.push(`${caminho}:${i + 1} — ${nome}`);
        }
      }
    }

    expect(achados).toEqual([]);
  });

  it("o sensor enxerga: um texto com provedor casa com o padrao", () => {
    expect(PROVEDORES.some((p) => p.regex.test("const cliente = new TavilyClient()"))).toBe(
      true,
    );
    expect(PROVEDORES.some((p) => p.regex.test('tools: [{ type: "web_search" }]'))).toBe(
      true,
    );
    expect(PROVEDORES.some((p) => p.regex.test("const cliente = new Client()"))).toBe(false);
  });

  it("a lista fechada de tarefas nao ganhou busca nem leitura de edital", () => {
    // A medicao da SPEC 38 e o que a abertura reusa; nada alem disso entrou.
    const proibidas = /busca|pesquis|search|edital|scrape|raspagem|crawl/i;
    expect(TAREFAS.filter((tarefa) => proibidas.test(tarefa))).toEqual([]);
    expect(TAREFAS).toContain("etiqueta_de_item");
    expect(TAREFAS).toContain("separacao_de_itens");
  });

  it("nenhuma chave de configuracao guarda credencial ou endpoint de busca", () => {
    // A allowlist e a unica chave da abertura que fala de web, e ela e o
    // contrario de uma busca: e a lista do que **nao** se descarta.
    const suspeitas = CHAVES.filter((chave) =>
      /(busca|pesquis|search|api_key|segredo|credencial|endpoint)/i.test(chave),
    );
    expect(suspeitas).toEqual([]);
    expect(CHAVES).toContain("param.m1.dominios_oficiais");
    expect(CATALOGO["param.m1.dominios_oficiais"].moduloDono).toBe("m1");
  });
});
