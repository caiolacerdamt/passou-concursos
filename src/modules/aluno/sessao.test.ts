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
  itensPendentes,
  mapearQuestaoParaTela,
  prepararSessao,
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
});
