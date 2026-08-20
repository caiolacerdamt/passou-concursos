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
  GatewayParou,
  type RegistroDeGeracao,
  TarefaEhDeLote,
  definirAdaptador,
  definirRepositorioDeIa,
  executarTarefa,
  montarChaveDeDedup,
  restaurarAdaptadorPadrao,
  restaurarRepositorioAusente,
} from "./gateway";
import { TarefaSemPerfil } from "./matriz";

const perfilBase = {
  modelo: "principal-de-teste",
  versao: "principal-de-teste-2026-01-01",
  esforco: "alto",
  batch: false,
  cache: true,
  fallback: {
    modelo: "reserva-de-teste",
    versao: "reserva-de-teste-2025-12-01",
    esforco: "medio",
  },
};

function comMatriz(matriz: Record<string, unknown>): void {
  const leitor: LeitorDeConfig = async () => ({
    "param.m2.matriz_de_modelos": matriz,
  });
  definirLeitorDeConfig(leitor);
}

/** Repositorio de mentira: guarda o que foi gravado, e nada mais. */
function repositorioFalso(guardadas: Record<string, unknown> = {}) {
  const gravadas: RegistroDeGeracao[] = [];
  definirRepositorioDeIa({
    async buscarPorChave(chave) {
      const achada = guardadas[chave];
      return achada === undefined
        ? null
        : { resultado: achada, modelo: "principal-de-teste", usouFallback: false };
    },
    async gravar(registro) {
      gravadas.push(registro);
    },
    // O gasto tem teste proprio; aqui ele so nao pode atrapalhar.
    async gastoDoPeriodo() {
      return 0;
    },
    async registrarAlerta() {
      return true;
    },
  });
  return gravadas;
}

/** Adapter de mentira: responde, ou quebra, conforme o destino. */
function adaptadorFalso(comportamento: Record<string, "responde" | "quebra">) {
  const chamados: string[] = [];
  const falso: Adaptador = async (destino) => {
    chamados.push(destino.modelo);
    if (comportamento[destino.modelo] === "quebra") {
      throw new Error(`o provedor recusou ${destino.modelo}`);
    }
    return {
      texto: `resposta de ${destino.modelo}`,
      tokensEntrada: 100,
      tokensCacheados: 20,
      tokensSaida: 50,
    };
  };
  definirAdaptador(falso);
  return chamados;
}

let reportes: { contexto: Record<string, unknown> }[];

beforeEach(() => {
  reportes = [];
  definirDestinoDeErro((_erro, contexto) => {
    reportes.push({ contexto });
  });
});

afterEach(() => {
  restaurarLeitorPadrao();
  restaurarDestinoPadrao();
  restaurarAdaptadorPadrao();
  restaurarRepositorioAusente();
});

describe("caminho feliz", () => {
  it("usa o principal e grava modelo, versao, esforco e versao do prompt (IA-02 AC4)", async () => {
    comMatriz({ explicacao: perfilBase });
    const chamados = adaptadorFalso({ "principal-de-teste": "responde" });
    const gravadas = repositorioFalso();

    const resultado = await executarTarefa({
      tarefa: "explicacao",
      pedido: { instrucao: "i", entrada: "e" },
      alvo: { questaoId: "11111111-1111-1111-1111-111111111111", questaoVersao: 2 },
    });

    expect(resultado.texto).toBe("resposta de principal-de-teste");
    expect(resultado.usouFallback).toBe(false);
    expect(chamados).toEqual(["principal-de-teste"]);

    expect(gravadas).toHaveLength(1);
    expect(gravadas[0]).toMatchObject({
      tarefa: "explicacao",
      modelo: "principal-de-teste",
      modeloVersao: "principal-de-teste-2026-01-01",
      esforco: "alto",
      usouFallback: false,
      batch: false,
      questaoId: "11111111-1111-1111-1111-111111111111",
      questaoVersao: 2,
      tokensEntrada: 100,
      tokensSaida: 50,
    });
    expect(gravadas[0].versaoPrompt).toBeTruthy();
  });

  it("chamada sem alvo nao guarda o resultado — texto de aluno nao vira copia", async () => {
    comMatriz({ frase_do_plano: perfilBase });
    adaptadorFalso({ "principal-de-teste": "responde" });
    const gravadas = repositorioFalso();

    await executarTarefa({
      tarefa: "frase_do_plano",
      pedido: { instrucao: "i", entrada: "e" },
    });

    expect(gravadas[0].chaveDedup).toBeNull();
    expect(gravadas[0].resultado).toBeNull();
  });
});

