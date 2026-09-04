import { afterEach, describe, expect, it, vi } from "vitest";

const deps = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
  concederTrial: vi.fn(async () => ({ estado: "concedido", matriculaId: "mat-1" })),
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

vi.mock("@/modules/conta/trial", () => ({ concederTrial: deps.concederTrial }));

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
    expect(deps.concederTrial).not.toHaveBeenCalled();
  });

  it("não aceita tipo desconhecido e volta ao login", async () => {
    await expect(
      GET(
        new Request(
          "http://localhost:3000/auth/confirm?token_hash=hash-de-teste&type=magiclink",
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

describe("confirmação do cadastro gratuito (AD-133)", () => {
  it("confirma o e-mail, concede o trial e leva ao plano de hoje", async () => {
    deps.verifyOtp.mockResolvedValue({ error: null });

    await expect(
      GET(
        new Request(
          "http://localhost:3000/auth/confirm?token_hash=hash-de-teste&type=signup",
        ),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/app");

    expect(deps.verifyOtp).toHaveBeenCalledWith({
      token_hash: "hash-de-teste",
      type: "email",
    });
    expect(deps.concederTrial).toHaveBeenCalledTimes(1);
  });

  it("aceita também o `type=email`, que é o que o Supabase manda hoje", async () => {
    deps.verifyOtp.mockResolvedValue({ error: null });

    await expect(
      GET(
        new Request(
          "http://localhost:3000/auth/confirm?token_hash=hash-de-teste&type=email",
        ),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/app");
  });

  /**
   * A recusa do trial não pode derrubar a confirmação: a conta existe e o
   * aluno está autenticado. Sem trial ele cai no paywall, que explica o que
   * houve — e não numa tela de erro sobre uma conta recém-criada.
   */
  it("trial recusado ainda leva o aluno para dentro", async () => {
    deps.verifyOtp.mockResolvedValue({ error: null });
    deps.concederTrial.mockResolvedValue({
      estado: "recusado",
      motivo: "trial_ja_usado",
    } as never);

    await expect(
      GET(
        new Request(
          "http://localhost:3000/auth/confirm?token_hash=hash-de-teste&type=signup",
        ),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/app");
  });

  it("token de cadastro rejeitado volta ao login sem conceder nada", async () => {
    deps.verifyOtp.mockResolvedValue({ error: new Error("expirado") });

    await expect(
      GET(
        new Request(
          "http://localhost:3000/auth/confirm?token_hash=hash-de-teste&type=signup",
        ),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/entrar?erro=provedor");

    expect(deps.concederTrial).not.toHaveBeenCalled();
  });
});
