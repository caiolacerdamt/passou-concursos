import { describe, expect, it } from "vitest";

import { contextoDaMatricula, diasAteOFim } from "./contexto";

function cliente(opcoes: {
  linha?: { id: string; estado: string; fim_em: string; tipo: "pago" | "trial" } | null;
  restante?: unknown;
  erroDoRpc?: boolean;
  chamadasDoRpc?: string[];
}) {
  const construtor = {
    select: () => construtor,
    eq: () => construtor,
    gt: () => construtor,
    maybeSingle: async () => ({ data: opcoes.linha ?? null }),
  };

  return {
    auth: { getUser: async () => ({ data: { user: { id: "a" } } }) },
    from: () => construtor,
    rpc: async (nome: string) => {
      opcoes.chamadasDoRpc?.push(nome);
      if (opcoes.erroDoRpc) return { data: null, error: new Error("indisponivel") };
      return { data: opcoes.restante ?? null, error: null };
    },
  };
}

const DAQUI_A = (ms: number) => new Date(Date.now() + ms).toISOString();
const HORA = 60 * 60 * 1000;

describe("diasAteOFim", () => {
  it("arredonda para cima: faltando 6h ainda e 1 dia", () => {
    const agora = new Date("2026-09-05T12:00:00Z");
    expect(diasAteOFim("2026-09-05T18:00:00Z", agora)).toBe(1);
  });

  it("conta os dias inteiros que faltam", () => {
    const agora = new Date("2026-09-05T12:00:00Z");
    expect(diasAteOFim("2026-09-12T12:00:00Z", agora)).toBe(7);
  });

  /** Prazo vencido nunca vira numero negativo na tela. */
  it("nao devolve numero negativo", () => {
    const agora = new Date("2026-09-05T12:00:00Z");
    expect(diasAteOFim("2026-09-01T12:00:00Z", agora)).toBe(0);
  });

  it("data ilegivel vira zero, nao NaN", () => {
    expect(diasAteOFim("nao e data")).toBe(0);
  });
});

describe("contextoDaMatricula", () => {
  it("matricula paga nao e trial e nao tem teto nem contagem", async () => {
    const chamadasDoRpc: string[] = [];
    const contexto = await contextoDaMatricula(
      cliente({
        linha: { id: "m1", estado: "ativa", fim_em: DAQUI_A(300 * 24 * HORA), tipo: "pago" },
        chamadasDoRpc,
      }),
    );

    expect(contexto.ehTrial).toBe(false);
    expect(contexto.diasRestantes).toBeNull();
    expect(contexto.questoesRestantesHoje).toBeNull();
    // Quem pagou nao tem teto: perguntar ao banco por ele e round-trip a toa.
    expect(chamadasDoRpc).toEqual([]);
  });

  it("matricula de trial devolve os dias e o restante do dia", async () => {
    const contexto = await contextoDaMatricula(
      cliente({
        linha: { id: "m1", estado: "ativa", fim_em: DAQUI_A(3 * 24 * HORA), tipo: "trial" },
        restante: 5,
      }),
    );

    expect(contexto.ehTrial).toBe(true);
    expect(contexto.diasRestantes).toBe(3);
    expect(contexto.questoesRestantesHoje).toBe(5);
  });

  it("sem matricula nenhuma o contexto e vazio, e nao estoura", async () => {
    const contexto = await contextoDaMatricula(cliente({ linha: null }));

    expect(contexto.matricula).toBeNull();
    expect(contexto.tipo).toBeNull();
    expect(contexto.ehTrial).toBe(false);
  });

  /**
   * Numero errado na faixa e pior que numero nenhum: "faltam 3 questoes" quando
   * faltam 12 faz o aluno parar de estudar por engano.
   */
  it("falha ao ler o restante do dia apaga o numero, nao a tela", async () => {
    const contexto = await contextoDaMatricula(
      cliente({
        linha: { id: "m1", estado: "ativa", fim_em: DAQUI_A(2 * 24 * HORA), tipo: "trial" },
        erroDoRpc: true,
      }),
    );

    expect(contexto.ehTrial).toBe(true);
    expect(contexto.diasRestantes).toBe(2);
    expect(contexto.questoesRestantesHoje).toBeNull();
  });
});
