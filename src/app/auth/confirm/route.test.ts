import { afterEach, describe, expect, it, vi } from "vitest";

const deps = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
  redirect: vi.fn((destino: string): never => {
    throw new Error(`NEXT_REDIRECT:${destino}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect: deps.redirect }));

vi.mock("@/lib/db/sessao", () => ({
  clienteDaSessao: vi.fn(async () => ({
    auth: { verifyOtp: deps.verifyOtp },
  })),
}));

const { GET } = await import("./route");

afterEach(() => {
  vi.clearAllMocks();
});

describe("callback SSR de recuperação", () => {
  it("troca o token recovery e abre a tela de definição de senha", async () => {
    deps.verifyOtp.mockResolvedValue({ error: null });

    await expect(
      GET(
        new Request(
          "http://localhost:3000/auth/confirm?token_hash=hash-de-teste&type=recovery",
        ),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/definir-senha");

    expect(deps.verifyOtp).toHaveBeenCalledWith({
      token_hash: "hash-de-teste",
      type: "recovery",
    });
  });

  it("não aceita outro tipo de token e volta ao login", async () => {
    await expect(
      GET(
        new Request(
          "http://localhost:3000/auth/confirm?token_hash=hash-de-teste&type=email",
        ),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/entrar?erro=provedor");

    expect(deps.verifyOtp).not.toHaveBeenCalled();
  });

  it("trata token rejeitado pelo provedor como falha genérica", async () => {
    deps.verifyOtp.mockResolvedValue({ error: new Error("token inválido") });

    await expect(
      GET(
        new Request(
          "http://localhost:3000/auth/confirm?token_hash=hash-de-teste&type=recovery",
        ),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/entrar?erro=provedor");
  });
});
