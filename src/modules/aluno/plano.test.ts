import { describe, expect, it, vi } from "vitest";

import {
  adiarBlocoDoPlano,
  consultarPlanoDoDia,
  dataHojeDoProduto,
  encurtarBlocoDoPlano,
  reordenarBlocosDoPlano,
} from "./plano";

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
            n_questoes: 10,
            n_questoes_cheias: 10,
            minutos_estimados: 20,
            minutos_estimados_cheios: 20,
            motivo: "seu ponto mais fraco",
            ajuste_usuario: false,
            adiado_de: null,
          },
          {
            id: "piso-1",
            tipo: "revisar",
            nivel: "piso",
            ordem: 1,
            topico_id: "topico-1",
            n_questoes: 10,
            n_questoes_cheias: 10,
            minutos_estimados: 20,
            minutos_estimados_cheios: 20,
            motivo: "revisar hoje = não perder o que você já conquistou",
            ajuste_usuario: false,
            adiado_de: null,
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
          nQuestoes: 10,
          nQuestoesCheias: 10,
          minutosEstimados: 20,
          minutosEstimadosCheios: 20,
          motivo: "revisar hoje = não perder o que você já conquistou",
          ajusteUsuario: false,
          adiadoDe: null,
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
          nQuestoes: 10,
          nQuestoesCheias: 10,
          minutosEstimados: 20,
          minutosEstimadosCheios: 20,
          motivo: "seu ponto mais fraco",
          ajusteUsuario: false,
          adiadoDe: null,
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
            n_questoes: 10,
            n_questoes_cheias: 10,
            minutos_estimados: 20,
            minutos_estimados_cheios: 20,
            motivo: "começar pelo mais importante",
            ajuste_usuario: false,
            adiado_de: null,
          },
          {
            id: "bloco-pendente",
            tipo: "treinar",
            nivel: "meta_cheia",
            ordem: 2,
            topico_id: "topico-2",
            n_questoes: 10,
            n_questoes_cheias: 10,
            minutos_estimados: 20,
            minutos_estimados_cheios: 20,
            motivo: "consolidar",
            ajuste_usuario: false,
            adiado_de: null,
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

describe("ajustes do plano", () => {
  it("reordena pela RPC atômica com a permutação e o nível declarados", async () => {
    const cliente = {
      rpc: vi.fn(async () => ({ data: null, error: null })),
    };

    await reordenarBlocosDoPlano(cliente as never, {
      planoId: "plano-1",
      nivel: "meta_cheia",
      blocoIds: ["bloco-2", "bloco-1"],
    });

    expect(cliente.rpc).toHaveBeenCalledWith("reordenar_plano_do_dia", {
      p_plano_id: "plano-1",
      p_nivel: "meta_cheia",
      p_ordens: ["bloco-2", "bloco-1"],
    });
  });

  it("devolve a data do adiamento e o tamanho da versão curta", async () => {
    const cliente = {
      rpc: vi
        .fn()
        .mockResolvedValueOnce({ data: "2026-08-29", error: null })
        .mockResolvedValueOnce({
          data: [{ n_questoes: 3, minutos_estimados: 6 }],
          error: null,
        }),
    };

    await expect(adiarBlocoDoPlano(cliente as never, "bloco-1")).resolves.toBe(
      "2026-08-29",
    );
    await expect(encurtarBlocoDoPlano(cliente as never, "bloco-1")).resolves.toEqual({
      nQuestoes: 3,
      minutosEstimados: 6,
    });
  });
});
