import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencias = vi.hoisted(() => ({
  from: vi.fn(),
  configuracoes: vi.fn(),
}));

vi.mock("./fronteira", () => ({
  comOperador: async (
    _operacao: string,
    acao: (contexto: { operador: { id: string }; cliente: { from: typeof dependencias.from } }) => unknown,
  ) => acao({ operador: { id: "operador-1" }, cliente: { from: dependencias.from } }),
}));
vi.mock("@/modules/config/escrita", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/config/escrita")>()),
  lerConfiguracoesAdministrativas: dependencias.configuracoes,
}));

const {
  consultarCandidatosDeTopico,
  consultarConfiguracoes,
  consultarFilaRevisao,
  consultarRecursosEstudo,
  consultarTaxonomia,
} = await import("./consultas");

function consulta(data: unknown, error: unknown = null) {
  const cadeia = {
    select: vi.fn(() => cadeia),
    eq: vi.fn(() => cadeia),
    order: vi.fn(() => cadeia),
    then: (resolve: (valor: unknown) => unknown, reject: (erro: unknown) => unknown) =>
      Promise.resolve({ data, error }).then(resolve, reject),
  };
  return cadeia;
}

describe("consultas do operador", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("entrega a fila com prioridade e proveniência, sem colunas internas", async () => {
    dependencias.from.mockReturnValue(
      consulta([
        {
          id: 7,
          questao_id: "questao-1",
          questao_versao: 2,
          motivo: "baixa confianca",
          prioridade: 100,
          criada_em: "2026-08-23T12:00:00.000Z",
          questoes: {
            tipo_questao: "multipla_escolha",
            origem: "real",
            enunciado: "Qual é a resposta?",
            alternativas: [
              { letra: "A", texto: "Primeira" },
              { letra: "B", texto: "Segunda" },
            ],
            resposta_correta: "B",
            anulada: false,
            fonte_citacao: {
              banca: "Cesgranrio",
              ano: 2024,
              orgao: "Banco do Brasil",
              cargo: "Escriturário",
              numero: 12,
            },
            decidido_por: "nao deveria sair",
          },
        },
      ]),
    );

    const fila = await consultarFilaRevisao();

    expect(fila).toEqual([
      {
        id: 7,
        questaoId: "questao-1",
        questaoVersao: 2,
        motivo: "baixa confianca",
        prioridade: 100,
        criadaEm: "2026-08-23T12:00:00.000Z",
        questao: {
          tipoQuestao: "multipla_escolha",
          origem: "real",
          enunciado: "Qual é a resposta?",
          alternativas: [
            { letra: "A", texto: "Primeira" },
            { letra: "B", texto: "Segunda" },
          ],
          respostaCorreta: "B",
          anulada: false,
          proveniencia: {
            banca: "Cesgranrio",
            ano: 2024,
            orgao: "Banco do Brasil",
            cargo: "Escriturário",
            numero: 12,
          },
        },
      },
    ]);
    expect(fila[0]).not.toHaveProperty("decididoPor");
  });

  it("entrega candidatos sem expor decisão ou dados de auditoria", async () => {
    dependencias.from.mockReturnValue(
      consulta([
        {
          id: "candidato-1",
          nome_sugerido: "Open Finance",
          materia_id: null,
          ocorrencias: 8,
          sugerido_em: "2026-08-23T12:00:00.000Z",
          decidido_por: "interno",
          motivo_decisao: "interno",
        },
      ]),
    );

    await expect(consultarCandidatosDeTopico()).resolves.toEqual([
      {
        id: "candidato-1",
        nomeSugerido: "Open Finance",
        materiaId: null,
        ocorrencias: 8,
        sugeridoEm: "2026-08-23T12:00:00.000Z",
      },
    ]);
  });

  it("combina matérias e tópicos sem datas internas", async () => {
    dependencias.from
      .mockReturnValueOnce(
        consulta([{ id: "materia-1", nome: "Matemática", ordem: 1, ativa: true }]),
      )
      .mockReturnValueOnce(
        consulta([
          {
            id: "topico-1",
            materia_id: "materia-1",
            nome: "Juros",
            ordem: 1,
            ativo: true,
            criado_em: "interno",
          },
        ]),
      )
      .mockReturnValueOnce(consulta([]));

    await expect(consultarTaxonomia()).resolves.toEqual({
      materias: [
        {
          id: "materia-1",
          nome: "Matemática",
          ordem: 1,
          ativa: true,
          topicos: [{ id: "topico-1", nome: "Juros", ordem: 1, ativo: true }],
        },
      ],
      candidatos: [],
    });
  });

  it("protege a leitura administrativa e repassa o contrato tipado", async () => {
    const configuracao = {
      chave: "flag.m5.raiox",
      tipo: "flag",
      moduloDono: "m5",
      descricao: "Raio-X",
      padrao: false,
      vigente: { valor: false, autorId: null, motivo: null, alteradoEm: null },
      historico: [],
    };
    dependencias.configuracoes.mockResolvedValue([configuracao]);

    await expect(consultarConfiguracoes()).resolves.toEqual([configuracao]);
  });

  it("lista recursos inclusive inativos para a correção do operador", async () => {
    dependencias.from.mockReturnValue(
      consulta([
        {
          id: "recurso-1",
          topico_id: "topico-1",
          titulo: "Aula",
          url: "https://conteudo.test/aula",
          tipo: "video",
          duracao_minutos: 20,
          ordem: 1,
          ativo: false,
        },
      ]),
    );

    await expect(consultarRecursosEstudo("topico-1")).resolves.toEqual([
      {
        id: "recurso-1",
        topicoId: "topico-1",
        titulo: "Aula",
        url: "https://conteudo.test/aula",
        tipo: "video",
        duracaoMinutos: 20,
        ordem: 1,
        ativo: false,
      },
    ]);
    expect(dependencias.from).toHaveBeenCalledWith("recursos_estudo");
  });
});
