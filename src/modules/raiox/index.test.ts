import { describe, expect, it } from "vitest";

import {
  classificarDominio,
  consultarMapaPrioridade,
  consultarRaioX,
} from "./index";

type Resposta = { data: unknown; error: { message: string } | null };

function cadeia(resposta: Resposta) {
  const api = {
    select: () => api,
    eq: () => api,
    in: () => api,
    order: () => api,
    maybeSingle: async () => resposta,
    then: (
      resolve: (valor: Resposta) => unknown,
      reject?: (erro: unknown) => unknown,
    ) => Promise.resolve(resposta).then(resolve, reject),
  };
  return api;
}

function clienteFalso(respostas: Record<string, Resposta>) {
  const chamadas: string[] = [];
  return {
    chamadas,
    cliente: {
      from(tabela: string) {
        chamadas.push(tabela);
        return cadeia(respostas[tabela]);
      },
    },
  };
}

describe("consultarRaioX", () => {
  it("devolve perfil e linhas já ordenadas pela projeção", async () => {
    const falso = clienteFalso({
      perfil_concurso: {
        data: {
          id: "perfil-1",
          orgao: "Banco do Brasil",
          banca: "indefinida",
          data_prova: null,
          formato: "multipla_escolha",
        },
        error: null,
      },
      raiox_projecoes: {
        data: [
          {
            topico_id: "topico-a",
            peso: "0.72",
            n_questoes: 3,
            tendencia: "subindo",
            amostra_baixa: true,
          },
          {
            topico_id: "topico-b",
            peso: 0.41,
            n_questoes: 18,
            tendencia: "estavel",
            amostra_baixa: false,
          },
        ],
        error: null,
      },
      topicos: {
        data: [
          { id: "topico-a", nome: "Matemática Financeira" },
          { id: "topico-b", nome: "Conhecimentos Bancários" },
        ],
        error: null,
      },
    });

    await expect(consultarRaioX(falso.cliente as never)).resolves.toEqual({
      perfil: {
        orgao: "Banco do Brasil",
        banca: "indefinida",
        dataProva: null,
        formato: "multipla_escolha",
        programaEdital: [],
      },
      linhas: [
        {
          topicoId: "topico-a",
          topico: "Matemática Financeira",
          peso: 0.72,
          nQuestoes: 3,
          tendencia: "subindo",
          amostraBaixa: true,
        },
        {
          topicoId: "topico-b",
          topico: "Conhecimentos Bancários",
          peso: 0.41,
          nQuestoes: 18,
          tendencia: "estavel",
          amostraBaixa: false,
        },
      ],
    });
    expect(falso.chamadas).toEqual([
      "perfil_concurso",
      "raiox_projecoes",
      "topicos",
    ]);
  });

  it("retorna vazio quando não há perfil ativo e não lê a projeção", async () => {
    const falso = clienteFalso({
      perfil_concurso: { data: null, error: null },
      raiox_projecoes: { data: [], error: null },
      topicos: { data: [], error: null },
    });

    await expect(consultarRaioX(falso.cliente as never)).resolves.toEqual({
      perfil: null,
      linhas: [],
    });
    expect(falso.chamadas).toEqual(["perfil_concurso"]);
  });

  it("propaga falha da leitura com recurso nomeado", async () => {
    const falso = clienteFalso({
      perfil_concurso: {
        data: null,
        error: { message: "indisponível" },
      },
      raiox_projecoes: { data: [], error: null },
      topicos: { data: [], error: null },
    });

    await expect(consultarRaioX(falso.cliente as never)).rejects.toThrow(
      "falha ao ler perfil_concurso: indisponível",
    );
  });
});

