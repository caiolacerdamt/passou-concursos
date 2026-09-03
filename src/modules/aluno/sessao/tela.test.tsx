import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/app/sessao/acoes", () => ({
  responderQuestao: vi.fn(),
}));

import type { EstadoDaResposta } from "@/app/app/sessao/acoes";

import { ErroComCausa, FeedbackDaResposta, SessaoTela } from "./tela";
import type { SessaoDaTela } from "../sessao";

const sessao: SessaoDaTela = {
  id: "sessao-1",
  blocoId: "bloco-1",
  contexto: "treino",
  encerradaEm: null,
  totalItens: 1,
  itensRespondidos: 0,
  itens: [
    {
      id: "item-1",
      questaoId: "questao-1",
      questaoVersao: 3,
      ordem: 1,
      somenteLeitura: false,
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
      <FeedbackDaResposta
        estado={estado}
        ultima
        aoAvancar={() => undefined}
        hrefResumo="/app/sessao/sessao-1/resumo"
      />,
    );

    expect(html).toContain("Alternativa correta");
    expect(html).toContain("Ver resumo da sessão");
    expect(html).toContain("/app/sessao/sessao-1/resumo");
    expect(html).not.toContain("Explicação");
  });

  it("marca a alternativa errada como \"Sua resposta\" ao lado do gabarito", () => {
    const estado: Extract<EstadoDaResposta, { status: "respondida" }> = {
      status: "respondida",
      sessaoId: "sessao-1",
      itemId: "item-1",
      correta: false,
      duplicada: false,
      respostaCorreta: "B",
      sessaoConcluida: false,
    };

    const html = renderToStaticMarkup(
      <FeedbackDaResposta
        estado={estado}
        ultima={false}
        aoAvancar={() => undefined}
        hrefResumo="/app/sessao/sessao-1/resumo"
        questao={sessao.itens[0].questao}
        respostaDada="A"
      />,
    );

    expect(html).toContain("Sua resposta");
    expect(html).toContain("Primeira alternativa");
    expect(html).toContain("Segunda alternativa");
  });

  it("não mostra \"Sua resposta\" quando o aluno acertou", () => {
    const estado: Extract<EstadoDaResposta, { status: "respondida" }> = {
      status: "respondida",
      sessaoId: "sessao-1",
      itemId: "item-1",
      correta: true,
      duplicada: false,
      respostaCorreta: "B",
      sessaoConcluida: false,
    };

    const html = renderToStaticMarkup(
      <FeedbackDaResposta
        estado={estado}
        ultima={false}
        aoAvancar={() => undefined}
        hrefResumo="/app/sessao/sessao-1/resumo"
        questao={sessao.itens[0].questao}
        respostaDada="B"
      />,
    );

    expect(html).not.toContain("Sua resposta");
  });

  it("retoma na primeira pendência e mantém as anteriores navegáveis", () => {
    const retomada: SessaoDaTela = {
      ...sessao,
      totalItens: 3,
      itensRespondidos: 2,
      itens: [
        {
          ...sessao.itens[0],
          id: "item-respondido-1",
          somenteLeitura: true,
          respondidoEm: "2026-08-24T12:00:00Z",
          respostaDada: "B",
          correta: false,
          questao: { ...sessao.itens[0].questao, respostaCorreta: "A" },
        },
        {
          ...sessao.itens[0],
          id: "item-pendente-2",
          questaoId: "questao-2",
          ordem: 2,
        },
        {
          ...sessao.itens[0],
          id: "item-respondido-3",
          questaoId: "questao-3",
          ordem: 3,
          somenteLeitura: true,
          respondidoEm: "2026-08-24T12:01:00Z",
          respostaDada: "A",
          correta: true,
          questao: { ...sessao.itens[0].questao, id: "questao-3", respostaCorreta: "A" },
        },
      ],
    };

    const html = renderToStaticMarkup(<SessaoTela sessao={retomada} />);

    expect(html).toContain("Questão <span class=\"font-semibold text-texto\">2</span> de 3");
    expect(html).toContain("2 de 3 respondidas");
    expect(html).toContain('aria-label="Rever questão 1"');
    expect(html).toContain('aria-label="Rever questão 3"');
  });

  it("não pergunta chute antes de responder: quem chuta diz isso na causa (AD-126)", () => {
    const html = renderToStaticMarkup(<SessaoTela sessao={sessao} />);

    expect(html).not.toContain("Marcar como chute");
    expect(html).not.toContain('type="checkbox"');
  });

  it("navega por quadrado numerado, com seta para andar de uma em uma (AD-125)", () => {
    const tres: SessaoDaTela = {
      ...sessao,
      totalItens: 3,
      itens: [
        sessao.itens[0],
        { ...sessao.itens[0], id: "item-2", ordem: 2 },
        { ...sessao.itens[0], id: "item-3", ordem: 3 },
      ],
    };

    const html = renderToStaticMarkup(<SessaoTela sessao={tres} />);

    expect(html).toContain('aria-label="Abrir questão 3"');
    // O número tem que estar no botão: era isso que o tracinho não dava.
    expect(html).toMatch(/aria-current="step"[^>]*>1</);
    expect(html).toContain('aria-label="Questão anterior"');
    expect(html).toContain('aria-label="Próxima questão"');
  });

  it("formata a marcação do enunciado em vez de imprimir os asteriscos", () => {
    const comNegrito: SessaoDaTela = {
      ...sessao,
      itens: [
        {
          ...sessao.itens[0],
          questao: {
            ...sessao.itens[0].questao,
            enunciado: "**Povos da floresta.**\n\nQual alternativa está correta?",
          },
        } as SessaoDaTela["itens"][number],
      ],
    };

    const html = renderToStaticMarkup(<SessaoTela sessao={comNegrito} />);

    expect(html).toContain("<strong");
    expect(html).not.toContain("**Povos");
  });

  it("errou: gabarito e causa na mesma tela, e nada gravado ainda (AD-126)", () => {
    const estado: Extract<EstadoDaResposta, { status: "causa_necessaria" }> = {
      status: "causa_necessaria",
      sessaoId: "sessao-1",
      itemId: "item-1",
      respostaDada: "A",
      respostaCorreta: "B",
      tempoMs: 8100,
      marcouChute: false,
      mensagem: "Diga por que errou antes de seguir.",
    };

    const html = renderToStaticMarkup(
      <ErroComCausa
        estado={estado}
        questao={sessao.itens[0].questao}
        sessaoId="sessao-1"
        itemId="item-1"
        decorridoMs={8100}
        aoConfirmar={() => undefined}
        action={() => undefined}
        pendente={false}
        ultima={false}
      />,
    );

    expect(html).toContain("Gabarito");
    expect(html).toContain("Segunda alternativa");
    expect(html).toContain("Sua resposta");
    expect(html).toContain("Primeira alternativa");
    expect(html).toContain("O que explica este erro?");
    expect(html).toContain('value="chutei"');
    expect(html).toContain("Registrar e continuar");
    expect(html).toContain('value="A"');
  });

  it("envia pausa para o estudo do bloco e refação para o progresso", () => {
    const bloco = renderToStaticMarkup(<SessaoTela sessao={sessao} />);
    const refacao = renderToStaticMarkup(
      <SessaoTela sessao={{ ...sessao, blocoId: null }} />,
    );

    expect(bloco).toContain("/app/estudo?bloco=bloco-1");
    expect(refacao).toContain("/app/progresso");
  });

  it("renderiza resposta anterior sem formulário nem ação de gravação", () => {
    const respondida: SessaoDaTela = {
      ...sessao,
      encerradaEm: "2026-08-24T12:02:00Z",
      itensRespondidos: 1,
      itens: [
        {
          ...sessao.itens[0],
          somenteLeitura: true,
          respondidoEm: "2026-08-24T12:02:00Z",
          respostaDada: "B",
          correta: false,
          questao: { ...sessao.itens[0].questao, respostaCorreta: "A" },
        },
      ],
    };

    const html = renderToStaticMarkup(<SessaoTela sessao={respondida} />);

    expect(html).toContain("Questão já respondida · somente leitura");
    expect(html).toContain("Sua resposta");
    expect(html).toContain("Gabarito");
    expect(html).not.toContain('name="respostaDada"');
    expect(html).not.toContain("Registrar e continuar");
  });
});
