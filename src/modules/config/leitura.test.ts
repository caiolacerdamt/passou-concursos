import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CATALOGO, CHAVES, type Chave } from "./catalogo";
import {
  JANELA_DE_CACHE_SEGUNDOS,
  type LeitorDeConfig,
  definirLeitorDeConfig,
  definirReporteDeErro,
  getParam,
  getParams,
  isFlagOn,
  restaurarLeitorPadrao,
  restaurarReportePadrao,
} from "./leitura";

/** Leitor de mentira: devolve o que o teste mandar, e conta as idas ao banco. */
function leitorFalso(resposta: Record<string, unknown>) {
  const chamadas: (readonly Chave[])[] = [];
  const leitor: LeitorDeConfig = async (chaves) => {
    chamadas.push(chaves);
    return resposta;
  };
  return { leitor, chamadas };
}

const leitorQueQuebra: LeitorDeConfig = async () => {
  throw new Error("banco fora do ar");
};

let reportes: { erro: unknown; contexto: Record<string, unknown> }[];

beforeEach(() => {
  reportes = [];
  definirReporteDeErro((erro, contexto) => reportes.push({ erro, contexto }));
});

afterEach(() => {
  restaurarLeitorPadrao();
  restaurarReportePadrao();
  vi.restoreAllMocks();
});

describe("getParam", () => {
  it("devolve o valor vigente do banco, tipado", async () => {
    const { leitor } = leitorFalso({ "param.m4.diagnostico_n_questoes": 25 });
    definirLeitorDeConfig(leitor);

    const valor = await getParam("param.m4.diagnostico_n_questoes");

    expect(valor).toBe(25);
    // Nao e o default do catalogo: o banco mandou outro numero.
    expect(valor).not.toBe(CATALOGO["param.m4.diagnostico_n_questoes"].padrao);
    expect(reportes).toEqual([]);
  });

  it("devolve o default do catalogo quando nao ha linha no banco, sem alertar", async () => {
    const { leitor } = leitorFalso({});
    definirLeitorDeConfig(leitor);

    expect(await getParam("param.m4.diagnostico_n_questoes")).toBe(20);
    expect(await getParam("param.m4.fsrs_faixas_nota")).toEqual({
      errei: 0.5,
      dificil: 0.7,
      bom: 0.9,
    });
    // Banco vazio e operacao normal, nao incidente: o sistema sobe assim.
    expect(reportes).toEqual([]);
  });

  it("devolve o default e reporta quando a leitura falha (AC6)", async () => {
    definirLeitorDeConfig(leitorQueQuebra);

    expect(await getParam("param.m4.minutos_por_questao")).toBe(2);
    expect(reportes).toHaveLength(1);
    expect(reportes[0].contexto.motivo).toBe("falha ao ler a configuracao");
    expect((reportes[0].erro as Error).message).toBe("banco fora do ar");
  });

  it("devolve o default e reporta quando o valor do banco nao valida contra o tipo", async () => {
    const { leitor } = leitorFalso({
      "param.m4.diagnostico_n_questoes": "vinte", // deveria ser numero inteiro
      "param.m4.peso_devendo_revisao": -3, // .positive() recusa
    });
    definirLeitorDeConfig(leitor);

    expect(await getParam("param.m4.diagnostico_n_questoes")).toBe(20);
    expect(await getParam("param.m4.peso_devendo_revisao")).toBe(1.5);

    expect(reportes).toHaveLength(2);
    expect(reportes.map((r) => r.contexto.chave)).toEqual([
      "param.m4.diagnostico_n_questoes",
      "param.m4.peso_devendo_revisao",
    ]);
  });
});

describe("isFlagOn", () => {
  it("devolve false em qualquer falha, mesmo com default declarado true (AC6)", async () => {
    // caderno_erros nasce ligada no catalogo. Ainda assim, ilegivel = desligada.
    expect(CATALOGO["flag.m4.caderno_erros"].padrao).toBe(true);

    definirLeitorDeConfig(leitorQueQuebra);
    expect(await isFlagOn("flag.m4.caderno_erros")).toBe(false);

    const { leitor } = leitorFalso({ "flag.m4.caderno_erros": "sim" });
    definirLeitorDeConfig(leitor);
    expect(await isFlagOn("flag.m4.caderno_erros")).toBe(false);

    expect(reportes).toHaveLength(2);
  });

  it("respeita o valor do banco e, sem linha, o default declarado", async () => {
    const { leitor } = leitorFalso({ "flag.m4.simulado_semanal": true });
    definirLeitorDeConfig(leitor);
    // Banco liga uma flag que nasce desligada.
    expect(await isFlagOn("flag.m4.simulado_semanal")).toBe(true);

    const vazio = leitorFalso({});
    definirLeitorDeConfig(vazio.leitor);
    // Sem linha nao e duvida: e operacao normal.
    expect(await isFlagOn("flag.m4.caderno_erros")).toBe(true);
    expect(await isFlagOn("flag.m4.diagnostico_adaptativo")).toBe(false);
    expect(reportes).toEqual([]);
  });
});

describe("getParams", () => {
  it("le varias chaves em um unico round-trip", async () => {
    const { leitor, chamadas } = leitorFalso({
      "param.m4.minutos_por_questao": 3,
      "param.m4.diagnostico_n_questoes": 15,
    });
    definirLeitorDeConfig(leitor);

    const [minutos, diagnostico, semLinha] = await getParams(
      "param.m4.minutos_por_questao",
      "param.m4.diagnostico_n_questoes",
      "param.m4.dias_sem_repetir_questao",
    );

    expect(minutos).toBe(3);
    expect(diagnostico).toBe(15);
    expect(semLinha).toBe(30); // default do catalogo

    // Uma ida ao banco so, com as tres chaves juntas — nao tres idas.
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]).toEqual([
      "param.m4.minutos_por_questao",
      "param.m4.diagnostico_n_questoes",
      "param.m4.dias_sem_repetir_questao",
    ]);
  });
});

describe("fronteira da variavel de ambiente (AC2)", () => {
  it("nenhum valor de configuracao vem de variavel de ambiente", async () => {
    const { readFileSync } = await import("node:fs");

    // Env var existe so para o que precisa existir ANTES de o banco responder —
    // URL e chave do Supabase, que moram em src/lib/db. Flag e parametro de
    // produto vem da tabela, com default no catalogo. Se um dia alguem ler
    // process.env aqui dentro, este teste avisa.
    for (const arquivo of [
      "src/modules/config/leitura.ts",
      "src/modules/config/escrita.ts",
      "src/modules/config/catalogo.ts",
    ]) {
      expect(readFileSync(arquivo, "utf8")).not.toContain("process.env");
    }
  });
});

describe("janela de cache", () => {
  it("e constante em codigo, 30s, e nao existe como chave de configuracao", async () => {
    expect(JANELA_DE_CACHE_SEGUNDOS).toBe(30);

    // A circularidade que isto evita: se o TTL morasse na tabela que ele mesmo
    // cacheia, um valor errado se auto-perpetuaria e o valor novo nunca chegaria.
    const chavesDeCache = CHAVES.filter((chave) => /cache|ttl|janela/.test(chave));
    expect(chavesDeCache).toEqual([]);
  });
});
