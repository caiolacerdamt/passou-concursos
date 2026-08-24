import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencias = vi.hoisted(() => ({
  matricula: vi.fn(),
  cliente: vi.fn(),
  consultar: vi.fn(),
  sair: vi.fn(),
  reportar: vi.fn(),
}));

vi.mock("@/modules/conta/matricula", () => ({ exigirMatriculaAtiva: dependencias.matricula }));
vi.mock("@/lib/db/sessao", () => ({ clienteDaSessao: dependencias.cliente }));
vi.mock("@/modules/aluno/resumo-sessao", () => ({ consultarResumoDaSessao: dependencias.consultar }));
vi.mock("@/app/entrar/acoes", () => ({ sair: dependencias.sair }));
vi.mock("@/modules/observabilidade/reporte", () => ({ reportarErro: dependencias.reportar }));
vi.mock("@/modules/aluno/resumo-tela", () => ({
  ResumoTela: ({ resumo }: { resumo: { id: string } }) => <div>Resumo renderizado: {resumo.id}</div>,
}));

const { default: Resumo } = await import("./page");

describe("rota do resumo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencias.matricula.mockResolvedValue({ id: "matricula-1" });
    dependencias.cliente.mockResolvedValue({});
    dependencias.consultar.mockResolvedValue({ id: "sessao-1" });
  });

  it("exige matrícula e consulta a sessão pelo ID no servidor", async () => {
    const html = renderToStaticMarkup(
      await Resumo({ params: Promise.resolve({ id: "sessao-1" }) }),
    );

    expect(dependencias.matricula).toHaveBeenCalledTimes(1);
    expect(dependencias.consultar).toHaveBeenCalledWith({}, "sessao-1");
    expect(html).toContain("Resumo renderizado: sessao-1");
  });

  it("não revela se a sessão ausente, aberta ou alheia existe", async () => {
    dependencias.consultar.mockResolvedValue(null);

    const html = renderToStaticMarkup(
      await Resumo({ params: Promise.resolve({ id: "sessao-alheia" }) }),
    );

    expect(html).toContain("Resumo indisponível");
    expect(html).toContain("Voltar ao plano de hoje");
    expect(html).not.toContain("Resumo renderizado");
  });

  it("interrompe antes da consulta quando a matrícula não autoriza o acesso", async () => {
    dependencias.matricula.mockRejectedValue(new Error("NEXT_REDIRECT:/assinar"));

    await expect(
      Resumo({ params: Promise.resolve({ id: "sessao-1" }) }),
    ).rejects.toThrow("NEXT_REDIRECT:/assinar");
    expect(dependencias.cliente).not.toHaveBeenCalled();
    expect(dependencias.consultar).not.toHaveBeenCalled();
  });

  it("transforma falha interna em estado genérico sem expor a mensagem técnica", async () => {
    dependencias.consultar.mockRejectedValue(new Error("detalhe privado do banco"));

    const html = renderToStaticMarkup(
      await Resumo({ params: Promise.resolve({ id: "sessao-1" }) }),
    );

    expect(html).toContain("Algo deu errado");
    expect(html).not.toContain("detalhe privado do banco");
    expect(dependencias.reportar).toHaveBeenCalledWith(
      expect.any(Error),
      { modulo: "aluno", operacao: "consultar_resumo_sessao" },
    );
  });
});
