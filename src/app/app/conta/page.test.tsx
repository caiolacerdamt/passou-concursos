import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencias = vi.hoisted(() => ({
  matricula: vi.fn(),
  cliente: vi.fn(),
  servico: vi.fn(),
  sair: vi.fn(),
  solicitar: vi.fn(),
  reembolso: vi.fn(),
  precos: vi.fn(),
  repositorio: vi.fn(),
  reportar: vi.fn(),
}));

vi.mock("@/lib/db/sessao", () => ({ clienteDaSessao: dependencias.cliente }));
vi.mock("@/lib/db/servidor", () => ({ clienteDeServico: dependencias.servico }));
vi.mock("@/modules/conta/matricula", () => ({ exigirMatriculaAtiva: dependencias.matricula }));
vi.mock("@/modules/observabilidade/reporte", () => ({ reportarErro: dependencias.reportar }));
vi.mock("@/modules/pagamentos/repositorio", () => ({
  criarRepositorioDePagamentos: dependencias.repositorio,
}));
vi.mock("./acoes", () => ({
  solicitarEsquecimento: dependencias.solicitar,
  pedirReembolso: dependencias.reembolso,
}));

vi.mock("@/modules/pagamentos/preco", async () => {
  const real = await vi.importActual<typeof import("@/modules/pagamentos/preco")>(
    "@/modules/pagamentos/preco",
  );
  return { ...real, obterPrecosPublicos: dependencias.precos };
});

const { default: Conta } = await import("./page");

const PAGAMENTO = {
  id: "pag-1",
  valor_centavos: 19700,
  meio: "CREDIT_CARD",
  parcelas: 12,
  estado: "ativada",
  confirmado_em: "2026-08-28T12:00:00.000Z",
  referencia_interna: "PC-4F82A9",
};

function renderConta(parametros: Record<string, string> = {}) {
  return Conta({ searchParams: Promise.resolve(parametros) });
}

describe("/app/conta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.setSystemTime(new Date("2026-09-01T12:00:00.000Z"));
    dependencias.matricula.mockResolvedValue({
      id: "matricula-1",
      estado: "ativa",
      fim_em: "2027-08-28T12:00:00.000Z",
    });
    dependencias.cliente.mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: "aluno-1", email: "aluno@exemplo.com" } },
        })),
      },
    });
    dependencias.servico.mockReturnValue({});
    dependencias.precos.mockResolvedValue({ garantiaDias: 7 });
    dependencias.repositorio.mockReturnValue({
      buscarUltimoPagamentoDoUsuario: vi.fn(async () => PAGAMENTO),
    });
  });

  it("abre na assinatura, com o acesso, o valor e a régua da garantia", async () => {
    const html = renderToStaticMarkup(await renderConta());

    expect(html).toContain("Seu acesso vai até");
    expect(html).toContain("197,00");
    expect(html).toContain("Cartão");
    expect(html).toContain("Garantia de 7 dias");
    expect(html).toContain("Quero meu dinheiro de volta");
  });

  it("recusa o pedido fora da janela sem esconder o motivo", async () => {
    vi.setSystemTime(new Date("2026-09-20T12:00:00.000Z"));

    const html = renderToStaticMarkup(await renderConta());

    expect(html).toContain("sete dias");
    expect(html).not.toContain("Quero meu dinheiro de volta");
  });

  it("não mostra pedido de reembolso quando não há pagamento", async () => {
    dependencias.repositorio.mockReturnValue({
      buscarUltimoPagamentoDoUsuario: vi.fn(async () => null),
    });

    const html = renderToStaticMarkup(await renderConta());

    expect(html).toContain("Não há um pagamento confirmado para consultar");
    expect(html).not.toContain("Quero meu dinheiro de volta");
  });

  it("falha fechada: preço ilegível não libera o botão de reembolso", async () => {
    dependencias.precos.mockRejectedValue(new Error("config fora do ar"));

    const html = renderToStaticMarkup(await renderConta());

    expect(html).not.toContain("Quero meu dinheiro de volta");
    expect(dependencias.reportar).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ operacao: "carregar_assinatura_da_conta" }),
    );
  });

  it("explica o que some e o que permanece e exige APAGAR na aba de privacidade", async () => {
    const html = renderToStaticMarkup(await renderConta({ aba: "privacidade" }));

    expect(html).toContain("Some para sempre");
    expect(html).toContain("Faturas e o aceite dos termos");
    expect(html).toContain("digite");
    expect(html).toContain("APAGAR");
    expect(html).toContain('name="confirmacao"');
  });

  it("cai na assinatura quando a aba da URL não existe", async () => {
    const html = renderToStaticMarkup(await renderConta({ aba: "../../etc/passwd" }));

    expect(html).toContain("Garantia de 7 dias");
    expect(html).not.toContain("etc/passwd");
  });

  it("não expõe mensagem técnica em caso de erro recuperável", async () => {
    const html = renderToStaticMarkup(await renderConta({ resultado: "erro" }));

    expect(html).toContain("Algo deu errado");
    expect(html).not.toContain("stack");
  });

  it("mostra confirmação não reconhecida sem esconder a explicação", async () => {
    const html = renderToStaticMarkup(
      await renderConta({ aba: "privacidade", resultado: "confirmacao" }),
    );

    expect(html).toContain("A confirmação não foi reconhecida");
    expect(html).toContain("Apagar minha conta");
  });

  it("confirma o reembolso solicitado e o pedido em análise", async () => {
    expect(renderToStaticMarkup(await renderConta({ resultado: "solicitado" }))).toContain(
      "Reembolso confirmado",
    );
    expect(renderToStaticMarkup(await renderConta({ resultado: "pendente" }))).toContain(
      "ficou em análise",
    );
  });

  it("nunca ecoa o texto do parâmetro resultado na tela", async () => {
    const html = renderToStaticMarkup(
      await renderConta({ resultado: "<script>alert(1)</script>" }),
    );

    expect(html).not.toContain("alert(1)");
    expect(html).not.toContain("script>alert");
  });
});
