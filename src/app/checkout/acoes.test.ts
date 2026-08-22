import { afterEach, describe, expect, it, vi } from "vitest";

const deps = vi.hoisted(() => ({
  executarCheckout: vi.fn(),
  reportarErro: vi.fn(),
  redirect: vi.fn((destino: string): never => {
    throw new Error(`NEXT_REDIRECT:${destino}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect: deps.redirect }));

vi.mock("@/lib/db/servidor", () => ({
  clienteDeServico: vi.fn(() => ({})),
}));

vi.mock("@/modules/observabilidade/reporte", () => ({
  reportarErro: deps.reportarErro,
}));

vi.mock("@/modules/pagamentos/checkout", () => ({
  dadosDoFormularioCheckout: vi.fn(() => ({})),
  executarCheckout: deps.executarCheckout,
}));

vi.mock("@/modules/pagamentos/asaas", () => ({
  gatewayAsaasDoAmbiente: vi.fn(() => ({})),
}));

vi.mock("@/modules/pagamentos/preco", () => ({
  obterPrecosPublicos: vi.fn(async () => ({
    parcelado: {
      totalCentavos: 19_704,
      parcelas: 12,
      parcelaCentavos: 1_642,
      totalFormatado: "R$ 197,04",
      parcelaFormatada: "R$ 16,42",
    },
    aVista: { totalCentavos: 17_730, totalFormatado: "R$ 177,30" },
    garantiaDias: 7,
  })),
}));

vi.mock("@/modules/pagamentos/repositorio", () => ({
  criarRepositorioDePagamentos: vi.fn(() => ({})),
}));

const { enviarCheckout } = await import("./acoes");

afterEach(() => {
  vi.clearAllMocks();
});

describe("action de checkout", () => {
  it("deixa o redirect de sucesso atravessar sem virar erro do gateway", async () => {
    deps.executarCheckout.mockResolvedValue({
      tipo: "criado",
      resultadoToken: "token-de-resultado",
      referencia: "checkout-teste",
    });

    await expect(
      enviarCheckout({ tipo: "inicial" }, new FormData()),
    ).rejects.toThrow("NEXT_REDIRECT:/checkout/resultado/token-de-resultado");

    expect(deps.redirect).toHaveBeenCalledWith(
      "/checkout/resultado/token-de-resultado",
    );
    expect(deps.reportarErro).not.toHaveBeenCalled();
  });
});
