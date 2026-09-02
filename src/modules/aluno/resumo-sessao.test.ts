import { describe, expect, it, vi } from "vitest";

import { consultarResumoDaSessao } from "./resumo-sessao";

type Resposta = { data: unknown; error: { message: string } | null };

// O falso precisa obedecer à lista de colunas do `select`: um falso que devolve
// o fixture inteiro esconde exatamente a classe de bug que derrubou o resumo —
// campo declarado no tipo, ausente da consulta.
function apenasAsColunas(dado: unknown, colunas: string): unknown {
  const pedidas = colunas.split(",").map((coluna) => coluna.trim()).filter(Boolean);
  const projetar = (linha: unknown): unknown => {
    if (linha === null || typeof linha !== "object") return linha;
    const origem = linha as Record<string, unknown>;
    const destino: Record<string, unknown> = {};
    for (const coluna of pedidas) {
      if (coluna in origem) destino[coluna] = origem[coluna];
    }
    return destino;
  };
  return Array.isArray(dado) ? dado.map(projetar) : projetar(dado);
}

function clienteCom(respostas: Record<string, Resposta>) {
  const from = vi.fn((tabela: string) => {
    const resposta = respostas[tabela] ?? { data: [], error: null };
    const select = vi.fn((colunas: string) => {
      const projetada: Resposta = {
        data: apenasAsColunas(resposta.data, colunas),
        error: resposta.error,
      };
      const consulta = {
        eq: vi.fn(() => consulta),
        in: vi.fn(() => consulta),
        not: vi.fn(() => consulta),
        order: vi.fn(() => consulta),
        maybeSingle: vi.fn(async () => projetada),
        then: (
          resolve: (valor: Resposta) => unknown,
          reject: (erro: unknown) => unknown,
        ) => Promise.resolve(projetada).then(resolve, reject),
      };
      return consulta;
    });
    return { select };
  });

  const rpc = vi.fn(async () => ({ data: [], error: null }));

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
  it("entrega placar e questões na ordem com resposta, gabarito e fonte, sem explicação", async () => {
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
          topico_id: "topico-1",
          ordem_na_sessao: 1,
            resposta_dada: "B",
            correta: false,
            causa_erro: "errei_a_conta",
          },
          {
          questao_id: "questao-2",
          questao_versao: 1,
          topico_id: "topico-1",
          ordem_na_sessao: 2,
            resposta_dada: "C",
            correta: true,
            causa_erro: null,
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
            alternativas: [
              { letra: "A", texto: "R$ 100,00" },
              { letra: "B", texto: "R$ 200,00" },
              { letra: "C", texto: "R$ 300,00" },
              { letra: "D", texto: "R$ 400,00" },
            ],
            fonte_citacao: FONTE,
            resposta_correta: "D",
          },
          {
            id: "questao-2",
            questao_versao: 1,
            origem: "real",
            tipo_questao: "certo_errado",
            enunciado: "A afirmação está correta.",
            alternativas: null,
            fonte_citacao: { ...FONTE, numero: 29 },
            resposta_correta: "C",
          },
        ],
        error: null,
      },
      revisao_agenda: {
        data: [{ topico_id: "topico-1", due: "2026-08-30" }],
        error: null,
      },
    });

    const { rpc } = { rpc: (cliente as { rpc: ReturnType<typeof vi.fn> }).rpc };

    await expect(consultarResumoDaSessao(cliente as never, "sessao-1")).resolves.toEqual({
      id: "sessao-1",
      blocoId: "bloco-1",
      encerradaEm: "2026-08-23T21:00:00.000Z",
      proximaRevisao: "2026-08-30",
      nQuestoes: 2,
      nAcertos: 1,
      itens: [
        {
          ordem: 1,
          respostaDada: "B",
          correta: false,
          causaErro: "errei_a_conta",
          questao: {
            id: "questao-1",
            questaoVersao: 2,
            origem: "real",
            tipoQuestao: "multipla_escolha",
            enunciado: "Quanto deverá pagar?",
            alternativas: [
              { letra: "A", texto: "R$ 100,00" },
              { letra: "B", texto: "R$ 200,00" },
              { letra: "C", texto: "R$ 300,00" },
              { letra: "D", texto: "R$ 400,00" },
            ],
            fonteCitacao: FONTE,
            respostaCorreta: "D",
          },
        },
        {
          ordem: 2,
          respostaDada: "C",
          correta: true,
          causaErro: null,
          questao: {
            id: "questao-2",
            questaoVersao: 1,
            origem: "real",
            tipoQuestao: "certo_errado",
            enunciado: "A afirmação está correta.",
            alternativas: null,
            fonteCitacao: { ...FONTE, numero: 29 },
            respostaCorreta: "C",
          },
        },
      ],
    });
    expect(rpc).not.toHaveBeenCalled();
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

  it("não mostra revisão para contexto que não agenda revisão", async () => {
    const { cliente, from } = clienteCom({
      sessoes: {
        data: {
          id: "sessao-simulado",
          plano_bloco_id: null,
          contexto: "simulado",
          encerrada_em: "2026-08-23T21:00:00.000Z",
        },
        error: null,
      },
      tentativas: {
        data: [
          {
            questao_id: "questao-1",
            questao_versao: 1,
            topico_id: "topico-1",
            ordem_na_sessao: 1,
            resposta_dada: "A",
            correta: true,
          },
        ],
        error: null,
      },
      questoes: {
        data: [
          {
            id: "questao-1",
            questao_versao: 1,
            origem: "real",
            tipo_questao: "certo_errado",
            enunciado: "A afirmação está correta.",
            fonte_citacao: FONTE,
            resposta_correta: "A",
          },
        ],
        error: null,
      },
    });

    await expect(consultarResumoDaSessao(cliente as never, "sessao-simulado")).resolves.toMatchObject({
      proximaRevisao: null,
    });
    expect(from).not.toHaveBeenCalledWith("revisao_agenda");
  });
});
