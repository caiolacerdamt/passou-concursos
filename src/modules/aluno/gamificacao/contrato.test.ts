import { describe, expect, it, vi } from "vitest";

import {
  CATALOGO_DE_CONQUISTAS,
  GamificacaoRecusada,
  consultarGamificacao,
  mapearGamificacao,
} from "./contrato";

const respostaBase = {
  data: "2026-08-24",
  habilitada: true,
  estado: "ok",
  anel: {
    estudo: {
      progresso: 2,
      meta: 2,
      piso_meta: 1,
      piso_progresso: 3,
      bruto: 3,
      percentual: 1,
      concluido: true,
    },
    questoes: {
      progresso: 10,
      meta: 10,
      piso_meta: 5,
      piso_progresso: 2,
      bruto: 14,
      percentual: 1,
      concluido: true,
    },
    revisao: {
      progresso: 1,
      meta: 2,
      piso_meta: 1,
      piso_progresso: 0,
      bruto: 1,
      percentual: 0.5,
      concluido: false,
    },
  },
  pontos: {
    dia: 45,
    total: 145,
    discriminacao: {
      estudo_prioritario: 10,
      conclusao: 20,
      revisao_no_prazo: 15,
      recuperacao_erro: 0,
    },
  },
  missao: {
    id: "missao-piso:2026-08-24",
    tipo: "concluir_piso",
    progresso: 2,
    progresso_bruto: 3,
    meta: 2,
    estado: "concluida",
  },
  sequencia: {
    data: "2026-08-24",
    sequencia: 4,
    estado: "cumprido",
    piso_entregue: true,
    piso_cumprido: true,
    tem_historico: true,
  },
  conquistas: [
    { id: "primeiro_bloco", desbloqueada_em: "2026-08-20T12:00:00Z" },
  ],
};

/** A resposta válida com um recorte trocado — o resto vem da base. */
function respostaValida(troca: Record<string, unknown> = {}) {
  return { ...respostaBase, ...troca };
}

describe("contrato da gamificação", () => {
  it("separa o anel, preserva o bruto e limita o visual à meta", () => {
    const dados = mapearGamificacao(respostaBase);

    expect(dados.anel).toMatchObject({
      estudo: { progresso: 2, meta: 2, pisoMeta: 1, pisoProgresso: 1, bruto: 3, percentual: 1 },
      questoes: { progresso: 10, meta: 10, pisoMeta: 5, pisoProgresso: 2, bruto: 14, percentual: 1 },
      revisao: { progresso: 1, meta: 2, pisoMeta: 1, pisoProgresso: 0, bruto: 1, percentual: 0.5 },
    });
    expect(dados.pontos).toEqual({
      dia: 45,
      total: 145,
      discriminacao: {
        estudoPrioritario: 10,
        conclusao: 20,
        revisaoNoPrazo: 15,
        recuperacaoErro: 0,
      },
      discriminacaoTotal: null,
    });
    expect(dados.missao?.progresso).toBe(2);
    expect(dados.missao?.progressoBruto).toBe(3);
    expect(dados.sequencia?.sequencia).toBe(4);
    expect(dados.conquistas).toHaveLength(CATALOGO_DE_CONQUISTAS.length);
    expect(dados.conquistas[0]).toMatchObject({
      id: "primeiro_bloco",
      desbloqueada: true,
    });
  });

  it("retorna o estado inicial seguro quando a flag está desligada", () => {
    const dados = mapearGamificacao({
      data: "2026-08-24",
      habilitada: false,
      estado: "desligada",
      anel: {
        estudo: {},
        questoes: {},
        revisao: {},
      },
      pontos: {},
      missao: null,
      sequencia: null,
      conquistas: [],
    });

    expect(dados.habilitada).toBe(false);
    expect(dados.anel.estudo).toEqual({
      progresso: 0,
      meta: 0,
      pisoMeta: 0,
      pisoProgresso: 0,
      bruto: 0,
      percentual: 0,
      concluido: false,
    });
    expect(dados.pontos.total).toBe(0);
    expect(dados.conquistas.every((conquista) => !conquista.desbloqueada)).toBe(true);
  });

  it("usa RPC sem argumentos e nomeia falha de leitura", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: respostaBase, error: null });
    const dados = await consultarGamificacao({ rpc } as never);

    expect(rpc).toHaveBeenCalledWith("consultar_gamificacao_do_dia");
    expect(dados.pontos.dia).toBe(45);

    const erro = new Error("indisponível");
    const clienteComFalha = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: erro }),
    };
    await expect(consultarGamificacao(clienteComFalha as never)).rejects.toMatchObject({
      name: "GamificacaoRecusada",
      motivo: "falha_leitura",
    });
  });

  it("não aceita estado de erro nem conquista fora do catálogo", () => {
    expect(() => mapearGamificacao({ ...respostaBase, estado: "erro", habilitada: false })).toThrow(
      GamificacaoRecusada,
    );
    expect(() =>
      mapearGamificacao({
        ...respostaBase,
        conquistas: [{ id: "ranking", desbloqueada_em: "2026-08-24T00:00:00Z" }],
      }),
    ).toThrow(/conquista desconhecida/);
  });

  it("recusa piso maior que a meta da dimensão", () => {
    expect(() =>
      mapearGamificacao({
        ...respostaBase,
        anel: {
          ...respostaBase.anel,
          estudo: { ...respostaBase.anel.estudo, piso_meta: 3 },
        },
      }),
    ).toThrow(/piso_meta ultrapassa meta/);
  });
});

