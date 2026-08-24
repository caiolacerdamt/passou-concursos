import { describe, expect, it, vi } from "vitest";

const dependencias = vi.hoisted(() => ({
  servico: { rpc: vi.fn() },
}));

vi.mock("@/lib/db/servidor", () => ({
  clienteDeServico: () => dependencias.servico,
}));

import {
  CAUSAS_DO_CADERNO,
  calcularTendencia,
  consultarProgresso,
  finalizarBloco,
  normalizarFiltrosProgresso,
} from "./progresso";

type Resposta = { data: unknown; error: { message: string } | null };

function cadeia(resposta: Resposta) {
  const api = {
    select: vi.fn(() => api),
    eq: vi.fn(() => api),
    in: vi.fn(() => api),
    gte: vi.fn(() => api),
    lte: vi.fn(() => api),
    order: vi.fn(() => api),
    then: (
      resolve: (valor: Resposta) => unknown,
      reject?: (erro: unknown) => unknown,
    ) => Promise.resolve(resposta).then(resolve, reject),
  };
  return api;
}

function clienteFalso(
  respostas: Record<string, Resposta>,
  sequencia: Resposta = { data: [], error: null },
) {
  const chamadas: string[] = [];
  const cadeias: Record<string, ReturnType<typeof cadeia>> = {};
  return {
    chamadas,
    cadeias,
    cliente: {
      from(tabela: string) {
        chamadas.push(tabela);
        cadeias[tabela] ??= cadeia(
          respostas[tabela] ?? { data: [], error: null },
        );
        return cadeias[tabela];
      },
      rpc: vi.fn(async () => sequencia),
    },
  };
}

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

describe("normalizarFiltrosProgresso", () => {
  it("mantém causa e tópico válidos para o filtro combinado", () => {
    expect(
      normalizarFiltrosProgresso({ causa: "errei_a_conta", topico: UUID_A }),
    ).toEqual({ causa: "errei_a_conta", topicoId: UUID_A });
  });

  it("descarta causa desconhecida, UUID inválido e valor repetido em array", () => {
    expect(
      normalizarFiltrosProgresso({ causa: "sql_injection", topico: [UUID_B, UUID_A] }),
    ).toEqual({ causa: null, topicoId: UUID_B });
  });

  it("mantém a allowlist fechada de causas do banco", () => {
    expect(CAUSAS_DO_CADERNO).toHaveLength(8);
    expect(CAUSAS_DO_CADERNO).toContain("faltou_tempo");
  });
});

