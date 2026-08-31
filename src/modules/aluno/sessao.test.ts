import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencias = vi.hoisted(() => ({
  getParams: vi.fn(),
  getParam: vi.fn(),
  servico: vi.fn(),
}));

vi.mock("@/modules/config", () => ({
  getParams: dependencias.getParams,
  getParam: dependencias.getParam,
}));
vi.mock("@/lib/db/servidor", () => ({
  clienteDeServico: dependencias.servico,
}));

import {
  SessaoRecusada,
  consultarSessao,
  itensPendentes,
  mapearQuestaoParaTela,
  prepararSessao,
  prepararSessaoDeRefacao,
  selecionarQuestoesDisponiveis,
} from "./sessao";

function linha(sobrescreve: Partial<Record<string, unknown>> = {}) {
  return {
    id: "questao-1",
    questao_versao: 1,
    origem: "real" as const,
    topico_id: "topico-1",
    tipo_questao: "multipla_escolha" as const,
    enunciado: "Qual alternativa está correta?",
    alternativas: [
      { letra: "A", texto: "Primeira alternativa" },
      { letra: "B", texto: "Segunda alternativa" },
    ],
    imagens: [],
    fonte_citacao: {
      banca: "CESGRANRIO",
      ano: 2024,
      orgao: "Banco do Brasil",
      cargo: "Escriturário",
      numero: 7,
    },
    status: "publicada",
    vigente: true,
    anulada: false,
    ...sobrescreve,
  };
}

function consulta(resposta: { data: unknown; error: null | { message: string; code?: string } }) {
  const builder: Record<string, unknown> = {};
  for (const metodo of ["select", "eq", "is", "order", "limit", "not", "gte", "in"]) {
    builder[metodo] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn(async () => resposta);
  builder.single = vi.fn(async () => resposta);
  builder.then = (resolve: (valor: unknown) => unknown, reject: (erro: unknown) => unknown) =>
    Promise.resolve(resposta).then(resolve, reject);
  return builder;
}

function clienteParaPreparar({
  bloco = {
    id: "bloco-1",
    plano_dia_id: "plano-1",
    tipo: "treinar",
    topico_id: "topico-1",
    n_questoes: 10,
  },
  abertas = null,
  questoes = [linha()],
  inserir = { data: { id: "sessao-1" }, error: null },
  inserirItens = { data: null, error: null },
}: {
  bloco?: Record<string, unknown> | null;
  abertas?: Record<string, unknown> | null;
  questoes?: unknown[];
  inserir?: { data: unknown; error: null | { message: string; code?: string } };
  inserirItens?: { data: unknown; error: null | { message: string; code?: string } };
} = {}) {
  const consultas: Record<string, ReturnType<typeof consulta>[]> = {};
  const cliente = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "aluno-1" } }, error: null }) },
    from: vi.fn((tabela: string) => {
      const jaConsultadas = consultas[tabela] ?? [];
      const resposta =
        tabela === "sessoes" && jaConsultadas.length === 0
          ? { data: abertas, error: null }
          : tabela === "plano_bloco"
            ? { data: bloco, error: null }
            : tabela === "tentativas"
              ? { data: [], error: null }
              : tabela === "questoes"
                ? { data: questoes, error: null }
                : { data: null, error: null };
      const builder = consulta(resposta);
      consultas[tabela] ??= [];
      consultas[tabela].push(builder);

      builder.insert = vi.fn(() => {
        const insercao = tabela === "sessoes" ? inserir : inserirItens;
        return consulta(insercao);
      });
      return builder;
    }),
  };
  return { cliente, consultas };
}