describe("discriminação vitalícia e progresso das conquistas", () => {
  it("separa a janela do dia da janela de sempre", () => {
    const dados = mapearGamificacao(
      respostaValida({
        pontos: {
          dia: 0,
          total: 300,
          discriminacao: {
            estudo_prioritario: 0,
            conclusao: 0,
            revisao_no_prazo: 0,
            recuperacao_erro: 0,
          },
          discriminacao_total: {
            estudo_prioritario: 120,
            conclusao: 100,
            revisao_no_prazo: 30,
            recuperacao_erro: 50,
          },
        },
      }),
    );

    // O zero de hoje continua zero — o defeito nunca foi o número, foi a
    // ausência de um total por categoria ao lado dele.
    expect(dados.pontos.dia).toBe(0);
    expect(dados.pontos.discriminacao.conclusao).toBe(0);
    expect(dados.pontos.total).toBe(300);
    expect(dados.pontos.discriminacaoTotal).toEqual({
      estudoPrioritario: 120,
      conclusao: 100,
      revisaoNoPrazo: 30,
      recuperacaoErro: 50,
    });
  });

  it("lê quanto falta para cada conquista e limita o progresso à meta", () => {
    const dados = mapearGamificacao(
      respostaValida({
        progresso_conquistas: {
          primeiro_bloco: { progresso: 1, meta: 1 },
          cem_questoes: { progresso: 38, meta: 100 },
          sequencia_pessoal: { progresso: 99, meta: 7 },
        },
      }),
    );

    const porId = new Map(dados.conquistas.map((c) => [c.id, c]));
    expect(porId.get("cem_questoes")).toMatchObject({ progresso: 38, meta: 100 });
    expect(porId.get("sequencia_pessoal")).toMatchObject({ progresso: 7, meta: 7 });
    // Conquista fora do bloco não vira zero: vira ausência declarada.
    expect(porId.get("primeira_revisao")).toMatchObject({ progresso: null, meta: null });
  });

  it("degrada para ausência quando o servidor ainda não devolve os blocos novos", () => {
    const dados = mapearGamificacao(respostaValida());

    expect(dados.pontos.discriminacaoTotal).toBeNull();
    expect(dados.conquistas.every((c) => c.progresso === null)).toBe(true);
  });
});
