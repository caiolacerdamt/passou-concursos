import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencias = vi.hoisted(() => ({
  matricula: vi.fn(),
  cliente: vi.fn(),
  obterItem: vi.fn(),
  registrar: vi.fn(),
  validar: vi.fn(),
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

function clienteDaResposta({ pendente = true, explicacao = true } = {}) {
  const pendingBuilder = builder({
    data: pendente ? { id: "item-2" } : null,
    error: null,
  });
  const fechamentoBuilder = builder({ data: null, error: null });
  const cliente = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "aluno-1" } }, error: null }),
    },
    rpc: vi.fn().mockResolvedValue({
      data: explicacao
        ? [
            {
              texto: "A alternativa B é apoiada pelo documento.",
              alternativa_correta: "B",
              fontes_citadas: [{ doc_id: "base:1", trecho: "trecho oficial" }],
            },
          ]
        : [],
      error: null,
    }),
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
  });

  it("deriva contexto e usuário da sessão, registra uma vez e mostra fonte da explicação", async () => {
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
      explicacao: {
        texto: "A alternativa B é apoiada pelo documento.",
        alternativaCorreta: "B",
        fontesCitadas: [{ docId: "base:1", trecho: "trecho oficial" }],
      },
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

  it("mostra em revisão quando a RPC não tem explicação aprovada", async () => {
    const { cliente } = clienteDaResposta({ explicacao: false });
    dependencias.cliente.mockResolvedValue(cliente);

    const estado = await responderQuestao(ESTADO_INICIAL_DA_RESPOSTA, formulario());

    expect(estado).toMatchObject({ status: "respondida", explicacao: null });
  });

  it("deixa o redirect do paywall atravessar a action", async () => {
    dependencias.matricula.mockRejectedValue(new Error("NEXT_REDIRECT:/assinar"));

    await expect(
      responderQuestao(ESTADO_INICIAL_DA_RESPOSTA, formulario()),
    ).rejects.toThrow("NEXT_REDIRECT:/assinar");
    expect(dependencias.cliente).not.toHaveBeenCalled();
  });
});
