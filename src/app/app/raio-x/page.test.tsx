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
vi.mock("@/modules/raiox", () => ({
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
      topico: "Matemática Financeira",
      peso: 0.7,
      nQuestoes: 3,
      tendencia: "subindo" as const,
      amostraBaixa: true,
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
    dependencias.cliente.mockResolvedValue({});
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
    dependencias.flag.mockResolvedValue(true);

    const html = renderToStaticMarkup(await RaioX());

    expect(dependencias.consultar).toHaveBeenCalledTimes(1);
    expect(dependencias.cliente).toHaveBeenCalledTimes(1);
    expect(dependencias.mapa).toHaveBeenCalledWith(expect.anything(), dados);
    expect(html).toContain("O que mais cai no seu concurso");
    expect(html).toContain("Matemática Financeira");
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
