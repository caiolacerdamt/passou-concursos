import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencias = vi.hoisted(() => ({
  matricula: vi.fn(),
  cliente: vi.fn(),
  preparar: vi.fn(),
  consultar: vi.fn(),
  sair: vi.fn(),
  redirect: vi.fn((destino: string): never => {
    throw new Error(`NEXT_REDIRECT:${destino}`);
  }),
}));

vi.mock("@/modules/conta/matricula", () => ({
  exigirMatriculaAtiva: dependencias.matricula,
}));
vi.mock("@/lib/db/sessao", () => ({ clienteDaSessao: dependencias.cliente }));
vi.mock("@/modules/aluno/sessao", async (importOriginal) => {
  const atual = await importOriginal<typeof import("@/modules/aluno/sessao")>();
  return {
    ...atual,
    prepararSessao: dependencias.preparar,
    consultarSessao: dependencias.consultar,
  };
});
vi.mock("../../../entrar/acoes", () => ({ sair: dependencias.sair }));
vi.mock("@/modules/aluno/sessao/tela", () => ({
  SessaoTela: ({ sessao }: { sessao: { id: string } }) => (
    <div data-testid="sessao-tela">Sessão renderizada: {sessao.id}</div>
  ),
}));
vi.mock("next/navigation", () => ({ redirect: dependencias.redirect }));

import { SessaoRecusada } from "@/modules/aluno/sessao";

const { default: Sessao } = await import("./page");
const { default: AbrirSessao } = await import("../page");

const sessao = {
  id: "sessao-1",
  blocoId: "bloco-1",
  contexto: "treino" as const,
  encerradaEm: null,
  itens: [
    {
      id: "item-1",
      questaoId: "questao-1",
      questaoVersao: 1,
      ordem: 1,
      respondidoEm: null,
      questao: {} as never,
    },
  ],
};

describe("rotas da sessão", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencias.matricula.mockResolvedValue({ id: "matricula-1" });
    dependencias.cliente.mockResolvedValue({});
    dependencias.consultar.mockResolvedValue(sessao);
    dependencias.preparar.mockResolvedValue({ id: "sessao-1", retomada: false });
  });

  it("redireciona a entrada do bloco para uma sessão persistida", async () => {
    await expect(
      AbrirSessao({ searchParams: Promise.resolve({ bloco: "bloco-1" }) }),
    ).rejects.toThrow("NEXT_REDIRECT:/app/sessao/sessao-1");
    expect(dependencias.preparar).toHaveBeenCalledWith({}, "bloco-1");
  });

  it("renderiza a questão pendente através do componente da sessão", async () => {
    const html = renderToStaticMarkup(
      await Sessao({ params: Promise.resolve({ id: "sessao-1" }) }),
    );

    expect(html).toContain("Sessão renderizada: sessao-1");
    expect(dependencias.consultar).toHaveBeenCalledWith({}, "sessao-1");
  });

  it("mostra conclusão sem criar conteúdo quando não há itens pendentes", async () => {
    dependencias.consultar.mockResolvedValue({ ...sessao, encerradaEm: "2026-08-22T22:00:00Z", itens: [] });

    const html = renderToStaticMarkup(
      await Sessao({ params: Promise.resolve({ id: "sessao-1" }) }),
    );

    expect(html).toContain("Bloco concluído");
    expect(html).not.toContain("sessao-tela");
  });

  it("trata acervo vazio com estado seguro e mantém a volta ao plano", async () => {
    dependencias.preparar.mockRejectedValue(
      new SessaoRecusada("acervo_vazio", "sem questões"),
    );

    const html = renderToStaticMarkup(
      await AbrirSessao({ searchParams: Promise.resolve({ bloco: "bloco-1" }) }),
    );

    expect(html).toContain("Este bloco ainda não tem questões disponíveis");
    expect(html).toContain("/app");
  });
});
