import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/entrar/acoes", () => ({ sair: vi.fn() }));

const { AppShell } = await import("./app-shell");

describe("AppShell", () => {
  it("oferece a mesma navegação de estudo no desktop e no celular", () => {
    const html = renderToStaticMarkup(<AppShell>conteúdo da tela</AppShell>);

    expect(html).toContain('data-surface="app"');
    expect(html).toContain('aria-label="Navegação principal"');
    expect(html).toContain('aria-label="Navegação principal no celular"');
    expect(html).toContain('href="/app"');
    expect(html).toContain('href="/app/plano"');
    expect(html).toContain('href="/app/raio-x"');
    expect(html).toContain('href="/app/sessao"');
    expect(html).toContain('href="/app/progresso"');
    expect(html).toContain('href="/app/conta"');
    expect(html).toContain('href="/app/reembolso"');
    expect(html).toContain("Hoje");
    expect(html).toContain("Questões e revisões");
    expect(html).toContain("Sair da conta");
  });

  it("mantém o salto de acessibilidade antes do conteúdo", () => {
    const html = renderToStaticMarkup(<AppShell>x</AppShell>);

    expect(html).toContain('href="#conteudo"');
    expect(html).toContain('<main id="conteudo"');
    expect(html.indexOf('href="#conteudo"')).toBeLessThan(html.indexOf('<main id="conteudo"'));
  });
});

