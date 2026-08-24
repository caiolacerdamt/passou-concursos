import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CATALOGO_DE_CONQUISTAS, type DadosGamificacao } from "./gamificacao";
import type { PainelDoDia } from "./painel-do-dia";
import { GamificacaoNoProgresso, PainelDoDiaTela } from "./painel-do-dia-tela";

function dimensao(progresso: number, meta: number) {
  return {
    progresso,
    meta,
    bruto: progresso,
    percentual: meta === 0 ? 0 : progresso / meta,
    concluido: meta > 0 && progresso >= meta,
  };
}

const gamificacao: DadosGamificacao = {
  data: "2026-08-24",
  habilitada: true,
  estado: "ok",
  anel: { estudo: dimensao(1, 2), questoes: dimensao(10, 10), revisao: dimensao(0, 1) },
  pontos: {
    dia: 30,
    total: 145,
    discriminacao: {
      estudoPrioritario: 40,
      conclusao: 60,
      revisaoNoPrazo: 20,
      recuperacaoErro: 25,
    },
  },
  missao: {
    id: "missao-1",
    tipo: "concluir_piso",
    progresso: 1,
    progressoBruto: 1,
    meta: 2,
    estado: "em_andamento",
  },
  sequencia: {
    data: "2026-08-24",
    sequencia: 4,
    estado: "piso_pendente",
    pisoEntregue: true,
    pisoCumprido: false,
    temHistorico: true,
  },
  conquistas: CATALOGO_DE_CONQUISTAS.map((conquista, indice) => ({
    ...conquista,
    desbloqueada: indice === 0,
    desbloqueadaEm: indice === 0 ? "2026-08-20T12:00:00.000Z" : null,
  })),
};

const painel: PainelDoDia = {
  contagem: { dataProva: "2026-09-10", dias: 17, estado: "futura" },
  gamificacao,
  relatorioSemanal: {
    inicio: "2026-08-17T12:00:00.000Z",
    fim: "2026-08-24T12:00:00.000Z",
    questoesRespondidas: 12,
    acertos: 9,
    percentualAcertos: 0.75,
    topicosTocados: 3,
    revisoesConcluidas: 2,
    tendencia: "subindo",
  },
  recuperacao: [
    {
      topicoId: "11111111-1111-4111-8111-111111111111",
      topico: "Concordância verbal",
      causa: "errei_a_conta",
      nErros: 3,
      ultimoErroEm: "2026-08-23T10:00:00.000Z",
    },
  ],
  acompanhamentoIndisponivel: false,
};

describe("PainelDoDiaTela", () => {
  it("mostra contagem da prova, anel, semana e atalho de recuperação", () => {
    const html = renderToStaticMarkup(<PainelDoDiaTela painel={painel} />);

    expect(html).toContain("17 dias para a prova");
    expect(html).toContain("Anel de hoje");
    expect(html).toContain("30 pontos hoje");
    expect(html).toContain("Concluir o essencial de hoje");
    expect(html).toContain("4 dias de sequência");
    expect(html).toContain("Sua semana até aqui");
    expect(html).toContain("Tendência: Subindo");
    expect(html).toContain("Concordância verbal");
    expect(html).toContain("Errei a conta");
    expect(html).toContain(
      "/app/sessao?refacao=1&amp;topico=11111111-1111-4111-8111-111111111111&amp;causa=errei_a_conta",
    );
    expect(html).toContain("/app/progresso");
  });

  it("cala a contagem quando não há data e não mostra gamificação desligada", () => {
    const html = renderToStaticMarkup(
      <PainelDoDiaTela
        painel={{
          ...painel,
          contagem: { dataProva: null, dias: null, estado: "indefinida" },
          gamificacao: null,
          recuperacao: [],
        }}
      />,
    );

    expect(html).toContain("Data da prova ainda não definida");
    expect(html).not.toContain("Anel de hoje");
    expect(html).not.toContain("Erros que merecem outra chance");
    expect(html).toContain("Sua semana até aqui");
  });

  it("avisa quando o acompanhamento não pôde ser lido", () => {
    const html = renderToStaticMarkup(
      <PainelDoDiaTela
        painel={{
          ...painel,
          relatorioSemanal: null,
          recuperacao: [],
          acompanhamentoIndisponivel: true,
        }}
      />,
    );

    expect(html).toContain("Não foi possível carregar seu acompanhamento agora");
    expect(html).not.toContain("Sua semana até aqui");
  });

  it("trata prova de hoje e prova passada sem número negativo na tela", () => {
    const hoje = renderToStaticMarkup(
      <PainelDoDiaTela painel={{ ...painel, contagem: { dataProva: "2026-08-24", dias: 0, estado: "hoje" } }} />,
    );
    const passada = renderToStaticMarkup(
      <PainelDoDiaTela painel={{ ...painel, contagem: { dataProva: "2026-08-20", dias: -4, estado: "passada" } }} />,
    );

    expect(hoje).toContain("A prova é hoje");
    expect(passada).toContain("A data da prova já passou");
    expect(passada).not.toContain("-4 dias");
  });
});

describe("GamificacaoNoProgresso", () => {
  it("abre a origem dos pontos e o estado das conquistas", () => {
    const html = renderToStaticMarkup(<GamificacaoNoProgresso dados={gamificacao} />);

    expect(html).toContain("Pontos e conquistas");
    expect(html).toContain("145 no total");
    expect(html).toContain("Recuperação de erro");
    expect(html).toContain("Primeiro bloco");
    expect(html).toContain("Desbloqueada");
    expect(html).toContain("Ainda não");
  });
});
