import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencias = vi.hoisted(() => ({
  matricula: vi.fn(),
  cliente: vi.fn(),
  executar: vi.fn(),
  reportar: vi.fn(),
  redirect: vi.fn((destino: string): never => {
    throw new Error(`NEXT_REDIRECT:${destino}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect: dependencias.redirect }));
vi.mock("@/modules/conta/matricula", () => ({ exigirMatriculaAtiva: dependencias.matricula }));
vi.mock("@/lib/db/sessao", () => ({ clienteDaSessao: dependencias.cliente }));
vi.mock("@/modules/lgpd/esquecimento", () => ({ executarEsquecimento: dependencias.executar }));
vi.mock("@/modules/observabilidade/reporte", () => ({ reportarErro: dependencias.reportar }));

const { solicitarEsquecimento } = await import("./acoes");

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
      "NEXT_REDIRECT:/app/conta?resultado=confirmacao",
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
      "NEXT_REDIRECT:/app/conta?resultado=erro",
    );
    expect(dependencias.reportar).toHaveBeenCalledWith(
      erro,
      expect.objectContaining({ operacao: "solicitar_esquecimento" }),
    );
  });
});