describe("classificarDominio", () => {
  it("mantém as cinco faixas e as fronteiras do score", () => {
    expect(classificarDominio(null, 0)).toBe("nao_iniciado");
    expect(classificarDominio(0, 1)).toBe("fraco");
    expect(classificarDominio(0.5, 1)).toBe("fraco");
    expect(classificarDominio(0.5001, 1)).toBe("em_desenvolvimento");
    expect(classificarDominio(0.7, 1)).toBe("em_desenvolvimento");
    expect(classificarDominio(0.7001, 1)).toBe("forte");
    expect(classificarDominio(0.9, 1)).toBe("dominado");
    expect(classificarDominio(1, 1)).toBe("dominado");
  });

  it("não chama uma linha com zero respostas de domínio observado", () => {
    expect(classificarDominio(1, 0)).toBe("nao_iniciado");
  });
});

describe("consultarMapaPrioridade", () => {
  const topicoA = "11111111-1111-4111-8111-111111111111";
  const topicoB = "22222222-2222-4222-8222-222222222222";

  function clienteMapa(respostas: Record<string, Resposta>) {
    const chamadas: string[] = [];
    const cliente = {
      chamadas,
      from(tabela: string) {
        chamadas.push(tabela);
        const resposta = respostas[tabela];
        const api = {
          select: () => api,
          in: () => api,
          then: (
            resolve: (valor: Resposta) => unknown,
            reject?: (erro: unknown) => unknown,
          ) => Promise.resolve(resposta).then(resolve, reject),
        };
        return api;
      },
    };
    return { chamadas, cliente };
  }

  const dados = {
    perfil: {
      orgao: "Banco do Brasil",
      banca: "indefinida",
      dataProva: null,
      formato: "multipla_escolha",
      programaEdital: [topicoA, topicoB],
    },
    linhas: [
      {
        topicoId: topicoA,
        topico: "Matemática Financeira",
        peso: 0.72,
        nQuestoes: 18,
        tendencia: "estavel" as const,
        amostraBaixa: false,
      },
    ],
  };

  it("cruza quatro sinais, preserva tópico sem projeção e ordena de forma estável", async () => {
    const falso = clienteMapa({
      dominio_topico: {
        data: [{ topico_id: topicoA, n_respostas: 10, score: 0.4 }],
        error: null,
      },
      revisao_agenda: {
        data: [{ topico_id: topicoA, due: "2026-08-24" }],
        error: null,
      },
      topicos: {
        data: [
          { id: topicoA, nome: "Matemática Financeira" },
          { id: topicoB, nome: "Conhecimentos Bancários" },
        ],
        error: null,
      },
    });

    await expect(
      consultarMapaPrioridade(falso.cliente as never, dados, "2026-08-24"),
    ).resolves.toEqual({
      dataReferencia: "2026-08-24",
      linhas: [
        {
          topicoId: topicoA,
          topico: "Matemática Financeira",
          peso: 0.72,
          score: 0.4,
          nRespostas: 10,
          dominio: "fraco",
          cobertura: "coberto",
          revisao: "devida",
          due: "2026-08-24",
          prioridade: 0.432,
          nivel: "maior_atencao",
          motivo:
            "A revisão está devida; veja este tópico antes de deixar o conteúdo se afastar.",
          ordem: 1,
        },
        {
          topicoId: topicoB,
          topico: "Conhecimentos Bancários",
          peso: null,
          score: null,
          nRespostas: 0,
          dominio: "nao_iniciado",
          cobertura: "nao_iniciado",
          revisao: "sem_agenda",
          due: null,
          prioridade: null,
          nivel: "sem_projecao",
          motivo:
            "A frequência da banca ainda não tem projeção para este tópico.",
          ordem: 2,
        },
      ],
    });
    expect(falso.chamadas).toEqual([
      "dominio_topico",
      "revisao_agenda",
      "topicos",
    ]);
  });

  it("nomeia a projeção pessoal que falhou", async () => {
    const falso = clienteMapa({
      dominio_topico: { data: null, error: { message: "indisponível" } },
      revisao_agenda: { data: [], error: null },
      topicos: { data: [], error: null },
    });

    await expect(
      consultarMapaPrioridade(falso.cliente as never, dados, "2026-08-24"),
    ).rejects.toThrow("falha ao ler dominio_topico: indisponível");
  });
});
