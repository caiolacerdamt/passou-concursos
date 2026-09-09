import { describe, expect, it, vi } from "vitest";

import {
  conferirSenhaAtual,
  provedoresDoUsuario,
  temSenhaPropria,
} from "./troca-de-senha";

vi.mock("@/lib/db/chaves", () => ({
  chavesPublicas: () => ({ url: "https://x.supabase.co", chave: "publicavel" }),
}));
vi.mock("@/modules/observabilidade/reporte", () => ({ reportarErro: vi.fn() }));

describe("provedoresDoUsuario", () => {
  it("lê a lista de identidades", () => {
    expect(
      provedoresDoUsuario({ identities: [{ provider: "email" }, { provider: "google" }] }),
    ).toEqual(["email", "google"]);
  });

  /*
   * As duas fontes existem no mesmo objeto e nem sempre as duas vêm cheias:
   * `identities` é o vínculo real, `app_metadata` é o resumo do token. Ler só
   * uma faria a resposta depender de qual caminho encheu o objeto.
   */
  it("cai no app_metadata quando identities não veio", () => {
    expect(provedoresDoUsuario({ app_metadata: { providers: ["google"] } })).toEqual([
      "google",
    ]);
    expect(provedoresDoUsuario({ app_metadata: { provider: "email" } })).toEqual(["email"]);
  });

  it("não repete o provedor que aparece nas duas fontes", () => {
    expect(
      provedoresDoUsuario({
        identities: [{ provider: "google" }],
        app_metadata: { provider: "google", providers: ["google"] },
      }),
    ).toEqual(["google"]);
  });

  it("objeto vazio ou ausente não vira lista de lixo", () => {
    expect(provedoresDoUsuario(null)).toEqual([]);
    expect(provedoresDoUsuario({ identities: [{ provider: null }] })).toEqual([]);
  });
});

describe("temSenhaPropria", () => {
  it("quem tem o provedor email tem senha", () => {
    expect(temSenhaPropria(["email"])).toBe(true);
    expect(temSenhaPropria(["google", "email"])).toBe(true);
  });

  /*
   * Sem esta pergunta o formulário aparecia para quem entra pelo Google, a
   * conferência falhava sempre, e a tela dizia "senha atual incorreta" sobre
   * uma senha que nunca existiu — erro sem saída para o aluno.
   */
  it("conta só-Google não tem senha para trocar", () => {
    expect(temSenhaPropria(["google"])).toBe(false);
  });

  /** Na dúvida, não: um formulário que só sabe falhar é pior que um texto. */
  it("lista vazia responde não", () => {
    expect(temSenhaPropria([])).toBe(false);
  });
});

describe("conferirSenhaAtual", () => {
  function cliente(error: unknown = null) {
    const signInWithPassword = vi.fn(async () => ({ error }));
    return {
      signInWithPassword,
      objeto: { auth: { signInWithPassword } } as unknown as Parameters<
        typeof conferirSenhaAtual
      >[2],
    };
  }

  it("senha certa confere", async () => {
    const { objeto } = cliente();
    expect(await conferirSenhaAtual("a@x.com", "senhalonga", objeto)).toBe(true);
  });

  it("senha errada não confere", async () => {
    const { objeto } = cliente(new Error("invalid credentials"));
    expect(await conferirSenhaAtual("a@x.com", "errada12", objeto)).toBe(false);
  });

  /*
   * `updateUser` não pede a senha antiga. Sem esta conferência, uma sessão
   * esquecida aberta troca a senha e tranca o dono fora da própria conta.
   */
  it("senha vazia não chega a perguntar ao provedor", async () => {
    const { signInWithPassword, objeto } = cliente();

    expect(await conferirSenhaAtual("a@x.com", "", objeto)).toBe(false);
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  /** Não deu para conferir é o mesmo que não conferiu: recusa. */
  it("falha de rede recusa em vez de liberar", async () => {
    const objeto = {
      auth: {
        signInWithPassword: async () => {
          throw new Error("rede fora");
        },
      },
    } as unknown as Parameters<typeof conferirSenhaAtual>[2];

    expect(await conferirSenhaAtual("a@x.com", "senhalonga", objeto)).toBe(false);
  });

  it("confere com o e-mail e a senha recebidos, sem inventar credencial", async () => {
    const { signInWithPassword, objeto } = cliente();

    await conferirSenhaAtual("a@x.com", "senhalonga", objeto);

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "a@x.com",
      password: "senhalonga",
    });
  });
});
