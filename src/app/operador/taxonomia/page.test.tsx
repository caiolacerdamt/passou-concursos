import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencias = vi.hoisted(() => ({
  consultar: vi.fn(),
  decidir: vi.fn(),
  editar: vi.fn(),
}));

vi.mock("@/modules/operador", () => ({
  consultarTaxonomia: dependencias.consultar,
}));
vi.mock("./acoes", () => ({
  decidirCandidato: dependencias.decidir,
  editarTaxonomia: dependencias.editar,
}));

const { default: Taxonomia } = await import("./page");

const taxonomia = {
  materias: [
    {
      id: "33333333-3333-4333-8333-333333333333",
      nome: "Conhecimentos bancários",
      ordem: 1,
      ativa: true,
      topicos: [
        {
          id: "44444444-4444-4444-8444-444444444444",
          nome: "Mercado de capitais",
          ordem: 1,
          ativo: true,
        },
      ],
    },
  ],
  candidatos: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      nomeSugerido: "Open banking",
      materiaId: "33333333-3333-4333-8333-333333333333",
      ocorrencias: 4,
      sugeridoEm: "2026-08-23T10:00:00.000Z",
    },
  ],
};

describe("/operador/taxonomia", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencias.consultar.mockResolvedValue(taxonomia);
  });

  it("mostra ocorrências, escolha de matéria/nome e edição com motivo", async () => {
    const html = renderToStaticMarkup(
      await Taxonomia({ searchParams: Promise.resolve({}) }),
    );

    expect(html).toContain("Open banking");
    expect(html).toContain("4 ocorrências");
    expect(html).toContain("Aprovar e criar tópico");
    expect(html).toContain("Escolha uma matéria");
    expect(html).toContain("Nome canônico");
    expect(html).toContain("Motivo da edição");
    expect(html).toContain("Desativado — ação explícita");
    expect(html).toContain("Mercado de capitais");
  });

  it("orienta os estados vazios de candidatos e taxonomia", async () => {
    dependencias.consultar.mockResolvedValue({ materias: [], candidatos: [] });
    const html = renderToStaticMarkup(
      await Taxonomia({ searchParams: Promise.resolve({ estado: "editado" }) }),
    );

    expect(html).toContain("Taxonomia atualizada");
    expect(html).toContain("Nenhum candidato pendente");
    expect(html).toContain("A taxonomia ainda está vazia");
  });
});
