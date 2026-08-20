import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  type LeitorDeConfig,
  definirLeitorDeConfig,
  restaurarLeitorPadrao,
} from "@/modules/config";
import {
  definirDestinoDeErro,
  restaurarDestinoPadrao,
} from "@/modules/observabilidade";

import type { Adaptador } from "./adaptador-openai";
import {
  definirAdaptador,
  definirRepositorioDeIa,
  restaurarAdaptadorPadrao,
  restaurarRepositorioAusente,
} from "./gateway";
import { refazerUmaVez } from "./refazer";

const primeiraVolta = {
  modelo: "primeira-volta",
  versao: "primeira-volta-2026-01-01",
  esforco: "maximo",
  batch: false,
  cache: false,
  fallback: null,
};

/** A tarefa de reprocessamento aponta outro modelo **e** outro esforco. */
const segundaVolta = {
  modelo: "segunda-volta",
  versao: "segunda-volta-2026-01-01",
  esforco: "maximo-de-verdade",
  batch: false,
  cache: false,
  fallback: null,
};

function comMatriz(): void {
  const leitor: LeitorDeConfig = async () => ({
    "param.m2.matriz_de_modelos": {
      verificacao_quantitativa: primeiraVolta,
      reprocessamento_verificacao: segundaVolta,
      explicacao: primeiraVolta,
    },
  });
  definirLeitorDeConfig(leitor);
}

function adaptadorQueAnota() {
  const destinos: { modelo: string; esforco: string }[] = [];
  const falso: Adaptador = async (destino) => {
    destinos.push({ modelo: destino.modelo, esforco: destino.esforco });
    return {
      texto: `resposta de ${destino.modelo}`,
      tokensEntrada: 1,
      tokensCacheados: 0,
      tokensSaida: 1,
    };
  };
  definirAdaptador(falso);
  return destinos;
}

const chamada = {
  tarefa: "verificacao_quantitativa" as const,
  pedido: { instrucao: "i", entrada: "e" },
};

let reportes: unknown[];

beforeEach(() => {
  reportes = [];
  definirDestinoDeErro((erro) => {
    reportes.push(erro);
  });
  comMatriz();
  definirRepositorioDeIa({
    async buscarPorChave() {
      return null;
    },
    async gravar() {},
    async gastoDoPeriodo() {
      return 0;
    },
    async registrarAlerta() {
      return true;
    },
  });
});

afterEach(() => {
  restaurarLeitorPadrao();
  restaurarDestinoPadrao();
  restaurarAdaptadorPadrao();
  restaurarRepositorioAusente();
});

describe("refazerUmaVez (IA-13)", () => {
  it("aprovado na primeira: nao ha segunda chamada", async () => {
    const destinos = adaptadorQueAnota();

    const saida = await refazerUmaVez(chamada, () => true);

    expect(saida).toMatchObject({ aprovado: true, tentativas: 1, escalou: false });
    expect(destinos).toHaveLength(1);
    expect(destinos[0].modelo).toBe("primeira-volta");
  });

  it("reprovado na primeira: refaz escalando modelo e esforco", async () => {
    const destinos = adaptadorQueAnota();
    let conferencias = 0;

    const saida = await refazerUmaVez(chamada, () => {
      conferencias += 1;
      return conferencias > 1; // reprova a primeira, aprova a segunda
    });

    expect(saida).toMatchObject({ aprovado: true, tentativas: 2, escalou: true });
    expect(destinos).toEqual([
      { modelo: "primeira-volta", esforco: "maximo" },
      { modelo: "segunda-volta", esforco: "maximo-de-verdade" },
    ]);
  });

  it("reprovado nas duas: para em duas, nunca uma terceira", async () => {
    const destinos = adaptadorQueAnota();

    const saida = await refazerUmaVez(chamada, () => false);

    expect(saida).toMatchObject({ aprovado: false, tentativas: 2, escalou: true });
    expect(destinos).toHaveLength(2);
  });

  it("erro tecnico na conferencia conta como reprovado, nunca como aprovado", async () => {
    const destinos = adaptadorQueAnota();

    const saida = await refazerUmaVez(chamada, () => {
      throw new Error("divisao por zero");
    });

    expect(saida.aprovado).toBe(false);
    expect(destinos).toHaveLength(2);
    expect(reportes).toHaveLength(2);
  });

  it("tarefa sem par de reprocessamento nao ganha segunda tentativa", async () => {
    const destinos = adaptadorQueAnota();

    const saida = await refazerUmaVez(
      { tarefa: "explicacao", pedido: { instrucao: "i", entrada: "e" } },
      () => false,
    );

    expect(saida).toMatchObject({ aprovado: false, tentativas: 1, escalou: false });
    expect(destinos).toHaveLength(1);
  });

  it("o conferidor decide, e o mecanismo nao sabe o que ele confere", async () => {
    adaptadorQueAnota();

    const saida = await refazerUmaVez(chamada, (resultado) =>
      resultado.texto.includes("segunda-volta"),
    );

    expect(saida.aprovado).toBe(true);
    expect(saida.tentativas).toBe(2);
  });
});
