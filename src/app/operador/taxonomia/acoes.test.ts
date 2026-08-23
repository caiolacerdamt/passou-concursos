import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencias = vi.hoisted(() => ({
  decidir: vi.fn(),
  editar: vi.fn(),
  revalidar: vi.fn(),
  redirecionar: vi.fn((destino: string) => {
    throw new Error(`REDIRECT:${destino}`);
  }),
  reportar: vi.fn(),
}));

vi.mock("@/modules/operador", () => ({
  decidirTopicoCandidato: dependencias.decidir,
  editarTaxonomia: dependencias.editar,
  EntradaDoOperadorInvalida: class EntradaDoOperadorInvalida extends Error {},
}));
vi.mock("@/modules/observabilidade/reporte", () => ({
  reportarErro: dependencias.reportar,
}));
vi.mock("next/cache", () => ({
  revalidatePath: dependencias.revalidar,
}));
vi.mock("next/navigation", () => ({
  redirect: dependencias.redirecionar,
}));

const { decidirCandidato, editarTaxonomia } = await import("./acoes");

describe("ações da taxonomia do operador", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencias.decidir.mockResolvedValue("topico-1");
    dependencias.editar.mockResolvedValue(true);
  });

  it("aprova candidato com matéria e nome escolhidos", async () => {
    const formulario = new FormData();
    formulario.set("candidatoId", "22222222-2222-4222-8222-222222222222");
    formulario.set("decisao", "aprovado");
    formulario.set("materiaId", "33333333-3333-4333-8333-333333333333");
    formulario.set("nome", "Mercado de capitais");
    formulario.set("motivo", "nome conferido no edital");

    await expect(decidirCandidato(formulario)).rejects.toThrow("REDIRECT:/operador/taxonomia?estado=decidido");
    expect(dependencias.decidir).toHaveBeenCalledWith({
      candidatoId: "22222222-2222-4222-8222-222222222222",
      decisao: "aprovado",
      materiaId: "33333333-3333-4333-8333-333333333333",
      nome: "Mercado de capitais",
      motivo: "nome conferido no edital",
    });
  });

  it("edita tópico com estado explícito e motivo, sem autor no formulário", async () => {
    const formulario = new FormData();
    formulario.set("tipo", "topico");
    formulario.set("id", "44444444-4444-4444-8444-444444444444");
    formulario.set("nome", "Novo nome");
    formulario.set("ordem", "3");
    formulario.set("ativa", "false");
    formulario.set("materiaId", "33333333-3333-4333-8333-333333333333");
    formulario.set("motivo", "desativação revisada");

    await expect(editarTaxonomia(formulario)).rejects.toThrow("REDIRECT:/operador/taxonomia?estado=editado");
    expect(dependencias.editar).toHaveBeenCalledWith({
      tipo: "topico",
      id: "44444444-4444-4444-8444-444444444444",
      motivo: "desativação revisada",
      campos: {
        nome: "Novo nome",
        ordem: 3,
        ativo: false,
        materiaId: "33333333-3333-4333-8333-333333333333",
      },
    });
  });

  it("fecha erro inesperado em orientação genérica", async () => {
    dependencias.editar.mockRejectedValue(new Error("stack do banco"));
    const formulario = new FormData();
    formulario.set("tipo", "materia");
    formulario.set("id", "33333333-3333-4333-8333-333333333333");
    formulario.set("nome", "Bancário");
    formulario.set("motivo", "ajuste");

    await expect(editarTaxonomia(formulario)).rejects.toThrow("REDIRECT:/operador/taxonomia?estado=erro");
    expect(dependencias.reportar).toHaveBeenCalled();
    expect(String(dependencias.redirecionar.mock.calls[0]?.[0])).not.toContain("stack do banco");
  });
});
