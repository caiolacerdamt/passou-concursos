import { describe, expect, it } from "vitest";

import {
  classificarDominio,
  consultarMapaPrioridade,
  consultarRaioX,
  detalhaPorAssunto,
  lastroEmTexto,
  montarMateriasDoEdital,
} from "./index";

import type { LastroRaioX } from "./index";

/**
 * O lastro padrao das fixtures: degrau 1, medido em duas provas do proprio
 * concurso. Quem quiser provar o comportamento de outro degrau sobrescreve.
 */
const LASTRO_TESTE: LastroRaioX = {
  degrau: 1,
  nProvas: 2,
  anos: [2024, 2025],
  baseDoPeso: "itens",
  texto: lastroEmTexto(1, 2, [2024, 2025], "itens"),
};


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
            degrau: 1,
            n_provas: 2,
            anos: [2024, 2025],
            base_do_peso: "itens",
          },
          {
            topico_id: "topico-b",
            peso: 0.41,
            n_questoes: 18,
            tendencia: "estavel",
            amostra_baixa: false,
            degrau: 1,
            n_provas: 2,
            anos: [2024, 2025],
            base_do_peso: "itens",
          },
        ],
        error: null,
      },
      topicos: {
        data: [
          {
            id: "topico-a",
            nome: "Matemática Financeira",
            materia_id: "materia-1",
            materias: { nome: "Matemática Financeira" },
          },
          {
            id: "topico-b",
            nome: "Conhecimentos Bancários",
            materia_id: "materia-2",
            materias: [{ nome: "Conhecimentos Bancários" }],
          },
        ],
        error: null,
      },
      raiox_projecoes_materia: {
        data: [
          {
            materia_id: "materia-2",
            peso: "0.4",
            n_questoes: 18,
            n_topicos: 4,
            tendencia: "estavel",
            amostra_baixa: false,
            degrau: 1,
            n_provas: 2,
            anos: [2024, 2025],
            base_do_peso: "itens",
          },
          {
            materia_id: "materia-1",
            peso: 0.1,
            n_questoes: 3,
            n_topicos: 2,
            tendencia: "subindo",
            amostra_baixa: true,
            degrau: 1,
            n_provas: 2,
            anos: [2024, 2025],
            base_do_peso: "itens",
          },
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
          lastro: LASTRO_TESTE,
        },
        {
          topicoId: "topico-b",
          topico: "Conhecimentos Bancários",
          peso: 0.41,
          nQuestoes: 18,
          tendencia: "estavel",
          amostraBaixa: false,
          lastro: LASTRO_TESTE,
        },
      ],
      // A projeção por matéria é leitura própria, não a soma de `linhas`: as
      // fatias saem do peso agregado (0,4 e 0,1) e fecham 100%.
      materias: [
        {
          materiaId: "materia-2",
          materia: "Conhecimentos Bancários",
          peso: 0.4,
          fatia: 0.8,
          nQuestoes: 18,
          nTopicos: 4,
          tendencia: "estavel",
          amostraBaixa: false,
          lastro: LASTRO_TESTE,
          topicos: [
            {
              topicoId: "topico-b",
              topico: "Conhecimentos Bancários",
              peso: 0.41,
              nQuestoes: 18,
              tendencia: "estavel",
              amostraBaixa: false,
              lastro: LASTRO_TESTE,
              fatia: 0.8,
            },
          ],
        },
        {
          materiaId: "materia-1",
          materia: "Matemática Financeira",
          peso: 0.1,
          fatia: 0.2,
          nQuestoes: 3,
          nTopicos: 2,
          tendencia: "subindo",
          amostraBaixa: true,
          lastro: LASTRO_TESTE,
          topicos: [
            {
              topicoId: "topico-a",
              topico: "Matemática Financeira",
              peso: 0.72,
              nQuestoes: 3,
              tendencia: "subindo",
              amostraBaixa: true,
              lastro: LASTRO_TESTE,
              fatia: 0.2,
            },
          ],
        },
      ],
    });
    expect(falso.chamadas).toEqual([
      "perfil_concurso",
      "raiox_projecoes",
      "topicos",
      "raiox_projecoes_materia",
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
      materias: [],
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
        lastro: LASTRO_TESTE,
      },
    ],
    materias: [],
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

