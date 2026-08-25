import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencias = vi.hoisted(() => ({
  matricula: vi.fn(),
  cliente: vi.fn(),
  perfil: vi.fn(),
  plano: vi.fn(),
  rotulos: vi.fn(),
  painel: vi.fn(),
  reportar: vi.fn(),
  salvar: vi.fn(),
  sair: vi.fn(),
}));

vi.mock("@/modules/conta/matricula", () => ({
  exigirMatriculaAtiva: dependencias.matricula,
}));
vi.mock("@/lib/db/sessao", () => ({
  clienteDaSessao: dependencias.cliente,
}));
vi.mock("@/modules/aluno/onboarding", () => ({
  NIVEIS_DECLARADOS: ["iniciante", "intermediario", "avancado"],
  consultarPerfilEstudo: dependencias.perfil,
}));
vi.mock("@/modules/aluno/plano", () => ({
  consultarPlanoDoDia: dependencias.plano,
}));
vi.mock("@/modules/aluno/plano-rotulos", () => ({
  consultarRotulosDosTopicos: dependencias.rotulos,
}));
vi.mock("@/modules/aluno/painel-do-dia", () => ({
  consultarPainelDoDia: dependencias.painel,
}));
vi.mock("@/modules/observabilidade/reporte", () => ({
  reportarErro: dependencias.reportar,
}));
vi.mock("./acoes", () => ({
  salvarOnboarding: dependencias.salvar,
}));
vi.mock("../entrar/acoes", () => ({
  sair: dependencias.sair,
}));

const { default: App } = await import("./page");

const plano = {
  id: "plano-1",
  data: "2026-08-22",
  frase: "Hoje, consistência antes de velocidade.",
  piso: [
    {
      id: "bloco-piso",
      tipo: "revisar" as const,
      nivel: "piso" as const,
      ordem: 1,
      topicoId: "topico-1",
      minutosEstimados: 15,
      motivo: "A revisão vence hoje.",
      conclusao: null,
    },
  ],
  metaCheia: [
    {
      id: "bloco-meta",
      tipo: "avancar" as const,
      nivel: "meta_cheia" as const,
      ordem: 2,
      topicoId: "topico-2",
      minutosEstimados: 25,
      motivo: "Este tema tem peso alto na prova.",
      conclusao: null,
    },
  ],
};

const painelVazio = {
  contagem: { dataProva: null, dias: null, estado: "indefinida" as const },
  gamificacao: null,
  relatorioSemanal: null,
  recuperacao: [],
  acompanhamentoIndisponivel: false,
};

function renderApp(searchParams: Record<string, string> = {}) {
  return App({ params: Promise.resolve({}), searchParams: Promise.resolve(searchParams) });
}

