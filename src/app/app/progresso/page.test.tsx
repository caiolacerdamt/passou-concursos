import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencias = vi.hoisted(() => ({
  matricula: vi.fn(),
  flag: vi.fn(),
  cliente: vi.fn(),
  progresso: vi.fn(),
  gamificacao: vi.fn(),
  reportar: vi.fn(),
  sair: vi.fn(),
}));

vi.mock("@/modules/conta/matricula", () => ({ exigirMatriculaAtiva: dependencias.matricula }));
vi.mock("@/modules/config", () => ({ isFlagOn: dependencias.flag }));
vi.mock("@/lib/db/sessao", () => ({ clienteDaSessao: dependencias.cliente }));
vi.mock("@/modules/aluno/progresso", () => ({
  CAUSAS_DO_CADERNO: [
    "nao_sabia_conteudo",
    "errei_a_conta",
    "entendi_errado_enunciado",
    "confundi_conceitos",
    "fiquei_na_duvida",
    "chutei",
    "nao_sei_dizer",
    "faltou_tempo",
  ],
  NOMES_DAS_CAUSAS: {
    nao_sabia_conteudo: "Não sabia o conteúdo",
    errei_a_conta: "Errei a conta",
    entendi_errado_enunciado: "Entendi errado o enunciado",
    confundi_conceitos: "Confundi conceitos",
    fiquei_na_duvida: "Fiquei na dúvida",
    chutei: "Chutei",
    nao_sei_dizer: "Não sei dizer",
    faltou_tempo: "Faltou tempo",
  },
  consultarProgresso: dependencias.progresso,
}));
vi.mock("@/modules/aluno/painel-do-dia", () => ({
  consultarGamificacaoOpcional: dependencias.gamificacao,
}));
vi.mock("@/modules/observabilidade/reporte", () => ({ reportarErro: dependencias.reportar }));
vi.mock("../../entrar/acoes", () => ({ sair: dependencias.sair }));

const { default: Progresso } = await import("./page");

const TOPICO = "11111111-1111-4111-8111-111111111111";
const MATERIA = "22222222-2222-4222-8222-222222222222";

const topico = {
  topicoId: TOPICO,
  topico: "Juros compostos",
  materiaId: MATERIA,
  materia: "Matemática",
};

const dados = {
  filtros: { causa: "errei_a_conta" as const, topicoId: TOPICO, materiaId: null },
  historico: [
    {
      ...topico,
      nRespostas: 10,
      nAcertos: 7,
      score: 0.7,
      dominio: "em_desenvolvimento" as const,
      tendencia: "sem_base" as const,
    },
  ],
  historicoPorMateria: [
    {
      materiaId: MATERIA,
      materia: "Matemática",
      nTopicos: 1,
      nRespostas: 10,
      nAcertos: 7,
      tendencia: "sem_base" as const,
      topicos: [
        {
          ...topico,
          nRespostas: 10,
          nAcertos: 7,
          score: 0.7,
          dominio: "em_desenvolvimento" as const,
          tendencia: "sem_base" as const,
        },
      ],
    },
  ],
  caderno: [
    { ...topico, causa: "errei_a_conta" as const, nErros: 2, ultimoErroEm: "2026-08-21T20:00:00Z" },
  ],
  cadernoPorAssunto: [
    {
      ...topico,
      nErros: 2,
      ultimoErroEm: "2026-08-21T20:00:00Z",
      causas: [
        { causa: "errei_a_conta" as const, nErros: 2, ultimoErroEm: "2026-08-21T20:00:00Z" },
      ],
    },
  ],
  cadernoTruncado: false,
  materias: [{ id: MATERIA, nome: "Matemática" }],
  topicos: [{ id: TOPICO, nome: "Juros compostos", materiaId: MATERIA, materia: "Matemática" }],
  sequencia: {
    data: "2026-08-22",
    sequencia: 4,
    estado: "cumprido" as const,
    pisoEntregue: true,
    pisoCumprido: true,
    temHistorico: true,
  },
  estadoInicial: false,
  relatorioSemanal: {
    inicio: "2026-08-15T00:00:00Z",
    fim: "2026-08-22T00:00:00Z",
    questoesRespondidas: 10,
    acertos: 7,
    percentualAcertos: 0.7,
    percentualAnterior: null,
    topicosTocados: 1,
    revisoesConcluidas: 2,
    tendencia: "sem_base" as const,
    porDia: [
      { data: "2026-08-16", questoes: 0, acertos: 0 },
      { data: "2026-08-17", questoes: 2, acertos: 2 },
      { data: "2026-08-18", questoes: 0, acertos: 0 },
      { data: "2026-08-19", questoes: 3, acertos: 2 },
      { data: "2026-08-20", questoes: 0, acertos: 0 },
      { data: "2026-08-21", questoes: 4, acertos: 2 },
      { data: "2026-08-22", questoes: 1, acertos: 1 },
    ],
  },
};

