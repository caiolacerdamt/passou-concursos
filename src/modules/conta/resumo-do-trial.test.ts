import { describe, expect, it } from "vitest";

import {
  consultarResumoDoTrial,
  temAlgoAContar,
  type ResumoDoTrial,
} from "./resumo-do-trial";

type Tabelas = Record<string, { data?: unknown[]; error?: unknown }>;

function leitor(tabelas: Tabelas, colunasPedidas: string[] = []) {
  return {
    from(tabela: string) {
      const resposta = tabelas[tabela] ?? { data: [] };
      const consulta = {
        select(colunas: string) {
          colunasPedidas.push(`${tabela}:${colunas}`);
          return consulta;
        },
        limit() {
          return consulta;
        },
        then<T>(fn: (r: { data: unknown; error: unknown }) => T) {
          return Promise.resolve(
            fn({ data: resposta.data ?? [], error: resposta.error ?? null }),
          );
        },
      };
      return consulta;
    },
  };
}

const TENTATIVAS = [
  { respondida_em: "2026-09-01T14:00:00Z", correta: true },
  { respondida_em: "2026-09-01T15:00:00Z", correta: false },
  { respondida_em: "2026-09-02T14:00:00Z", correta: true },
];

describe("consultarResumoDoTrial", () => {
  it("conta dias, questoes, acertos, assuntos fracos, caderno e revisoes", async () => {
    const resumo = await consultarResumoDoTrial(
      leitor({
        tentativas: { data: TENTATIVAS },
        dominio_topico: {
          data: [
            { score: 0.2, n_respostas: 10 },
            { score: 0.95, n_respostas: 10 },
          ],
        },
        caderno_erros: {
          data: [{ topico_id: "t1" }, { topico_id: "t1" }, { topico_id: "t2" }],
        },
        revisao_agenda: { data: [{ topico_id: "t1" }, { topico_id: "t2" }] },
      }),
    );

    expect(resumo).toEqual<ResumoDoTrial>({
      diasEstudados: 2,
      questoesRespondidas: 3,
      acertos: 2,
      assuntosFracos: 1,
      // O caderno tem grão (topico, causa): duas linhas do mesmo topico sao um
      // assunto so. Contar linha diria "3 assuntos" para quem tem 2.
      assuntosNoCaderno: 2,
      revisoesAgendadas: 2,
    });
  });

  /**
   * Numeros, nunca conteudo (item 5 do TRIAL-2): acervo e o que fechou no dia 7.
   * Se alguem acrescentar `questoes` ou `enunciado` a esta leitura, a tela do
   * dia 7 passa a mostrar o que o aluno nao pode mais ver.
   */
  it("nao le nenhuma coluna de acervo", async () => {
    const colunas: string[] = [];
    await consultarResumoDoTrial(
      leitor({ tentativas: { data: TENTATIVAS } }, colunas),
    );

    expect(colunas.join(" ")).not.toMatch(/enunciado|alternativa|explicacao|questoes/);
  });

  /** Zero inventado diria ao aluno que ele nao construiu nada. */
  it("leitura que falha devolve null, e nao um resumo de zeros", async () => {
    const resumo = await consultarResumoDoTrial(
      leitor({ tentativas: { error: new Error("indisponivel") } }),
    );

    expect(resumo).toBeNull();
  });
});

describe("temAlgoAContar", () => {
  it("resumo sem nenhuma tentativa nao vira tela de numeros", () => {
    expect(
      temAlgoAContar({
        diasEstudados: 0,
        questoesRespondidas: 0,
        acertos: 0,
        assuntosFracos: 0,
        assuntosNoCaderno: 0,
        revisoesAgendadas: 0,
      }),
    ).toBe(false);
  });

  it("null nao vira tela de numeros", () => {
    expect(temAlgoAContar(null)).toBe(false);
  });
});
