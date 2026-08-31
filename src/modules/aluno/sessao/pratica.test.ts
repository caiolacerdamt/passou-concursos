import { describe, expect, it } from "vitest";

import { consultarPratica } from "./pratica";

type Resposta = { data: unknown; error: { message: string } | null; count?: number };

type Chamada = {
  tabela: string;
  filtros: Array<[string, unknown]>;
  /** O teto que a consulta pediu ao banco, quando pediu. */
  limite?: number;
};

/**
 * Um cliente falso que despacha por tabela.
 *
 * `consultarPratica` faz seis consultas em tabelas diferentes; encadear mocks
 * por chamada tornaria o teste dependente da **ordem** delas, que é detalhe de
 * implementação. Aqui cada tabela responde o que foi programado, e o teste
 * afirma sobre o resultado — não sobre a sequência.
 */
function clienteFalso(respostas: Record<string, Resposta>, chamadas: Chamada[] = []) {
  return {
    from(tabela: string) {
      const chamada: Chamada = { tabela, filtros: [] };
      chamadas.push(chamada);
      const construtor = {
        select: () => construtor,
        order: () => construtor,
        limit: (quantos: number) => {
          chamada.limite = quantos;
          return construtor;
        },
        eq: (campo: string, valor: unknown) => {
          chamada.filtros.push([campo, valor]);
          return construtor;
        },
        lte: (campo: string, valor: unknown) => {
          chamada.filtros.push([campo, valor]);
          return construtor;
        },
        in: (campo: string, valor: unknown) => {
          chamada.filtros.push([campo, valor]);
          return construtor;
        },
        not: (campo: string, operador: string, valor: unknown) => {
          chamada.filtros.push([`not.${campo}.${operador}`, valor]);
          return construtor;
        },
        then: (resolve: (valor: unknown) => unknown, reject: (erro: unknown) => unknown) =>
          Promise.resolve(respostas[tabela] ?? { data: [], error: null }).then(resolve, reject),
      };
      return construtor;
    },
  };
}

const SEM_DADOS: Record<string, Resposta> = {
  sessoes: { data: [], error: null },
  revisao_agenda: { data: [], error: null },
  caderno_erros: { data: [], error: null },
  sessao_itens: { data: [], error: null },
  tentativas: { data: [], error: null },
  plano_bloco: { data: [], error: null },
};

describe("consultarPratica — revisões fora do plano", () => {
  it("descarta a revisão cujo tópico o plano de hoje já cobre", async () => {
    const cliente = clienteFalso({
      ...SEM_DADOS,
      revisao_agenda: {
        data: [
          { topico_id: "topico-no-plano", due: "2026-08-29" },
          { topico_id: "topico-de-fora", due: "2026-08-26" },
        ],
        error: null,
      },
    });

    const dados = await consultarPratica(cliente as never, {
      topicosNoPlanoDeHoje: ["topico-no-plano"],
      hoje: "2026-08-31",
    });

    expect(dados.revisoesForaDoPlano).toEqual([{ topicoId: "topico-de-fora", due: "2026-08-26" }]);
  });

  it("filtra no banco pelo dia do produto", async () => {
    const chamadas: Chamada[] = [];
    const cliente = clienteFalso(SEM_DADOS, chamadas);

    await consultarPratica(cliente as never, { hoje: "2026-08-31" });

    const agenda = chamadas.find((chamada) => chamada.tabela === "revisao_agenda");
    expect(agenda?.filtros).toContainEqual(["due", "2026-08-31"]);
  });
});

