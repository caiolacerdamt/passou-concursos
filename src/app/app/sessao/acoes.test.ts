import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencias = vi.hoisted(() => ({
  matricula: vi.fn(),
  cliente: vi.fn(),
  obterItem: vi.fn(),
  registrar: vi.fn(),
  validar: vi.fn(),
  finalizar: vi.fn(),
  agendar: vi.fn(),
  reportar: vi.fn(),
}));

vi.mock("@/modules/conta/matricula", () => ({
  exigirMatriculaAtiva: dependencias.matricula,
}));
vi.mock("@/lib/db/sessao", () => ({ clienteDaSessao: dependencias.cliente }));
vi.mock("@/modules/aluno/sessao", async (importOriginal) => {
  const atual = await importOriginal<typeof import("@/modules/aluno/sessao")>();
  return {
    ...atual,
    obterItemParaResposta: dependencias.obterItem,
  };
});
vi.mock("@/modules/aluno/tentativas", async (importOriginal) => {
  const atual = await importOriginal<typeof import("@/modules/aluno/tentativas")>();
  return {
    ...atual,
    registrarTentativa: dependencias.registrar,
    validarResposta: dependencias.validar,
  };
});
vi.mock("@/modules/observabilidade/reporte", () => ({
  reportarErro: dependencias.reportar,
}));
vi.mock("@/modules/aluno/progresso", () => ({
  finalizarBloco: dependencias.finalizar,
}));
vi.mock("@/modules/aluno/revisao", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/aluno/revisao")>()),
  agendarRevisao: dependencias.agendar,
}));

import { TentativaRecusada } from "@/modules/aluno/tentativas";

import {
  responderQuestao,
} from "./acoes";

const ESTADO_INICIAL_DA_RESPOSTA = { status: "inicial" } as const;

const alvo = {
  sessao: { id: "sessao-1", contexto: "treino" as const, encerradaEm: null },
  item: {
    id: "item-1",
    questaoId: "questao-1",
    questaoVersao: 2,
    ordem: 1,
    respondidoEm: null,
  },
  questao: {
    id: "questao-1",
    questaoVersao: 2,
    origem: "real" as const,
    topicoId: "topico-1",
    tipoQuestao: "multipla_escolha" as const,
    enunciado: "Enunciado",
    alternativas: [
      { letra: "A" as const, texto: "A" },
      { letra: "B" as const, texto: "B" },
    ],
    fonteCitacao: null,
    imagens: [],
    respostaCorreta: "B",
    gabaritoVersao: "gabarito-1",
  },
};

function formulario({
  resposta = "B",
  causa,
  tempo = "8100",
  chute = true,
  contexto = "simulado",
}: {
  resposta?: string;
  causa?: string;
  tempo?: string;
  chute?: boolean;
  contexto?: string;
} = {}) {
  const form = new FormData();
  form.set("sessaoId", "sessao-1");
  form.set("itemId", "item-1");
  form.set("respostaDada", resposta);
  form.set("tempoMs", tempo);
  form.set("marcouChute", String(chute));
  form.set("contexto", contexto);
  if (causa !== undefined) form.set("causaErro", causa);
  return form;
}

function clienteDaResposta({ pendente = true } = {}) {
  const pendingBuilder = builder({
    data: pendente ? { id: "item-2" } : null,
    error: null,
  });
  const fechamentoBuilder = builder({ data: null, error: null });
  const cliente = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "aluno-1" } }, error: null }),
    },
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    from: vi.fn((tabela: string) => {
      if (tabela === "sessao_itens") return pendingBuilder;
      return fechamentoBuilder;
    }),
  };
  return { cliente, pendingBuilder, fechamentoBuilder };
}

function builder(resposta: { data: unknown; error: null | { message: string } }) {
  const consulta: Record<string, unknown> = {};
  for (const metodo of ["select", "eq", "is", "limit"]) {
    consulta[metodo] = vi.fn(() => consulta);
  }
  consulta.update = vi.fn(() => consulta);
  consulta.then = (resolve: (valor: unknown) => unknown, reject: (erro: unknown) => unknown) =>
    Promise.resolve(resposta).then(resolve, reject);
  consulta.maybeSingle = vi.fn(async () => resposta);
  return consulta;
}

