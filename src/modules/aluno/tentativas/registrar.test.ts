import { describe, expect, it, vi } from "vitest";

import {
  type EntradaTentativa,
  TentativaRecusada,
  registrarTentativa,
  validarResposta,
} from "./index";

/**
 * SPEC 05 · T46 — a recusa que acontece **antes** do INSERT (ALUNO-03 AC1).
 *
 * O que estes testes provam e que a recusa nao depende do banco: nenhum deles
 * tem conexao, e o teste de contrato confirma que a chamada nem chega a sair.
 */

function entrada(sobrescreve: Partial<EntradaTentativa> = {}): EntradaTentativa {
  return {
    userId: "11111111-1111-1111-1111-111111111111",
    sessaoItemId: "22222222-2222-2222-2222-222222222222",
    contexto: "treino",
    respostaDada: "A",
    ...sobrescreve,
  };
}

describe("validarResposta — o que e recusado antes de gravar", () => {
  it("errar no treino sem causa e recusado, com motivo nomeado (ALUNO-03 AC1)", () => {
    try {
      validarResposta(entrada(), { tipoQuestao: "multipla_escolha", acertou: false });
      expect.unreachable("deveria ter recusado");
    } catch (erro) {
      expect(erro).toBeInstanceOf(TentativaRecusada);
      expect((erro as TentativaRecusada).motivo).toBe("causa_obrigatoria");
      // A mensagem e o que a tela mostra: precisa dizer que "nao sei" vale.
      expect((erro as TentativaRecusada).message).toMatch(/nao sei dizer/i);
    }
  });

  it("'nao_sei_dizer' e causa valida, nao um pulo (ALUNO-03 AC4)", () => {
    expect(() =>
      validarResposta(entrada({ causaErro: "nao_sei_dizer" }), {
        tipoQuestao: "multipla_escolha",
        acertou: false,
      }),
    ).not.toThrow();
  });

  it("as seis causas do ALUNO-04 AC2 sao todas aceitas", () => {
    const causas = [
      "nao_sabia_conteudo",
      "errei_a_conta",
      "entendi_errado_enunciado",
      "confundi_conceitos",
      "fiquei_na_duvida",
      "chutei",
    ] as const;
    for (const causa of causas) {
      expect(() =>
        validarResposta(entrada({ causaErro: causa }), {
          tipoQuestao: "multipla_escolha",
          acertou: false,
        }),
      ).not.toThrow();
    }
  });

  it("'faltou_tempo' e recusado — so existe na revisao pos-prova (ALUNO-04 AC3)", () => {
    try {
      validarResposta(
        entrada({
          contexto: "simulado",
          causaErro: "faltou_tempo" as never,
        }),
        { tipoQuestao: "multipla_escolha", acertou: false },
      );
      expect.unreachable("deveria ter recusado");
    } catch (erro) {
      expect((erro as TentativaRecusada).motivo).toBe("causa_invalida");
    }
  });

  it("diagnostico e simulado gravam erro sem causa — nao interrompem", () => {
    for (const contexto of ["diagnostico", "simulado"] as const) {
      expect(() =>
        validarResposta(entrada({ contexto }), {
          tipoQuestao: "multipla_escolha",
          acertou: false,
        }),
      ).not.toThrow();
    }
  });

  it("acertar no treino nao pede causa", () => {
    expect(() =>
      validarResposta(entrada(), { tipoQuestao: "multipla_escolha", acertou: true }),
    ).not.toThrow();
  });

  it("causa em resposta certa e recusada", () => {
    try {
      validarResposta(entrada({ causaErro: "chutei" }), {
        tipoQuestao: "multipla_escolha",
        acertou: true,
      });
      expect.unreachable("deveria ter recusado");
    } catch (erro) {
      expect((erro as TentativaRecusada).motivo).toBe("causa_so_com_erro");
    }
  });

  it("letra fora do tipo da questao e recusada, e a letra certa passa", () => {
    try {
      validarResposta(entrada({ respostaDada: "D" }), {
        tipoQuestao: "certo_errado",
        acertou: true,
      });
      expect.unreachable("deveria ter recusado");
    } catch (erro) {
      expect((erro as TentativaRecusada).motivo).toBe("resposta_invalida");
    }

    expect(() =>
      validarResposta(entrada({ respostaDada: "E" }), {
        tipoQuestao: "certo_errado",
        acertou: true,
      }),
    ).not.toThrow();
    expect(() =>
      validarResposta(entrada({ respostaDada: "E" }), {
        tipoQuestao: "multipla_escolha",
        acertou: true,
      }),
    ).not.toThrow();
  });

  it("contexto que nao existe e recusado", () => {
    try {
      validarResposta(entrada({ contexto: "estudo_livre" as never }), {
        tipoQuestao: "multipla_escolha",
        acertou: true,
      });
      expect.unreachable("deveria ter recusado");
    } catch (erro) {
      expect((erro as TentativaRecusada).motivo).toBe("contexto_invalido");
    }
  });
});