function clienteParaRefacao({
  aberta = null,
  abertaDepoisDoConflito = aberta,
  tentativas = [],
  causas = [],
  questoes = [],
  itens = [],
  itensDepoisDaCorrida = itens,
  inserir = { data: { id: "sessao-refacao" }, error: null },
  inserirItens = { data: null, error: null },
}: {
  aberta?: Record<string, unknown> | null;
  abertaDepoisDoConflito?: Record<string, unknown> | null;
  tentativas?: unknown[];
  causas?: unknown[];
  questoes?: unknown[];
  itens?: unknown[];
  itensDepoisDaCorrida?: unknown[];
  inserir?: { data: unknown; error: null | { message: string; code?: string } };
  inserirItens?: { data: unknown; error: null | { message: string; code?: string } };
} = {}) {
  const sessoes = [0];
  const consultasDeItens = [0];
  const insercoes: unknown[] = [];
  const cliente = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "aluno-1" } }, error: null }) },
    from: vi.fn((tabela: string) => {
      let resposta: { data: unknown; error: null | { message: string; code?: string } };
      if (tabela === "sessoes") {
        resposta =
          sessoes[0] === 0
            ? { data: aberta, error: null }
            : sessoes[0] === 1
              ? inserir
              : { data: abertaDepoisDoConflito, error: null };
        sessoes[0] += 1;
      } else if (tabela === "tentativas") {
        resposta = { data: tentativas, error: null };
      } else if (tabela === "tentativa_causa_simulado") {
        resposta = { data: causas, error: null };
      } else if (tabela === "questoes") {
        resposta = { data: questoes, error: null };
      } else if (tabela === "sessao_itens") {
        resposta = {
          data: consultasDeItens[0]++ === 0 ? itens : itensDepoisDaCorrida,
          error: null,
        };
      } else {
        resposta = inserirItens;
      }
      const builder = consulta(resposta);
      builder.insert = vi.fn((linhas: unknown) => {
        insercoes.push(linhas);
        if (tabela === "sessao_itens") consultasDeItens[0] += 1;
        return consulta(tabela === "sessoes" ? inserir : inserirItens);
      });
      return builder;
    }),
  };
  return { cliente, insercoes };
}

function clienteParaConsultar({
  sessao,
  itens,
  tentativas,
  questoesPublicas,
  questoesRespondidas,
}: {
  sessao: Record<string, unknown>;
  itens: unknown[];
  tentativas: unknown[];
  questoesPublicas: unknown[];
  questoesRespondidas: unknown[];
}) {
  const selecoesDeQuestoes: string[] = [];
  const from = vi.fn((tabela: string) => {
    const builder: Record<string, unknown> = {};
    let campos = "";
    builder.select = vi.fn((valor: string) => {
      campos = valor;
      if (tabela === "questoes") selecoesDeQuestoes.push(valor);
      return builder;
    });
    for (const metodo of ["eq", "is", "order", "in", "limit"]) {
      builder[metodo] = vi.fn(() => builder);
    }
    builder.maybeSingle = vi.fn(async () => ({ data: sessao, error: null }));
    builder.then = (resolve: (valor: unknown) => unknown, reject: (erro: unknown) => unknown) => {
      const data =
        tabela === "sessao_itens"
          ? itens
          : tabela === "tentativas"
            ? tentativas
            : tabela === "questoes"
              ? campos.includes("resposta_correta")
                ? questoesRespondidas
                : questoesPublicas
              : [];
      return Promise.resolve({ data, error: null }).then(resolve, reject);
    };
    return builder;
  });

  return {
    cliente: { from },
    from,
    selecoesDeQuestoes,
  };
}