describe("/app", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencias.matricula.mockResolvedValue({ id: "matricula-1" });
    dependencias.cliente.mockResolvedValue({});
    dependencias.perfil.mockResolvedValue(null);
    dependencias.plano.mockResolvedValue(null);
    dependencias.rotulos.mockResolvedValue(new Map());
    dependencias.painel.mockResolvedValue(painelVazio);
  });

  it("mostra onboarding no primeiro acesso e deixa o diagnóstico para depois", async () => {
    const html = renderToStaticMarkup(await renderApp());

    expect(dependencias.matricula).toHaveBeenCalledTimes(1);
    expect(dependencias.perfil).toHaveBeenCalledTimes(1);
    expect(dependencias.plano).not.toHaveBeenCalled();
    expect(html).toContain("Um plano que cabe na sua rotina");
    expect(html).toContain('name="concursoAlvo"');
    expect(html).toContain('name="minutosPorDia"');
    expect(html).toContain('name="diasEstudo"');
    expect(html).toContain('name="horarioEstudo"');
    expect(html).toContain('name="nivelDeclarado"');
    expect(html).toContain("O diagnóstico adaptativo é opcional");
  });

  it("mostra piso, meta cheia, motivo e frase quando o plano existe", async () => {
    dependencias.perfil.mockResolvedValue({ onboardingConcluido: true });
    dependencias.plano.mockResolvedValue(plano);

    const html = renderToStaticMarkup(await renderApp());

    expect(dependencias.plano).toHaveBeenCalledTimes(1);
    expect(html).toContain("Piso");
    expect(html).toContain("Meta cheia");
    expect(html).toContain("A revisão vence hoje.");
    expect(html).toContain("Este tema tem peso alto na prova.");
    expect(html).toContain("Hoje, consistência antes de velocidade.");
    expect(html).toContain("/app/estudo?bloco=bloco-piso");
  });

  it("trata plano ainda não preparado como estado vazio seguro", async () => {
    dependencias.perfil.mockResolvedValue({ onboardingConcluido: true });

    const html = renderToStaticMarkup(await renderApp({ erro: "plano" }));

    expect(html).toContain("Seu plano de hoje ainda está sendo preparado");
    expect(html).toContain("não depende de uma resposta da IA");
  });

  it("mantém o plano sem UUID e reporta falha técnica dos rótulos", async () => {
    dependencias.perfil.mockResolvedValue({ onboardingConcluido: true });
    dependencias.plano.mockResolvedValue(plano);
    dependencias.rotulos.mockRejectedValue(new Error("detalhe interno"));

    const html = renderToStaticMarkup(await renderApp());

    expect(html).toContain("Tópico do ciclo");
    expect(html).not.toContain("detalhe interno");
    expect(html).not.toContain("topico-1");
    expect(dependencias.reportar).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ modulo: "aluno", operacao: "consultar_rotulos_plano" }),
    );
  });

  it("troca a ação do bloco concluído pelo placar e link do resumo", async () => {
    dependencias.perfil.mockResolvedValue({ onboardingConcluido: true });
    dependencias.plano.mockResolvedValue({
      ...plano,
      metaCheia: [
        {
          ...plano.metaCheia[0],
          conclusao: {
            sessaoId: "sessao-concluida",
            nQuestoes: 10,
            nAcertos: 3,
            encerradaEm: "2026-08-23T21:00:00.000Z",
          },
        },
      ],
    });

    const html = renderToStaticMarkup(await renderApp());

    expect(html).toContain("Concluído");
    expect(html).toContain("10 questões · 3 acertos");
    expect(html).toContain("/app/sessao/sessao-concluida/resumo");
    expect(html).toContain("Ver resumo");
    expect(html).not.toContain("/app/sessao?bloco=bloco-meta");
  });

  it("integra contagem da prova, gamificação, semana e recuperação em Hoje", async () => {
    dependencias.perfil.mockResolvedValue({ onboardingConcluido: true, dataProva: "2026-09-10" });
    dependencias.plano.mockResolvedValue(plano);
    dependencias.painel.mockResolvedValue({
      contagem: { dataProva: "2026-09-10", dias: 17, estado: "futura" as const },
      gamificacao: {
        pontos: { dia: 30, total: 145, discriminacao: { estudoPrioritario: 0, conclusao: 0, revisaoNoPrazo: 0, recuperacaoErro: 0 } },
        anel: {
          estudo: { progresso: 1, meta: 2, bruto: 1, percentual: 0.5, concluido: false },
          questoes: { progresso: 0, meta: 10, bruto: 0, percentual: 0, concluido: false },
          revisao: { progresso: 0, meta: 1, bruto: 0, percentual: 0, concluido: false },
        },
        missao: { id: "m1", tipo: "concluir_piso" as const, progresso: 1, progressoBruto: 1, meta: 2, estado: "em_andamento" as const },
        sequencia: null,
        conquistas: [],
      },
      relatorioSemanal: {
        inicio: "2026-08-17T12:00:00.000Z",
        fim: "2026-08-24T12:00:00.000Z",
        questoesRespondidas: 12,
        acertos: 9,
        percentualAcertos: 0.75,
        topicosTocados: 3,
        revisoesConcluidas: 2,
        tendencia: "subindo" as const,
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
          topicoId: "topico-1",
          topico: "Concordância verbal",
          causa: "errei_a_conta" as const,
          nErros: 3,
          ultimoErroEm: "2026-08-23T10:00:00.000Z",
        },
      ],
      acompanhamentoIndisponivel: false,
    });

    const html = renderToStaticMarkup(await renderApp());

    expect(dependencias.painel).toHaveBeenCalledWith(expect.anything(), { dataProva: "2026-09-10" });
    expect(html).toContain("17 dias para a prova");
    expect(html).toContain("Você está no meio do dia");
    expect(html).toContain("Sua semana até aqui");
    expect(html).toContain("Erros que merecem outra chance");
    expect(html).toContain("/app/sessao?refacao=1&amp;topico=topico-1&amp;causa=errei_a_conta");
  });

  it("mantém a faixa integrada mesmo com o plano ainda em preparação", async () => {
    dependencias.perfil.mockResolvedValue({ onboardingConcluido: true, dataProva: null });

    const html = renderToStaticMarkup(await renderApp());

    expect(html).toContain("Data da prova ainda não definida");
    expect(html).toContain("Seu plano de hoje ainda está sendo preparado");
  });

  it("não lê a faixa integrada antes de o onboarding terminar", async () => {
    const html = renderToStaticMarkup(await renderApp());

    expect(dependencias.painel).not.toHaveBeenCalled();
    expect(html).toContain("Um plano que cabe na sua rotina");
  });

  it("mantém a guarda de matrícula antes de qualquer leitura", async () => {
    dependencias.matricula.mockRejectedValue(new Error("NEXT_REDIRECT:/assinar"));

    await expect(renderApp()).rejects.toThrow("NEXT_REDIRECT:/assinar");
    expect(dependencias.cliente).not.toHaveBeenCalled();
    expect(dependencias.perfil).not.toHaveBeenCalled();
  });
});
