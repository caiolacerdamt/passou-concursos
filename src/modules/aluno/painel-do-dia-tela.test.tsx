import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CATALOGO_DE_CONQUISTAS, type DadosGamificacao } from "./gamificacao";
import type { PainelDoDia } from "./painel-do-dia";
import { AcompanhamentoDoDia, CartaoDoDia, GamificacaoNoProgresso } from "./painel-do-dia-tela";

function dimensao(progresso: number, meta: number, pisoMeta = 0, pisoProgresso = 0) {
  return {
    progresso,
    meta,
    pisoMeta,
    pisoProgresso,
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
    discriminacaoTotal: {
      estudoPrioritario: 60,
      conclusao: 60,
      revisaoNoPrazo: 20,
      recuperacaoErro: 5,
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
    progresso: indice === 0 ? 1 : 38,
    meta: indice === 0 ? 1 : 100,
  })),
};

const painel: PainelDoDia = {
  contagem: { dataProva: "2026-09-10", dias: 17, estado: "futura" },
  gamificacao,
  trajetoria: null,
  relatorioSemanal: {
    inicio: "2026-08-17T12:00:00.000Z",
    fim: "2026-08-24T12:00:00.000Z",
    questoesRespondidas: 12,
    acertos: 9,
    percentualAcertos: 0.75,
    percentualAnterior: 0.5,
    topicosTocados: 3,
    revisoesConcluidas: 2,
    tendencia: "subindo",
    porDia: [
      { data: "2026-08-18", questoes: 0, acertos: 0 },
      { data: "2026-08-19", questoes: 2, acertos: 2 },
      { data: "2026-08-20", questoes: 3, acertos: 2 },
      { data: "2026-08-21", questoes: 0, acertos: 0 },
      { data: "2026-08-22", questoes: 4, acertos: 3 },
      { data: "2026-08-23", questoes: 1, acertos: 0 },
      { data: "2026-08-24", questoes: 2, acertos: 2 },
    ],
  },
  recuperacao: [
    {
      topicoId: "11111111-1111-4111-8111-111111111111",
      topico: "Concordância verbal",
      materiaId: "22222222-2222-4222-8222-222222222222",
      materia: "Língua Portuguesa",
      causa: "errei_a_conta",
      nErros: 3,
      ultimoErroEm: "2026-08-23T10:00:00.000Z",
    },
  ],
  acompanhamentoIndisponivel: false,
};

describe("CartaoDoDia", () => {
  it("lê o dia em andamento a partir do anel e da missão", () => {
    const html = renderToStaticMarkup(<CartaoDoDia dados={gamificacao} />);

    expect(html).toContain("Você está no meio do dia");
    expect(html).toContain("Concluir o mínimo de hoje");
    expect(html).toContain('href="#nivel-minimo"');
    expect(html).toContain(">Blocos</span>");
    expect(html).toContain("Em andamento");
    expect(html).not.toContain("dias de sequência");
    expect(html).toContain("1/2");
    expect(html).toContain("10/10");
  });

  it("chama de pendente o dia sem nenhum progresso no anel", () => {
    const html = renderToStaticMarkup(
      <CartaoDoDia
        dados={{
          ...gamificacao,
          anel: { estudo: dimensao(0, 2), questoes: dimensao(0, 10), revisao: dimensao(0, 1) },
          missao: { ...gamificacao.missao!, progresso: 0, progressoBruto: 0, estado: "pendente" },
        }}
      />,
    );

    expect(html).toContain("O dia ainda não começou");
    expect(html).toContain("Pendente");
    expect(html).not.toContain("Você está no meio do dia");
  });

  it("fecha o cartão quando a missão do dia foi concluída", () => {
    const html = renderToStaticMarkup(
      <CartaoDoDia
        dados={{ ...gamificacao, missao: { ...gamificacao.missao!, progresso: 2, estado: "concluida" } }}
      />,
    );

    expect(html).toContain("Dia cumprido");
    expect(html).toContain("Concluída");
  });

  it("marca o limite do mínimo somente quando ele fica antes da meta", () => {
    const comMarcacao = renderToStaticMarkup(
      <CartaoDoDia
        dados={{
          ...gamificacao,
          anel: {
            estudo: dimensao(4, 30, 10, 4),
            questoes: dimensao(0, 10),
            revisao: dimensao(0, 1),
          },
        }}
      />,
    );
    const pisoZerado = renderToStaticMarkup(
      <CartaoDoDia
        dados={{
          ...gamificacao,
          anel: {
            estudo: dimensao(0, 30, 0),
            questoes: dimensao(0, 10),
            revisao: dimensao(0, 1),
          },
        }}
      />,
    );
    const pisoIgualMeta = renderToStaticMarkup(
      <CartaoDoDia
        dados={{
          ...gamificacao,
          anel: {
            estudo: dimensao(0, 30, 30, 30),
            questoes: dimensao(0, 10),
            revisao: dimensao(0, 1),
          },
        }}
      />,
    );

    expect(comMarcacao.match(/data-piso-marcacao="true"/g) ?? []).toHaveLength(1);
    expect(pisoZerado).not.toContain('data-piso-marcacao="true"');
    expect(pisoIgualMeta).not.toContain('data-piso-marcacao="true"');
  });
});

