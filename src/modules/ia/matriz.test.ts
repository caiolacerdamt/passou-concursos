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

import { TarefaSemPerfil, fallbackDe, perfilDaTarefa, principalDe } from "./matriz";

/**
 * Uma matriz de mentira. **Nenhum nome de modelo real aparece em teste** — o que
 * se prova aqui e que o codigo repassa o que a configuracao mandar, seja qual
 * for (IA-02 AC1).
 */
function comMatriz(matriz: Record<string, unknown>): void {
  const leitor: LeitorDeConfig = async () => ({
    "param.m2.matriz_de_modelos": matriz,
  });
  definirLeitorDeConfig(leitor);
}

const perfilCompleto = {
  modelo: "principal-de-teste",
  versao: "2026-01-01",
  esforco: "alto",
  batch: false,
  cache: true,
  fallback: {
    modelo: "reserva-de-teste",
    versao: "2025-12-01",
    esforco: "medio",
  },
};

let reportes: unknown[];

beforeEach(() => {
  reportes = [];
  definirDestinoDeErro((erro) => {
    reportes.push(erro);
  });
});

afterEach(() => {
  restaurarLeitorPadrao();
  restaurarDestinoPadrao();
});

describe("perfilDaTarefa (IA-02 AC1)", () => {
  it("devolve o que a configuracao mandar, sem conhecer nenhum modelo", async () => {
    comMatriz({ explicacao: perfilCompleto });

    const perfil = await perfilDaTarefa("explicacao");

    expect(principalDe(perfil)).toEqual({
      modelo: "principal-de-teste",
      versao: "2026-01-01",
      esforco: "alto",
    });
    expect(fallbackDe(perfil)).toEqual({
      modelo: "reserva-de-teste",
      versao: "2025-12-01",
      esforco: "medio",
    });
  });

  it("trocar o modelo na configuracao muda o comportamento sem tocar em codigo", async () => {
    comMatriz({ explicacao: perfilCompleto });
    expect((await perfilDaTarefa("explicacao")).modelo).toBe("principal-de-teste");

    comMatriz({
      explicacao: { ...perfilCompleto, modelo: "outro-modelo-de-teste" },
    });
    expect((await perfilDaTarefa("explicacao")).modelo).toBe("outro-modelo-de-teste");
  });

  it("mudar o esforco de uma tarefa nao encosta nas outras", async () => {
    comMatriz({
      explicacao: { ...perfilCompleto, esforco: "maximo" },
      classificacao_topico: { ...perfilCompleto, esforco: "baixo" },
      tutor: { ...perfilCompleto, esforco: "medio" },
    });

    expect((await perfilDaTarefa("explicacao")).esforco).toBe("maximo");
    expect((await perfilDaTarefa("classificacao_topico")).esforco).toBe("baixo");
    expect((await perfilDaTarefa("tutor")).esforco).toBe("medio");
  });

  it("batch e cache sao decisao da tarefa, cada uma com o seu", async () => {
    comMatriz({
      explicacao: { ...perfilCompleto, batch: true, cache: true },
      tutor: { ...perfilCompleto, batch: false, cache: false },
    });

    expect(await perfilDaTarefa("explicacao")).toMatchObject({
      batch: true,
      cache: true,
    });
    expect(await perfilDaTarefa("tutor")).toMatchObject({
      batch: false,
      cache: false,
    });
  });

  it("matriz vazia e parada visivel, nunca um modelo adivinhado", async () => {
    comMatriz({});

    await expect(perfilDaTarefa("explicacao")).rejects.toBeInstanceOf(
      TarefaSemPerfil,
    );
    await expect(perfilDaTarefa("explicacao")).rejects.toThrow(/vazia/);
  });

  it("tarefa sem linha para, mesmo quando outras tem", async () => {
    comMatriz({ explicacao: perfilCompleto });

    await expect(perfilDaTarefa("tutor")).rejects.toBeInstanceOf(TarefaSemPerfil);
  });

  it("perfil malformado nao vale: cai no default vazio do catalogo e para", async () => {
    // Sem `versao` o perfil nao valida contra o tipo declarado. O modulo de
    // config reporta e devolve o default — que e `{}` — e o gateway para.
    comMatriz({ explicacao: { modelo: "principal-de-teste", esforco: "alto" } });

    await expect(perfilDaTarefa("explicacao")).rejects.toBeInstanceOf(
      TarefaSemPerfil,
    );
    expect(reportes.length).toBeGreaterThan(0);
  });

  it("fallback nulo e caso legitimo: nao ha para onde ir", async () => {
    comMatriz({ tutor: { ...perfilCompleto, fallback: null } });

    expect(fallbackDe(await perfilDaTarefa("tutor"))).toBeNull();
  });

  it("tarefa orfa na matriz e reportada, mas nao derruba as outras", async () => {
    comMatriz({
      explicacao: perfilCompleto,
      tarefa_que_nao_existe: perfilCompleto,
    });

    expect((await perfilDaTarefa("explicacao")).modelo).toBe("principal-de-teste");
    expect(reportes.length).toBe(1);
  });
});
