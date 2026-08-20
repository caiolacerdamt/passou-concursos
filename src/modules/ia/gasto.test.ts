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

import {
  type ContadorDeGasto,
  calcularCusto,
  conferirGasto,
  periodoDe,
} from "./gasto";

const precos = {
  "modelo-barato": { entrada: 0.2, saida: 1.2, entrada_cacheada: 0.02 },
  "modelo-sem-cache": { entrada: 1, saida: 10 },
};

function comConfig(valores: Record<string, unknown>): void {
  const leitor: LeitorDeConfig = async () => valores;
  definirLeitorDeConfig(leitor);
}

/** Contador de mentira: diz quanto se gastou e conta os alertas emitidos. */
function contadorFalso(gasto: number, jaAlertou = false) {
  const alertas: { periodo: string; gasto: number; teto: number }[] = [];
  let alertado = jaAlertou;

  const contador: ContadorDeGasto = {
    async gastoDoPeriodo() {
      return gasto;
    },
    async registrarAlerta(periodo, valor, teto) {
      if (alertado) return false; // e a PK do banco que recusa o segundo
      alertado = true;
      alertas.push({ periodo, gasto: valor, teto });
      return true;
    },
  };

  return { contador, alertas };
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
});

describe("periodoDe", () => {
  it("e o mes em UTC, no formato que a PK do alerta aceita", () => {
    expect(periodoDe(new Date("2026-08-20T03:00:00Z"))).toBe("2026-08");
    expect(periodoDe(new Date("2026-01-01T00:00:00Z"))).toBe("2026-01");
  });
});

describe("calcularCusto", () => {
  it("cobra a entrada cacheada mais barato, e nao a conta duas vezes", () => {
    // 1.000.000 de entrada, dos quais 500.000 cacheados, e 1.000.000 de saida.
    const custo = calcularCusto(precos, "modelo-barato", {
      tokensEntrada: 1_000_000,
      tokensCacheados: 500_000,
      tokensSaida: 1_000_000,
    });

    // 0,5 x 0,20 + 0,5 x 0,02 + 1 x 1,20
    expect(custo).toBeCloseTo(0.5 * 0.2 + 0.5 * 0.02 + 1.2, 6);
  });

  it("sem preco de cacheado, o cacheado custa o preco cheio", () => {
    const custo = calcularCusto(precos, "modelo-sem-cache", {
      tokensEntrada: 1_000_000,
      tokensCacheados: 1_000_000,
      tokensSaida: 0,
    });
    expect(custo).toBeCloseTo(1, 6);
  });

  it("preco ausente na configuracao custa null, nunca zero", () => {
    // Zero mentiria dizendo que a chamada foi de graca, e a soma do mes ficaria
    // menor do que a fatura.
    expect(
      calcularCusto(precos, "modelo-que-ninguem-precificou", {
        tokensEntrada: 10,
        tokensCacheados: 0,
        tokensSaida: 10,
      }),
    ).toBeNull();
  });

  it("provedor que nao informou tokens tambem custa null", () => {
    expect(
      calcularCusto(precos, "modelo-barato", {
        tokensEntrada: null,
        tokensCacheados: null,
        tokensSaida: null,
      }),
    ).toBeNull();
  });
});

describe("conferirGasto (IA-12)", () => {
  it("abaixo do teto nao alerta", async () => {
    comConfig({ "param.m2.teto_gasto_mensal_usd": 60 });
    const { contador, alertas } = contadorFalso(59.99);

    await conferirGasto(contador, new Date("2026-08-20T00:00:00Z"));

    expect(alertas).toEqual([]);
    expect(reportes).toEqual([]);
  });

  it("acima do teto alerta uma vez, com o periodo e os dois numeros", async () => {
    comConfig({ "param.m2.teto_gasto_mensal_usd": 60 });
    const { contador, alertas } = contadorFalso(75.5);

    await conferirGasto(contador, new Date("2026-08-20T00:00:00Z"));

    expect(alertas).toEqual([{ periodo: "2026-08", gasto: 75.5, teto: 60 }]);
    expect(reportes).toHaveLength(1);
    expect(reportes[0].contexto).toMatchObject({ modulo: "ia", periodo: "2026-08" });
  });

  it("a segunda passagem do mesmo mes nao alerta de novo", async () => {
    comConfig({ "param.m2.teto_gasto_mensal_usd": 60 });
    const { contador, alertas } = contadorFalso(75.5);

    await conferirGasto(contador, new Date("2026-08-20T00:00:00Z"));
    await conferirGasto(contador, new Date("2026-08-21T00:00:00Z"));
    await conferirGasto(contador, new Date("2026-08-22T00:00:00Z"));

    expect(alertas).toHaveLength(1);
    expect(reportes).toHaveLength(1);
  });

  it("mes que ja tinha alerta registrado nao repete o aviso", async () => {
    comConfig({ "param.m2.teto_gasto_mensal_usd": 60 });
    const { contador, alertas } = contadorFalso(90, true);

    await conferirGasto(contador, new Date("2026-08-20T00:00:00Z"));

    expect(alertas).toEqual([]);
    expect(reportes).toEqual([]);
  });

  it("falha ao consultar o gasto nao derruba quem chamou", async () => {
    comConfig({ "param.m2.teto_gasto_mensal_usd": 60 });
    const contador: ContadorDeGasto = {
      async gastoDoPeriodo() {
        throw new Error("banco fora do ar");
      },
      async registrarAlerta() {
        return true;
      },
    };

    await expect(conferirGasto(contador)).resolves.toBeUndefined();
    expect(reportes).toHaveLength(1);
  });

  it("nao existe caminho que desligue tarefa por gasto", async () => {
    // O contrato do IA-12: `conferirGasto` nao devolve decisao nenhuma. Se um
    // dia devolver, este teste quebra e a decisao volta para a mesa.
    comConfig({ "param.m2.teto_gasto_mensal_usd": 1 });
    const { contador } = contadorFalso(1_000_000);

    expect(await conferirGasto(contador)).toBeUndefined();
  });
});
