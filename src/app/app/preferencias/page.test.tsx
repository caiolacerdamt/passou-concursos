import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencias = vi.hoisted(() => ({
  matricula: vi.fn(),
  cliente: vi.fn(),
  perfil: vi.fn(),
  salvar: vi.fn(),
}));

vi.mock("@/modules/conta/matricula", () => ({
  exigirMatriculaAtiva: dependencias.matricula,
}));
vi.mock("@/lib/db/sessao", () => ({
  clienteDaSessao: dependencias.cliente,
}));
vi.mock("@/modules/aluno/onboarding", () => ({
  consultarPerfilEstudo: dependencias.perfil,
  NIVEIS_DECLARADOS: ["iniciante", "intermediario", "avancado"],
}));
vi.mock("@/modules/aluno/preferencias-tela", () => ({
  PreferenciasTela: ({ perfil }: { perfil: { concursoAlvo: string } }) => (
    <div data-concurso={perfil.concursoAlvo}>preferências renderizadas</div>
  ),
}));
vi.mock("./acoes", () => ({
  salvarPreferencias: dependencias.salvar,
}));

const redirect = vi.hoisted(() => vi.fn((destino: string): never => {
  throw new Error(`NEXT_REDIRECT:${destino}`);
}));
vi.mock("next/navigation", () => ({ redirect }));

const { default: Preferencias } = await import("./page");

function perfilCompleto() {
  return {
    concursoAlvo: "Banco do Brasil",
    minutosPorDia: 45,
    diasEstudo: [1, 3, 6],
    horarioEstudo: "19:30:00",
    nivelDeclarado: "intermediario" as const,
    onboardingConcluido: true,
    dataProva: "2026-10-18",
  };
}

describe("/app/preferencias", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencias.matricula.mockResolvedValue({ id: "matricula-1" });
    dependencias.cliente.mockResolvedValue({});
    dependencias.perfil.mockResolvedValue(perfilCompleto());
  });

  it("exige matrícula, lê o perfil e renderiza a tela preenchida", async () => {
    const html = renderToStaticMarkup(
      await Preferencias({ searchParams: Promise.resolve({ resultado: "salvo" }) }),
    );

    expect(dependencias.matricula).toHaveBeenCalledTimes(1);
    expect(dependencias.cliente).toHaveBeenCalledTimes(1);
    expect(dependencias.perfil).toHaveBeenCalledWith(expect.anything());
    expect(html).toContain("preferências renderizadas");
    expect(html).toContain("Banco do Brasil");
  });

  it("manda para Hoje quando o onboarding ainda não está concluído", async () => {
    dependencias.perfil.mockResolvedValue({ ...perfilCompleto(), onboardingConcluido: false });

    await expect(
      Preferencias({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("NEXT_REDIRECT:/app");
    expect(dependencias.perfil).toHaveBeenCalledTimes(1);
  });

  it("manda para Hoje quando não existe perfil", async () => {
    dependencias.perfil.mockResolvedValue(null);

    await expect(
      Preferencias({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("NEXT_REDIRECT:/app");
  });
});
