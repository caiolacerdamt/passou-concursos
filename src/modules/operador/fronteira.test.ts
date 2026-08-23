import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencias = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  reportar: vi.fn(),
}));

vi.mock("@/lib/db/sessao", () => ({
  clienteDaSessao: async () => ({ auth: { getUser: dependencias.getUser } }),
}));
vi.mock("@/lib/db/servidor", () => ({
  clienteDeServico: () => ({ rpc: dependencias.rpc }),
}));
vi.mock("@/modules/observabilidade/reporte", () => ({
  reportarErro: dependencias.reportar,
}));

const {
  exigirOperadorAtivo,
  FalhaNaOperacaoDoOperador,
  OperadorNaoAutorizado,
} = await import("./fronteira");

describe("fronteira do operador", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencias.getUser.mockResolvedValue({ data: { user: { id: "operador-1" } } });
    dependencias.rpc.mockResolvedValue({ data: true, error: null });
  });

  it("nega e reporta uma sessão sem papel", async () => {
    dependencias.rpc.mockResolvedValue({ data: false, error: null });

    await expect(exigirOperadorAtivo("consultar_fila")).rejects.toBeInstanceOf(
      OperadorNaoAutorizado,
    );

    expect(dependencias.reportar).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ modulo: "operador", operacao: "consultar_fila", motivo: "sem_papel" }),
    );
    expect(dependencias.rpc).toHaveBeenCalledWith("operador_ativo", {
      p_user_id: "operador-1",
    });
  });

  it("nega e reporta ausência de sessão sem consultar a allowlist", async () => {
    dependencias.getUser.mockResolvedValue({ data: { user: null } });

    await expect(exigirOperadorAtivo()).rejects.toMatchObject({
      name: "OperadorNaoAutorizado",
      codigo: "sem_sessao",
    });

    expect(dependencias.rpc).not.toHaveBeenCalled();
    expect(dependencias.reportar).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ motivo: "sem_sessao" }),
    );
  });

  it("devolve somente o id do operador autenticado", async () => {
    dependencias.getUser.mockResolvedValue({
      data: {
        user: {
          id: "operador-1",
          email: "interno@exemplo.dev",
          user_metadata: { segredo: "nao sai" },
        },
      },
    });

    await expect(exigirOperadorAtivo()).resolves.toEqual({ id: "operador-1" });
  });

  it("converte falha inesperada em erro genérico e a reporta", async () => {
    const falha = new Error("detalhe interno do banco");
    dependencias.rpc.mockRejectedValue(falha);

    await expect(exigirOperadorAtivo()).rejects.toBeInstanceOf(
      FalhaNaOperacaoDoOperador,
    );
    await expect(exigirOperadorAtivo()).rejects.toThrow(
      "Não foi possível concluir a operação.",
    );
    expect(dependencias.reportar).toHaveBeenCalledWith(
      falha,
      expect.objectContaining({ motivo: "falha_ao_autorizar" }),
    );
  });
});
