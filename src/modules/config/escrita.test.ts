import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Chave } from "./catalogo";
import {
  ConfiguracaoRecusada,
  type LinhaDeConfig,
  definirLeitorAdministrativoDeConfig,
  definirGravadorDeConfig,
  definirInvalidacaoDeCache,
  lerConfiguracoesAdministrativas,
  restaurarLeitorAdministrativoPadrao,
  restaurarGravadorPadrao,
  restaurarInvalidacaoPadrao,
  setConfig,
} from "./escrita";

const AUTOR = "3f1b5a2c-9d4e-4a7b-8c6d-0e1f2a3b4c5d";

let gravadas: LinhaDeConfig[];
let invalidacoes: number;

beforeEach(() => {
  gravadas = [];
  invalidacoes = 0;
  definirGravadorDeConfig(async (linha) => {
    gravadas.push(linha);
  });
  definirInvalidacaoDeCache(() => {
    invalidacoes += 1;
  });
});

afterEach(() => {
  restaurarLeitorAdministrativoPadrao();
  restaurarGravadorPadrao();
  restaurarInvalidacaoPadrao();
});

describe("setConfig", () => {
  it("grava uma linha nova com o modulo dono vindo do catalogo, e invalida o cache", async () => {
    await setConfig("param.m4.diagnostico_n_questoes", 25, {
      autorId: AUTOR,
      motivo: "calibracao pos-piloto",
    });

    expect(gravadas).toEqual([
      {
        chave: "param.m4.diagnostico_n_questoes",
        valor: 25,
        moduloDono: "m4", // vem do catalogo, nao de quem chama
        autorId: AUTOR,
        motivo: "calibracao pos-piloto",
      },
    ]);
    expect(invalidacoes).toBe(1);
  });

  it("recusa valor que nao valida contra o tipo, antes de gravar", async () => {
    await expect(
      // @ts-expect-error o tipo ja barra: string onde o catalogo pede numero
      setConfig("param.m4.diagnostico_n_questoes", "vinte e cinco", {
        autorId: AUTOR,
        motivo: "teste",
      }),
    ).rejects.toThrow(ConfiguracaoRecusada);

    // .int().positive() nao aparece no tipo do TypeScript: quem pega e a validacao.
    await expect(
      setConfig("param.m4.diagnostico_n_questoes", -5, {
        autorId: AUTOR,
        motivo: "teste",
      }),
    ).rejects.toThrow(ConfiguracaoRecusada);

    await expect(
      setConfig("param.m4.fsrs_faixas_nota", { errei: 2, dificil: 0.7, bom: 0.9 }, {
        autorId: AUTOR,
        motivo: "teste",
      }),
    ).rejects.toThrow(ConfiguracaoRecusada);

    // Nada disso virou linha, e o cache nao foi mexido a toa.
    expect(gravadas).toEqual([]);
    expect(invalidacoes).toBe(0);
  });

  it("recusa chave fora do catalogo", async () => {
    // Chave literal inexistente e erro de compilacao.
    // @ts-expect-error chave que nao existe no catalogo
    const literal: Chave = "param.m4.inventada";
    expect(typeof literal).toBe("string");

    // Chave que chega por variavel (de uma tela, por exemplo) e barrada em execucao.
    const vindaDeFora = "param.m4.inventada" as Chave;
    await expect(
      setConfig(vindaDeFora, 1 as never, {
        autorId: AUTOR,
        motivo: "chave inexistente",
      }),
    ).rejects.toThrow(/nao existe no catalogo/);

    expect(gravadas).toEqual([]);
  });

  it("recusa alteracao sem autor: nao existe mudanca anonima (AC7)", async () => {
    const semAutor = [
      { autorId: "" },
      { autorId: "   " },
      { autorId: undefined as unknown as string },
      { autorId: null as unknown as string },
    ];

    for (const opcoes of semAutor) {
      await expect(
        setConfig("flag.m4.simulado_semanal", true, {
          ...opcoes,
          motivo: "teste",
        }),
      ).rejects.toThrow(ConfiguracaoRecusada);
    }

    expect(gravadas).toEqual([]);
    expect(invalidacoes).toBe(0);
  });

  it("recusa motivo vazio antes de gravar", async () => {
    const semMotivo = ["", "   ", undefined, null];

    for (const motivo of semMotivo) {
      await expect(
        setConfig("flag.m4.simulado_semanal", true, {
          autorId: AUTOR,
          motivo: motivo as string,
        }),
      ).rejects.toThrow(ConfiguracaoRecusada);
    }

    expect(gravadas).toEqual([]);
    expect(invalidacoes).toBe(0);
  });

  it("propaga a falha do banco em vez de fingir que gravou", async () => {
    definirGravadorDeConfig(async () => {
      throw new Error("banco fora do ar");
    });

    await expect(
      setConfig("flag.m4.simulado_semanal", true, {
        autorId: AUTOR,
        motivo: "teste de falha do banco",
      }),
    ).rejects.toThrow("banco fora do ar");

    // Cache nao pode ser invalidado por uma gravacao que nao aconteceu.
    expect(invalidacoes).toBe(0);
  });
});

describe("lerConfiguracoesAdministrativas", () => {
  it("combina catalogo, default, vigente e historico com autoria", async () => {
    definirLeitorAdministrativoDeConfig(async () => [
      {
        id: 1,
        chave: "param.m4.minutos_por_questao",
        valor: 2,
        modulo_dono: "m4",
        alterado_por: AUTOR,
        motivo: "valor inicial",
        alterado_em: "2026-08-23T10:00:00.000Z",
      },
      {
        id: 2,
        chave: "param.m4.minutos_por_questao",
        valor: 3,
        modulo_dono: "m4",
        alterado_por: "4b2d7f1a-6c8e-4d90-a2b4-5c6d7e8f9012",
        motivo: "ritmo do piloto",
        alterado_em: "2026-08-23T11:00:00.000Z",
      },
    ]);

    const configuracoes = await lerConfiguracoesAdministrativas();
    const minutos = configuracoes.find(
      (configuracao) => configuracao.chave === "param.m4.minutos_por_questao",
    );

    expect(minutos).toMatchObject({
      chave: "param.m4.minutos_por_questao",
      tipo: "param",
      moduloDono: "m4",
      padrao: 2,
      vigente: {
        valor: 3,
        autorId: "4b2d7f1a-6c8e-4d90-a2b4-5c6d7e8f9012",
        motivo: "ritmo do piloto",
        alteradoEm: "2026-08-23T11:00:00.000Z",
      },
    });
    expect(minutos?.descricao).toContain("tempo");
    expect(minutos?.historico.map((linha) => ({
      valor: linha.valor,
      autorId: linha.autorId,
      motivo: linha.motivo,
    }))).toEqual([
      { valor: 2, autorId: AUTOR, motivo: "valor inicial" },
      {
        valor: 3,
        autorId: "4b2d7f1a-6c8e-4d90-a2b4-5c6d7e8f9012",
        motivo: "ritmo do piloto",
      },
    ]);

    const flagSemLinha = configuracoes.find(
      (configuracao) => configuracao.chave === "flag.m4.simulado_semanal",
    );
    expect(flagSemLinha?.vigente).toEqual({
      valor: false,
      autorId: null,
      motivo: null,
      alteradoEm: null,
    });
  });
});
