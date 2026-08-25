import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencias = vi.hoisted(() => ({
  rpc: vi.fn(),
  setConfig: vi.fn(),
}));

vi.mock("./fronteira", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./fronteira")>()),
  comOperador: async (
    _operacao: string,
    acao: (contexto: { operador: { id: string }; cliente: { rpc: typeof dependencias.rpc } }) => unknown,
  ) => acao({ operador: { id: "operador-da-sessao" }, cliente: { rpc: dependencias.rpc } }),
}));
vi.mock("@/modules/config/escrita", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/config/escrita")>()),
  setConfig: dependencias.setConfig,
}));

const {
  alterarConfiguracao,
  corrigirQuestao,
  decidirRevisoesEmLote,
  decidirTopicoCandidato,
  editarTaxonomia,
  salvarRecursoEstudo,
} = await import("./comandos");

describe("comandos do operador", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencias.rpc.mockResolvedValue({ data: true, error: null });
    dependencias.setConfig.mockResolvedValue(undefined);
  });

  it("decide lote usando o autor derivado da sessão", async () => {
    dependencias.rpc.mockResolvedValue({ data: 2, error: null });

    await expect(
      decidirRevisoesEmLote({
        revisoes: [4, 8],
        decisao: "aprovada",
        motivo: "conferidas no PDF",
      }),
    ).resolves.toBe(2);

    expect(dependencias.rpc).toHaveBeenCalledWith("decidir_revisoes_em_lote", {
      p_revisoes: [4, 8],
      p_decisao: "aprovada",
      p_operador: "operador-da-sessao",
      p_motivo: "conferidas no PDF",
    });
  });

  it("mapeia a correção para campos SQL permitidos", async () => {
    dependencias.rpc.mockResolvedValue({
      data: [{ questao_id: "questao-1", questao_versao: 3 }],
      error: null,
    });

    await expect(
      corrigirQuestao({
        questaoId: "11111111-1111-4111-8111-111111111111",
        questaoVersao: 2,
        mudancaTipo: "substantiva",
        motivo: "enunciado conferido",
        campos: {
          enunciado: "Novo enunciado",
          respostaCorreta: "C",
          anulada: false,
        },
      }),
    ).resolves.toEqual({ questaoId: "questao-1", questaoVersao: 3 });

    expect(dependencias.rpc).toHaveBeenCalledWith(
      "corrigir_questao_operador",
      expect.objectContaining({
        p_operador: "operador-da-sessao",
        p_campos: {
          enunciado: "Novo enunciado",
          resposta_correta: "C",
          anulada: false,
        },
      }),
    );
  });

  it("decide candidato e edita taxonomia com autor derivado", async () => {
    dependencias.rpc
      .mockResolvedValueOnce({ data: "topico-1", error: null })
      .mockResolvedValueOnce({ data: true, error: null });

    await expect(
      decidirTopicoCandidato({
        candidatoId: "22222222-2222-4222-8222-222222222222",
        decisao: "aprovado",
        materiaId: "33333333-3333-4333-8333-333333333333",
        nome: "Juros",
        motivo: "nome conferido",
      }),
    ).resolves.toBe("topico-1");
    await expect(
      editarTaxonomia({
        tipo: "topico",
        id: "44444444-4444-4444-8444-444444444444",
        motivo: "adequar edital",
        campos: { nome: "Juros simples", ativo: false },
      }),
    ).resolves.toBe(true);

    expect(dependencias.rpc).toHaveBeenNthCalledWith(
      1,
      "decidir_topico_candidato",
      expect.objectContaining({ p_operador: "operador-da-sessao" }),
    );
    expect(dependencias.rpc).toHaveBeenNthCalledWith(
      2,
      "editar_taxonomia_operador",
      expect.objectContaining({
        p_operador: "operador-da-sessao",
        p_campos: { nome: "Juros simples", ativo: false },
      }),
    );
  });

  it("grava configuração com autoria da sessão e motivo obrigatório", async () => {
    await alterarConfiguracao({
      chave: "flag.m5.raiox",
      valor: true,
      motivo: "liberar homologação",
    });

    expect(dependencias.setConfig).toHaveBeenCalledWith(
      "flag.m5.raiox",
      true,
      { autorId: "operador-da-sessao", motivo: "liberar homologação" },
    );
  });

  it("grava recurso curado com autoria da sessão", async () => {
    dependencias.rpc.mockResolvedValue({ data: "recurso-1", error: null });

    await expect(
      salvarRecursoEstudo({
        recursoId: null,
        topicoId: "44444444-4444-4444-8444-444444444444",
        titulo: "Aula de juros",
        url: "https://conteudo.test/juros",
        tipo: "video",
        duracaoMinutos: 20,
        ordem: 1,
        ativo: true,
        motivo: "link conferido pelo operador",
      }),
    ).resolves.toBe("recurso-1");

    expect(dependencias.rpc).toHaveBeenCalledWith("salvar_recurso_estudo_operador", {
      p_recurso_id: null,
      p_topico_id: "44444444-4444-4444-8444-444444444444",
      p_titulo: "Aula de juros",
      p_url: "https://conteudo.test/juros",
      p_tipo: "video",
      p_duracao_minutos: 20,
      p_ordem: 1,
      p_ativo: true,
      p_operador: "operador-da-sessao",
      p_motivo: "link conferido pelo operador",
    });
  });

  it("recusa entrada extra ou motivo vazio sem chamar a RPC", async () => {
    await expect(
      decidirRevisoesEmLote({
        revisoes: [1],
        decisao: "rejeitada",
        motivo: "   ",
      }),
    ).rejects.toMatchObject({ name: "EntradaDoOperadorInvalida" });
    await expect(
      decidirRevisoesEmLote({
        revisoes: [1],
        decisao: "rejeitada",
        motivo: "motivo",
        campoInterno: "nao permitido",
      }),
    ).rejects.toMatchObject({ name: "EntradaDoOperadorInvalida" });

    expect(dependencias.rpc).not.toHaveBeenCalled();
  });

  it("recusa campos extras na edição de taxonomia e configuração", async () => {
    await expect(
      editarTaxonomia({
        tipo: "topico",
        id: "44444444-4444-4444-8444-444444444444",
        motivo: "ajuste",
        campos: { nome: "Juros", campoInterno: "não permitido" },
      }),
    ).rejects.toMatchObject({ name: "EntradaDoOperadorInvalida" });

    await expect(
      alterarConfiguracao({
        chave: "flag.m5.raiox",
        valor: true,
        motivo: "ajuste",
        autorId: "autor-forjado",
      }),
    ).rejects.toMatchObject({ name: "EntradaDoOperadorInvalida" });
    await expect(
      salvarRecursoEstudo({
        topicoId: "44444444-4444-4444-8444-444444444444",
        titulo: "Aula",
        url: "http://nao-seguro.test/aula",
        tipo: "video",
        duracaoMinutos: 20,
        ordem: 1,
        ativo: true,
        motivo: "ajuste",
      }),
    ).rejects.toMatchObject({ name: "EntradaDoOperadorInvalida" });

    expect(dependencias.rpc).not.toHaveBeenCalled();
    expect(dependencias.setConfig).not.toHaveBeenCalled();
  });
});
