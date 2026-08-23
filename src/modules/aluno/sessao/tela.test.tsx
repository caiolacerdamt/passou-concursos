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

  it("mostra explicação, fonte e saída na conclusão", () => {
    const estado: Extract<EstadoDaResposta, { status: "respondida" }> = {
      status: "respondida",
      sessaoId: "sessao-1",
      itemId: "item-1",
      correta: false,
      duplicada: false,
      respostaCorreta: "B",
      explicacao: {
        texto: "A alternativa B é apoiada pelo documento.",
        alternativaCorreta: "B",
        fontesCitadas: [{ docId: "base:1", trecho: "trecho oficial" }],
      },
      sessaoConcluida: true,
    };

    const html = renderToStaticMarkup(
      <FeedbackDaResposta estado={estado} ultima aoAvancar={() => undefined} />,
    );

    expect(html).toContain("A alternativa B é apoiada pelo documento.");
    expect(html).toContain("base:1");
    expect(html).toContain("Concluir e voltar ao plano");
  });

  it("expõe o aviso em revisão quando a explicação da versão não existe", () => {
    const estado: Extract<EstadoDaResposta, { status: "respondida" }> = {
      status: "respondida",
      sessaoId: "sessao-1",
      itemId: "item-1",
      correta: true,
      duplicada: false,
      respostaCorreta: "A",
      explicacao: null,
      sessaoConcluida: true,
    };

    const html = renderToStaticMarkup(
      <FeedbackDaResposta estado={estado} ultima aoAvancar={() => undefined} />,
    );

    expect(html).toContain("Explicação em revisão");
    expect(html).toContain("gabarito oficial");
  });
});
