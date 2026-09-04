import { afterEach, describe, expect, it, vi } from "vitest";

const deps = vi.hoisted(() => ({
  signUp: vi.fn(async () => ({ error: null })),
  signInWithOAuth: vi.fn(async () => ({
    data: { url: "https://accounts.google.com/o/oauth2/auth?x=1" },
    error: null,
  })),
  isFlagOn: vi.fn(async () => true),
  getParam: vi.fn(async (): Promise<string[]> => []),
  redirect: vi.fn((destino: string): never => {
    throw new Error(`NEXT_REDIRECT:${destino}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect: deps.redirect }));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ host: "localhost:3000" })),
}));

vi.mock("@/lib/db/sessao", () => ({
  clienteDaSessao: vi.fn(async () => ({
    auth: { signUp: deps.signUp, signInWithOAuth: deps.signInWithOAuth },
  })),
}));

vi.mock("@/modules/config", () => ({ isFlagOn: deps.isFlagOn, getParam: deps.getParam }));

const { criarContaComGoogle, criarContaComSenha } = await import("./acoes");

function formulario(campos: Record<string, string>): FormData {
  const dados = new FormData();
  for (const [nome, valor] of Object.entries(campos)) dados.set(nome, valor);
  return dados;
}

afterEach(() => {
  vi.clearAllMocks();
  deps.isFlagOn.mockResolvedValue(true);
  deps.getParam.mockResolvedValue([]);
  deps.signUp.mockResolvedValue({ error: null });
});

describe("cadastro por e-mail e senha (AD-133)", () => {
  it("cadastra e manda confirmar o e-mail", async () => {
    await expect(
      criarContaComSenha(formulario({ email: " aluno@exemplo.com ", senha: "segredo123" })),
    ).rejects.toThrow("NEXT_REDIRECT:/criar-conta?enviado=1");

    expect(deps.signUp).toHaveBeenCalledWith({
      email: "aluno@exemplo.com",
      password: "segredo123",
      options: { emailRedirectTo: "http://localhost:3000/auth/confirm" },
    });
  });

  /**
   * O teste que prova a promessa do checklist: com a flag desligada, nenhuma
   * conta nasce. A tranca de verdade é `conceder_trial()` no banco; esta é a
   * que evita deixar uma conta órfã para trás.
   */
  it("com a flag desligada não chama o provedor nem cria conta", async () => {
    deps.isFlagOn.mockResolvedValue(false);

    await expect(
      criarContaComSenha(formulario({ email: "aluno@exemplo.com", senha: "segredo123" })),
    ).rejects.toThrow("NEXT_REDIRECT:/criar-conta?erro=desligado");

    expect(deps.signUp).not.toHaveBeenCalled();
  });

  it("domínio descartável é recusado antes de gastar um e-mail", async () => {
    deps.getParam.mockResolvedValue(["mailinator.com"]);

    await expect(
      criarContaComSenha(formulario({ email: "x@mailinator.com", senha: "segredo123" })),
    ).rejects.toThrow("NEXT_REDIRECT:/criar-conta?erro=dominio");

    expect(deps.signUp).not.toHaveBeenCalled();
  });

  it("erro do provedor não vai para a tela", async () => {
    deps.signUp.mockResolvedValue({ error: { message: "User already registered" } } as never);

    await expect(
      criarContaComSenha(formulario({ email: "aluno@exemplo.com", senha: "segredo123" })),
    ).rejects.toThrow("NEXT_REDIRECT:/criar-conta?erro=cadastro");
  });
});

describe("cadastro pelo Google", () => {
  it("manda o aluno para o provedor com o callback do produto", async () => {
    await expect(criarContaComGoogle()).rejects.toThrow(
      "NEXT_REDIRECT:https://accounts.google.com/o/oauth2/auth?x=1",
    );

    expect(deps.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "http://localhost:3000/auth/callback?proximo=%2Fapp",
      },
    });
  });

  it("com a flag desligada nem chega ao provedor", async () => {
    deps.isFlagOn.mockResolvedValue(false);

    await expect(criarContaComGoogle()).rejects.toThrow(
      "NEXT_REDIRECT:/criar-conta?erro=desligado",
    );
    expect(deps.signInWithOAuth).not.toHaveBeenCalled();
  });
});
