import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencias = vi.hoisted(() => ({
  decidir: vi.fn(),
  corrigir: vi.fn(),
  revalidar: vi.fn(),
  redirecionar: vi.fn((destino: string) => {
    throw new Error(`REDIRECT:${destino}`);
  }),
  reportar: vi.fn(),
}));

vi.mock("@/modules/operador", () => ({
  decidirRevisoesEmLote: dependencias.decidir,
  corrigirQuestao: dependencias.corrigir,
  EntradaDoOperadorInvalida: class EntradaDoOperadorInvalida extends Error {},
}));
vi.mock("@/modules/observabilidade/reporte", () => ({
  reportarErro: dependencias.reportar,
}));
vi.mock("next/cache", () => ({
  revalidatePath: dependencias.revalidar,
}));
vi.mock("next/navigation", () => ({
  redirect: dependencias.redirecionar,
}));

const { decidirFila, corrigirQuestao } = await import("./acoes");

describe("ações da fila do operador", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencias.decidir.mockResolvedValue(2);
    dependencias.corrigir.mockResolvedValue({ questaoId: "q-1", questaoVersao: 2 });
  });

  it("envia apenas ids, decisão e motivo para o lote", async () => {
    const formulario = new FormData();
    formulario.append("revisoes", "4");
    formulario.append("revisoes", "8");
    formulario.append("decisao", "aprovada");
    formulario.append("motivo", "conferido com gabarito oficial");

    await expect(decidirFila(formulario)).rejects.toThrow("REDIRECT:/operador/fila?estado=decidido");
    expect(dependencias.decidir).toHaveBeenCalledWith({
      revisoes: [4, 8],
      decisao: "aprovada",
      motivo: "conferido com gabarito oficial",
    });
    expect(dependencias.revalidar).toHaveBeenCalledWith("/operador/fila");
  });

  it("mapeia a correção para a criação de uma nova versão", async () => {
    const formulario = new FormData();
    formulario.set("questaoId", "22222222-2222-4222-8222-222222222222");
    formulario.set("questaoVersao", "3");
    formulario.set("mudancaTipo", "substantiva");
    formulario.set("motivo", "gabarito conferido");
    formulario.set("enunciado", "Novo enunciado");
    formulario.set("alternativas", '[{"letra":"A","texto":"Uma"},{"letra":"B","texto":"Duas"}]');
    formulario.set("respostaCorreta", "A");
    formulario.set("anulada", "false");

    await expect(corrigirQuestao(formulario)).rejects.toThrow("REDIRECT:/operador/fila?estado=corrigido");
    expect(dependencias.corrigir).toHaveBeenCalledWith({
      questaoId: "22222222-2222-4222-8222-222222222222",
      questaoVersao: 3,
      mudancaTipo: "substantiva",
      motivo: "gabarito conferido",
      campos: {
        enunciado: "Novo enunciado",
        alternativas: [
          { letra: "A", texto: "Uma" },
          { letra: "B", texto: "Duas" },
        ],
        respostaCorreta: "A",
        anulada: false,
      },
    });
  });

  it("orienta erro de entrada sem mostrar detalhe interno", async () => {
    dependencias.decidir.mockRejectedValue(new Error("consulta secreta"));
    const formulario = new FormData();
    formulario.append("revisoes", "1");
    formulario.append("decisao", "aprovada");
    formulario.append("motivo", "x");

    await expect(decidirFila(formulario)).rejects.toThrow("REDIRECT:/operador/fila?estado=erro");
    expect(dependencias.reportar).toHaveBeenCalled();
    expect(String(dependencias.redirecionar.mock.calls[0]?.[0])).not.toContain("consulta secreta");
  });
});
