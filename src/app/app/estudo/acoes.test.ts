import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencias = vi.hoisted(() => ({
  cliente: vi.fn(),
  matricula: vi.fn(),
  reportar: vi.fn(),
}));

vi.mock("@/lib/db/sessao", () => ({ clienteDaSessao: dependencias.cliente }));
vi.mock("@/modules/conta/matricula", () => ({ exigirMatriculaAtiva: dependencias.matricula }));
vi.mock("@/modules/observabilidade/reporte", () => ({ reportarErro: dependencias.reportar }));

import { desmarcarRecursoComoVisto, marcarRecursoComoVisto } from "./acoes";

const USER_ID = "b4f9c6d8-2d1e-4ef5-bacf-f0f8cb4d02d1";
const RECURSO_ID = "7d86194a-f1cf-4e65-bc2e-69d67766366a";

function clienteCom(opcoes: { erroInsercao?: { code: string } | null; erroExclusao?: { code: string } | null } = {}) {
  const eq = vi.fn();
  const cadeiaDeExclusao = {
    eq: vi.fn((...argumentos: unknown[]) => {
      eq(...argumentos);
      return cadeiaDeExclusao;
    }),
    then: (resolve: (valor: unknown) => unknown, reject: (erro: unknown) => unknown) =>
      Promise.resolve({ error: opcoes.erroExclusao ?? null }).then(resolve, reject),
  };
  const insert = vi.fn(() => Promise.resolve({ error: opcoes.erroInsercao ?? null }));
  const from = vi.fn(() => ({ insert, delete: vi.fn(() => cadeiaDeExclusao) }));
  const cliente = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: USER_ID } }, error: null })),
    },
    from,
  };
  return { cliente, from, insert, eq };
}

describe("ações do checklist de recursos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencias.matricula.mockResolvedValue({ id: "matricula-1" });
  });

  it("marca usando o titular da sessão e não um user_id do cliente", async () => {
    const dependenciasDoCliente = clienteCom();
    dependencias.cliente.mockResolvedValue(dependenciasDoCliente.cliente);

    await expect(marcarRecursoComoVisto(RECURSO_ID)).resolves.toEqual({ ok: true });

    expect(dependenciasDoCliente.insert).toHaveBeenCalledWith({
      user_id: USER_ID,
      recurso_id: RECURSO_ID,
    });
    expect(dependencias.matricula).toHaveBeenCalledOnce();
  });

  it("trata uma marca repetida como idempotente", async () => {
    const dependenciasDoCliente = clienteCom({ erroInsercao: { code: "23505" } });
    dependencias.cliente.mockResolvedValue(dependenciasDoCliente.cliente);

    await expect(marcarRecursoComoVisto(RECURSO_ID)).resolves.toEqual({ ok: true });
    expect(dependencias.reportar).not.toHaveBeenCalled();
  });

  it("desmarca somente a linha do titular autenticado", async () => {
    const dependenciasDoCliente = clienteCom();
    dependencias.cliente.mockResolvedValue(dependenciasDoCliente.cliente);

    await expect(desmarcarRecursoComoVisto(RECURSO_ID)).resolves.toEqual({ ok: true });

    expect(dependenciasDoCliente.eq).toHaveBeenNthCalledWith(1, "user_id", USER_ID);
    expect(dependenciasDoCliente.eq).toHaveBeenNthCalledWith(2, "recurso_id", RECURSO_ID);
  });

  it("recusa identificador inválido antes de abrir a sessão", async () => {
    await expect(marcarRecursoComoVisto("recurso-forjado")).resolves.toMatchObject({ ok: false });

    expect(dependencias.matricula).not.toHaveBeenCalled();
    expect(dependencias.cliente).not.toHaveBeenCalled();
  });
});
