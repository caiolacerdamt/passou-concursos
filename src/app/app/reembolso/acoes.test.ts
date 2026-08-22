import { describe, expect, it, vi } from "vitest";

const desvio = vi.hoisted(() => ({ destino: null as string | null }));

vi.mock("next/navigation", () => ({
  redirect: (para: string) => {
    desvio.destino = para;
    throw new Error(`NEXT_REDIRECT:${para}`);
  },
}));

vi.mock("@/lib/db/sessao", () => ({
  clienteDaSessao: async () => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
  }),
}));

const { pedirReembolso } = await import("./acoes");

describe("action de reembolso", () => {
  it("exige sessão antes de acessar pagamento ou gateway", async () => {
    desvio.destino = null;

    await expect(pedirReembolso()).rejects.toThrow(
      "NEXT_REDIRECT:/entrar?proximo=%2Fapp%2Freembolso",
    );
    expect(desvio.destino).toBe("/entrar?proximo=%2Fapp%2Freembolso");
  });
});
