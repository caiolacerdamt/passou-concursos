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

type Resposta = { data: unknown; error: { message: string } | null; count?: number };

function cadeia(resposta: Resposta) {
  const api = {
    select: vi.fn(() => api),
    eq: vi.fn(() => api),
    in: vi.fn(() => api),
    gte: vi.fn(() => api),
    lte: vi.fn(() => api),
    range: vi.fn(() => api),
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

const MATERIA_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MATERIA_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

describe("normalizarFiltrosProgresso", () => {
  it("mantém causa e tópico válidos para o filtro combinado", () => {
    expect(
      normalizarFiltrosProgresso({ causa: "errei_a_conta", topico: UUID_A }),
    ).toEqual({ causa: "errei_a_conta", topicoId: UUID_A, materiaId: null });
  });

  it("descarta causa desconhecida, UUID inválido e valor repetido em array", () => {
    expect(
      normalizarFiltrosProgresso({ causa: "sql_injection", topico: [UUID_B, UUID_A] }),
    ).toEqual({ causa: null, topicoId: UUID_B, materiaId: null });
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
        topicos: { data: [{ id: UUID_A, nome: "Matemática Financeira", materia_id: MATERIA_A }], error: null },
        materias: { data: [{ id: MATERIA_A, nome: "Matemática" }], error: null },
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
      materiaId: MATERIA_A,
      materia: "Matemática",
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
    // O recorte é em memória: nem a causa nem o tópico viram `.eq()`, porque a
    // consulta filtrada era quem encolhia as opções do próprio filtro.
    expect(falso.cadeias.caderno_erros.eq).not.toHaveBeenCalled();
    expect(falso.cadeias.dominio_topico.eq).not.toHaveBeenCalled();
    expect(falso.cadeias.caderno_erros.range).toHaveBeenCalledWith(0, 799);
  });

  it("não deixa o filtro do caderno encolher o histórico nem a lista de opções", async () => {
    const falso = clienteFalso(
      {
        dominio_topico: {
          data: [
            { topico_id: UUID_A, n_respostas: 10, n_acertos: 6, score: 0.6 },
            { topico_id: UUID_B, n_respostas: 4, n_acertos: 1, score: 0.25 },
          ],
          error: null,
        },
        caderno_erros: {
          data: [
            { topico_id: UUID_A, causa_erro: "chutei", n_erros: 2, ultimo_erro_em: "2026-08-21T20:00:00Z" },
            { topico_id: UUID_B, causa_erro: "errei_a_conta", n_erros: 5, ultimo_erro_em: "2026-08-22T20:00:00Z" },
          ],
          error: null,
        },
        topicos: {
          data: [
            { id: UUID_A, nome: "Geral", materia_id: MATERIA_A },
            { id: UUID_B, nome: "Geral", materia_id: MATERIA_B },
          ],
          error: null,
        },
        materias: {
          data: [
            { id: MATERIA_A, nome: "Matemática" },
            { id: MATERIA_B, nome: "Vendas e Negociação" },
          ],
          error: null,
        },
      },
      { data: [], error: null },
    );

    const resultado = await consultarProgresso(falso.cliente as never, {
      topico: UUID_A,
    });

    // O caderno obedece ao filtro...
    expect(resultado.caderno).toHaveLength(1);
    expect(resultado.caderno[0].topicoId).toBe(UUID_A);
    // ...e mais nada obedece: histórico inteiro, opções inteiras.
    expect(resultado.historico).toHaveLength(2);
    expect(resultado.topicos).toHaveLength(2);
    expect(resultado.materias).toHaveLength(2);
    // Dois tópicos "Geral": é a matéria que os separa na opção do filtro.
    expect(resultado.topicos.map((topico) => topico.materia)).toEqual([
      "Matemática",
      "Vendas e Negociação",
    ]);
  });

  it("filtra por matéria e agrupa o caderno por assunto, com as causas dentro", async () => {
    const falso = clienteFalso(
      {
        dominio_topico: { data: [], error: null },
        caderno_erros: {
          data: [
            { topico_id: UUID_A, causa_erro: "chutei", n_erros: 4, ultimo_erro_em: "2026-09-01T20:00:00Z" },
            { topico_id: UUID_A, causa_erro: "confundi_conceitos", n_erros: 4, ultimo_erro_em: "2026-09-02T20:00:00Z" },
            { topico_id: UUID_A, causa_erro: "nao_sei_dizer", n_erros: 3, ultimo_erro_em: "2026-08-30T20:00:00Z" },
            { topico_id: UUID_B, causa_erro: "chutei", n_erros: 9, ultimo_erro_em: "2026-08-26T20:00:00Z" },
          ],
          error: null,
        },
        topicos: {
          data: [
            { id: UUID_A, nome: "Interpretação", materia_id: MATERIA_A },
            { id: UUID_B, nome: "Probabilidade", materia_id: MATERIA_B },
          ],
          error: null,
        },
        materias: {
          data: [
            { id: MATERIA_A, nome: "Língua Portuguesa" },
            { id: MATERIA_B, nome: "Matemática" },
          ],
          error: null,
        },
      },
      { data: [], error: null },
    );

    const resultado = await consultarProgresso(falso.cliente as never, {
      materia: MATERIA_A,
    });

    expect(resultado.filtros.materiaId).toBe(MATERIA_A);
    expect(resultado.cadernoPorAssunto).toHaveLength(1);
    const assunto = resultado.cadernoPorAssunto[0];
    expect(assunto.topico).toBe("Interpretação");
    expect(assunto.materia).toBe("Língua Portuguesa");
    expect(assunto.nErros).toBe(11);
    // O último erro do assunto é o mais recente entre as causas dele.
    expect(assunto.ultimoErroEm).toBe("2026-09-02T20:00:00Z");
    expect(assunto.causas.map((causa) => causa.nErros)).toEqual([4, 4, 3]);
  });

  it("denuncia o corte quando o caderno passa do teto da consulta", async () => {
    const falso = clienteFalso(
      {
        dominio_topico: { data: [], error: null },
        caderno_erros: {
          data: [
            { topico_id: UUID_A, causa_erro: "chutei", n_erros: 1, ultimo_erro_em: "2026-08-21T20:00:00Z" },
          ],
          error: null,
          count: 900,
        },
        topicos: { data: [{ id: UUID_A, nome: "Interpretação", materia_id: MATERIA_A }], error: null },
        materias: { data: [{ id: MATERIA_A, nome: "Língua Portuguesa" }], error: null },
      },
      { data: [], error: null },
    );

    await expect(consultarProgresso(falso.cliente as never)).resolves.toMatchObject({
      cadernoTruncado: true,
    });
  });

  it("agrupa o histórico por matéria somando respostas, não fazendo média de taxas", async () => {
    const falso = clienteFalso(
      {
        dominio_topico: {
          data: [
            { topico_id: UUID_A, n_respostas: 30, n_acertos: 6, score: 0.2 },
            { topico_id: UUID_B, n_respostas: 2, n_acertos: 2, score: 1 },
          ],
          error: null,
        },
        caderno_erros: { data: [], error: null },
        topicos: {
          data: [
            { id: UUID_A, nome: "Interpretação", materia_id: MATERIA_A },
            { id: UUID_B, nome: "Ortografia", materia_id: MATERIA_A },
          ],
          error: null,
        },
        materias: { data: [{ id: MATERIA_A, nome: "Língua Portuguesa" }], error: null },
      },
      { data: [], error: null },
    );

    const resultado = await consultarProgresso(falso.cliente as never);

    expect(resultado.historicoPorMateria).toHaveLength(1);
    const materia = resultado.historicoPorMateria[0];
    expect(materia.materia).toBe("Língua Portuguesa");
    expect(materia.nTopicos).toBe(2);
    // 8 de 32, e não a média entre 20% e 100%.
    expect(materia.nRespostas).toBe(32);
    expect(materia.nAcertos).toBe(8);
    expect(materia.topicos[0].topico).toBe("Interpretação");
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
      topicos: { data: [{ id: UUID_A, nome: "Tópico", materia_id: MATERIA_A }], error: null },
      materias: { data: [{ id: MATERIA_A, nome: "Matemática" }], error: null },
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
        topicos: { data: [{ id: UUID_A, nome: "Matemática", materia_id: MATERIA_A }], error: null },
        materias: { data: [{ id: MATERIA_A, nome: "Matemática" }], error: null },
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
      percentualAnterior: 1,
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
