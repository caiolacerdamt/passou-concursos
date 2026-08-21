import { describe, expect, it } from "vitest";

import { EXCECOES_DO_APAGAMENTO } from "./grupo-1";

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
});
