import { describe, expect, it } from "vitest";

import { consultarPratica } from "./pratica";

type Resposta = { data: unknown; error: { message: string } | null };

type Chamada = { tabela: string; filtros: Array<[string, unknown]> };

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
        limit: () => construtor,
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
