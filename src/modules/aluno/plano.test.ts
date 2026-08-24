import { describe, expect, it, vi } from "vitest";

import { consultarPlanoDoDia, dataHojeDoProduto } from "./plano";

function clienteCom(respostas: Record<string, unknown>) {
  return {
    from: vi.fn((tabela: string) => {
      const resposta = (respostas[tabela] ?? { data: [], error: null }) as {
        data: unknown;
        error: { message: string } | null;
      };
      const consulta = {
        eq: vi.fn(() => consulta),
        in: vi.fn(() => consulta),
        not: vi.fn(() => consulta),
        order: vi.fn(() => consulta),
        maybeSingle: vi.fn(async () => resposta),
        then: (
          resolve: (valor: typeof resposta) => unknown,
          reject: (erro: unknown) => unknown,
        ) => Promise.resolve(resposta).then(resolve, reject),
      };
      return { select: vi.fn(() => consulta) };
    }),
  };
}

describe("dataHojeDoProduto", () => {
  it("usa o dia de São Paulo, não o fuso do processo", () => {
    expect(dataHojeDoProduto(new Date("2026-08-22T02:00:00.000Z"))).toBe(
      "2026-08-21",
    );
  });
});

describe("consultarPlanoDoDia", () => {
  it("separa piso e meta cheia e preserva motivo/frase", async () => {
    const cliente = clienteCom({
      plano_dia: {
        data: { id: "plano-1", data: "2026-08-22", frase: null },
        error: null,
      },
      plano_bloco: {
        data: [
          {
            id: "meta-1",
            tipo: "avancar",
            nivel: "meta_cheia",
            ordem: 2,
            topico_id: "topico-2",
            minutos_estimados: 20,
            motivo: "seu ponto mais fraco",
          },
          {
            id: "piso-1",
            tipo: "revisar",
            nivel: "piso",
            ordem: 1,
            topico_id: "topico-1",
            minutos_estimados: 20,
            motivo: "revisar hoje = não perder o que você já conquistou",
          },
        ],
        error: null,
      },
    });

    await expect(consultarPlanoDoDia(cliente as never, "2026-08-22")).resolves.toEqual({
      id: "plano-1",
      data: "2026-08-22",
      frase: null,
      piso: [
        {
          id: "piso-1",
          tipo: "revisar",
          nivel: "piso",
          ordem: 1,
          topicoId: "topico-1",
          minutosEstimados: 20,
          motivo: "revisar hoje = não perder o que você já conquistou",
          conclusao: null,
        },
      ],
      metaCheia: [
        {
          id: "meta-1",
          tipo: "avancar",
          nivel: "meta_cheia",
          ordem: 2,
          topicoId: "topico-2",
          minutosEstimados: 20,
          motivo: "seu ponto mais fraco",
          conclusao: null,
        },
      ],
    });
  });

  it("marca o bloco com a sessão encerrada mais recente e seu placar", async () => {
    const cliente = clienteCom({
      plano_dia: {
        data: { id: "plano-1", data: "2026-08-23", frase: null },
        error: null,
      },
      plano_bloco: {
        data: [
          {
            id: "bloco-concluido",
            tipo: "avancar",
            nivel: "meta_cheia",
            ordem: 1,
            topico_id: "topico-1",
            minutos_estimados: 20,
            motivo: "começar pelo mais importante",
          },
          {
            id: "bloco-pendente",
            tipo: "treinar",
            nivel: "meta_cheia",
            ordem: 2,
            topico_id: "topico-2",
            minutos_estimados: 20,
            motivo: "consolidar",
          },
        ],
        error: null,
      },
      sessoes: {
        data: [
          {
            id: "sessao-recente",
            plano_bloco_id: "bloco-concluido",
            encerrada_em: "2026-08-23T21:00:00.000Z",
          },
          {
            id: "sessao-antiga",
            plano_bloco_id: "bloco-concluido",
            encerrada_em: "2026-08-23T20:00:00.000Z",
          },
        ],
        error: null,
      },
      tentativas: {
        data: [
          { sessao_id: "sessao-recente", correta: true },
          { sessao_id: "sessao-recente", correta: false },
          { sessao_id: "sessao-antiga", correta: true },
        ],
        error: null,
      },
    });

    const plano = await consultarPlanoDoDia(cliente as never, "2026-08-23");

    expect(plano?.metaCheia[0].conclusao).toEqual({
      sessaoId: "sessao-recente",
      nQuestoes: 2,
      nAcertos: 1,
      encerradaEm: "2026-08-23T21:00:00.000Z",
    });
    expect(plano?.metaCheia[1].conclusao).toBeNull();
  });

  it("distingue plano ausente de plano sem blocos", async () => {
    const cliente = clienteCom({
      plano_dia: { data: null, error: null },
      plano_bloco: { data: [], error: null },
    });

    await expect(consultarPlanoDoDia(cliente as never, "2026-08-22")).resolves.toBeNull();
  });

  it("nomeia a falha do banco", async () => {
    const cliente = clienteCom({
      plano_dia: { data: null, error: { message: "indisponível" } },
      plano_bloco: { data: [], error: null },
    });

    await expect(consultarPlanoDoDia(cliente as never, "2026-08-22")).rejects.toThrow(
      "falha ao ler plano_dia: indisponível",
    );
  });
});
