import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencias = vi.hoisted(() => ({
  flag: vi.fn(),
  gamificacao: vi.fn(),
  progresso: vi.fn(),
  reportar: vi.fn(),
}));

vi.mock("@/modules/config", () => ({ isFlagOn: dependencias.flag }));
vi.mock("@/modules/observabilidade/reporte", () => ({ reportarErro: dependencias.reportar }));
vi.mock("./gamificacao", () => ({ consultarGamificacao: dependencias.gamificacao }));
vi.mock("./progresso", () => ({ consultarProgresso: dependencias.progresso }));

const { consultarPainelDoDia, contarDiasParaProva } = await import("./painel-do-dia");

const cliente = {} as never;

const relatorio = {
  inicio: "2026-08-17T12:00:00.000Z",
  fim: "2026-08-24T12:00:00.000Z",
  questoesRespondidas: 12,
  acertos: 9,
  percentualAcertos: 0.75,
  topicosTocados: 3,
  revisoesConcluidas: 2,
  tendencia: "subindo" as const,
};

function caderno(n: number) {
  return Array.from({ length: n }, (_, indice) => ({
    topicoId: `topico-${indice}`,
    topico: `Assunto ${indice}`,
    causa: "chutei" as const,
    nErros: n - indice,
    ultimoErroEm: "2026-08-23T10:00:00.000Z",
  }));
}

function ligarFlags(valores: Record<string, boolean>) {
  dependencias.flag.mockImplementation(async (chave: string) => valores[chave] ?? false);
}

describe("contarDiasParaProva", () => {
  it("conta os dias pelo calendário do produto", () => {
    const contagem = contarDiasParaProva("2026-09-10", new Date("2026-08-24T12:00:00Z"));

    expect(contagem).toEqual({ dataProva: "2026-09-10", dias: 17, estado: "futura" });
  });

  it("usa o fuso do produto na virada do dia em UTC", () => {
    // 2026-08-24 21:30 em São Paulo já é 2026-08-25 em UTC.
    const contagem = contarDiasParaProva("2026-08-25", new Date("2026-08-25T00:30:00Z"));

    expect(contagem.dias).toBe(1);
    expect(contagem.estado).toBe("futura");
  });

  it("separa a prova de hoje da prova que já passou", () => {
    const hoje = contarDiasParaProva("2026-08-24", new Date("2026-08-24T12:00:00Z"));
    const passada = contarDiasParaProva("2026-08-20", new Date("2026-08-24T12:00:00Z"));

    expect(hoje.estado).toBe("hoje");
    expect(hoje.dias).toBe(0);
    expect(passada.estado).toBe("passada");
    expect(passada.dias).toBe(-4);
  });

  it("não inventa contagem quando a data falta ou é ilegível", () => {
    for (const valor of [null, undefined, "", "amanhã", "2026-13-40"]) {
      expect(contarDiasParaProva(valor, new Date("2026-08-24T12:00:00Z"))).toEqual({
        dataProva: null,
        dias: null,
        estado: "indefinida",
      });
    }
  });
});

describe("consultarPainelDoDia", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ligarFlags({ "flag.m4.caderno_erros": true, "flag.m6.gamificacao": true });
    dependencias.gamificacao.mockResolvedValue({ habilitada: true, pontos: { dia: 30 } });
    dependencias.progresso.mockResolvedValue({ relatorioSemanal: relatorio, caderno: caderno(5) });
  });

  it("reúne contagem, gamificação, semana e recuperação limitada", async () => {
    const painel = await consultarPainelDoDia(cliente, {
      dataProva: "2026-09-10",
      agora: new Date("2026-08-24T12:00:00Z"),
    });

    expect(painel.contagem.dias).toBe(17);
    expect(painel.gamificacao).toEqual({ habilitada: true, pontos: { dia: 30 } });
    expect(painel.relatorioSemanal).toEqual(relatorio);
    expect(painel.recuperacao).toHaveLength(3);
    expect(painel.recuperacao[0]?.topicoId).toBe("topico-0");
    expect(painel.acompanhamentoIndisponivel).toBe(false);
  });

  it("omite a gamificação quando a flag global está desligada", async () => {
    ligarFlags({ "flag.m4.caderno_erros": true, "flag.m6.gamificacao": false });

    const painel = await consultarPainelDoDia(cliente);

    expect(dependencias.gamificacao).not.toHaveBeenCalled();
    expect(painel.gamificacao).toBeNull();
    expect(painel.relatorioSemanal).toEqual(relatorio);
  });

  it("omite a gamificação recusada pelo servidor sem derrubar a tela", async () => {
    dependencias.gamificacao.mockRejectedValue(new Error("detalhe interno"));

    const painel = await consultarPainelDoDia(cliente);

    expect(painel.gamificacao).toBeNull();
    expect(painel.relatorioSemanal).toEqual(relatorio);
    expect(dependencias.reportar).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ modulo: "aluno", operacao: "consultar_gamificacao" }),
    );
  });

  it("marca acompanhamento indisponível quando a leitura falha", async () => {
    dependencias.progresso.mockRejectedValue(new Error("detalhe interno"));

    const painel = await consultarPainelDoDia(cliente);

    expect(painel.acompanhamentoIndisponivel).toBe(true);
    expect(painel.relatorioSemanal).toBeNull();
    expect(painel.recuperacao).toEqual([]);
    expect(dependencias.reportar).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ modulo: "aluno", operacao: "consultar_painel_do_dia" }),
    );
  });

  it("não lê acompanhamento com o caderno desligado e não trata isso como falha", async () => {
    ligarFlags({ "flag.m4.caderno_erros": false, "flag.m6.gamificacao": true });

    const painel = await consultarPainelDoDia(cliente);

    expect(dependencias.progresso).not.toHaveBeenCalled();
    expect(painel.acompanhamentoIndisponivel).toBe(false);
    expect(painel.relatorioSemanal).toBeNull();
  });
});
