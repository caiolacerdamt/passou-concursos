import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencias = vi.hoisted(() => ({
  fila: vi.fn(),
  decidir: vi.fn(),
  corrigir: vi.fn(),
}));

vi.mock("@/modules/operador", () => ({
  consultarFilaRevisao: dependencias.fila,
}));
vi.mock("./acoes", () => ({
  decidirFila: dependencias.decidir,
  corrigirQuestao: dependencias.corrigir,
}));

const { default: Fila } = await import("./page");

const fila = [
  {
    id: 7,
    questaoId: "11111111-1111-4111-8111-111111111111",
    questaoVersao: 1,
    motivo: "confiança abaixo do piso",
    prioridade: 9,
    criadaEm: "2026-08-23T10:00:00.000Z",
    questao: {
      tipoQuestao: "multipla_escolha" as const,
      origem: "real" as const,
      enunciado: "Qual alternativa descreve a operação?",
      alternativas: [
        { letra: "A" as const, texto: "Primeira" },
        { letra: "B" as const, texto: "Segunda" },
      ],
      respostaCorreta: "A",
      anulada: false,
      proveniencia: {
        banca: "CESGRANRIO",
        ano: 2024,
        orgao: "Banco do Brasil",
        cargo: "Escriturário",
        numero: 12,
      },
    },
  },
];

describe("/operador/fila", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencias.fila.mockResolvedValue(fila);
  });

  it("mostra prioridade, proveniência, lote com motivo e editor de nova versão", async () => {
    const html = renderToStaticMarkup(
      await Fila({ searchParams: Promise.resolve({}) }),
    );

    expect(dependencias.fila).toHaveBeenCalledTimes(1);
    expect(html).toContain("prioridade 9");
    expect(html).toContain("CESGRANRIO · 2024 · Banco do Brasil · Escriturário · questão 12");
    expect(html).toContain('name="revisoes"');
    expect(html).toContain('name="motivo"');
    expect(html).toContain("Aprovar selecionadas");
    expect(html).toContain("Corrigir esta questão — cria uma nova versão");
    expect(html).toContain("versão 2");
    expect(html).toContain("gabarito oficial");
  });

  it("usa estado vazio sem inventar conteúdo quando a fila não tem itens", async () => {
    dependencias.fila.mockResolvedValue([]);
    const html = renderToStaticMarkup(
      await Fila({ searchParams: Promise.resolve({ estado: "decidido" }) }),
    );

    expect(html).toContain("A fila está limpa");
    expect(html).toContain("Decisão registrada");
    expect(html).not.toContain("consulta secreta");
  });
});
