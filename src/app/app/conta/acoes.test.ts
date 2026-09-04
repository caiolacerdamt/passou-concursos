import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencias = vi.hoisted(() => ({
  matricula: vi.fn(),
  cliente: vi.fn(),
  executar: vi.fn(),
  reportar: vi.fn(),
  servico: vi.fn(),
  precos: vi.fn(),
  repositorio: vi.fn(),
  gateway: vi.fn(),
  reembolso: vi.fn(),
  redirect: vi.fn((destino: string): never => {
    throw new Error(`NEXT_REDIRECT:${destino}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect: dependencias.redirect }));
vi.mock("@/modules/conta/matricula", () => ({ exigirMatriculaAtiva: dependencias.matricula }));
vi.mock("@/lib/db/sessao", () => ({ clienteDaSessao: dependencias.cliente }));
vi.mock("@/lib/db/servidor", () => ({ clienteDeServico: dependencias.servico }));
vi.mock("@/modules/lgpd/esquecimento", () => ({ executarEsquecimento: dependencias.executar }));
vi.mock("@/modules/observabilidade/reporte", () => ({ reportarErro: dependencias.reportar }));
vi.mock("@/modules/pagamentos/preco", () => ({ obterPrecosPublicos: dependencias.precos }));
vi.mock("@/modules/pagamentos/asaas", () => ({
  gatewayAsaasDoAmbiente: dependencias.gateway,
}));
vi.mock("@/modules/pagamentos/garantia", () => ({
  solicitarReembolso: dependencias.reembolso,
}));
vi.mock("@/modules/pagamentos/repositorio", () => ({
  criarRepositorioDePagamentos: dependencias.repositorio,
}));

const { pedirReembolso, solicitarEsquecimento } = await import("./acoes");

function formulario(confirmacao = "APAGAR", userId = "tentativa-do-form") {
  const form = new FormData();
  form.set("confirmacao", confirmacao);
  form.set("user_id", userId);
  return form;
}

function clienteComUsuario(user: { id: string; email?: string } | null) {
  const cliente = { auth: { getUser: vi.fn(async () => ({ data: { user } })) } };
  dependencias.cliente.mockResolvedValue(cliente);
  return cliente;
}

describe("action de esquecimento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencias.matricula.mockResolvedValue({ id: "matricula-1" });
    dependencias.executar.mockResolvedValue({ estado: "concluido" });
  });

  it("exige a confirmação textual antes de abrir a sessão", async () => {
    await expect(solicitarEsquecimento(formulario("apagar minha conta"))).rejects.toThrow(
      "NEXT_REDIRECT:/app/conta?aba=privacidade&resultado=confirmacao",
    );
    expect(dependencias.cliente).not.toHaveBeenCalled();
  });

  it("deriva id e e-mail da sessão e ignora user_id do formulário", async () => {
    clienteComUsuario({ id: "aluno-real", email: "real@exemplo.com" });

    await expect(solicitarEsquecimento(formulario())).rejects.toThrow(
      "NEXT_REDIRECT:/entrar?resultado=esquecimento",
    );
    expect(dependencias.executar).toHaveBeenCalledWith({
      id: "aluno-real",
      email: "real@exemplo.com",
    });
    expect(dependencias.executar).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: "tentativa-do-form" }),
    );
  });

  it("manda para login quando a sessão não existe", async () => {
    clienteComUsuario(null);

    await expect(solicitarEsquecimento(formulario())).rejects.toThrow(
      "NEXT_REDIRECT:/entrar?proximo=%2Fapp%2Fconta",
    );
    expect(dependencias.executar).not.toHaveBeenCalled();
  });

  it("não confirma sucesso técnico quando a orquestração falha", async () => {
    clienteComUsuario({ id: "aluno-real", email: "real@exemplo.com" });
    const erro = new Error("detalhe interno");
    dependencias.executar.mockRejectedValue(erro);

    await expect(solicitarEsquecimento(formulario())).rejects.toThrow(
      "NEXT_REDIRECT:/app/conta?aba=privacidade&resultado=erro",
    );
    expect(dependencias.reportar).toHaveBeenCalledWith(
      erro,
      expect.objectContaining({ operacao: "solicitar_esquecimento" }),
    );
  });
});

describe("action de reembolso", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencias.precos.mockResolvedValue({ garantiaDias: 7 });
    dependencias.servico.mockReturnValue({});
    dependencias.repositorio.mockReturnValue({
      buscarUltimoPagamentoDoUsuario: vi.fn(),
      registrarPedidoDeReembolso: vi.fn(),
      confirmarReembolsoLocal: vi.fn(),
      buscarFatura: vi.fn(),
      registrarResultadoCancelamentoFatura: vi.fn(),
      abrirPendencia: vi.fn(),
    });
    dependencias.gateway.mockReturnValue({
      estornarCobranca: vi.fn(),
      cancelarNotaFiscal: vi.fn(),
    });
  });

  it("exige sessão antes de tocar em preço, repositório ou gateway", async () => {
    clienteComUsuario(null);

    await expect(pedirReembolso()).rejects.toThrow(
      "NEXT_REDIRECT:/entrar?proximo=%2Fapp%2Fconta",
    );
    expect(dependencias.precos).not.toHaveBeenCalled();
    expect(dependencias.gateway).not.toHaveBeenCalled();
    expect(dependencias.reembolso).not.toHaveBeenCalled();
  });

  it("usa o id da sessão para buscar o pagamento, e volta para a aba da assinatura", async () => {
    clienteComUsuario({ id: "aluno-real", email: "real@exemplo.com" });
    dependencias.reembolso.mockResolvedValue({ estado: "solicitado" });

    await expect(pedirReembolso()).rejects.toThrow(
      "NEXT_REDIRECT:/app/conta?aba=assinatura&resultado=solicitado",
    );
    expect(dependencias.reembolso).toHaveBeenCalledWith(
      "aluno-real",
      7,
      expect.any(Date),
      expect.anything(),
    );
  });

  it("não emite estorno quando o gateway não está configurado", async () => {
    clienteComUsuario({ id: "aluno-real", email: "real@exemplo.com" });
    dependencias.gateway.mockImplementation(() => {
      throw new Error("sem chave do Asaas");
    });

    await expect(pedirReembolso()).rejects.toThrow(
      "NEXT_REDIRECT:/app/conta?aba=assinatura&resultado=pendente",
    );
    expect(dependencias.reembolso).not.toHaveBeenCalled();
  });

  it("devolve o pedido recusado sem prometer estorno", async () => {
    clienteComUsuario({ id: "aluno-real", email: "real@exemplo.com" });
    dependencias.reembolso.mockResolvedValue({ estado: "recusado" });

    await expect(pedirReembolso()).rejects.toThrow(
      "NEXT_REDIRECT:/app/conta?aba=assinatura&resultado=recusado",
    );
  });
});
