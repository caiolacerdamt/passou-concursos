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

const { salvarPreferencias } = await import("./acoes");

function formularioCompleto() {
  const formulario = new FormData();
  formulario.set("user_id", "usuario-inserido-pelo-atacante");
  formulario.set("concursoAlvo", "Banco do Brasil");
  formulario.set("minutosPorDia", "75");
  formulario.append("diasEstudo", "0");
  formulario.append("diasEstudo", "2");
  formulario.append("diasEstudo", "6");
  formulario.set("horarioEstudo", "06:45");
  formulario.set("nivelDeclarado", "avancado");
  return formulario;
}

function clienteCom({ erroAoSalvar = null as Error | null } = {}) {
  const upsert = vi.fn().mockResolvedValue({ error: erroAoSalvar });
  const cliente = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "aluno-da-sessao" } } }) },
    from: vi.fn(() => ({ upsert })),
  };
  const rpc = vi.fn().mockResolvedValue({ error: null });
  dependencias.cliente.mockResolvedValue(cliente);
  dependencias.servico.mockReturnValue({ rpc });
  return { cliente, upsert, rpc };
}

describe("salvarPreferencias", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencias.matricula.mockResolvedValue({ id: "matricula-1" });
  });

  it("rejeita quem não tem matrícula antes de ler ou gravar o perfil", async () => {
    dependencias.matricula.mockRejectedValue(new Error("NEXT_REDIRECT:/assinar"));

    await expect(salvarPreferencias(formularioCompleto())).rejects.toThrow(
      "NEXT_REDIRECT:/assinar",
    );
    expect(dependencias.cliente).not.toHaveBeenCalled();
    expect(dependencias.servico).not.toHaveBeenCalled();
  });

  it("grava o usuário da sessão, mantém o onboarding concluído e regenera o plano", async () => {
    const { upsert, rpc } = clienteCom();

    await expect(salvarPreferencias(formularioCompleto())).rejects.toThrow(
      "NEXT_REDIRECT:/app/preferencias?resultado=salvo",
    );

    const payload = upsert.mock.calls[0][0];
    expect(payload).toEqual({
      user_id: "aluno-da-sessao",
      concurso_alvo: "Banco do Brasil",
      minutos_por_dia: 75,
      dias_estudo: [0, 2, 6],
      horario_estudo: "06:45",
      nivel_declarado: "avancado",
    });
    expect(payload).not.toHaveProperty("onboarding_concluido");
    expect(upsert).toHaveBeenCalledWith(payload, { onConflict: "user_id" });
    expect(rpc).toHaveBeenCalledWith(
      "gera_plano_do_dia",
      expect.objectContaining({ p_user_id: "aluno-da-sessao", p_data: expect.any(String) }),
    );
    expect(dependencias.revalidatePath).toHaveBeenNthCalledWith(1, "/app");
    expect(dependencias.revalidatePath).toHaveBeenNthCalledWith(2, "/app/preferencias");
  });

  it("redireciona erro de validação sem tocar no banco", async () => {
    const { upsert } = clienteCom();
    const formulario = formularioCompleto();
    formulario.delete("diasEstudo");

    await expect(salvarPreferencias(formulario)).rejects.toThrow(
      "NEXT_REDIRECT:/app/preferencias?erro=onboarding&motivo=agenda_obrigatoria",
    );
    expect(upsert).not.toHaveBeenCalled();
    expect(dependencias.servico).not.toHaveBeenCalled();
  });

  it("não expõe erro técnico quando a persistência falha", async () => {
    const { upsert, rpc } = clienteCom({ erroAoSalvar: new Error("detalhe interno") });

    await expect(salvarPreferencias(formularioCompleto())).rejects.toThrow(
      "NEXT_REDIRECT:/app/preferencias?erro=salvar",
    );
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(rpc).not.toHaveBeenCalled();
    expect(dependencias.reportar).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ operacao: "salvar_preferencias" }),
    );
  });

  it("não chega ao perfil quando a sessão não tem usuário", async () => {
    const cliente = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    };
    dependencias.cliente.mockResolvedValue(cliente);

    await expect(salvarPreferencias(formularioCompleto())).rejects.toThrow(
      "NEXT_REDIRECT:/entrar?proximo=%2Fapp%2Fpreferencias",
    );
    expect(cliente.from).not.toHaveBeenCalled();
  });
});
