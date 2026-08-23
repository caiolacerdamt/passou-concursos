import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencias = vi.hoisted(() => ({
  matricula: vi.fn(),
  cliente: vi.fn(),
  sair: vi.fn(),
  solicitar: vi.fn(),
}));

vi.mock("@/lib/db/sessao", () => ({ clienteDaSessao: dependencias.cliente }));
vi.mock("@/modules/conta/matricula", () => ({ exigirMatriculaAtiva: dependencias.matricula }));
vi.mock("../../entrar/acoes", () => ({ sair: dependencias.sair }));
vi.mock("./acoes", () => ({ solicitarEsquecimento: dependencias.solicitar }));

const { default: Conta } = await import("./page");

function renderConta(resultado?: string) {
  return Conta({ searchParams: Promise.resolve(resultado ? { resultado } : {}) });
}

describe("/app/conta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencias.matricula.mockResolvedValue({ id: "matricula-1" });
    dependencias.cliente.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: "aluno-1", email: "aluno@exemplo.com" } } })) },
    });
  });

  it("explica claramente o que some e o que permanece e exige APAGAR", async () => {
    const html = renderToStaticMarkup(await renderConta());
    expect(html).toContain("Será apagado");
    expect(html).toContain("Faturas, aceite");
    expect(html).toContain("digite");
    expect(html).toContain("APAGAR");
    expect(html).toContain('name="confirmacao"');
    expect(html).toContain("/app/progresso");
  });

  it("não expõe mensagem técnica em caso de erro recuperável", async () => {
    const html = renderToStaticMarkup(await renderConta("erro"));
    expect(html).toContain("Algo deu errado");
    expect(html).not.toContain("stack");
  });

  it("mostra confirmação não reconhecida sem esconder a explicação", async () => {
    const html = renderToStaticMarkup(await renderConta("confirmacao"));
    expect(html).toContain("A confirmação não foi reconhecida");
    expect(html).toContain("Apagar minha conta");
  });
});
