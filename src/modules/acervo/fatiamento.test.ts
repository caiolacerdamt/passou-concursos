import { afterEach, describe, expect, it } from "vitest";

import {
  type LeitorDeConfig,
  definirLeitorDeConfig,
  restaurarLeitorPadrao,
} from "@/modules/config";

import {
  PaginaMaiorQueOTeto,
  estimarTokens,
  fatiarEmBlocos,
  orcamentoVigente,
} from "./fatiamento";
import type { PaginaDoPdf } from "./pdf";

function pagina(numero: number, tamanho: number): PaginaDoPdf {
  return { numero, texto: "x".repeat(tamanho), imagens: [] };
}

/** Um orcamento pequeno, para o teste caber na cabeca: 1 char = 1 token. */
const ORCAMENTO = { teto: 100, tetoUtil: 100, charsPorToken: 1 };

afterEach(() => {
  restaurarLeitorPadrao();
});

describe("fatiarEmBlocos — nenhum pedido passa do teto (IA-17)", () => {
  it("prova curta cabe num bloco so", () => {
    const blocos = fatiarEmBlocos([pagina(1, 10), pagina(2, 10)], ORCAMENTO);

    expect(blocos).toHaveLength(1);
    expect(blocos[0].indice).toBe(0);
    expect(blocos[0].primeiraPagina).toBe(1);
    expect(blocos[0].ultimaPagina).toBe(2);
  });

  it("prova longa vira varios blocos, e nenhum deles passa do teto", () => {
    const paginas = Array.from({ length: 12 }, (_, i) => pagina(i + 1, 30));

    const blocos = fatiarEmBlocos(paginas, ORCAMENTO);

    expect(blocos.length).toBeGreaterThan(1);
    for (const bloco of blocos) {
      expect(bloco.tokensEstimados).toBeLessThanOrEqual(ORCAMENTO.tetoUtil);
    }
  });

  it("nenhuma pagina fica de fora e nenhuma entra duas vezes", () => {
    const paginas = Array.from({ length: 9 }, (_, i) => pagina(i + 1, 40));

    const blocos = fatiarEmBlocos(paginas, ORCAMENTO);

    // O bloco carrega o intervalo de paginas; a uniao dos intervalos tem que
    // ser a prova inteira, em ordem e sem buraco. Perder uma pagina no meio
    // perderia questoes sem ninguem perceber.
    const cobertas = blocos.flatMap((bloco) => {
      const lista: number[] = [];
      for (let n = bloco.primeiraPagina; n <= bloco.ultimaPagina; n += 1) lista.push(n);
      return lista;
    });
    expect(cobertas).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("o indice do bloco e sequencial a partir de zero", () => {
    // O indice entra na chave de dedup do lote: se ele mudasse de sentido, a
    // retomada reprocessaria bloco ja pago.
    const blocos = fatiarEmBlocos(
      Array.from({ length: 8 }, (_, i) => pagina(i + 1, 40)),
      ORCAMENTO,
    );
    expect(blocos.map((b) => b.indice)).toEqual(
      blocos.map((_, indice) => indice),
    );
  });

  it("pagina em branco no meio nao desloca a numeracao das seguintes", () => {
    const blocos = fatiarEmBlocos(
      [pagina(1, 10), { numero: 2, texto: "", imagens: [] }, pagina(3, 10)],
      ORCAMENTO,
    );

    expect(blocos[0].ultimaPagina).toBe(3);
    expect(blocos[0].texto).toContain("--- pagina 2 ---");
  });

  it("pagina sozinha acima do teto e parada visivel, nao texto truncado", () => {
    expect(() => fatiarEmBlocos([pagina(1, 500)], ORCAMENTO)).toThrow(
      PaginaMaiorQueOTeto,
    );
    // E para com o numero da pagina, que e o que o operador precisa para agir.
    expect(() => fatiarEmBlocos([pagina(1, 10), pagina(2, 500)], ORCAMENTO)).toThrow(
      /pagina 2/,
    );
  });

  it("o texto do bloco marca de que pagina veio cada pedaco", () => {
    const blocos = fatiarEmBlocos([pagina(4, 10), pagina(5, 10)], ORCAMENTO);

    expect(blocos[0].texto).toContain("--- pagina 4 ---");
    expect(blocos[0].texto).toContain("--- pagina 5 ---");
  });
});

describe("orcamentoVigente — o teto vem da configuracao", () => {
  it("aplica a margem sobre o teto lido do banco", async () => {
    const leitor: LeitorDeConfig = async () => ({
      "param.m1.teto_tokens_por_pedido": 100_000,
      "param.m1.margem_do_teto": 0.25,
      "param.m1.chars_por_token": 4,
    });
    definirLeitorDeConfig(leitor);

    const orcamento = await orcamentoVigente();

    expect(orcamento.teto).toBe(100_000);
    expect(orcamento.tetoUtil).toBe(75_000);
    expect(orcamento.charsPorToken).toBe(4);
  });

  it("sem linha no banco vale o default do catalogo, que e o teto do fornecedor", async () => {
    definirLeitorDeConfig(async () => ({}));

    const orcamento = await orcamentoVigente();

    // 272K e o degrau do AD-073. Ele nao esta escrito aqui como numero solto:
    // o teste compara com o teto util, que e o teto menos a margem default.
    expect(orcamento.teto).toBe(272_000);
    expect(orcamento.tetoUtil).toBeLessThan(orcamento.teto);
    expect(orcamento.tetoUtil).toBeGreaterThan(0);
  });

  it("o fatiamento respeita o teto que a configuracao mandar, seja qual for", async () => {
    // A prova de que o numero nao esta em codigo: dois tetos diferentes, sobre
    // a mesma prova, produzem quantidades diferentes de bloco.
    const paginas = Array.from({ length: 10 }, (_, i) => pagina(i + 1, 100));

    const apertado = fatiarEmBlocos(paginas, {
      teto: 250,
      tetoUtil: 250,
      charsPorToken: 1,
    });
    const folgado = fatiarEmBlocos(paginas, {
      teto: 2000,
      tetoUtil: 2000,
      charsPorToken: 1,
    });

    expect(apertado.length).toBeGreaterThan(folgado.length);
    expect(folgado).toHaveLength(1);
  });
});

describe("estimarTokens", () => {
  it("arredonda para cima: meia unidade a mais nao pode caber", () => {
    expect(estimarTokens("abcde", 4)).toBe(2);
    expect(estimarTokens("", 4)).toBe(0);
  });
});
