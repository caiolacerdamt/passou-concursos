import { describe, expect, it, vi } from "vitest";

import { consultarRotulosDosTopicos } from "./plano-rotulos";
import type { PlanoDoDia } from "./plano";

const plano: PlanoDoDia = {
  id: "plano-1",
  data: "2026-08-22",
  frase: null,
  piso: [],
  metaCheia: [
    {
      id: "bloco-1",
      tipo: "avancar",
      nivel: "meta_cheia",
      ordem: 1,
      topicoId: "topico-1",
      nQuestoes: 10,
      nQuestoesCheias: 10,
      minutosEstimados: 20,
      minutosEstimadosCheios: 20,
      motivo: null,
      ajusteUsuario: false,
      adiadoDe: null,
      conclusao: null,
    },
  ],
};

describe("consultarRotulosDosTopicos", () => {
  it("retorna somente rótulos existentes para os tópicos do plano", async () => {
    const consulta = {
      data: [
        { id: "topico-1", nome: "Mercado de crédito", materias: { nome: "Conhecimentos Bancários" } },
        { id: "outro", nome: "Fora do plano", materias: { nome: "Outra matéria" } },
        { id: "topico-1", nome: "  Mercado de crédito  ", materias: { nome: "  Conhecimentos Bancários  " } },
      ],
      error: null,
    };
    const cadeia = {
      in: vi.fn(async () => consulta),
    };
    const cliente = {
      from: vi.fn(() => ({
        select: vi.fn(() => cadeia),
      })),
    };

    await expect(consultarRotulosDosTopicos(cliente as never, plano)).resolves.toEqual(
      new Map([[
        "topico-1",
        { materia: "Conhecimentos Bancários", topico: "Mercado de crédito" },
      ]]),
    );
    expect(cliente.from).toHaveBeenCalledWith("topicos");
    expect(cadeia.in).toHaveBeenCalledWith("id", ["topico-1"]);
  });

  it("forma apenas o nome da matéria quando o tópico é Geral", async () => {
    const cadeia = {
      in: vi.fn(async () => ({
        data: [{ id: "topico-1", nome: "Geral", materias: { nome: "Língua Portuguesa" } }],
        error: null,
      })),
    };
    const cliente = { from: vi.fn(() => ({ select: vi.fn(() => cadeia) })) };

    const rotulos = await consultarRotulosDosTopicos(cliente as never, plano);

    expect(rotulos.get("topico-1")).toEqual({ materia: "Língua Portuguesa", topico: "Geral" });
  });

  it("não faz leitura quando o plano não tem tópico", async () => {
    const cliente = { from: vi.fn() };
    await expect(
      consultarRotulosDosTopicos(cliente as never, { ...plano, metaCheia: [{ ...plano.metaCheia[0], topicoId: null }] }),
    ).resolves.toEqual(new Map());
    expect(cliente.from).not.toHaveBeenCalled();
  });

  it("propaga a falha técnica da leitura para o fallback da tela", async () => {
    const cadeia = {
      in: vi.fn(async () => ({ data: null, error: { message: "indisponível" } })),
    };
    const cliente = {
      from: vi.fn(() => ({
        select: vi.fn(() => cadeia),
      })),
    };

    await expect(consultarRotulosDosTopicos(cliente as never, plano)).rejects.toThrow(
      "falha ao ler rótulos dos tópicos: indisponível",
    );
  });
});