describe("consultarPratica — teto dos blocos que crescem (AD-117)", () => {
  const UM_TOPICO = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";

  it("pede ao banco um teto de itens, e não a fila inteira", async () => {
    const chamadas: Chamada[] = [];

    await consultarPratica(clienteFalso(SEM_DADOS, chamadas) as never, { hoje: "2026-08-31" });

    // Sem isto as 214 linhas do caderno viajavam do banco para o HTML com
    // quatro desenhadas na tela.
    expect(chamadas.find((c) => c.tabela === "caderno_erros")?.limite).toBe(24);
    expect(chamadas.find((c) => c.tabela === "revisao_agenda")?.limite).toBe(24);
  });

  it("leva o filtro do plano para o banco, junto com o teto", async () => {
    const chamadas: Chamada[] = [];

    await consultarPratica(clienteFalso(SEM_DADOS, chamadas) as never, {
      topicosNoPlanoDeHoje: [UM_TOPICO],
      hoje: "2026-08-31",
    });

    // Filtrar só no JS depois do `limit` faria as 24 linhas trazidas serem
    // todas de tópicos que o plano já cobre: tela vazia tendo o que mostrar.
    expect(chamadas.find((c) => c.tabela === "revisao_agenda")?.filtros).toContainEqual([
      "not.topico_id.in",
      `(${UM_TOPICO})`,
    ]);
  });

  it("não interpola no filtro do banco um id que não tem formato de uuid", async () => {
    const chamadas: Chamada[] = [];

    await consultarPratica(clienteFalso(SEM_DADOS, chamadas) as never, {
      topicosNoPlanoDeHoje: ['x") or true --'],
      hoje: "2026-08-31",
    });

    const filtros = chamadas.find((c) => c.tabela === "revisao_agenda")?.filtros ?? [];
    expect(filtros.some(([campo]) => campo === "not.topico_id.in")).toBe(false);
  });

  it("devolve a contagem do banco, não o tamanho da lista cortada", async () => {
    const dados = await consultarPratica(
      clienteFalso({
        ...SEM_DADOS,
        caderno_erros: {
          data: [
            { topico_id: "t1", causa_erro: "chutei", n_erros: 9, ultimo_erro_em: "2026-08-30" },
          ],
          error: null,
          count: 214,
        },
        revisao_agenda: {
          data: [{ topico_id: "t2", due: "2026-08-20" }],
          error: null,
          count: 61,
        },
      }) as never,
      { hoje: "2026-08-31" },
    );

    expect(dados.caderno).toHaveLength(1);
    expect(dados.totalNoCaderno).toBe(214);
    expect(dados.revisoesForaDoPlano).toHaveLength(1);
    expect(dados.totalDeRevisoes).toBe(61);
  });

  it("cai no tamanho da lista quando o banco não devolveu contagem", async () => {
    const dados = await consultarPratica(
      clienteFalso({
        ...SEM_DADOS,
        // Banco que não devolveu contagem: o total cai no tamanho da lista.
        caderno_erros: {
          data: [
            { topico_id: "t1", causa_erro: "chutei", n_erros: 2, ultimo_erro_em: "2026-08-30" },
            { topico_id: "t2", causa_erro: "chutei", n_erros: 1, ultimo_erro_em: "2026-08-29" },
          ],
          error: null,
        },
      }) as never,
      { hoje: "2026-08-31" },
    );

    expect(dados.totalNoCaderno).toBe(2);
  });
});

describe("consultarPratica — sessão aberta", () => {
  const abertaComItens: Record<string, Resposta> = {
    ...SEM_DADOS,
    sessoes: {
      data: [
        {
          id: "sessao-aberta",
          contexto: "plano",
          plano_bloco_id: "bloco-1",
          refacao_chave: null,
          iniciada_em: "2026-08-31T12:00:00Z",
          encerrada_em: null,
        },
      ],
      error: null,
    },
    sessao_itens: {
      data: [
        { sessao_id: "sessao-aberta", questao_id: "q1", ordem: 1, respondido_em: "2026-08-31T12:01:00Z" },
        { sessao_id: "sessao-aberta", questao_id: "q2", ordem: 2, respondido_em: "2026-08-31T12:02:00Z" },
        { sessao_id: "sessao-aberta", questao_id: "q3", ordem: 3, respondido_em: null },
      ],
      error: null,
    },
    tentativas: {
      data: [
        { sessao_id: "sessao-aberta", questao_id: "q1", correta: true },
        { sessao_id: "sessao-aberta", questao_id: "q2", correta: false },
      ],
      error: null,
    },
    plano_bloco: { data: [{ id: "bloco-1", topico_id: "topico-do-bloco" }], error: null },
  };

  it("devolve a trilha na ordem dos itens e o tópico vindo do bloco", async () => {
    const dados = await consultarPratica(clienteFalso(abertaComItens) as never, {
      hoje: "2026-08-31",
    });

    expect(dados.sessaoAberta).toMatchObject({
      id: "sessao-aberta",
      topicoId: "topico-do-bloco",
      nItens: 3,
      nRespondidas: 2,
      resultados: ["acerto", "erro", "pendente"],
    });
  });

  it("lê o tópico da chave da refação quando a sessão não veio de bloco", async () => {
    const cliente = clienteFalso({
      ...abertaComItens,
      sessoes: {
        data: [
          {
            id: "sessao-aberta",
            contexto: "treino",
            plano_bloco_id: null,
            refacao_chave: "topico-da-refacao|errei_a_conta",
            iniciada_em: "2026-08-31T12:00:00Z",
            encerrada_em: null,
          },
        ],
        error: null,
      },
    });

    const dados = await consultarPratica(cliente as never, { hoje: "2026-08-31" });

    expect(dados.sessaoAberta?.topicoId).toBe("topico-da-refacao");
  });

  it("não oferece retomar uma sessão aberta que ficou sem item", async () => {
    const cliente = clienteFalso({
      ...abertaComItens,
      sessao_itens: { data: [], error: null },
    });

    const dados = await consultarPratica(cliente as never, { hoje: "2026-08-31" });

    expect(dados.sessaoAberta).toBeNull();
  });
});

