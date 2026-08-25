import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencias = vi.hoisted(() => ({
  matricula: vi.fn(),
  cliente: vi.fn(),
  consultar: vi.fn(),
  reportar: vi.fn(),
}));

vi.mock("@/modules/conta/matricula", () => ({
  exigirMatriculaAtiva: dependencias.matricula,
}));
vi.mock("@/lib/db/sessao", () => ({ clienteDaSessao: dependencias.cliente }));
vi.mock("@/modules/observabilidade/reporte", () => ({
  reportarErro: dependencias.reportar,
}));
vi.mock("@/modules/aluno/estudo-guiado/consulta", async (importOriginal) => {
  const atual = await importOriginal<typeof import("@/modules/aluno/estudo-guiado/consulta")>();
  return { ...atual, consultarEstudoGuiado: dependencias.consultar };
});
vi.mock("@/modules/aluno/estudo-guiado/tela", () => ({
  EstudoGuiadoTela: ({ estudo }: { estudo: { topico: string | null } }) => (
    <div data-testid="estudo-tela">Estudo renderizado: {estudo.topico}</div>
  ),
}));

import { EstudoGuiadoRecusado } from "@/modules/aluno/estudo-guiado/consulta";

const { default: Estudo } = await import("./page");

const id = "4c2d8f62-bf58-4db2-8f55-8ef7a9799b1f";

describe("/app/estudo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencias.matricula.mockResolvedValue({ id: "matricula-1" });
    dependencias.cliente.mockResolvedValue({});
    dependencias.consultar.mockResolvedValue({
      bloco: { id },
      materia: "Conhecimentos Bancários",
      topico: "Mercado de crédito",
      recursos: [],
      proximaRevisao: null,
    });
  });

  it("exige bloco válido antes de abrir o cliente da sessão", async () => {
    const html = renderToStaticMarkup(
      await Estudo({ searchParams: Promise.resolve({ bloco: "não-é-uuid" }) }),
    );

    expect(html).toContain("Escolha um bloco válido do seu plano");
    expect(html).toContain("/app");
    expect(dependencias.cliente).not.toHaveBeenCalled();
    expect(dependencias.consultar).not.toHaveBeenCalled();
    expect(dependencias.reportar).not.toHaveBeenCalled();
  });

  it("consulta pela sessão/RLS e renderiza o estudo do bloco", async () => {
    const html = renderToStaticMarkup(
      await Estudo({ searchParams: Promise.resolve({ bloco: id }) }),
    );

    expect(dependencias.consultar).toHaveBeenCalledWith({}, id);
    expect(html).toContain("Estudo renderizado: Mercado de crédito");
  });

  it("falha de forma segura para bloco alheio ou concluído e mantém a volta", async () => {
    dependencias.consultar.mockRejectedValue(
      new EstudoGuiadoRecusado("bloco_inexistente", "não pertence"),
    );
    const alheio = renderToStaticMarkup(
      await Estudo({ searchParams: Promise.resolve({ bloco: id }) }),
    );
    expect(alheio).toContain("Este bloco não está disponível");
    expect(alheio).toContain("Voltar ao plano de hoje");
    expect(dependencias.reportar).not.toHaveBeenCalled();

    dependencias.consultar.mockRejectedValue(
      new EstudoGuiadoRecusado("bloco_concluido", "concluído"),
    );
    const concluido = renderToStaticMarkup(
      await Estudo({ searchParams: Promise.resolve({ bloco: id }) }),
    );
    expect(concluido).toContain("Este bloco já foi concluído");
    expect(concluido).toContain("Voltar ao plano de hoje");
    expect(dependencias.reportar).not.toHaveBeenCalled();
  });

  it("reporta falha de leitura sem expor o detalhe técnico na tela", async () => {
    const falha = new EstudoGuiadoRecusado(
      "falha_leitura",
      "Falha ao ler recursos curados: detalhe interno",
    );
    dependencias.consultar.mockRejectedValue(falha);

    const html = renderToStaticMarkup(
      await Estudo({ searchParams: Promise.resolve({ bloco: id }) }),
    );

    expect(dependencias.reportar).toHaveBeenCalledWith(
      falha,
      { modulo: "aluno", operacao: "consultar_estudo_guiado" },
    );
    expect(html).toContain("Algo deu errado");
    expect(html).not.toContain("detalhe interno");
  });

  it("mantém a guarda de matrícula antes da leitura", async () => {
    dependencias.matricula.mockRejectedValue(new Error("NEXT_REDIRECT:/assinar"));

    await expect(
      Estudo({ searchParams: Promise.resolve({ bloco: id }) }),
    ).rejects.toThrow("NEXT_REDIRECT:/assinar");
    expect(dependencias.cliente).not.toHaveBeenCalled();
    expect(dependencias.consultar).not.toHaveBeenCalled();
  });
});