describe("montarMateriasDoEdital", () => {
  const linhas = [
    {
      topicoId: "t-venda",
      topico: "Momento da verdade no atendimento",
      peso: 0.6,
      nQuestoes: 12,
      tendencia: "subindo" as const,
      amostraBaixa: false,
      lastro: LASTRO_TESTE,
    },
    {
      topicoId: "t-binomial",
      topico: "Distribuição binomial",
      peso: 0.2,
      nQuestoes: 4,
      tendencia: "estavel" as const,
      amostraBaixa: true,
      lastro: LASTRO_TESTE,
    },
  ];

  it("usa o nome do edital do concurso, não o da taxonomia canônica", () => {
    const materias = montarMateriasDoEdital(
      [
        { id: "cm-1", nome: "Atendimento Bancário", ordem: 1, topicoIds: ["t-venda"] },
        { id: "cm-2", nome: "Probabilidade e Estatística", ordem: 2, topicoIds: ["t-binomial"] },
      ],
      linhas,
    );

    expect(materias.map((materia) => materia.materia)).toEqual([
      "Atendimento Bancário",
      "Probabilidade e Estatística",
    ]);
    // O mesmo assunto canônico, agrupado por outro edital, muda de pai sem que
    // nada no núcleo mude: as linhas de tópico são as mesmas.
    const outro = montarMateriasDoEdital(
      [
        {
          id: "cm-3",
          nome: "Vendas e Negociação",
          ordem: 1,
          topicoIds: ["t-venda", "t-binomial"],
        },
      ],
      linhas,
    );
    expect(outro).toHaveLength(1);
    expect(outro[0].materia).toBe("Vendas e Negociação");
    expect(outro[0].nTopicos).toBe(2);
    expect(outro[0].peso).toBeCloseTo(0.8, 10);
  });

  it("fecha 100% entre as matérias e reparte a fatia entre os assuntos", () => {
    const materias = montarMateriasDoEdital(
      [
        { id: "cm-1", nome: "Atendimento Bancário", ordem: 1, topicoIds: ["t-venda"] },
        { id: "cm-2", nome: "Probabilidade e Estatística", ordem: 2, topicoIds: ["t-binomial"] },
      ],
      linhas,
    );

    const soma = materias.reduce((total, materia) => total + materia.fatia, 0);
    expect(soma).toBeCloseTo(1, 10);
    expect(materias[0].fatia).toBeCloseTo(0.75, 10);
    expect(materias[0].topicos[0].fatia).toBeCloseTo(0.75, 10);
  });

  it("não inventa matéria do edital que a projeção não sustenta", () => {
    const materias = montarMateriasDoEdital(
      [
        { id: "cm-1", nome: "Atendimento Bancário", ordem: 1, topicoIds: ["t-venda"] },
        { id: "cm-4", nome: "Redação", ordem: 3, topicoIds: ["t-sem-projecao"] },
      ],
      linhas,
    );

    expect(materias).toHaveLength(1);
    expect(materias[0].materia).toBe("Atendimento Bancário");
  });

  it("não afirma uma terceira tendência quando os assuntos discordam", () => {
    const materias = montarMateriasDoEdital(
      [{ id: "cm-1", nome: "Bloco único", ordem: 1, topicoIds: ["t-venda", "t-binomial"] }],
      linhas,
    );

    expect(materias[0].tendencia).toBe("estavel");
    // Um assunto com amostra cheia tira o rótulo de pouca amostra da matéria.
    expect(materias[0].amostraBaixa).toBe(false);
  });
});

describe("lastro (RAIOX-18)", () => {
  it("diz de onde veio a evidência sem adjetivá-la", () => {
    expect(lastroEmTexto(1, 2, [2023, 2025], "itens")).toBe(
      "Peso medido em 2 provas do proprio concurso, de 2023 e 2025.",
    );
    expect(lastroEmTexto(1, 1, [2025], "pontos")).toBe(
      "Peso medido em 1 prova do proprio concurso, de 2025.",
    );
    expect(lastroEmTexto(2, 0, [], "edital")).toContain("declarado pelo edital");
    expect(lastroEmTexto(3, 2, [2021, 2024], "itens")).toContain(
      "mesma banca em outro orgao",
    );
    expect(lastroEmTexto(4, 0, [], "sem_dado")).toBe(
      "Sem prova medida nem peso declarado para esta materia.",
    );
  });

  it("só o degrau 1 abre o detalhe por assunto", () => {
    const lastro = (degrau: 1 | 2 | 3 | 4) => ({
      degrau,
      nProvas: 1,
      anos: [2025],
      baseDoPeso: "itens" as const,
      texto: "",
    });

    expect(detalhaPorAssunto(lastro(1))).toBe(true);
    expect(detalhaPorAssunto(lastro(2))).toBe(false);
    expect(detalhaPorAssunto(lastro(3))).toBe(false);
    expect(detalhaPorAssunto(lastro(4))).toBe(false);
  });

  it("a matéria do edital herda o PIOR degrau dos assuntos que ela junta", () => {
    const comLastro = (
      topicoId: string,
      degrau: 1 | 2 | 3 | 4,
      anos: number[],
    ) => ({
      topicoId,
      topico: topicoId,
      peso: 0.1,
      nQuestoes: 4,
      tendencia: "estavel" as const,
      amostraBaixa: false,
      lastro: {
        degrau,
        nProvas: anos.length,
        anos,
        baseDoPeso: "itens" as const,
        texto: lastroEmTexto(degrau, anos.length, anos, "itens"),
      },
    });

    const [materia] = montarMateriasDoEdital(
      [{ id: "cm-1", nome: "Bloco misto", ordem: 1, topicoIds: ["t-1", "t-2"] }],
      [comLastro("t-1", 1, [2025]), comLastro("t-2", 3, [2021])],
    );

    // Dizer "medido na prova do próprio concurso" quando metade da linha veio
    // de outro órgão daria ao aluno uma garantia que só vale para uma parte.
    expect(materia.lastro.degrau).toBe(3);
    expect(materia.lastro.anos).toEqual([2021, 2025]);
  });
});
