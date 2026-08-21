import { describe, expect, it } from "vitest";

import { consultarRaioX } from "./index";

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