describe("registrarTentativa — o que sai e o que entra", () => {
  it("nao chama o banco quando a entrada ja e invalida", async () => {
    const rpc = vi.fn();
    await expect(
      registrarTentativa(entrada({ causaErro: "faltou_tempo" as never }), {
        rpc,
      } as never),
    ).rejects.toBeInstanceOf(TentativaRecusada);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("manda a entrada para a funcao SQL e devolve o resultado tal como veio", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          tentativa_id: "33333333-3333-3333-3333-333333333333",
          respondida_em: "2026-08-17T12:00:00+00:00",
          correta: false,
          duplicada: false,
        },
      ],
      error: null,
    });

    const resultado = await registrarTentativa(
      entrada({ causaErro: "errei_a_conta", tempoMs: 8100, marcouChute: true }),
      { rpc } as never,
    );

    expect(rpc).toHaveBeenCalledWith("registrar_tentativa", {
      p_user_id: "11111111-1111-1111-1111-111111111111",
      p_sessao_item_id: "22222222-2222-2222-2222-222222222222",
      p_contexto: "treino",
      p_resposta: "A",
      p_tempo_ms: 8100,
      p_marcou_chute: true,
      p_causa: "errei_a_conta",
    });
    expect(resultado).toEqual({
      tentativaId: "33333333-3333-3333-3333-333333333333",
      respondidaEm: "2026-08-17T12:00:00+00:00",
      correta: false,
      duplicada: false,
    });
  });

  it("nao inventa gabarito: `correta` vem do banco, nunca do chamador", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          tentativa_id: "44444444-4444-4444-4444-444444444444",
          respondida_em: "2026-08-17T12:00:00+00:00",
          correta: true,
          duplicada: false,
        },
      ],
      error: null,
    });

    const resultado = await registrarTentativa(entrada({ contexto: "plano" }), {
      rpc,
    } as never);

    expect(resultado.correta).toBe(true);
    // Nenhum parametro enviado carrega o gabarito (invariante nº4).
    expect(JSON.stringify(rpc.mock.calls[0][1])).not.toMatch(/correta|gabarito/);
  });

  it("traduz a recusa da funcao SQL em `causa_obrigatoria` (ALUNO-03 AC1)", async () => {
    // O modulo nao conhece o gabarito (invariante nº4), entao quem sabe que o
    // aluno errou no treino e a funcao SQL. O papel daqui e transformar a
    // excecao dela em motivo nomeado, para a tela pedir a causa em vez de
    // mostrar erro de banco.
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        message:
          'causa_obrigatoria: diga por que errou antes de seguir; "nao sei dizer" vale como resposta (ALUNO-03 AC1)',
      },
    });

    try {
      await registrarTentativa(entrada(), { rpc } as never);
      expect.unreachable("deveria ter recusado");
    } catch (erro) {
      expect(erro).toBeInstanceOf(TentativaRecusada);
      expect((erro as TentativaRecusada).motivo).toBe("causa_obrigatoria");
      expect((erro as TentativaRecusada).message).toMatch(/nao sei dizer/i);
    }
  });

  it("nao estoura com `undefined` quando a funcao devolve linha nenhuma", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    await expect(registrarTentativa(entrada({ contexto: "plano" }), { rpc } as never))
      .rejects.toThrow(/linha nenhuma/);
  });

  it("traduz o item inexistente em recusa nomeada, nao em erro de banco", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "item_inexistente: item ... nao existe para este aluno" },
    });

    try {
      await registrarTentativa(entrada({ contexto: "plano" }), { rpc } as never);
      expect.unreachable("deveria ter recusado");
    } catch (erro) {
      expect((erro as TentativaRecusada).motivo).toBe("item_inexistente");
    }
  });
});
