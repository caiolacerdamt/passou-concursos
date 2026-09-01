import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/entrar/acoes", () => ({ sair: vi.fn() }));

const rota = vi.hoisted(() => ({ caminho: "/app" }));
vi.mock("next/navigation", () => ({ usePathname: () => rota.caminho }));
vi.mock("next/link", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/link")>()),
  useLinkStatus: () => ({ pending: false }),
}));

const { BarraDoCelular } = await import("./barra-do-celular");

function renderizar(caminho = "/app"): string {
  rota.caminho = caminho;
  return renderToStaticMarkup(<BarraDoCelular />);
}

describe("BarraDoCelular", () => {
  it("o topo fica só com a marca", () => {
    const html = renderizar();
    const topo = html.slice(0, html.indexOf("Navegação principal no celular"));

    // Em 375px os três itens de conta com nome inteiro mais o botão de sair não
    // cabiam ao lado da marca: o texto cortava e a marca perdia espaço.
    expect(topo).toContain("Passou");
    expect(topo).not.toContain("Reembolso");
    expect(topo).not.toContain("Preferências de estudo");
    expect(topo).not.toContain("Sair da conta");
  });

  it("a folha da conta nasce fechada", () => {
    const html = renderizar();

    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain("Sair da conta");
    expect(html).not.toContain('href="/app/reembolso"');
  });

  it("a barra de baixo tem seis abas, e a Conta é botão porque não navega", () => {
    const html = renderizar();
    const barra = html.slice(html.indexOf("Navegação principal no celular"));

    for (const href of [
      "/app",
      "/app/plano",
      "/app/raio-x",
      "/app/sessao",
      "/app/progresso",
    ]) {
      expect(barra).toContain(`href="${href}"`);
    }
    expect(barra).toContain("Conta");
    expect(barra).toContain('aria-controls=');
  });

  it("usa os rótulos curtos, porque o nome inteiro só cabe truncado", () => {
    const html = renderizar();

    expect(html).toContain(">Questões<");
    expect(html).not.toContain("Questões e revisões");
  });

  it("a aba Conta fica marcada quando a rota é uma das telas de conta", () => {
    const html = renderizar("/app/reembolso");
    const barra = html.slice(html.indexOf("Navegação principal no celular"));

    expect(barra).toContain('aria-current="page"');
  });
});
