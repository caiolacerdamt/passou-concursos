import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencias = vi.hoisted(() => ({
  guardar: vi.fn(),
  flag: vi.fn(),
  consultar: vi.fn(),
  mapa: vi.fn(),
  cliente: vi.fn(),
  reportar: vi.fn(),
  sair: vi.fn(),
}));

vi.mock("@/modules/conta/matricula", () => ({
  exigirMatriculaAtiva: dependencias.guardar,
}));
vi.mock("@/modules/config", () => ({
  isFlagOn: dependencias.flag,
}));
// Só as duas leituras que vão ao banco são trocadas por dublê. Os helpers
// puros do módulo (o lastro, a faixa de domínio) continuam sendo os de
// verdade: dublar cálculo faria a tela ser testada contra uma segunda
// implementação em vez de contra a que roda em produção.
vi.mock("@/modules/raiox", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/raiox")>()),
  consultarMapaPrioridade: dependencias.mapa,
  consultarRaioX: dependencias.consultar,
}));
vi.mock("@/lib/db/sessao", () => ({ clienteDaSessao: dependencias.cliente }));
vi.mock("@/modules/observabilidade/reporte", () => ({ reportarErro: dependencias.reportar }));
vi.mock("../../entrar/acoes", () => ({
  sair: dependencias.sair,
}));

const { default: RaioX } = await import("./page");

const dados = {
  perfil: {
    orgao: "Banco do Brasil",
    banca: "indefinida" as const,
    dataProva: null,
    formato: "multipla_escolha",
    programaEdital: [],
  },
  linhas: [
    {
      topicoId: "topico-1",
      topico: "Juros compostos",
      peso: 0.7,
      nQuestoes: 3,
      tendencia: "subindo" as const,
      amostraBaixa: true,
      lastro: {
        degrau: 1 as const,
        nProvas: 1,
        anos: [2025],
        baseDoPeso: "itens" as const,
        texto: "Peso medido em 1 prova do próprio concurso, de 2025.",
      },
    },
  ],
  materias: [
    {
      materiaId: "materia-1",
      materia: "Matemática Financeira",
      peso: 0.7,
      fatia: 1,
      nQuestoes: 3,
      nTopicos: 7,
      tendencia: "subindo" as const,
      amostraBaixa: true,
      lastro: {
        degrau: 1 as const,
        nProvas: 1,
        anos: [2025],
        baseDoPeso: "itens" as const,
        texto: "Peso medido em 1 prova do próprio concurso, de 2025.",
      },
      topicos: [
        {
          topicoId: "topico-1",
          topico: "Juros compostos",
          peso: 0.7,
          nQuestoes: 3,
          tendencia: "subindo" as const,
          amostraBaixa: true,
          lastro: {
            degrau: 1 as const,
            nProvas: 1,
            anos: [2025],
            baseDoPeso: "itens" as const,
            texto: "Peso medido em 1 prova do próprio concurso, de 2025.",
          },
          fatia: 1,
        },
      ],
    },
  ],
};

describe("/app/raio-x", () => {
  beforeEach(() => {
    dependencias.guardar.mockReset();
    dependencias.flag.mockReset();
    dependencias.consultar.mockReset();
    dependencias.mapa.mockReset();
    dependencias.cliente.mockReset();
    dependencias.reportar.mockReset();
    dependencias.sair.mockReset();
    dependencias.guardar.mockResolvedValue({ id: "matricula-1" });
    dependencias.flag.mockResolvedValue(false);
    dependencias.consultar.mockResolvedValue(dados);
    dependencias.mapa.mockResolvedValue({ dataReferencia: "2026-08-24", linhas: [] });
    dependencias.cliente.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: "aluno-1" } } }) },
    });
  });

  it("exige matrícula e, com flag desligada, não consulta a projeção", async () => {
    const html = renderToStaticMarkup(await RaioX());

    expect(dependencias.guardar).toHaveBeenCalledTimes(1);
    expect(dependencias.flag).toHaveBeenCalledWith("flag.m5.raiox");
    expect(dependencias.consultar).not.toHaveBeenCalled();
    expect(dependencias.cliente).not.toHaveBeenCalled();
    expect(html).toContain("O Raio-X está em preparação");
    expect(html).not.toContain("Matemática Financeira");
  });

  it("com flag ligada renderiza somente a leitura pré-computada", async () => {
    dependencias.flag.mockImplementation(async (chave: string) => chave === "flag.m5.raiox");

    const html = renderToStaticMarkup(await RaioX());

    expect(dependencias.consultar).toHaveBeenCalledTimes(1);
    // Multi-concurso desligado: a tela não pergunta quem está lendo.
    expect(dependencias.consultar).toHaveBeenCalledWith(undefined, undefined);
    expect(dependencias.cliente).toHaveBeenCalledTimes(1);
    expect(dependencias.mapa).toHaveBeenCalledWith(expect.anything(), dados);
    expect(html).toContain("O que mais cai no seu concurso");
    expect(html).toContain("Matemática Financeira");
  });

  it("com multi-concurso ligado, lê o Raio-X do concurso do aluno", async () => {
    dependencias.flag.mockResolvedValue(true);

    renderToStaticMarkup(await RaioX());

    expect(dependencias.consultar).toHaveBeenCalledWith(undefined, "aluno-1");
    expect(dependencias.cliente).toHaveBeenCalledTimes(1);
  });

  it("mantém a leitura pública e sinaliza falha do mapa pessoal", async () => {
    dependencias.flag.mockResolvedValue(true);
    const erro = new Error("falha ao ler dominio_topico: indisponível");
    dependencias.mapa.mockRejectedValue(erro);

    const html = renderToStaticMarkup(await RaioX());

    expect(html).toContain("O que mais cai no seu concurso");
    expect(html).toContain("Mapa de Prioridade está indisponível agora");
    expect(html).not.toContain("dominio_topico");
    expect(dependencias.reportar).toHaveBeenCalledWith(
      erro,
      expect.objectContaining({ operacao: "consultar_mapa_prioridade" }),
    );
  });

  it("não verifica flag nem lê projeção quando a guarda redireciona", async () => {
    dependencias.guardar.mockRejectedValue(new Error("NEXT_REDIRECT:/assinar"));

    await expect(RaioX()).rejects.toThrow("NEXT_REDIRECT:/assinar");
    expect(dependencias.flag).not.toHaveBeenCalled();
    expect(dependencias.consultar).not.toHaveBeenCalled();
    expect(dependencias.cliente).not.toHaveBeenCalled();
  });
});
