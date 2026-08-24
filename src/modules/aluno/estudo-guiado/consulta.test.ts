import { describe, expect, it, vi } from "vitest";

import { consultarEstudoGuiado, EstudoGuiadoRecusado } from "./consulta";

function clienteCom(respostas: Record<string, { data: unknown; error: null | { message: string } }>) {
  const chamadas: string[] = [];
  const from = vi.fn((tabela: string) => {
    chamadas.push(tabela);
    const resposta = respostas[tabela] ?? { data: null, error: null };
    const cadeia = {
      select: vi.fn(() => cadeia),
      eq: vi.fn(() => cadeia),
      not: vi.fn(() => cadeia),
      limit: vi.fn(() => cadeia),
      order: vi.fn(() => cadeia),
      maybeSingle: vi.fn(() => Promise.resolve(resposta)),
      then: (resolve: (valor: unknown) => unknown, reject: (erro: unknown) => unknown) =>
        Promise.resolve(resposta).then(resolve, reject),
    };
    return cadeia;
  });
  return { cliente: { from } as never, chamadas };
}

const bloco = {
  id: "4c2d8f62-bf58-4db2-8f55-8ef7a9799b1f",
  tipo: "revisar",
  nivel: "piso",
  ordem: 1,
  topico_id: "d7c96f70-6c28-47da-8ce5-04ed06f3e7bc",
  n_questoes: 5,
  n_questoes_cheias: 8,
  minutos_estimados: 20,
  minutos_estimados_cheios: 30,
  motivo: "A revisão venceu.",
  ajuste_usuario: false,
  adiado_de: null,
};

describe("leitor do estudo guiado", () => {
  it("preserva o snapshot, enriquece taxonomia e lê recurso/agenda pela RLS", async () => {
    const { cliente, chamadas } = clienteCom({
      plano_bloco: { data: bloco, error: null },
      sessoes: { data: null, error: null },
      topicos: {
        data: {
          id: bloco.topico_id,
          materia_id: "f3ba4a98-57df-4803-a56c-7d69de94a5bf",
          nome: "Mercado de crédito",
        },
        error: null,
      },
      revisao_agenda: { data: { due: "2026-08-30" }, error: null },
      materias: { data: { id: "f3ba4a98-57df-4803-a56c-7d69de94a5bf", nome: "Conhecimentos Bancários" }, error: null },
      recursos_estudo: {
        data: [
          {
            id: "7d86194a-f1cf-4e65-bc2e-69d67766366a",
            topico_id: bloco.topico_id,
            titulo: "Aula sobre crédito",
            url: "https://conteudo.test/credito",
            tipo: "video",
            duracao_minutos: 20,
            ordem: 1,
            ativo: true,
          },
        ],
        error: null,
      },
    });

    await expect(consultarEstudoGuiado(cliente, bloco.id)).resolves.toMatchObject({
      bloco: {
        id: bloco.id,
        tipo: "revisar",
        nivel: "piso",
        topicoId: bloco.topico_id,
        nQuestoes: 5,
        minutosEstimados: 20,
        motivo: "A revisão venceu.",
      },
      materia: "Conhecimentos Bancários",
      topico: "Mercado de crédito",
      proximaRevisao: "2026-08-30",
      recursos: [{ titulo: "Aula sobre crédito", ordem: 1 }],
    });
    expect(chamadas).toEqual([
      "plano_bloco",
      "sessoes",
      "topicos",
      "recursos_estudo",
      "revisao_agenda",
      "materias",
    ]);
  });

  it("recusa bloco ausente ou concluído antes de ler conteúdo", async () => {
    const ausente = clienteCom({ plano_bloco: { data: null, error: null } });
    await expect(consultarEstudoGuiado(ausente.cliente, bloco.id)).rejects.toMatchObject({
      motivo: "bloco_inexistente",
    });
    expect(ausente.chamadas).toEqual(["plano_bloco"]);

    const concluido = clienteCom({
      plano_bloco: { data: bloco, error: null },
      sessoes: { data: { id: "sessao-concluida" }, error: null },
    });
    await expect(consultarEstudoGuiado(concluido.cliente, bloco.id)).rejects.toBeInstanceOf(
      EstudoGuiadoRecusado,
    );
    expect(concluido.chamadas).toEqual(["plano_bloco", "sessoes"]);
  });

  it("mantém bloco sem tópico utilizável e não cria revisão", async () => {
    const semTopico = clienteCom({
      plano_bloco: { data: { ...bloco, topico_id: null }, error: null },
      sessoes: { data: null, error: null },
    });

    await expect(consultarEstudoGuiado(semTopico.cliente, bloco.id)).resolves.toMatchObject({
      materia: null,
      topico: null,
      recursos: [],
      proximaRevisao: null,
    });
    expect(semTopico.chamadas).toEqual(["plano_bloco", "sessoes"]);
  });
});
