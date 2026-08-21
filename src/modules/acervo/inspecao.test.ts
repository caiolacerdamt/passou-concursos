import { describe, expect, it } from "vitest";

import { relatorioDoEstado } from "./inspecao";
import type { EstadoDaProva, EstadoDoBloco } from "./inspecao";

function bloco(campos: Partial<EstadoDoBloco> = {}): EstadoDoBloco {
  return {
    bloco: 0,
    status: "colhido",
    primeiraPagina: 1,
    ultimaPagina: 4,
    aceitas: 10,
    recusadas: 0,
    erro: null,
    ...campos,
  };
}

const PROVA = {
  id: "p1",
  banca: "Cesgranrio",
  ano: 2021,
  orgao: "Banco do Brasil",
  cargo: "Escriturario",
  status: "extraida" as const,
};

function estado(blocos: EstadoDoBloco[]): EstadoDaProva {
  return { prova: PROVA, blocos };
}

describe("relatorioDoEstado", () => {
  it("bloco falhado ganha aviso e o motivo", () => {
    const texto = relatorioDoEstado(
      estado([bloco(), bloco({ bloco: 1, status: "falhou", aceitas: 0, erro: "content_filter" })]),
    );

    expect(texto).toContain("falhou");
    expect(texto).toContain("content_filter");
    expect(texto).toContain("--acao enviar reenvia so eles");
  });

  it("perda PARCIAL tem aviso proprio: o bloco parece pronto e nao esta", () => {
    // Medido na Prova C do BB 2021: o bloco voltou repartido, tres paginas
    // entraram e uma foi cortada pelo provedor. O bloco fecha como `colhido`,
    // e sem este aviso as questoes da pagina perdida sumiriam caladas — o
    // unico jeito de o acervo ficar errado sem ninguem saber.
    const texto = relatorioDoEstado(
      estado([bloco({ bloco: 1, erro: "pagina 5: content_filter" })]),
    );

    expect(texto).toContain("perda PARCIAL");
    expect(texto).toContain("nao estao no acervo");
    expect(texto).toContain("pagina 5");
  });

  it("prova inteira sem problema nenhum nao inventa aviso", () => {
    const texto = relatorioDoEstado(estado([bloco(), bloco({ bloco: 1 })]));

    expect(texto).not.toContain("falhado");
    expect(texto).not.toContain("PARCIAL");
  });

  it("prova sem bloco nenhum diz o que fazer", () => {
    expect(relatorioDoEstado(estado([]))).toContain("--acao enviar");
  });
});
