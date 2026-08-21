import { describe, expect, it } from "vitest";

import {
  EVENTOS_DO_FUNIL,
  normalizarEventoDoFunil,
} from "./funil";

describe("allowlist do funil", () => {
  it("aceita exatamente os quatro eventos públicos", () => {
    for (const evento of EVENTOS_DO_FUNIL) {
      const resultado = normalizarEventoDoFunil({ evento });
      expect(resultado).toMatchObject({ aceito: true, evento });
    }

    expect(normalizarEventoDoFunil({ evento: "login_realizado" })).toEqual({
      aceito: false,
      motivo: "entrada_invalida",
      quantidadeDescartada: 0,
    });
  });

  it("mantém só meio permitido e descarta PII e chaves desconhecidas", () => {
    const resultado = normalizarEventoDoFunil({
      evento: "meio_escolhido",
      propriedades: {
        meio: "PIX",
        email: "aluno@exemplo.com",
        nome: "Aluno",
        cpf: "123",
        telefone: "999",
        user_id: "abc",
        pagamento_id: "pag_1",
      },
    });

    expect(resultado).toEqual({
      aceito: true,
      evento: "meio_escolhido",
      propriedades: { meio: "PIX" },
      quantidadeDescartada: 6,
    });
  });

  it("não aceita propriedades na página vista e rejeita meio inválido", () => {
    expect(
      normalizarEventoDoFunil({
        evento: "pagina_vista",
        propriedades: { meio: "PIX" },
      }),
    ).toMatchObject({
      aceito: true,
      propriedades: {},
      quantidadeDescartada: 1,
    });
    expect(
      normalizarEventoDoFunil({
        evento: "meio_escolhido",
        propriedades: { meio: "DINHEIRO" },
      }),
    ).toMatchObject({ aceito: true, propriedades: {} });
  });
});
