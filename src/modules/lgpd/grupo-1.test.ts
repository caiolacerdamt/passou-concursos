import { describe, expect, it } from "vitest";

import { EXCECOES_DO_APAGAMENTO, TABELAS_GRUPO_1 } from "./grupo-1";

describe("exceções financeiras da retenção", () => {
  it("registra pagamentos, aceite, eventos, transições, faturas e pendências", () => {
    expect(EXCECOES_DO_APAGAMENTO.map((item) => item.tabela)).toEqual([
      "pagamentos",
      "pagamento_aceites",
      "pagamento_eventos",
      "pagamento_transicoes",
      "faturas",
      "pagamento_pendencias",
    ]);
    for (const item of EXCECOES_DO_APAGAMENTO) {
      expect(item.motivo.length).toBeGreaterThan(20);
    }
  });

  it("inclui todas as projeções e o log de gamificação no grupo 1", () => {
    expect(TABELAS_GRUPO_1).toEqual(
      expect.arrayContaining([
        "gamificacao_dia",
        "gamificacao_ponto_evento",
        "gamificacao_pontos_dia",
        "gamificacao_pontos",
        "gamificacao_missao_dia",
        "gamificacao_conquistas",
      ]),
    );
  });
});
