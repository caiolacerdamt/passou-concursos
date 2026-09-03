import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ASSUNTOS_POR_PAGINA, ProgressoTela } from "./progresso-tela";
import {
  agruparCadernoPorAssunto,
  agruparHistoricoPorMateria,
  type AssuntoDoCaderno,
  type DadosProgresso,
  type LinhaCaderno,
  type LinhaHistorico,
} from "./progresso";

const historico: LinhaHistorico[] = [
  {
    topicoId: "topico-1",
    topico: "Interpretação",
    materiaId: "materia-1",
    materia: "Língua Portuguesa",
    nRespostas: 32,
    nAcertos: 8,
    score: 0.25,
    dominio: "fraco",
    tendencia: "caindo",
  },
  {
    topicoId: "topico-2",
    topico: "Geral",
    materiaId: "materia-2",
    materia: "Vendas e Negociação",
    nRespostas: 4,
    nAcertos: 3,
    score: 0.75,
    dominio: "forte",
    tendencia: "sem_base",
  },
];

const caderno: LinhaCaderno[] = [
  {
    topicoId: "topico-1",
    topico: "Interpretação",
    materiaId: "materia-1",
    materia: "Língua Portuguesa",
    causa: "chutei",
    nErros: 4,
    ultimoErroEm: "2026-09-01T12:00:00Z",
  },
  {
    topicoId: "topico-1",
    topico: "Interpretação",
    materiaId: "materia-1",
    materia: "Língua Portuguesa",
    causa: "confundi_conceitos",
    nErros: 3,
    ultimoErroEm: "2026-09-02T12:00:00Z",
  },
];

const base: DadosProgresso = {
  filtros: { causa: null, topicoId: null, materiaId: null },
  historico,
  historicoPorMateria: agruparHistoricoPorMateria(historico),
  caderno,
  cadernoPorAssunto: agruparCadernoPorAssunto(caderno),
  cadernoTruncado: false,
  materias: [
    { id: "materia-1", nome: "Língua Portuguesa" },
    { id: "materia-2", nome: "Vendas e Negociação" },
  ],
  topicos: [
    { id: "topico-1", nome: "Interpretação", materiaId: "materia-1", materia: "Língua Portuguesa" },
    { id: "topico-2", nome: "Geral", materiaId: "materia-2", materia: "Vendas e Negociação" },
  ],
  sequencia: {
    data: "2026-09-03",
    sequencia: 2,
    estado: "folga",
    pisoEntregue: false,
    pisoCumprido: true,
    temHistorico: true,
  },
  estadoInicial: false,
  relatorioSemanal: {
    inicio: "2026-08-27T00:00:00Z",
    fim: "2026-09-03T00:00:00Z",
    questoesRespondidas: 38,
    acertos: 12,
    percentualAcertos: 0.32,
    percentualAnterior: 0.23,
    topicosTocados: 4,
    revisoesConcluidas: 2,
    tendencia: "subindo",
    porDia: [
      { data: "2026-08-28", questoes: 0, acertos: 0 },
      { data: "2026-08-29", questoes: 10, acertos: 3 },
      { data: "2026-08-30", questoes: 4, acertos: 2 },
      { data: "2026-08-31", questoes: 0, acertos: 0 },
      { data: "2026-09-01", questoes: 12, acertos: 4 },
      { data: "2026-09-02", questoes: 2, acertos: 0 },
      { data: "2026-09-03", questoes: 10, acertos: 3 },
    ],
  },
};

