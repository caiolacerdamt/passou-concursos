import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/app/sessao/acoes", () => ({
  responderQuestao: vi.fn(),
}));

import type { EstadoDaResposta } from "@/app/app/sessao/acoes";

import { FeedbackDaResposta, SessaoTela } from "./tela";
import type { SessaoDaTela } from "../sessao";

const sessao: SessaoDaTela = {
  id: "sessao-1",
  blocoId: "bloco-1",
  contexto: "treino",
  encerradaEm: null,
  itens: [
    {
      id: "item-1",
      questaoId: "questao-1",
      questaoVersao: 3,
      ordem: 1,
      respondidoEm: null,
      questao: {
        id: "questao-1",
        questaoVersao: 3,
        origem: "real",
        topicoId: "topico-1",
        tipoQuestao: "multipla_escolha",
        enunciado: "Qual alternativa está correta?",
        alternativas: [
          { letra: "A", texto: "Primeira alternativa" },
          { letra: "B", texto: "Segunda alternativa" },
        ],
        fonteCitacao: {
          banca: "CESGRANRIO",
          ano: 2024,
          orgao: "Banco do Brasil",
          cargo: "Escriturário",
          numero: 7,
        },
        imagens: [
          {
            posicao: "enunciado",
            altText: "Gráfico oficial",
            url: "https://signed.test/grafico.jpg",
          },
        ],
      },
    },
  ],
};

describe("tela da sessão", () => {
  it("mantém questão, proveniência, alternativas e imagem legíveis", () => {
    const html = renderToStaticMarkup(<SessaoTela sessao={sessao} />);

    expect(html).toContain("CESGRANRIO · 2024 · Banco do Brasil");
    expect(html).toContain("Qual alternativa está correta?");
    expect(html).toContain("Primeira alternativa");
    expect(html).toContain('alt="Gráfico oficial"');
    expect(html).toContain('name="respostaDada"');
    expect(html).not.toContain("respostaCorreta");
  });

  it("mostra apenas gabarito e saída na conclusão, sem explicação", () => {
    const estado: Extract<EstadoDaResposta, { status: "respondida" }> = {
      status: "respondida",
      sessaoId: "sessao-1",
      itemId: "item-1",
      correta: false,
      duplicada: false,
      respostaCorreta: "B",
      sessaoConcluida: true,
    };

    const html = renderToStaticMarkup(
      <FeedbackDaResposta estado={estado} ultima aoAvancar={() => undefined} />,
    );

    expect(html).toContain("Alternativa correta");
    expect(html).toContain("Concluir e voltar ao plano");
    expect(html).not.toContain("Explicação");
  });
});
