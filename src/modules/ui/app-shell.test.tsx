import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/entrar/acoes", () => ({ sair: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/app" }));

const cookieDaBarra = vi.hoisted(() => ({ valor: undefined as string | undefined }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (nome: string) =>
      nome === "barra-lateral" && cookieDaBarra.valor !== undefined
        ? { name: nome, value: cookieDaBarra.valor }
        : undefined,
  }),
}));

const { AppShell } = await import("./app-shell");

async function renderizar(tema?: Parameters<typeof AppShell>[0]["tema"]): Promise<string> {
  return renderToStaticMarkup(await AppShell({ children: "conteúdo da tela", tema }));
}

describe("AppShell", () => {
  it("oferece a mesma navegação de estudo no desktop e no celular", async () => {
    cookieDaBarra.valor = undefined;
    const html = await renderizar();

    expect(html).toContain('data-surface="app"');
    expect(html).toContain('aria-label="Navegação principal"');
    expect(html).toContain('aria-label="Navegação principal no celular"');
    expect(html).toContain('href="/app"');
    expect(html).toContain('href="/app/plano"');
    expect(html).toContain('href="/app/raio-x"');
    expect(html).toContain('href="/app/sessao"');
    expect(html).toContain('href="/app/progresso"');
    expect(html).toContain('href="/app/preferencias"');
    expect(html).toContain('href="/app/conta"');
    expect(html).toContain("Hoje");
    expect(html).toContain("Questões e revisões");
    expect(html).toContain("Preferências de estudo");
    expect(html).toContain("Sair da conta");
  });

  it("mantém o salto de acessibilidade antes do conteúdo", async () => {
    cookieDaBarra.valor = undefined;
    const html = await renderizar();

    expect(html).toContain('href="#conteudo"');
    expect(html).toContain('<main id="conteudo"');
    expect(html.indexOf('href="#conteudo"')).toBeLessThan(html.indexOf('<main id="conteudo"'));
  });

  it("nasce expandida sem cookie e fechada com ele, sem passar pelo cliente", async () => {
    cookieDaBarra.valor = undefined;
    const expandida = await renderizar();

    cookieDaBarra.valor = "fechada";
    const fechada = await renderizar();

    // O rótulo do botão é o que separa os dois estados no HTML do servidor:
    // se a barra dependesse de localStorage, os dois seriam idênticos aqui e
    // o aluno veria a barra piscar de expandida para fechada a cada carga.
    expect(expandida).toContain("Fechar a barra de navegação");
    expect(fechada).toContain("Expandir a barra de navegação");
    expect(fechada).not.toContain("Fechar a barra de navegação");
  });

  it("emite o tema no HTML do servidor nos três estados (AD-149)", async () => {
    cookieDaBarra.valor = undefined;

    expect(await renderizar("claro")).toContain('data-tema="claro"');
    expect(await renderizar("escuro")).toContain('data-tema="escuro"');
    expect(await renderizar("sistema")).toContain('data-tema="sistema"');
  });

  it("cai em `sistema` quando o tema não é informado", async () => {
    cookieDaBarra.valor = undefined;

    // O default não é conveniência: é o que faz o shell continuar renderizando
    // com o comportamento de hoje se a resolução do tema falhar lá em cima.
    expect(await renderizar()).toContain('data-tema="sistema"');
  });

  it("o atributo do tema fica no mesmo elemento que `data-surface`", async () => {
    cookieDaBarra.valor = undefined;
    const html = await renderizar("escuro");

    // As regras escuras do `globals.css` são `[data-tema="escuro"]` e cascateiam
    // por herança de variável. Se o atributo saísse num elemento interno, tudo
    // acima dele — inclusive a barra lateral e a faixa do trial — continuaria
    // claro, e a tela sairia metade e metade.
    expect(html).toMatch(/<div class="app-ui[^"]*"[^>]*data-surface="app"[^>]*data-tema="escuro"/);
  });

  it("mantém conta, preferências e saída alcançáveis com a barra fechada", async () => {
    cookieDaBarra.valor = "fechada";
    const html = await renderizar();

    expect(html).toContain('href="/app/conta"');
    expect(html).toContain('href="/app/preferencias"');
    expect(html).toContain("Sair da conta");
  });
});
