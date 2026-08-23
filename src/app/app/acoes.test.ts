import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencias = vi.hoisted(() => ({
  matricula: vi.fn(),
  cliente: vi.fn(),
  servico: vi.fn(),
  reportar: vi.fn(),
  redirect: vi.fn((destino: string): never => {
    throw new Error(`NEXT_REDIRECT:${destino}`);
  }),
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: dependencias.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: dependencias.revalidatePath }));
vi.mock("@/modules/conta/matricula", () => ({
  exigirMatriculaAtiva: dependencias.matricula,
}));
vi.mock("@/lib/db/sessao", () => ({ clienteDaSessao: dependencias.cliente }));
vi.mock("@/lib/db/servidor", () => ({ clienteDeServico: dependencias.servico }));
vi.mock("@/modules/observabilidade/reporte", () => ({
  reportarErro: dependencias.reportar,
}));

const { salvarOnboarding } = await import("./acoes");

function formularioCompleto() {
  const formulario = new FormData();
  formulario.set("concursoAlvo", "Banco do Brasil");
  formulario.set("minutosPorDia", "60");
  formulario.append("diasEstudo", "1");
  formulario.append("diasEstudo", "3");
  formulario.append("diasEstudo", "5");
  formulario.set("horarioEstudo", "20:00");
  formulario.set("nivelDeclarado", "iniciante");
  return formulario;
}

function clienteCom({ erroAoSalvar = null as Error | null } = {}) {
  const upsert = vi.fn().mockResolvedValue({ error: erroAoSalvar });
  const rpc = vi.fn().mockResolvedValue({ error: null });
  const cliente = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "aluno-1" } } }) },
    from: vi.fn(() => ({ upsert })),
  };
  dependencias.cliente.mockResolvedValue(cliente);
  dependencias.servico.mockReturnValue({ rpc });
  return { cliente, upsert, rpc };
}

describe("salvarOnboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencias.matricula.mockResolvedValue({ id: "matricula-1" });
  });

  it("grava o perfil do próprio usuário, gera o plano por SQL e volta ao app", async () => {
    const { upsert, rpc } = clienteCom();

    await expect(salvarOnboarding(formularioCompleto())).rejects.toThrow(
      "NEXT_REDIRECT:/app",
    );

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "aluno-1",
        concurso_alvo: "Banco do Brasil",
        minutos_por_dia: 60,
        dias_estudo: [1, 3, 5],
        onboarding_concluido: true,
      }),
      { onConflict: "user_id" },
    );
    expect(rpc).toHaveBeenCalledWith(
      "gera_plano_do_dia",
      expect.objectContaining({ p_user_id: "aluno-1" }),
    );
    expect(dependencias.revalidatePath).toHaveBeenCalledWith("/app");
  });

  it("recusa payload incompleto antes de tocar o banco", async () => {
    const { upsert } = clienteCom();
    const formulario = formularioCompleto();
    formulario.delete("diasEstudo");

    await expect(salvarOnboarding(formulario)).rejects.toThrow(
      "NEXT_REDIRECT:/app?erro=onboarding&motivo=agenda_obrigatoria",
    );
    expect(upsert).not.toHaveBeenCalled();
    expect(dependencias.servico).not.toHaveBeenCalled();
  });

  it("não expõe erro técnico quando a persistência falha", async () => {
    const { upsert, rpc } = clienteCom({ erroAoSalvar: new Error("detalhe interno") });

    await expect(salvarOnboarding(formularioCompleto())).rejects.toThrow(
      "NEXT_REDIRECT:/app?erro=salvar",
    );
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(rpc).not.toHaveBeenCalled();
    expect(dependencias.reportar).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ operacao: "salvar_onboarding" }),
    );
  });

  it("não chega ao perfil quando não há usuário autenticado", async () => {
    const cliente = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    };
    dependencias.cliente.mockResolvedValue(cliente);

    await expect(salvarOnboarding(formularioCompleto())).rejects.toThrow(
      "NEXT_REDIRECT:/entrar?proximo=%2Fapp",
    );
    expect(cliente.from).not.toHaveBeenCalled();
  });
});