describe("consultarProgresso", () => {
  it("mapeia projeções, aplica os dois filtros e não consulta tentativas", async () => {
    const falso = clienteFalso(
      {
        dominio_topico: {
          data: [
            { topico_id: UUID_A, n_respostas: "10", n_acertos: 6, score: "0.6" },
          ],
          error: null,
        },
        caderno_erros: {
          data: [
            {
              topico_id: UUID_A,
              causa_erro: "errei_a_conta",
              n_erros: "3",
              ultimo_erro_em: "2026-08-21T20:00:00Z",
            },
          ],
          error: null,
        },
        topicos: { data: [{ id: UUID_A, nome: "Matemática Financeira" }], error: null },
      },
      {
        data: [
          {
            data: "2026-08-22",
            sequencia: "4",
            estado: "piso_pendente",
            piso_entregue: true,
            piso_cumprido: false,
            tem_historico: true,
          },
        ],
        error: null,
      },
    );

    const resultado = await consultarProgresso(falso.cliente as never, {
      causa: "errei_a_conta",
      topico: UUID_A,
    });

    expect(resultado.historico[0]).toEqual({
      topicoId: UUID_A,
      topico: "Matemática Financeira",
      nRespostas: 10,
      nAcertos: 6,
      score: 0.6,
      dominio: "em_desenvolvimento",
      tendencia: "sem_base",
    });
    expect(resultado.caderno[0].nErros).toBe(3);
    expect(resultado.sequencia?.sequencia).toBe(4);
    expect(resultado.estadoInicial).toBe(false);
    expect(falso.chamadas).toContain("tentativas");
    expect(falso.cadeias.caderno_erros.eq).toHaveBeenCalledWith(
      "causa_erro",
      "errei_a_conta",
    );
    expect(falso.cadeias.caderno_erros.eq).toHaveBeenCalledWith("topico_id", UUID_A);
  });

  it("devolve estado inicial claro e não busca tópicos quando não há projeção", async () => {
    const falso = clienteFalso(
      {
        dominio_topico: { data: [], error: null },
        caderno_erros: { data: [], error: null },
        topicos: { data: [], error: null },
      },
      { data: [], error: null },
    );

    await expect(consultarProgresso(falso.cliente as never)).resolves.toMatchObject({
      historico: [],
      caderno: [],
      topicos: [],
      sequencia: null,
      estadoInicial: true,
    });
    expect(falso.chamadas).toEqual([
      "dominio_topico",
      "caderno_erros",
      "tentativas",
      "revisao_evento",
    ]);
  });

  it("nomeia o recurso cuja leitura falhou e não mostra detalhes como sucesso", async () => {
    const falso = clienteFalso({
      dominio_topico: { data: null, error: { message: "indisponível" } },
      caderno_erros: { data: [], error: null },
      topicos: { data: [], error: null },
    });

    await expect(consultarProgresso(falso.cliente as never)).rejects.toThrow(
      "falha ao ler dominio_topico: indisponível",
    );
  });

  it("recusa projeção que aponta para tópico ausente", async () => {
    const falso = clienteFalso({
      dominio_topico: {
        data: [{ topico_id: UUID_A, n_respostas: 1, n_acertos: 0, score: 0 }],
        error: null,
      },
      caderno_erros: { data: [], error: null },
      topicos: { data: [], error: null },
    });

    await expect(consultarProgresso(falso.cliente as never)).rejects.toThrow(
      "tópico que não existe",
    );
  });

  it("recusa score não numérico e causa fora da enumeração", async () => {
    const falso = clienteFalso({
      dominio_topico: {
        data: [{ topico_id: UUID_A, n_respostas: 1, n_acertos: 0, score: "NaN" }],
        error: null,
      },
      caderno_erros: {
        data: [{ topico_id: UUID_A, causa_erro: "outra", n_erros: 1, ultimo_erro_em: "2026-08-21" }],
        error: null,
      },
      topicos: { data: [{ id: UUID_A, nome: "Tópico" }], error: null },
    });

    await expect(consultarProgresso(falso.cliente as never)).rejects.toThrow(
      "número inválido",
    );
  });

  it("propaga erro da RPC de sequência sem transformar falha em sequência zero", async () => {
    const falso = clienteFalso(
      {
        dominio_topico: { data: [], error: null },
        caderno_erros: { data: [], error: null },
        topicos: { data: [], error: null },
      },
      { data: null, error: { message: "rpc indisponível" } },
    );

    await expect(consultarProgresso(falso.cliente as never)).rejects.toThrow(
      "falha ao ler sequência: rpc indisponível",
    );
  });

  it("reconstroi projeções e calcula o percentual do bloco pela sessão autenticada", async () => {
    dependencias.servico.rpc.mockResolvedValue({ data: 2, error: null });
    const sessao = {
      select: vi.fn(() => sessao),
      eq: vi.fn(() => sessao),
      maybeSingle: vi.fn(async () => ({
        data: { contexto: "revisao", encerrada_em: "2026-08-24T10:00:00Z" },
        error: null,
      })),
    };
    const tentativas = {
      select: vi.fn(() => tentativas),
      eq: vi.fn(() => tentativas),
      then: (
        resolve: (valor: Resposta) => unknown,
        reject?: (erro: unknown) => unknown,
      ) =>
        Promise.resolve({
          data: [
            { topico_id: UUID_A, correta: true },
            { topico_id: UUID_A, correta: false },
            { topico_id: UUID_A, correta: true },
          ],
          error: null,
        }).then(resolve, reject),
    };
    const cliente = {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: "aluno-1" } }, error: null })),
      },
      from: vi.fn((tabela: string) => (tabela === "sessoes" ? sessao : tentativas)),
    };

    await expect(finalizarBloco(cliente as never, "sessao-1")).resolves.toEqual({
      userId: "aluno-1",
      contexto: "revisao",
      topicoId: UUID_A,
      nRespostas: 3,
      nAcertos: 2,
    });
    expect(dependencias.servico.rpc).toHaveBeenCalledWith("recalcula_projecoes", {
      p_user_id: "aluno-1",
    });
  });

  it("torna ocupação ou falha da projeção visível", async () => {
    dependencias.servico.rpc.mockResolvedValue({ data: -1, error: null });
    const cliente = {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: "aluno-1" } }, error: null })),
      },
    };

    await expect(finalizarBloco(cliente as never, "sessao-1")).rejects.toThrow(
      "está ocupada",
    );
  });

  it("compara as janelas de sete dias e monta relatório somente com fatos", async () => {
    const falso = clienteFalso(
      {
        dominio_topico: {
          data: [{ topico_id: UUID_A, n_respostas: 2, n_acertos: 1, score: 0.5 }],
          error: null,
        },
        caderno_erros: { data: [], error: null },
        topicos: { data: [{ id: UUID_A, nome: "Matemática" }], error: null },
        tentativas: {
          data: [
            { topico_id: UUID_A, correta: true, respondida_em: "2026-08-12T12:00:00Z" },
            { topico_id: UUID_A, correta: false, respondida_em: "2026-08-20T12:00:00Z" },
            { topico_id: UUID_A, correta: true, respondida_em: "2026-08-21T12:00:00Z" },
          ],
          error: null,
        },
        revisao_evento: {
          data: [{ topico_id: UUID_A, revisado_em: "2026-08-21T12:00:00Z" }],
          error: null,
        },
      },
      { data: [], error: null },
    );

    const resultado = await consultarProgresso(
      falso.cliente as never,
      {},
      "2026-08-24T12:00:00Z",
    );

    expect(resultado.relatorioSemanal).toMatchObject({
      questoesRespondidas: 2,
      acertos: 1,
      percentualAcertos: 0.5,
      topicosTocados: 1,
      revisoesConcluidas: 1,
      tendencia: "caindo",
    });
    expect(resultado.historico[0].tendencia).toBe("caindo");
  });
});

describe("calcularTendencia", () => {
  const tentativa = (correta: boolean) => ({
    topico_id: UUID_A,
    correta,
    respondida_em: "2026-08-20T12:00:00Z",
  });

  it("explicita sem base quando uma das janelas está vazia", () => {
    expect(calcularTendencia([tentativa(true)], [])).toBe("sem_base");
  });

  it("classifica taxas iguais como estáveis sem arredondamento", () => {
    expect(calcularTendencia([tentativa(true), tentativa(false)], [tentativa(false), tentativa(true)])).toBe("estavel");
  });
});
