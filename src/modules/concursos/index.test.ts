import { describe, expect, it, vi } from "vitest";

import {
  concursoDoAluno,
  editalDoConcurso,
  escolherConcurso,
  listarConcursosPublicados,
  perfilConcursoDoAluno,
} from "./index";

type Resposta = { data: unknown; error: { message: string } | null };

function cadeia(resposta: Resposta, filtros: [string, unknown][]) {
  const api = {
    select: () => api,
    eq: (coluna: string, valor: unknown) => {
      filtros.push([coluna, valor]);
      return api;
    },
    order: () => api,
    then: (
      resolve: (valor: Resposta) => unknown,
      reject?: (erro: unknown) => unknown,
    ) => Promise.resolve(resposta).then(resolve, reject),
  };
  return api;
}

function clienteFalso(respostas: Record<string, Resposta>, rpc?: Resposta) {
  const chamadasRpc: [string, unknown][] = [];
  const filtros: [string, unknown][] = [];
  return {
    chamadasRpc,
    filtros,
    cliente: {
      from: (tabela: string) => cadeia(respostas[tabela], filtros),
      rpc: async (nome: string, argumentos: unknown) => {
        chamadasRpc.push([nome, argumentos]);
        return rpc ?? { data: null, error: null };
      },
    },
  };
}

describe("listarConcursosPublicados", () => {
  it("devolve só o que a consulta trouxe, já no formato da tela", async () => {
    const falso = clienteFalso({
      concursos: {
        data: [
          { id: "c-1", orgao: "Banco do Brasil", cargo: "Escriturário" },
          { id: "c-2", orgao: "CAIXA", cargo: "Técnico Bancário" },
        ],
        error: null,
      },
    });

    await expect(
      listarConcursosPublicados(falso.cliente as never),
    ).resolves.toEqual([
      { id: "c-1", orgao: "Banco do Brasil", cargo: "Escriturário" },
      { id: "c-2", orgao: "CAIXA", cargo: "Técnico Bancário" },
    ]);
    // Oculto e elegível não podem vazar para a escolha do aluno.
    expect(falso.filtros).toEqual([["visibilidade", "publicado"]]);
  });

  it("estoura com o nome do recurso quando a leitura falha", async () => {
    const falso = clienteFalso({
      concursos: { data: null, error: { message: "sem permissão" } },
    });

    await expect(
      listarConcursosPublicados(falso.cliente as never),
    ).rejects.toThrow("falha ao ler concursos: sem permissão");
  });
});

describe("concurso do aluno", () => {
  it("pergunta ao banco, que é quem conhece a flag e o padrão", async () => {
    const falso = clienteFalso({}, { data: "c-1", error: null });

    await expect(
      concursoDoAluno("aluno-1", falso.cliente as never),
    ).resolves.toBe("c-1");
    expect(falso.chamadasRpc).toEqual([
      ["concurso_do_aluno", { p_user_id: "aluno-1" }],
    ]);
  });

  it("devolve null quando não há concurso nenhum", async () => {
    const falso = clienteFalso({}, { data: null, error: null });

    await expect(
      perfilConcursoDoAluno("aluno-1", falso.cliente as never),
    ).resolves.toBeNull();
  });
});

describe("editalDoConcurso", () => {
  it("ordena os assuntos de cada matéria pela ordem do edital", async () => {
    const falso = clienteFalso({
      concurso_materias: {
        data: [
          {
            id: "m-1",
            nome: "Atendimento Bancário",
            ordem: 1,
            concurso_materia_assuntos: [
              { topico_id: "t-b", ordem: 2 },
              { topico_id: "t-a", ordem: 1 },
            ],
          },
          { id: "m-2", nome: "Probabilidade", ordem: 2, concurso_materia_assuntos: null },
        ],
        error: null,
      },
    });

    await expect(
      editalDoConcurso("c-1", falso.cliente as never),
    ).resolves.toEqual([
      {
        id: "m-1",
        nome: "Atendimento Bancário",
        ordem: 1,
        topicoIds: ["t-a", "t-b"],
      },
      { id: "m-2", nome: "Probabilidade", ordem: 2, topicoIds: [] },
    ]);
    expect(falso.filtros).toEqual([["concurso_id", "c-1"]]);
  });
});

describe("escolherConcurso", () => {
  it("manda só o concurso: o titular sai de auth.uid() dentro do banco", async () => {
    const falso = clienteFalso({}, { data: "c-2", error: null });

    await escolherConcurso("c-2", falso.cliente as never);

    expect(falso.chamadasRpc).toEqual([
      ["escolher_concurso", { p_concurso_id: "c-2" }],
    ]);
  });

  it("propaga a recusa do banco sem traduzir para sucesso", async () => {
    const cliente = {
      rpc: vi.fn(async () => ({
        data: null,
        error: { message: "concurso_indisponivel" },
      })),
    };

    await expect(escolherConcurso("c-3", cliente as never)).rejects.toThrow(
      "falha ao escolher concurso: concurso_indisponivel",
    );
  });
});
