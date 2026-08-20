import { afterEach, describe, expect, it } from "vitest";

import {
  type LeitorDeConfig,
  definirLeitorDeConfig,
  restaurarLeitorPadrao,
} from "@/modules/config";
import { restaurarDestinoPadrao } from "@/modules/observabilidade";

import type { Adaptador } from "./adaptador-openai";
import {
  type GeracaoGuardada,
  type RegistroDeGeracao,
  definirAdaptador,
  definirRepositorioDeIa,
  executarTarefa,
  montarChaveDeDedup,
  restaurarAdaptadorPadrao,
  restaurarRepositorioAusente,
} from "./gateway";
import { VERSAO_DO_PROMPT } from "./tarefas";

/**
 * IA-14 / AD-036 — rerodar a fabrica nao regera nem cobra de novo.
 *
 * O que se prova aqui e sempre a mesma coisa por dois angulos: o adapter **nao
 * e chamado**, e o custo da chamada reaproveitada e zero.
 */

const perfil = {
  modelo: "principal-de-teste",
  versao: "principal-de-teste-2026-01-01",
  esforco: "alto",
  batch: false,
  cache: true,
  fallback: null,
};

function comMatriz(): void {
  const leitor: LeitorDeConfig = async () => ({
    "param.m2.matriz_de_modelos": { explicacao: perfil },
  });
  definirLeitorDeConfig(leitor);
}

/** Repositorio com memoria de verdade: o que grava, acha depois. */
function repositorioComMemoria() {
  const memoria = new Map<string, GeracaoGuardada>();
  const gravadas: RegistroDeGeracao[] = [];

  definirRepositorioDeIa({
    async buscarPorChave(chave) {
      return memoria.get(chave) ?? null;
    },
    async gravar(registro) {
      gravadas.push(registro);
      if (registro.chaveDedup !== null) {
        memoria.set(registro.chaveDedup, {
          resultado: registro.resultado,
          modelo: registro.modelo,
          usouFallback: registro.usouFallback,
        });
      }
    },
    async gastoDoPeriodo() {
      return 0;
    },
    async registrarAlerta() {
      return true;
    },
  });

  return { memoria, gravadas };
}

function adaptadorQueConta() {
  let chamadas = 0;
  const falso: Adaptador = async () => {
    chamadas += 1;
    return {
      texto: `chamada numero ${chamadas}`,
      tokensEntrada: 10,
      tokensCacheados: 0,
      tokensSaida: 5,
    };
  };
  definirAdaptador(falso);
  return () => chamadas;
}

const alvo = { questaoId: "11111111-1111-1111-1111-111111111111", questaoVersao: 1 };

afterEach(() => {
  restaurarLeitorPadrao();
  restaurarDestinoPadrao();
  restaurarAdaptadorPadrao();
  restaurarRepositorioAusente();
});

describe("dedup", () => {
  it("a segunda chamada devolve a primeira, sem tocar no provedor", async () => {
    comMatriz();
    const quantasChamadas = adaptadorQueConta();
    const { gravadas } = repositorioComMemoria();

    const primeira = await executarTarefa({
      tarefa: "explicacao",
      pedido: { instrucao: "i", entrada: "e" },
      alvo,
    });
    const segunda = await executarTarefa({
      tarefa: "explicacao",
      pedido: { instrucao: "i", entrada: "e" },
      alvo,
    });

    expect(quantasChamadas()).toBe(1);
    expect(primeira.reaproveitada).toBe(false);
    expect(segunda.reaproveitada).toBe(true);
    expect(segunda.texto).toBe(primeira.texto);
    expect(segunda.custoUsd).toBe(0);
    // Nao grava linha nova: a geracao ja estava registrada.
    expect(gravadas).toHaveLength(1);
  });

  it("outra versao da mesma questao e outra geracao", async () => {
    comMatriz();
    const quantasChamadas = adaptadorQueConta();
    repositorioComMemoria();

    await executarTarefa({
      tarefa: "explicacao",
      pedido: { instrucao: "i", entrada: "e" },
      alvo,
    });
    await executarTarefa({
      tarefa: "explicacao",
      pedido: { instrucao: "i", entrada: "e" },
      alvo: { ...alvo, questaoVersao: 2 },
    });

    expect(quantasChamadas()).toBe(2);
  });

  it("mudar a versao do prompt muda a chave — e so assim a fabrica regera", () => {
    const antes = montarChaveDeDedup("explicacao", alvo);

    const original = VERSAO_DO_PROMPT.explicacao;
    try {
      VERSAO_DO_PROMPT.explicacao = `${original}-nova`;
      expect(montarChaveDeDedup("explicacao", alvo)).not.toBe(antes);
    } finally {
      VERSAO_DO_PROMPT.explicacao = original;
    }
  });

  it("chamada sem alvo nunca reaproveita: sempre chama o provedor", async () => {
    comMatriz();
    const quantasChamadas = adaptadorQueConta();
    repositorioComMemoria();

    await executarTarefa({ tarefa: "explicacao", pedido: { instrucao: "i", entrada: "e" } });
    await executarTarefa({ tarefa: "explicacao", pedido: { instrucao: "i", entrada: "e" } });

    expect(quantasChamadas()).toBe(2);
  });

  it("resultado estruturado volta estruturado, nao como texto", async () => {
    comMatriz();
    const falso: Adaptador = async () => ({
      texto: '{"formula":"juros_compostos"}',
      estruturado: { formula: "juros_compostos" },
      tokensEntrada: 1,
      tokensCacheados: 0,
      tokensSaida: 1,
    });
    definirAdaptador(falso);
    repositorioComMemoria();

    await executarTarefa({
      tarefa: "explicacao",
      pedido: { instrucao: "i", entrada: "e" },
      alvo,
    });
    const segunda = await executarTarefa({
      tarefa: "explicacao",
      pedido: { instrucao: "i", entrada: "e" },
      alvo,
    });

    expect(segunda.reaproveitada).toBe(true);
    expect(segunda.estruturado).toEqual({ formula: "juros_compostos" });
  });
});
