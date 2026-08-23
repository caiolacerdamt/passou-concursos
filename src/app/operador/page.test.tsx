import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencias = vi.hoisted(() => ({
  guarda: vi.fn(),
  sair: vi.fn(),
}));

vi.mock("@/modules/operador", () => ({
  exigirOperadorAtivo: dependencias.guarda,
}));
vi.mock("@/app/entrar/acoes", () => ({
  sair: dependencias.sair,
}));

const { default: Layout } = await import("./layout");
const { default: Inicio } = await import("./page");

describe("/operador", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencias.guarda.mockResolvedValue({ id: "operador-1" });
  });

  it("guarda o layout antes de renderizar a mesa e oferece as três áreas", async () => {
    const html = renderToStaticMarkup(
      await Layout({ children: <Inicio /> }),
    );

    expect(dependencias.guarda).toHaveBeenCalledWith("abrir_painel");
    expect(html).toContain("Mesa editorial");
    expect(html).toContain("/operador/fila");
    expect(html).toContain("/operador/taxonomia");
    expect(html).toContain("/operador/configuracao");
    expect(html).toContain("Toda alteração exige autoria e motivo");
  });

  it("mantém a página inicial sem leitura adicional e sem largura fixa", () => {
    const html = renderToStaticMarkup(<Inicio />);

    expect(dependencias.guarda).not.toHaveBeenCalled();
    expect(html).toContain("O acervo passa por aqui.");
    expect(html).toContain("Escolha uma área");
    expect(html).not.toContain("width:");
    expect(html).not.toContain("min-width:");
  });

  it("não imprime mensagem técnica na fronteira de erro", async () => {
    const { default: Erro } = await import("./error");
    const html = renderToStaticMarkup(
      <Erro error={new Error("segredo do banco") as Error & { digest?: string }} />,
    );

    expect(html).toContain("A mesa não pôde ser aberta.");
    expect(html).toContain("Algo deu errado");
    expect(html).not.toContain("segredo do banco");
  });
});