describe("consultarPratica — histórico", () => {
  it("conta questões distintas, não tentativas — correção é linha nova", async () => {
    const cliente = clienteFalso({
      ...SEM_DADOS,
      sessoes: {
        data: [
          {
            id: "sessao-fechada",
            contexto: "plano",
            plano_bloco_id: null,
            refacao_chave: null,
            iniciada_em: "2026-08-30T12:00:00Z",
            encerrada_em: "2026-08-30T12:40:00Z",
          },
        ],
        error: null,
      },
      tentativas: {
        data: [
          { sessao_id: "sessao-fechada", questao_id: "q1", correta: false },
          { sessao_id: "sessao-fechada", questao_id: "q1", correta: true },
          { sessao_id: "sessao-fechada", questao_id: "q2", correta: true },
        ],
        error: null,
      },
    });

    const dados = await consultarPratica(cliente as never, { hoje: "2026-08-31" });

    expect(dados.historico).toEqual([
      {
        id: "sessao-fechada",
        contexto: "plano",
        topicoId: null,
        encerradaEm: "2026-08-30T12:40:00Z",
        nQuestoes: 2,
        nAcertos: 1,
      },
    ]);
  });

  it("deixa de fora a sessão encerrada que não teve nenhuma resposta", async () => {
    const cliente = clienteFalso({
      ...SEM_DADOS,
      sessoes: {
        data: [
          {
            id: "sessao-vazia",
            contexto: "plano",
            plano_bloco_id: null,
            refacao_chave: null,
            iniciada_em: "2026-08-30T12:00:00Z",
            encerrada_em: "2026-08-30T12:00:30Z",
          },
        ],
        error: null,
      },
    });

    const dados = await consultarPratica(cliente as never, { hoje: "2026-08-31" });

    expect(dados.historico).toEqual([]);
  });
});

describe("consultarPratica — caderno", () => {
  it("descarta a linha com causa fora do domínio sem derrubar a leitura", async () => {
    const cliente = clienteFalso({
      ...SEM_DADOS,
      caderno_erros: {
        data: [
          { topico_id: "t1", causa_erro: "errei_a_conta", n_erros: 4, ultimo_erro_em: "2026-08-30" },
          { topico_id: "t2", causa_erro: "motivo_inventado", n_erros: 9, ultimo_erro_em: "2026-08-29" },
        ],
        error: null,
      },
    });

    const dados = await consultarPratica(cliente as never, { hoje: "2026-08-31" });

    expect(dados.caderno).toEqual([
      { topicoId: "t1", causa: "errei_a_conta", nErros: 4, ultimoErroEm: "2026-08-30" },
    ]);
  });
});

describe("consultarPratica — falhas", () => {
  it("nomeia a tabela que caiu sem expor o detalhe do banco à tela", async () => {
    const cliente = clienteFalso({
      ...SEM_DADOS,
      caderno_erros: { data: null, error: { message: "conexão perdida" } },
    });

    await expect(consultarPratica(cliente as never, { hoje: "2026-08-31" })).rejects.toThrow(
      "falha ao ler caderno de erros: conexão perdida",
    );
  });
});
