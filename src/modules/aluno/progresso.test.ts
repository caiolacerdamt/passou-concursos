import { describe, expect, it, vi } from "vitest";

import {
  CAUSAS_DO_CADERNO,
  consultarProgresso,
  normalizarFiltrosProgresso,
} from "./progresso";

type Resposta = { data: unknown; error: { message: string } | null };

function cadeia(resposta: Resposta) {
  const api = {
    select: vi.fn(() => api),
    eq: vi.fn(() => api),
    in: vi.fn(() => api),
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
        cadeias[tabela] ??= cadeia(respostas[tabela]);
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
    });
    expect(resultado.caderno[0].nErros).toBe(3);
    expect(resultado.sequencia?.sequencia).toBe(4);
    expect(resultado.estadoInicial).toBe(false);
    expect(falso.chamadas).not.toContain("tentativas");
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
    expect(falso.chamadas).toEqual(["dominio_topico", "caderno_erros"]);
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
});
