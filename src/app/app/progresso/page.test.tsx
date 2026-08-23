import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencias = vi.hoisted(() => ({
  matricula: vi.fn(),
  flag: vi.fn(),
  cliente: vi.fn(),
  progresso: vi.fn(),
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
  consultarProgresso: dependencias.progresso,
}));
vi.mock("@/modules/observabilidade/reporte", () => ({ reportarErro: dependencias.reportar }));
vi.mock("../../entrar/acoes", () => ({ sair: dependencias.sair }));

const { default: Progresso } = await import("./page");

const dados = {
  filtros: { causa: "errei_a_conta" as const, topicoId: "11111111-1111-4111-8111-111111111111" },
  historico: [
    { topicoId: "11111111-1111-4111-8111-111111111111", topico: "Matemática", nRespostas: 10, nAcertos: 7, score: 0.7 },
  ],
  caderno: [
    { topicoId: "11111111-1111-4111-8111-111111111111", topico: "Matemática", causa: "errei_a_conta" as const, nErros: 2, ultimoErroEm: "2026-08-21T20:00:00Z" },
  ],
  topicos: [{ id: "11111111-1111-4111-8111-111111111111", nome: "Matemática" }],
  sequencia: {
    data: "2026-08-22",
    sequencia: 4,
    estado: "cumprido" as const,
    pisoEntregue: true,
    pisoCumprido: true,
    temHistorico: true,
  },
  estadoInicial: false,
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
    expect(html).toContain("Caderno de erros");
    expect(html).toContain("Por que errei");
    expect(html).toContain("name=\"topico\"");
    const texto = html.toLowerCase();
    for (const palavra of ["ranking", "liga", "placar", "percentil", "posição"]) {
      expect(texto).not.toContain(palavra);
    }
  });

  it("mostra começo explícito para aluno sem histórico", async () => {
    dependencias.progresso.mockResolvedValue({
      ...dados,
      filtros: { causa: null, topicoId: null },
      historico: [],
      caderno: [],
      sequencia: null,
      estadoInicial: true,
    });

    const html = renderToStaticMarkup(await renderPage());
    expect(html).toContain("Seu ponto de partida");
    expect(html).toContain("Seu histórico começa com a primeira questão");
    expect(html).toContain("Seu caderno ainda está vazio");
  });

  it("respeita flag desligada sem consultar progresso", async () => {
    dependencias.flag.mockResolvedValue(false);

    const html = renderToStaticMarkup(await renderPage());
    expect(html).toContain("Seu progresso está em preparação");
    expect(dependencias.cliente).not.toHaveBeenCalled();
    expect(dependencias.progresso).not.toHaveBeenCalled();
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
