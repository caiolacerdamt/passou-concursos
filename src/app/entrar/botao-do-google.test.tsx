import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { definirLeitorDeConfig, restaurarLeitorPadrao } from "@/modules/config";

vi.mock("@/app/entrar/acoes", () => ({
  entrarComGoogle: vi.fn(),
  entrarComSenha: vi.fn(),
}));
vi.mock("@/app/criar-conta/acoes", () => ({
  criarContaComGoogle: vi.fn(),
  criarContaComSenha: vi.fn(),
}));

const Entrar = (await import("./page")).default;
const CriarConta = (await import("../criar-conta/page")).default;

afterEach(() => {
  restaurarLeitorPadrao();
});

async function telas(config: Record<string, unknown>): Promise<[string, string]> {
  definirLeitorDeConfig(async () => config);

  const entrar = renderToStaticMarkup(
    await Entrar({ searchParams: Promise.resolve({}), params: Promise.resolve({}) }),
  );
  const criarConta = renderToStaticMarkup(
    await CriarConta({
      searchParams: Promise.resolve({}),
      params: Promise.resolve({}),
    }),
  );

  return [entrar, criarConta];
}

/**
 * Item 9 do TRIAL-2. `signInWithOAuth` devolve URL com sucesso mesmo com o
 * provedor desligado no painel, entao a recusa acontece fora do nosso dominio,
 * numa tela de JSON cru que expoe o project ref do Supabase. A mensagem
 * amigavel existe no codigo e nunca aparece.
 *
 * A assercao que importa e a **ausencia no HTML**: `display:none` deixaria o
 * botao alcancavel por teclado e por leitor de tela, e o defeito continuaria
 * no ar para quem navega sem mouse.
 */
describe("o botao do Google atras da flag", () => {
  it("com a flag desligada, o botao nao existe no HTML das duas telas", async () => {
    const [entrar, criarConta] = await telas({
      "flag.m9.login_google": false,
      "flag.m8.trial_gratuito": true,
    });

    for (const html of [entrar, criarConta]) {
      expect(html).not.toContain("Continuar com Google");
      // Nem o separador orfao: "ou com e-mail" sem o "ou" e ruido.
      expect(html).not.toContain("ou com e-mail");
      // E o caminho de e-mail e senha continua inteiro.
      expect(html).toContain('name="email"');
    }
  });

  it("chave sem linha nenhuma tambem esconde o botao", async () => {
    const [entrar, criarConta] = await telas({ "flag.m8.trial_gratuito": true });

    expect(entrar).not.toContain("Continuar com Google");
    expect(criarConta).not.toContain("Continuar com Google");
  });

  it("com a flag ligada, o botao volta nas duas telas", async () => {
    const [entrar, criarConta] = await telas({
      "flag.m9.login_google": true,
      "flag.m8.trial_gratuito": true,
    });

    expect(entrar).toContain("Continuar com Google");
    expect(criarConta).toContain("Continuar com Google");
    expect(entrar).toContain("ou com e-mail");
  });
});
