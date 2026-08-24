import { describe, expect, it, vi } from "vitest";

import { consultarResumoDaSessao } from "./resumo-sessao";

type Resposta = { data: unknown; error: { message: string } | null };

function clienteCom(respostas: Record<string, Resposta>) {
  const from = vi.fn((tabela: string) => {
    const resposta = respostas[tabela] ?? { data: [], error: null };
    const consulta = {
      eq: vi.fn(() => consulta),
      in: vi.fn(() => consulta),
      not: vi.fn(() => consulta),
      order: vi.fn(() => consulta),
      maybeSingle: vi.fn(async () => resposta),
      then: (
        resolve: (valor: Resposta) => unknown,
        reject: (erro: unknown) => unknown,
      ) => Promise.resolve(resposta).then(resolve, reject),
    };
    return { select: vi.fn(() => consulta) };
  });

  const rpc = vi.fn(async (_nome: string, args: { p_questao_id: string }) => {
    return respostas[`explicacao:${args.p_questao_id}`] ?? { data: [], error: null };
  });

  return { cliente: { from, rpc }, from, rpc };
}

const FONTE = {
  banca: "Fundação Cesgranrio",
  ano: 2021,
  orgao: "Banco do Brasil",
  cargo: "Escriturário",
  numero: 28,
};

describe("consultarResumoDaSessao", () => {
  it("entrega placar e questões na ordem com resposta, gabarito, fonte e explicação", async () => {
    const { cliente } = clienteCom({
      sessoes: {
        data: {
          id: "sessao-1",
          plano_bloco_id: "bloco-1",
          contexto: "plano",
          encerrada_em: "2026-08-23T21:00:00.000Z",
        },
        error: null,
      },
      tentativas: {
        data: [
          {
            questao_id: "questao-1",
            questao_versao: 2,
            ordem_na_sessao: 1,
            resposta_dada: "B",
            correta: false,
          },
          {
            questao_id: "questao-2",
            questao_versao: 1,
            ordem_na_sessao: 2,
            resposta_dada: "C",
            correta: true,
          },
        ],
        error: null,
      },
      questoes: {
        data: [
          {
            id: "questao-1",
            questao_versao: 2,
            origem: "real",
            tipo_questao: "multipla_escolha",
            enunciado: "Quanto deverá pagar?",
            fonte_citacao: FONTE,
            resposta_correta: "D",
          },
          {
            id: "questao-2",
            questao_versao: 1,
            origem: "real",
            tipo_questao: "certo_errado",
            enunciado: "A afirmação está correta.",
            fonte_citacao: { ...FONTE, numero: 29 },
            resposta_correta: "C",
          },
        ],
        error: null,
      },
      "explicacao:questao-1": {
        data: [{
          texto: "A multa e os juros levam ao total da alternativa D.",
          alternativa_correta: "D",
          fontes_citadas: [{ doc_id: "ref-1", trecho: "Juros simples" }],
        }],
        error: null,
      },
    });

    await expect(consultarResumoDaSessao(cliente as never, "sessao-1")).resolves.toEqual({
      id: "sessao-1",
      blocoId: "bloco-1",
      encerradaEm: "2026-08-23T21:00:00.000Z",
      nQuestoes: 2,
      nAcertos: 1,
      itens: [
        {
          ordem: 1,
          respostaDada: "B",
          correta: false,
          questao: {
            id: "questao-1",
            questaoVersao: 2,
            origem: "real",
            tipoQuestao: "multipla_escolha",
            enunciado: "Quanto deverá pagar?",
            fonteCitacao: FONTE,
            respostaCorreta: "D",
          },
          explicacao: {
            texto: "A multa e os juros levam ao total da alternativa D.",
            alternativaCorreta: "D",
            fontesCitadas: [{ docId: "ref-1", trecho: "Juros simples" }],
          },
        },
        {
          ordem: 2,
          respostaDada: "C",
          correta: true,
          questao: {
            id: "questao-2",
            questaoVersao: 1,
            origem: "real",
            tipoQuestao: "certo_errado",
            enunciado: "A afirmação está correta.",
            fonteCitacao: { ...FONTE, numero: 29 },
            respostaCorreta: "C",
          },
          explicacao: null,
        },
      ],
    });
  });

  it("não consulta respostas nem gabarito quando a sessão encerrada não está acessível", async () => {
    const { cliente, from, rpc } = clienteCom({
      sessoes: { data: null, error: null },
    });

    await expect(consultarResumoDaSessao(cliente as never, "sessao-alheia")).resolves.toBeNull();
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("sessoes");
    expect(rpc).not.toHaveBeenCalled();
  });
});