describe("sessão de estudo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencias.getParams.mockResolvedValue([10, 30]);
    dependencias.getParam.mockResolvedValue("questoes");
  });

  it("seleciona só questões publicadas, vigentes, não anuladas e do tópico", () => {
    const disponiveis = selecionarQuestoesDisponiveis(
      [
        linha({ id: "publicada" }),
        linha({ id: "rascunho", status: "rascunho" }),
        linha({ id: "antiga", vigente: false }),
        linha({ id: "anulada", anulada: true }),
        linha({ id: "outro-topico", topico_id: "topico-2" }),
        linha({ id: "recente" }),
      ],
      {
        tipo: "treinar",
        topicoId: "topico-1",
        quantidade: 10,
        idsRecentes: ["recente"],
      },
    );

    expect(disponiveis.map((questao) => questao.id)).toEqual(["publicada"]);
  });

  it("retoma visualmente apenas os itens ainda sem resposta", () => {
    expect(
      itensPendentes([
        { respondido_em: "2026-08-22T20:01:00Z" },
        { respondido_em: null },
        { respondido_em: null },
      ]),
    ).toEqual([1, 2]);
  });

  it("devolve contagem completa e mantém o gabarito somente nos itens respondidos", async () => {
    const { cliente, selecoesDeQuestoes } = clienteParaConsultar({
      sessao: {
        id: "sessao-1",
        plano_bloco_id: "bloco-1",
        contexto: "treino",
        encerrada_em: null,
        refacao_chave: null,
      },
      itens: [
        {
          id: "item-1",
          sessao_id: "sessao-1",
          questao_id: "questao-1",
          questao_versao: 1,
          ordem: 1,
          respondido_em: null,
        },
        {
          id: "item-2",
          sessao_id: "sessao-1",
          questao_id: "questao-2",
          questao_versao: 2,
          ordem: 2,
          respondido_em: "2026-08-24T12:00:00Z",
        },
      ],
      tentativas: [
        {
          questao_id: "questao-2",
          questao_versao: 2,
          ordem_na_sessao: 2,
          resposta_dada: "A",
          correta: false,
        },
      ],
      questoesPublicas: [linha({ id: "questao-1", questao_versao: 1 })],
      questoesRespondidas: [
        linha({
          id: "questao-2",
          questao_versao: 2,
          resposta_correta: "B",
          gabarito_versao: "gabarito-2",
        }),
      ],
    });

    const resultado = await consultarSessao(cliente as never, "sessao-1");

    expect(resultado).toMatchObject({
      totalItens: 2,
      itensRespondidos: 1,
      itens: [
        { somenteLeitura: false, respondidoEm: null },
        {
          somenteLeitura: true,
          respostaDada: "A",
          correta: false,
          questao: { respostaCorreta: "B" },
        },
      ],
    });
    expect(resultado?.itens[0]).not.toHaveProperty("respostaCorreta");
    expect(selecoesDeQuestoes).toHaveLength(2);
    expect(selecoesDeQuestoes.find((select) => !select.includes("resposta_correta"))).toBe(
      "id, questao_versao, origem, topico_id, tipo_questao, enunciado, alternativas, imagens, fonte_citacao, status, vigente, anulada",
    );
    expect(selecoesDeQuestoes.find((select) => select.includes("resposta_correta"))).toContain(
      "resposta_correta",
    );
  });

  it("mapeia imagem para URL assinada sem levar o caminho nem o gabarito", async () => {
    const questao = await mapearQuestaoParaTela(
      linha({
        imagens: [
          {
            storage_path: "questoes/prova-1/q7-0.jpg",
            posicao: "enunciado",
            alt_text: "Gráfico da questão 7",
          },
        ],
        resposta_correta: "B",
      }),
      async (storagePath) => `https://signed.test/${storagePath}`,
    );

    expect(questao.imagens).toEqual([
      {
        posicao: "enunciado",
        altText: "Gráfico da questão 7",
        url: "https://signed.test/questoes/prova-1/q7-0.jpg",
      },
    ]);
    expect(questao).not.toHaveProperty("respostaCorreta");
    expect(questao.imagens[0]).not.toHaveProperty("storagePath");
  });

  it("cria uma sessão com questões do acervo e seus itens", async () => {
    const { cliente } = clienteParaPreparar();

    await expect(prepararSessao(cliente as never, "bloco-1")).resolves.toEqual({
      id: "sessao-1",
      retomada: false,
    });
    expect(cliente.from).toHaveBeenCalledWith("sessao_itens");
  });

  it("usa a quantidade gravada no bloco, inclusive quando é menor que o padrão", async () => {
    const { cliente, consultas } = clienteParaPreparar({
      bloco: {
        id: "bloco-1",
        plano_dia_id: "plano-1",
        tipo: "treinar",
        topico_id: "topico-1",
        n_questoes: 3,
      },
    });

    await prepararSessao(cliente as never, "bloco-1");

    expect(consultas.questoes[0].limit).toHaveBeenCalledWith(3);
  });

  it("retoma sessão aberta e não busca nem insere outro conjunto", async () => {
    const { cliente } = clienteParaPreparar({ abertas: { id: "sessao-aberta", plano_bloco_id: "bloco-1", contexto: "treino", encerrada_em: null } });

    await expect(prepararSessao(cliente as never, "bloco-1")).resolves.toEqual({
      id: "sessao-aberta",
      retomada: true,
    });
    expect(cliente.from).toHaveBeenCalledTimes(1);
  });

  it("devolve estado nomeado quando o bloco ficou sem acervo", async () => {
    const { cliente } = clienteParaPreparar({ questoes: [] });

    await expect(prepararSessao(cliente as never, "bloco-1")).rejects.toMatchObject({
      constructor: SessaoRecusada,
      motivo: "acervo_vazio",
    });
  });

  it("monta refação somente com erros do titular e versões publicadas", async () => {
    const { cliente, insercoes } = clienteParaRefacao({
      tentativas: [
        {
          id: "tentativa-1",
          questao_id: "questao-1",
          questao_versao: 2,
          topico_id: "11111111-1111-4111-8111-111111111111",
          causa_erro: "errei_a_conta",
          respondida_em: "2026-08-23T12:00:00Z",
        },
        {
          id: "tentativa-2",
          questao_id: "questao-2",
          questao_versao: 1,
          topico_id: "11111111-1111-4111-8111-111111111111",
          causa_erro: "errei_a_conta",
          respondida_em: "2026-08-22T12:00:00Z",
        },
      ],
      questoes: [
        linha({
          id: "questao-1",
          questao_versao: 2,
          topico_id: "11111111-1111-4111-8111-111111111111",
          status: "publicada",
          vigente: true,
          anulada: false,
        }),
        linha({
          id: "questao-2",
          questao_versao: 1,
          topico_id: "11111111-1111-4111-8111-111111111111",
          status: "rascunho",
          vigente: true,
          anulada: false,
        }),
      ],
    });

    await expect(
      prepararSessaoDeRefacao(cliente as never, {
        topicoId: "11111111-1111-4111-8111-111111111111",
        causa: "errei_a_conta",
      }),
    ).resolves.toEqual({ id: "sessao-refacao", retomada: false });
    expect(insercoes).toHaveLength(2);
    expect(insercoes[1]).toEqual([
      {
        sessao_id: "sessao-refacao",
        questao_id: "questao-1",
        questao_versao: 2,
        ordem: 1,
      },
    ]);
  });

  it("limita a refação ao teto de questões do bloco e preserva a ordem recente", async () => {
    dependencias.getParams.mockResolvedValue([2, 30]);
    const topicoId = "11111111-1111-4111-8111-111111111111";
    const tentativas = ["questao-1", "questao-2", "questao-3"].map((id, indice) => ({
      id: `tentativa-${indice + 1}`,
      questao_id: id,
      questao_versao: 1,
      topico_id: topicoId,
      causa_erro: "errei_a_conta",
      respondida_em: `2026-08-${23 - indice}T12:00:00Z`,
    }));
    const { cliente, insercoes } = clienteParaRefacao({
      tentativas,
      questoes: [
        linha({ id: "questao-1", topico_id: topicoId }),
        linha({ id: "questao-2", topico_id: topicoId }),
        linha({ id: "questao-3", topico_id: topicoId }),
      ],
    });

    await prepararSessaoDeRefacao(cliente as never, {
      topicoId,
      causa: "errei_a_conta",
    });

    expect(insercoes[1]).toHaveLength(2);
    expect(insercoes[1]).toEqual([
      expect.objectContaining({ questao_id: "questao-1", ordem: 1 }),
      expect.objectContaining({ questao_id: "questao-2", ordem: 2 }),
    ]);
  });

  it("usa causa do simulado em tabela vizinha e nunca aceita identidade do cliente", async () => {
    const { cliente } = clienteParaRefacao({
      tentativas: [
        {
          id: "tentativa-simulado",
          questao_id: "questao-1",
          questao_versao: 1,
          topico_id: "11111111-1111-4111-8111-111111111111",
          causa_erro: null,
          respondida_em: "2026-08-23T12:00:00Z",
        },
      ],
      causas: [{ tentativa_id: "tentativa-simulado", causa_erro: "faltou_tempo" }],
      questoes: [linha({ topico_id: "11111111-1111-4111-8111-111111111111" })],
    });

    await expect(
      prepararSessaoDeRefacao(cliente as never, {
        topicoId: "11111111-1111-4111-8111-111111111111",
        causa: "faltou_tempo",
      }),
    ).resolves.toMatchObject({ id: "sessao-refacao" });
    expect(cliente.auth.getUser).toHaveBeenCalledTimes(1);
  });

  it("retoma a sessão de refação aberta e não refaz a seleção", async () => {
    const { cliente } = clienteParaRefacao({
      aberta: {
        id: "sessao-aberta",
        plano_bloco_id: null,
        contexto: "treino",
        encerrada_em: null,
        refacao_chave: "11111111-1111-4111-8111-111111111111|errei_a_conta",
      },
      itens: [
        {
          id: "item-refacao",
          sessao_id: "sessao-aberta",
          questao_id: "questao-1",
          questao_versao: 1,
          ordem: 1,
        },
      ],
    });

    await expect(
      prepararSessaoDeRefacao(cliente as never, {
        topicoId: "11111111-1111-4111-8111-111111111111",
        causa: "errei_a_conta",
      }),
    ).resolves.toEqual({ id: "sessao-aberta", retomada: true });
    expect(cliente.from).toHaveBeenCalledTimes(2);
  });

  it("repara sessão aberta sem itens e retorna retomada", async () => {
    const topicoId = "11111111-1111-4111-8111-111111111111";
    const { cliente, insercoes } = clienteParaRefacao({
      aberta: {
        id: "sessao-vazia",
        plano_bloco_id: null,
        contexto: "treino",
        encerrada_em: null,
        refacao_chave: `${topicoId}|errei_a_conta`,
      },
      abertaDepoisDoConflito: {
        id: "sessao-vazia",
        plano_bloco_id: null,
        contexto: "treino",
        encerrada_em: null,
        refacao_chave: `${topicoId}|errei_a_conta`,
      },
      tentativas: [
        {
          id: "tentativa-1",
          questao_id: "questao-1",
          questao_versao: 1,
          topico_id: topicoId,
          causa_erro: "errei_a_conta",
          respondida_em: "2026-08-23T12:00:00Z",
        },
      ],
      questoes: [linha({ id: "questao-1", topico_id: topicoId })],
      itens: [],
      itensDepoisDaCorrida: [],
      inserir: { data: null, error: { message: "colisão", code: "23505" } },
    });

    await expect(
      prepararSessaoDeRefacao(cliente as never, {
        topicoId,
        causa: "errei_a_conta",
      }),
    ).resolves.toEqual({ id: "sessao-vazia", retomada: true });
    expect(insercoes[1]).toEqual([
      {
        sessao_id: "sessao-vazia",
        questao_id: "questao-1",
        questao_versao: 1,
        ordem: 1,
      },
    ]);
  });

  it("no caminho 23505 preenche a sessão vencedora que ainda estava sem itens", async () => {
    const questao = linha({
      id: "questao-1",
      topico_id: "11111111-1111-4111-8111-111111111111",
    });
    const item = {
      id: "item-refacao",
      sessao_id: "sessao-vencedora",
      questao_id: "questao-1",
      questao_versao: 1,
      ordem: 1,
    };
    const { cliente, insercoes } = clienteParaRefacao({
      aberta: null,
      abertaDepoisDoConflito: {
        id: "sessao-vencedora",
        plano_bloco_id: null,
        contexto: "treino",
        encerrada_em: null,
        refacao_chave: "11111111-1111-4111-8111-111111111111|errei_a_conta",
      },
      tentativas: [
        {
          id: "tentativa-1",
          questao_id: "questao-1",
          questao_versao: 1,
          topico_id: "11111111-1111-4111-8111-111111111111",
          causa_erro: "errei_a_conta",
          respondida_em: "2026-08-23T12:00:00Z",
        },
      ],
      questoes: [questao],
      itens: [],
      itensDepoisDaCorrida: [item],
      inserir: { data: null, error: { message: "colisão", code: "23505" } },
      inserirItens: { data: null, error: { message: "colisão de item", code: "23505" } },
    });

    await expect(
      prepararSessaoDeRefacao(cliente as never, {
        topicoId: "11111111-1111-4111-8111-111111111111",
        causa: "errei_a_conta",
      }),
    ).resolves.toEqual({ id: "sessao-vencedora", retomada: true });
    expect(insercoes).toHaveLength(2);
    expect(insercoes[1]).toEqual([
      {
        sessao_id: "sessao-vencedora",
        questao_id: "questao-1",
        questao_versao: 1,
        ordem: 1,
      },
    ]);
  });

  it("recusa filtro de refação inválido antes de consultar o banco", async () => {
    const { cliente } = clienteParaRefacao();
    await expect(
      prepararSessaoDeRefacao(cliente as never, {
        topicoId: "topico-alheio",
        causa: "errei_a_conta",
      }),
    ).rejects.toMatchObject({ motivo: "refacao_indisponivel" });
    expect(cliente.auth.getUser).not.toHaveBeenCalled();
  });
});