describe("responderQuestao", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencias.validar.mockReset();
    dependencias.matricula.mockResolvedValue({ id: "matricula-1" });
    dependencias.obterItem.mockResolvedValue(alvo);
    dependencias.registrar.mockResolvedValue({
      tentativaId: "tentativa-1",
      respondidaEm: "2026-08-22T22:00:00Z",
      correta: true,
      duplicada: false,
    });
    dependencias.finalizar.mockResolvedValue({
      userId: "aluno-1",
      contexto: "treino",
      topicoId: "topico-1",
      nRespostas: 1,
      nAcertos: 1,
    });
    dependencias.agendar.mockResolvedValue({
      due: new Date("2026-08-24T00:00:00Z"),
      nota: 3,
      algoritmo: "fsrs",
    });
  });

  it("deriva contexto e usuário da sessão, registra uma vez e devolve só o gabarito", async () => {
    const { cliente } = clienteDaResposta();
    dependencias.cliente.mockResolvedValue(cliente);

    const estado = await responderQuestao(ESTADO_INICIAL_DA_RESPOSTA, formulario());

    expect(dependencias.validar).toHaveBeenCalledWith(
      expect.objectContaining({ contexto: "treino", userId: "aluno-1" }),
      expect.objectContaining({ acertou: true }),
    );
    expect(dependencias.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ contexto: "treino", userId: "aluno-1", respostaDada: "B" }),
      cliente,
    );
    expect(estado).toEqual({
      status: "respondida",
      sessaoId: "sessao-1",
      itemId: "item-1",
      correta: true,
      duplicada: false,
      respostaCorreta: "B",
      sessaoConcluida: false,
    });
  });

  it("devolve causa necessária antes do INSERT e aceita 'não sei dizer' na nova tentativa", async () => {
    const { cliente } = clienteDaResposta();
    dependencias.cliente.mockResolvedValue(cliente);
    dependencias.validar.mockImplementation(() => {
      throw new TentativaRecusada("causa_obrigatoria", "Diga por que errou. Não sei dizer vale.");
    });

    const estado = await responderQuestao(
      ESTADO_INICIAL_DA_RESPOSTA,
      formulario({ resposta: "A", chute: false }),
    );

    expect(estado).toMatchObject({
      status: "causa_necessaria",
      respostaDada: "A",
      tempoMs: 8100,
      marcouChute: false,
    });
    expect(dependencias.registrar).not.toHaveBeenCalled();
  });

  it("no duplo-clique não revalida nem cria nova tentativa", async () => {
    const { cliente, pendingBuilder } = clienteDaResposta({ pendente: false });
    dependencias.cliente.mockResolvedValue(cliente);
    dependencias.obterItem.mockResolvedValue({
      ...alvo,
      item: { ...alvo.item, respondidoEm: "2026-08-22T22:00:00Z" },
    });
    dependencias.registrar.mockResolvedValue({
      tentativaId: "tentativa-1",
      respondidaEm: "2026-08-22T22:00:00Z",
      correta: false,
      duplicada: true,
    });

    const estado = await responderQuestao(
      ESTADO_INICIAL_DA_RESPOSTA,
      formulario({ resposta: "A", causa: "nao_sei_dizer" }),
    );

    expect(dependencias.validar).not.toHaveBeenCalled();
    expect(dependencias.registrar).toHaveBeenCalledTimes(1);
    expect(pendingBuilder.maybeSingle).toHaveBeenCalledTimes(1);
    expect(estado).toMatchObject({
      status: "respondida",
      duplicada: true,
      correta: false,
      sessaoConcluida: true,
    });
  });

  it("não consulta nem devolve explicação ao responder", async () => {
    const { cliente } = clienteDaResposta();
    dependencias.cliente.mockResolvedValue(cliente);

    const estado = await responderQuestao(ESTADO_INICIAL_DA_RESPOSTA, formulario());

    expect(cliente.rpc).not.toHaveBeenCalled();
    expect(estado).toMatchObject({ status: "respondida" });
    expect(estado).not.toHaveProperty("explicacao");
  });

  it("recalcula antes de agendar a primeira revisão com identidade e tópico do servidor", async () => {
    const { cliente } = clienteDaResposta({ pendente: false });
    dependencias.cliente.mockResolvedValue(cliente);
    dependencias.obterItem.mockResolvedValue({
      ...alvo,
      sessao: { ...alvo.sessao, contexto: "revisao" },
    });
    dependencias.finalizar.mockResolvedValue({
      userId: "aluno-confirmado",
      contexto: "revisao",
      topicoId: "topico-confirmado",
      nRespostas: 4,
      nAcertos: 3,
    });

    const estado = await responderQuestao(
      ESTADO_INICIAL_DA_RESPOSTA,
      formulario({ contexto: "treino" }),
    );

    expect(estado).toMatchObject({ status: "respondida", sessaoConcluida: true });
    expect(dependencias.finalizar).toHaveBeenCalledWith(cliente, "sessao-1");
    expect(dependencias.agendar).toHaveBeenCalledWith(
      {
        userId: "aluno-confirmado",
        topicoId: "topico-confirmado",
        percentualAcerto: 0.75,
        sessaoId: "sessao-1",
        primeiraRevisao: false,
      },
      cliente,
    );
  });

  it("permite retry do fechamento sem perder a revisão nem duplicar o fato", async () => {
    const { cliente } = clienteDaResposta({ pendente: false });
    dependencias.cliente.mockResolvedValue(cliente);
    dependencias.obterItem.mockResolvedValue({
      ...alvo,
      sessao: { ...alvo.sessao, contexto: "revisao" },
      item: { ...alvo.item, respondidoEm: "2026-08-22T22:00:00Z" },
    });
    dependencias.registrar.mockResolvedValue({
      tentativaId: "tentativa-1",
      respondidaEm: "2026-08-22T22:00:00Z",
      correta: false,
      duplicada: true,
    });
    dependencias.finalizar.mockResolvedValue({
      userId: "aluno-1",
      contexto: "revisao",
      topicoId: "topico-1",
      nRespostas: 1,
      nAcertos: 0,
    });

    await responderQuestao(ESTADO_INICIAL_DA_RESPOSTA, formulario({ resposta: "A" }));

    expect(dependencias.finalizar).toHaveBeenCalledTimes(1);
    expect(dependencias.agendar).toHaveBeenCalledWith(
      {
        userId: "aluno-1",
        topicoId: "topico-1",
        percentualAcerto: 0,
        sessaoId: "sessao-1",
        primeiraRevisao: false,
      },
      cliente,
    );
  });

  it("agenda a primeira revisão do conteúdo para amanhã sem depender do cron", async () => {
    const { cliente } = clienteDaResposta({ pendente: false });
    dependencias.cliente.mockResolvedValue(cliente);
    dependencias.finalizar.mockResolvedValue({
      userId: "aluno-confirmado",
      contexto: "treino",
      topicoId: "topico-conteudo",
      nRespostas: 4,
      nAcertos: 1,
    });

    const estado = await responderQuestao(
      ESTADO_INICIAL_DA_RESPOSTA,
      formulario({ contexto: "simulado" }),
    );

    expect(estado).toMatchObject({ status: "respondida", sessaoConcluida: true });
    expect(dependencias.agendar).toHaveBeenCalledWith(
      {
        userId: "aluno-confirmado",
        topicoId: "topico-conteudo",
        percentualAcerto: 0.25,
        sessaoId: "sessao-1",
        primeiraRevisao: true,
      },
      cliente,
    );
  });

  it("mostra falha de projeção sem perder a tentativa confirmada", async () => {
    const { cliente } = clienteDaResposta({ pendente: false });
    dependencias.cliente.mockResolvedValue(cliente);
    dependencias.finalizar.mockRejectedValue(new Error("projeção indisponível"));

    const estado = await responderQuestao(ESTADO_INICIAL_DA_RESPOSTA, formulario());

    expect(estado).toMatchObject({ status: "erro", mensagem: expect.any(String) });
    expect(dependencias.registrar).toHaveBeenCalledTimes(1);
  });

  it("devolve o código do Postgres no estado de erro sem mudar a mensagem visível", async () => {
    const { cliente } = clienteDaResposta();
    dependencias.cliente.mockResolvedValue(cliente);
    const rpcError = {
      code: "23502",
      message: "null value in column dificuldade",
      details: "Failing row contains (questao-1)",
      hint: null,
    };
    dependencias.registrar.mockRejectedValue(
      new Error(`registrar_tentativa falhou: ${JSON.stringify(rpcError)}`, {
        cause: rpcError,
      }),
    );

    const estado = await responderQuestao(ESTADO_INICIAL_DA_RESPOSTA, formulario());

    expect(estado).toEqual({
      status: "erro",
      sessaoId: "sessao-1",
      itemId: "item-1",
      mensagem: "Não conseguimos registrar esta resposta. Tente novamente.",
      codigo: "23502",
    });
  });

  it("deixa o redirect do paywall atravessar a action", async () => {
    dependencias.matricula.mockRejectedValue(new Error("NEXT_REDIRECT:/assinar"));

    await expect(
      responderQuestao(ESTADO_INICIAL_DA_RESPOSTA, formulario()),
    ).rejects.toThrow("NEXT_REDIRECT:/assinar");
    expect(dependencias.cliente).not.toHaveBeenCalled();
  });
});