function renderPage(searchParams: Record<string, string | string[]> = {}) {
  return Progresso({ searchParams: Promise.resolve(searchParams) });
}

describe("/app/progresso", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencias.matricula.mockResolvedValue({ id: "matricula-1" });
    dependencias.flag.mockResolvedValue(true);
    dependencias.cliente.mockResolvedValue({});
    dependencias.progresso.mockResolvedValue(dados);
    dependencias.gamificacao.mockResolvedValue(null);
  });

  it("protege a rota, passa os dois filtros e não oferece ranking", async () => {
    const html = renderToStaticMarkup(
      await renderPage({ causa: "errei_a_conta", topico: dados.filtros.topicoId }),
    );

    expect(dependencias.matricula).toHaveBeenCalledTimes(1);
    expect(dependencias.progresso).toHaveBeenCalledWith(
      expect.anything(),
      { causa: "errei_a_conta", topico: dados.filtros.topicoId },
    );
    expect(html).toContain("Seu progresso");
    expect(html).toContain("Últimos 7 dias");
    expect(html).toContain("Caderno de erros");
    expect(html).toContain("Por que errei");
    expect(html).toContain("name=\"topico\"");
    expect(html).toContain("name=\"materia\"");
    const texto = html.toLowerCase();
    for (const palavra of ["ranking", "liga", "placar", "percentil", "posição"]) {
      expect(texto).not.toContain(palavra);
    }
  });

  it("mostra começo explícito para aluno sem histórico", async () => {
    dependencias.progresso.mockResolvedValue({
      ...dados,
      filtros: { causa: null, topicoId: null, materiaId: null },
      historico: [],
      historicoPorMateria: [],
      caderno: [],
      cadernoPorAssunto: [],
      sequencia: null,
      estadoInicial: true,
    });

    const html = renderToStaticMarkup(await renderPage());
    expect(html).toContain("Esta tela começa a existir na sua primeira questão");
    expect(html).toContain("Começar o plano de hoje");
  });

  it("integra pontos e conquistas quando a gamificação está ligada", async () => {
    dependencias.gamificacao.mockResolvedValue({
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
      conquistas: [
        {
          id: "primeiro_bloco",
          titulo: "Primeiro bloco",
          descricao: "Concluiu o primeiro bloco.",
          desbloqueada: true,
          desbloqueadaEm: "2026-08-20T12:00:00.000Z",
          progresso: 1,
          meta: 1,
        },
      ],
    });

    const html = renderToStaticMarkup(await renderPage());

    expect(html).toContain("Esforço reconhecido");
    expect(html).toContain("pontos acumulados");
    expect(html).toContain("Primeiro bloco");
  });

  it("mantém o progresso de pé com a gamificação ausente", async () => {
    const html = renderToStaticMarkup(await renderPage());

    expect(html).toContain("Últimos 7 dias");
    expect(html).not.toContain("Esforço reconhecido");
  });

  it("limita a altura da lista pedida pela query string", async () => {
    const html = renderToStaticMarkup(await renderPage({ mostrar: "999999" }));

    // O pedido absurdo não vira lista infinita: só um assunto existe, e a
    // tela nem chega a oferecer outro lote.
    expect(html).toContain("Caderno de erros");
    expect(html).not.toContain("Mostrar mais");
  });

  it("respeita flag desligada sem consultar progresso", async () => {
    dependencias.flag.mockResolvedValue(false);

    const html = renderToStaticMarkup(await renderPage());
    expect(html).toContain("Seu progresso está em preparação");
    expect(dependencias.cliente).not.toHaveBeenCalled();
    expect(dependencias.progresso).not.toHaveBeenCalled();
    expect(dependencias.gamificacao).not.toHaveBeenCalled();
  });

  it("mostra estado seguro e reporta falha técnica", async () => {
    const erro = new Error("detalhe interno");
    dependencias.progresso.mockRejectedValue(erro);

    const html = renderToStaticMarkup(await renderPage());
    expect(html).toContain("Algo deu errado");
    expect(html).not.toContain("detalhe interno");
    expect(dependencias.reportar).toHaveBeenCalledWith(
      erro,
      expect.objectContaining({ operacao: "consultar_progresso" }),
    );
  });

  it("não lê nada quando a guarda de matrícula falha", async () => {
    dependencias.matricula.mockRejectedValue(new Error("NEXT_REDIRECT:/assinar"));

    await expect(renderPage()).rejects.toThrow("NEXT_REDIRECT:/assinar");
    expect(dependencias.flag).not.toHaveBeenCalled();
    expect(dependencias.cliente).not.toHaveBeenCalled();
  });
});