describe("custo da geracao (IA-12)", () => {
  it("grava o custo calculado a partir dos precos da configuracao", async () => {
    definirLeitorDeConfig(async () => ({
      "param.m2.matriz_de_modelos": { explicacao: perfilBase },
      "param.m2.precos_por_modelo": {
        "principal-de-teste": { entrada: 1, saida: 2, entrada_cacheada: 0 },
      },
    }));
    adaptadorFalso({ "principal-de-teste": "responde" });
    const gravadas = repositorioFalso();

    const resultado = await executarTarefa({
      tarefa: "explicacao",
      pedido: { instrucao: "i", entrada: "e" },
    });

    // 80 tokens cheios x US$1 + 20 cacheados x US$0 + 50 de saida x US$2,
    // tudo por milhao.
    const esperado = (80 * 1 + 20 * 0 + 50 * 2) / 1_000_000;
    expect(resultado.custoUsd).toBeCloseTo(esperado, 10);
    expect(gravadas[0].custoUsd).toBeCloseTo(esperado, 10);
  });

  it("sem preco na configuracao o custo fica null, e a geracao acontece assim mesmo", async () => {
    comMatriz({ explicacao: perfilBase });
    adaptadorFalso({ "principal-de-teste": "responde" });
    const gravadas = repositorioFalso();

    const resultado = await executarTarefa({
      tarefa: "explicacao",
      pedido: { instrucao: "i", entrada: "e" },
    });

    expect(resultado.texto).toBe("resposta de principal-de-teste");
    expect(gravadas[0].custoUsd).toBeNull();
  });
});

describe("fallback (IA-02 AC5)", () => {
  it("derrubar o principal faz o fallback assumir, com registro", async () => {
    comMatriz({ explicacao: perfilBase });
    const chamados = adaptadorFalso({
      "principal-de-teste": "quebra",
      "reserva-de-teste": "responde",
    });
    const gravadas = repositorioFalso();

    const resultado = await executarTarefa({
      tarefa: "explicacao",
      pedido: { instrucao: "i", entrada: "e" },
      alvo: { livre: "qualquer" },
    });

    expect(resultado.texto).toBe("resposta de reserva-de-teste");
    expect(resultado.usouFallback).toBe(true);
    expect(chamados).toEqual(["principal-de-teste", "reserva-de-teste"]);

    // O evento e registrado nos dois lugares: no Sentry e na linha da geracao.
    expect(reportes).toHaveLength(1);
    expect(reportes[0].contexto).toMatchObject({ modulo: "ia", tarefa: "explicacao" });
    expect(gravadas[0]).toMatchObject({
      usouFallback: true,
      modelo: "reserva-de-teste",
      modeloVersao: "reserva-de-teste-2025-12-01",
      esforco: "medio",
    });
  });

  it("fallback tambem falha: para de forma visivel, sem resultado parcial", async () => {
    comMatriz({ explicacao: perfilBase });
    adaptadorFalso({
      "principal-de-teste": "quebra",
      "reserva-de-teste": "quebra",
    });
    const gravadas = repositorioFalso();

    await expect(
      executarTarefa({
        tarefa: "explicacao",
        pedido: { instrucao: "i", entrada: "e" },
      }),
    ).rejects.toBeInstanceOf(GatewayParou);

    expect(gravadas).toHaveLength(0);
    expect(reportes).toHaveLength(2);
  });

  it("sem fallback configurado, a falha do principal ja e a parada", async () => {
    comMatriz({ explicacao: { ...perfilBase, fallback: null } });
    const chamados = adaptadorFalso({ "principal-de-teste": "quebra" });
    repositorioFalso();

    await expect(
      executarTarefa({
        tarefa: "explicacao",
        pedido: { instrucao: "i", entrada: "e" },
      }),
    ).rejects.toBeInstanceOf(GatewayParou);

    expect(chamados).toEqual(["principal-de-teste"]);
  });
});

describe("recusas antes de gastar", () => {
  it("tarefa fora da matriz para, sem chamar modelo nenhum", async () => {
    comMatriz({});
    const chamados = adaptadorFalso({ "principal-de-teste": "responde" });
    repositorioFalso();

    await expect(
      executarTarefa({ tarefa: "tutor", pedido: { instrucao: "i", entrada: "e" } }),
    ).rejects.toBeInstanceOf(TarefaSemPerfil);

    expect(chamados).toEqual([]);
  });

  it("tarefa marcada batch nao roda sincrona (IA-02 AC9)", async () => {
    comMatriz({ explicacao: { ...perfilBase, batch: true } });
    const chamados = adaptadorFalso({ "principal-de-teste": "responde" });
    repositorioFalso();

    await expect(
      executarTarefa({
        tarefa: "explicacao",
        pedido: { instrucao: "i", entrada: "e" },
      }),
    ).rejects.toBeInstanceOf(TarefaEhDeLote);

    expect(chamados).toEqual([]);
  });
});

describe("chave de dedup (IA-14)", () => {
  it("junta tarefa, versao do prompt e a questao com a versao", () => {
    const chave = montarChaveDeDedup("explicacao", {
      questaoId: "abc",
      questaoVersao: 3,
    });
    expect(chave).toContain("explicacao");
    expect(chave).toContain("abc");
    expect(chave).toContain("3");
  });

  it("sem alvo nao ha chave", () => {
    expect(montarChaveDeDedup("frase_do_plano", null)).toBeNull();
  });

  it("questoes diferentes dao chaves diferentes", () => {
    const a = montarChaveDeDedup("explicacao", { questaoId: "x", questaoVersao: 1 });
    const b = montarChaveDeDedup("explicacao", { questaoId: "y", questaoVersao: 1 });
    const c = montarChaveDeDedup("explicacao", { questaoId: "x", questaoVersao: 2 });
    expect(new Set([a, b, c]).size).toBe(3);
  });
});