describe("ProgressoTela", () => {
  it("junta semana e sequência num cartão só e diz a taxa da janela anterior", () => {
    const html = renderToStaticMarkup(<ProgressoTela dados={base} />);

    expect(html).toContain("38 questões, 32% de acerto");
    // A comparação é número, não adjetivo.
    expect(html).toContain("Na semana anterior você acertava 23%");
    expect(html).toContain("2 dias de sequência");
    // O cartão que existia só para a sequência deixa de existir.
    expect(html).not.toContain("Seu ritmo");
    expect(html).not.toContain("Relatório semanal");
  });

  it("agrupa o histórico por matéria e não deixa dois assuntos homônimos soltos", () => {
    const html = renderToStaticMarkup(<ProgressoTela dados={base} />);

    expect(html).toContain("Língua Portuguesa");
    expect(html).toContain("Vendas e Negociação");
    // O assunto "Geral" só aparece debaixo da matéria que o desambigua.
    const posicaoDaMateria = html.indexOf("Vendas e Negociação");
    expect(posicaoDaMateria).toBeGreaterThan(-1);
    expect(html.indexOf(">Geral<")).toBeGreaterThan(posicaoDaMateria);
  });

  it("desenha os sete dias, inclusive o dia sem resposta", () => {
    const html = renderToStaticMarkup(<ProgressoTela dados={base} />);

    for (const dia of base.relatorioSemanal.porDia) {
      expect(html).toContain(`${dia.data}: ${dia.questoes} respondidas`);
    }
    expect(html).toContain("2026-08-28: 0 respondidas");
  });

  it("dá um cartão por assunto, com as causas dentro e uma ação para o assunto todo", () => {
    const html = renderToStaticMarkup(<ProgressoTela dados={base} />);

    // Um cartão, não quatro: o título do assunto aparece uma vez só.
    expect(html.split("Interpretação").length - 1).toBeGreaterThan(0);
    expect(html).toContain("Refazer os 7");
    expect(html).toContain("causa=todas");
    // E cada causa continua sendo um caminho próprio.
    expect(html).toContain("Chutei");
    expect(html).toContain("Confundi conceitos");
    expect(html).toContain("causa=chutei");
  });

  it("filtra por matéria, causa e assunto agrupado pela matéria", () => {
    const html = renderToStaticMarkup(<ProgressoTela dados={base} />);

    expect(html).toContain('name="materia"');
    expect(html).toContain('name="topico"');
    expect(html).toContain('name="causa"');
    // O `optgroup` é o que separa dois tópicos de mesmo nome.
    expect(html).toContain('<optgroup label="Língua Portuguesa">');
    expect(html).toContain('<optgroup label="Vendas e Negociação">');
  });

  it("corta a lista de assuntos e oferece o próximo lote sem perder o filtro", () => {
    const muitos: LinhaCaderno[] = Array.from({ length: 8 }, (_, indice) => ({
      topicoId: `topico-${indice}`,
      topico: `Assunto ${indice}`,
      materiaId: "materia-1",
      materia: "Língua Portuguesa",
      causa: "chutei" as const,
      nErros: 8 - indice,
      ultimoErroEm: "2026-09-01T12:00:00Z",
    }));
    const dados: DadosProgresso = {
      ...base,
      filtros: { causa: "chutei", topicoId: null, materiaId: null },
      caderno: muitos,
      cadernoPorAssunto: agruparCadernoPorAssunto(muitos),
    };

    const html = renderToStaticMarkup(<ProgressoTela dados={dados} />);

    expect(html).toContain(`Mostrando ${ASSUNTOS_POR_PAGINA} de 8 assuntos`);
    expect(html).toContain("Mostrar mais 3");
    // O lote seguinte carrega o filtro junto.
    expect(html).toContain(`causa=chutei&amp;mostrar=${ASSUNTOS_POR_PAGINA * 2}`);
    expect(html).not.toContain("Assunto 7");
  });

  it("avisa quando a consulta não trouxe o caderno inteiro", () => {
    const html = renderToStaticMarkup(
      <ProgressoTela dados={{ ...base, cadernoTruncado: true }} />,
    );

    expect(html).toContain("Há mais erros do que esta consulta traz de uma vez");
  });

  it("manda tirar o filtro em vez de só dizer que não achou nada", () => {
    const html = renderToStaticMarkup(
      <ProgressoTela
        dados={{
          ...base,
          filtros: { causa: "chutei", topicoId: "topico-1", materiaId: null },
          caderno: [],
          cadernoPorAssunto: [] as AssuntoDoCaderno[],
        }}
      />,
    );

    expect(html).toContain("Nenhum erro com esses filtros");
    expect(html).toContain("Limpe os filtros");
  });

  it("troca as cinco caixas vazias por uma tela só no primeiro dia", () => {
    const html = renderToStaticMarkup(
      <ProgressoTela
        dados={{
          ...base,
          historico: [],
          historicoPorMateria: [],
          caderno: [],
          cadernoPorAssunto: [],
          sequencia: null,
          estadoInicial: true,
        }}
      />,
    );

    expect(html).toContain("Esta tela começa a existir na sua primeira questão");
    expect(html).toContain("Começar o plano de hoje");
    // Nenhum dos vazios antigos sobra empilhado.
    expect(html).not.toContain("Caderno de erros");
    expect(html).not.toContain("Progresso por assunto");
  });

  it("não cria posição relativa em nenhum estado", () => {
    const texto = renderToStaticMarkup(<ProgressoTela dados={base} />).toLowerCase();

    for (const palavra of ["ranking", "liga", "placar", "percentil", "posição"]) {
      expect(texto).not.toContain(palavra);
    }
  });
});