describe("AcompanhamentoDoDia", () => {
  it("mostra contagem da prova, semana e atalho de recuperação", () => {
    const html = renderToStaticMarkup(<AcompanhamentoDoDia painel={painel} />);

    expect(html).toContain("17 dias para a prova");
    expect(html).toContain("Data da prova");
    expect(html).toContain("Sua semana até aqui");
    expect(html).toContain("Tendência: Subindo");
    expect(html).toContain("Concordância verbal");
    expect(html).toContain("Errei a conta");
    expect(html).toContain(
      "/app/sessao?refacao=1&amp;topico=11111111-1111-4111-8111-111111111111&amp;causa=errei_a_conta",
    );
    expect(html).toContain("/app/progresso");
  });

  it("desenha uma coluna por dia da janela de sete", () => {
    const html = renderToStaticMarkup(<AcompanhamentoDoDia painel={painel} />);

    // Sete colunas, e o dia sem questão continua sendo coluna — não buraco.
    expect(html).toContain("grid-cols-7");
    expect(html.split('style="height:').length - 1).toBe(7);
    expect(html).toContain("–");
  });

  it("cala a contagem quando não há data e omite recuperação vazia", () => {
    const html = renderToStaticMarkup(
      <AcompanhamentoDoDia
        painel={{
          ...painel,
          contagem: { dataProva: null, dias: null, estado: "indefinida" },
          recuperacao: [],
        }}
      />,
    );

    expect(html).toContain("Data da prova ainda não definida");
    expect(html).toContain("Data da prova");
    expect(html).not.toContain("Contagem da prova");
    expect(html).toContain("painel-calendario-flutua");
    expect(html).toContain("5s ease-in-out infinite");
    expect(html).toContain("prefers-reduced-motion: reduce");
    expect(html).not.toContain("Erros que merecem outra chance");
    expect(html).toContain("Sua semana até aqui");

    const comData = renderToStaticMarkup(<AcompanhamentoDoDia painel={painel} />);
    expect(comData).toContain("Data da prova");
    expect(comData).not.toContain("painel-calendario-flutua");
  });

  it("esconde a etiqueta de tendência quando ainda não há base", () => {
    const html = renderToStaticMarkup(
      <AcompanhamentoDoDia
        painel={{
          ...painel,
          relatorioSemanal: { ...painel.relatorioSemanal!, tendencia: "sem_base" },
        }}
      />,
    );

    expect(html).toContain("Sua semana até aqui");
    expect(html).not.toContain("Tendência:");
    expect(html).not.toContain("Sem base");
  });

  it("avisa quando o acompanhamento não pôde ser lido", () => {
    const html = renderToStaticMarkup(
      <AcompanhamentoDoDia
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
      <AcompanhamentoDoDia painel={{ ...painel, contagem: { dataProva: "2026-08-24", dias: 0, estado: "hoje" } }} />,
    );
    const passada = renderToStaticMarkup(
      <AcompanhamentoDoDia painel={{ ...painel, contagem: { dataProva: "2026-08-20", dias: -4, estado: "passada" } }} />,
    );

    expect(hoje).toContain("A prova é hoje");
    expect(passada).toContain("A data da prova já passou");
    expect(passada).not.toContain("-4 dia");
  });
});

describe("GamificacaoNoProgresso", () => {
  it("nomeia as duas janelas em vez de misturar total de sempre com placar de hoje", () => {
    const html = renderToStaticMarkup(<GamificacaoNoProgresso dados={gamificacao} />);

    expect(html).toContain("145");
    expect(html).toContain("pontos acumulados");
    // As duas colunas ficam rotuladas; era a ausência disso que fazia o total
    // de sempre parecer contradizer a discriminação do dia.
    expect(html).toContain(">Hoje<");
    expect(html).toContain(">Total<");
    expect(html).toContain("+30");
    // E a seção passa a dizer de onde vem cada ponto.
    expect(html).toContain("Acertar uma questão que você já errou");
    expect(html).toContain("25 / erro");
  });

  it("mede a conquista travada em vez de só dizer que ela não veio", () => {
    const html = renderToStaticMarkup(<GamificacaoNoProgresso dados={gamificacao} />);

    expect(html).toContain("Primeiro bloco");
    expect(html).toContain("38 de 100");
    expect(html).toContain("faltam 62");
    expect(html).toContain("Próxima:");
  });

  it("esconde a coluna do total quando o servidor não a informa", () => {
    const html = renderToStaticMarkup(
      <GamificacaoNoProgresso
        dados={{
          ...gamificacao,
          pontos: { ...gamificacao.pontos, discriminacaoTotal: null },
          conquistas: gamificacao.conquistas.map((conquista) => ({
            ...conquista,
            progresso: null,
            meta: null,
          })),
        }}
      />,
    );

    // Melhor não mostrar a coluna do que desenhar zero ao lado de um total
    // positivo — que é exatamente o defeito que esta seção veio corrigir.
    expect(html).not.toContain(">Total<");
    expect(html).toContain(">Hoje<");
    expect(html).not.toContain("faltam");
  });
});
