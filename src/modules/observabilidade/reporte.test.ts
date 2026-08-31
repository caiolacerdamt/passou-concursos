import { afterEach, describe, expect, it, vi } from "vitest";

import {
  type ContextoDeErro,
  definirDestinoDeErro,
  descreverErro,
  reportarErro,
  restaurarDestinoPadrao,
} from "./reporte";

afterEach(() => {
  // O destino e estado de modulo: sem isto um teste contamina o proximo.
  restaurarDestinoPadrao();
  vi.restoreAllMocks();
});

describe("ponto unico de reporte", () => {
  it("entrega ao destino o erro e o contexto", () => {
    const recebidos: Array<{ erro: unknown; contexto: ContextoDeErro }> = [];
    definirDestinoDeErro((erro, contexto) => recebidos.push({ erro, contexto }));

    const erro = new Error("caiu");
    reportarErro(erro, { modulo: "config", motivo: "leitura falhou" });

    expect(recebidos).toHaveLength(1);
    expect(recebidos[0].erro).toBe(erro);
    expect(recebidos[0].contexto).toEqual({
      modulo: "config",
      motivo: "leitura falhou",
    });
  });

  it("o contexto chega ao destino ja saneado — o destino nunca ve o dado cru", () => {
    let recebido: ContextoDeErro | null = null;
    definirDestinoDeErro((_erro, contexto) => {
      recebido = contexto;
    });

    reportarErro(new Error("caiu"), {
      email: "aluno@exemplo.com",
      motivo: "conta de aluno@exemplo.com recusada",
      chaves: ["flag.m4.caderno_erros"],
    });

    expect(recebido).toEqual({
      email: "[removido]",
      motivo: "conta de [email] recusada",
      chaves: ["flag.m4.caderno_erros"],
    });
  });

  it("entrega o Error original, para o Sentry nao perder a pilha de chamada", () => {
    let recebido: unknown = null;
    definirDestinoDeErro((erro) => {
      recebido = erro;
    });

    const erro = new Error("caiu");
    reportarErro(erro);

    expect(recebido).toBeInstanceOf(Error);
    expect((recebido as Error).stack).toBe(erro.stack);
  });

  it("o destino padrao escreve no console com a mensagem saneada", () => {
    const espiao = vi.spyOn(console, "error").mockImplementation(() => {});

    reportarErro(new Error("conta aluno@exemplo.com nao existe"), {
      modulo: "config",
    });

    expect(espiao).toHaveBeenCalledTimes(1);
    expect(espiao.mock.calls[0]).toEqual([
      "[erro]",
      { modulo: "config" },
      "Error: conta [email] nao existe",
    ]);
  });

  it("restaurarDestinoPadrao desfaz a troca de destino", () => {
    const espiaoDoDestino = vi.fn();
    definirDestinoDeErro(espiaoDoDestino);
    restaurarDestinoPadrao();

    const espiaoDoConsole = vi.spyOn(console, "error").mockImplementation(() => {});
    reportarErro(new Error("caiu"));

    expect(espiaoDoDestino).not.toHaveBeenCalled();
    expect(espiaoDoConsole).toHaveBeenCalledTimes(1);
  });

  it("erro do proprio destino nao escapa — reportar nao derruba quem chamou", () => {
    const espiao = vi.spyOn(console, "error").mockImplementation(() => {});
    definirDestinoDeErro(() => {
      throw new Error("Sentry fora do ar");
    });

    expect(() => reportarErro(new Error("o erro de verdade"))).not.toThrow();
    expect(espiao).toHaveBeenCalledWith(
      "[erro] o destino de reporte falhou",
      "Error: Sentry fora do ar",
      "Error: o erro de verdade",
    );
  });

  it("descreverErro preserva o nome da classe do erro e aceita o que nao e Error", () => {
    class ConfiguracaoRecusada extends Error {
      constructor(mensagem: string) {
        super(mensagem);
        this.name = "ConfiguracaoRecusada";
      }
    }

    expect(descreverErro(new ConfiguracaoRecusada("chave orfa"))).toBe(
      "ConfiguracaoRecusada: chave orfa",
    );
    expect(descreverErro("texto solto")).toBe("texto solto");
    expect(descreverErro(undefined)).toBe("undefined");
  });

  it("descreverErro serializa objeto puro e recua para String em referencia circular", () => {
    expect(
      descreverErro({
        code: "23502",
        message: "null value in column",
      }),
    ).toBe('{"code":"23502","message":"null value in column"}');

    const circular: Record<string, unknown> = { code: "XX000" };
    circular.self = circular;

    expect(descreverErro(circular)).toBe("[object Object]");
  });

  it("saneia dado pessoal dentro do JSON serializado antes de escrever no console", () => {
    const espiao = vi.spyOn(console, "error").mockImplementation(() => {});

    reportarErro({
      code: "23505",
      message: "conta aluno@exemplo.com recusada",
    });

    expect(espiao.mock.calls[0][2]).toBe(
      '{"code":"23505","message":"conta [email] recusada"}',
    );
  });
});
