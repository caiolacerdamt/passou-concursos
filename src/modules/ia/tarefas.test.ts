import { describe, expect, it } from "vitest";

import { CATALOGO } from "@/modules/config/catalogo";

import {
  TAREFA_DE_REFAZER,
  TAREFAS,
  VERSAO_DO_PROMPT,
  existeTarefa,
} from "./tarefas";

describe("a lista fechada de tarefas (IA-02 AC2)", () => {
  it("tem exatamente as tarefas que a spec enumera", () => {
    // Copiada do IA-02 AC2 a mao, de proposito: se alguem acrescentar tarefa em
    // `tarefas.ts`, este teste fica vermelho e obriga a passar pela spec.
    expect([...TAREFAS].sort()).toEqual(
      [
        "extracao_pdf",
        "explicacao",
        "verificacao_quantitativa",
        "classificacao_topico",
        "plano_inicial",
        "frase_do_plano",
        "tutor",
        "rascunho_inedita",
        "reprocessamento_verificacao",
      ].sort(),
    );
  });

  it("nao inclui embeddings — chamada direta ao Cohere, fora do gateway", () => {
    expect(TAREFAS.some((tarefa) => tarefa.includes("embedding"))).toBe(false);
  });

  it("reconhece o que esta na lista e recusa o que nao esta", () => {
    expect(existeTarefa("explicacao")).toBe(true);
    expect(existeTarefa("pre_diagnostico")).toBe(false);
  });

  it("toda tarefa tem versao de prompt — sem ela a chave de dedup fica torta", () => {
    for (const tarefa of TAREFAS) {
      expect(VERSAO_DO_PROMPT[tarefa]).toBeTruthy();
    }
    expect(Object.keys(VERSAO_DO_PROMPT).sort()).toEqual([...TAREFAS].sort());
  });

  it("quem refaz aponta para tarefa que existe", () => {
    for (const [de, para] of Object.entries(TAREFA_DE_REFAZER)) {
      expect(existeTarefa(de)).toBe(true);
      expect(existeTarefa(para as string)).toBe(true);
      expect(para).not.toBe(de);
    }
  });
});

describe("as chaves de configuracao do M2", () => {
  it("nascem vazias: nenhum nome de modelo mora no catalogo", () => {
    expect(CATALOGO["param.m2.matriz_de_modelos"].padrao).toEqual({});
    expect(CATALOGO["param.m2.precos_por_modelo"].padrao).toEqual({});
  });

  it("aceita um perfil completo e recusa um perfil sem versao fixada", () => {
    const tipo = CATALOGO["param.m2.matriz_de_modelos"].tipo;

    const completo = {
      frase_do_plano: {
        modelo: "modelo-de-teste",
        versao: "2026-01-01",
        esforco: "baixo",
        batch: false,
        cache: true,
        fallback: null,
      },
    };
    expect(tipo.safeParse(completo).success).toBe(true);

    const semVersao = {
      frase_do_plano: {
        modelo: "modelo-de-teste",
        esforco: "baixo",
        batch: false,
        cache: true,
        fallback: null,
      },
    };
    expect(tipo.safeParse(semVersao).success).toBe(false);
  });

  it("tem teto de gasto positivo e nao tem chave que desligue tarefa por gasto", () => {
    expect(CATALOGO["param.m2.teto_gasto_mensal_usd"].padrao).toBeGreaterThan(0);

    const chavesM2 = Object.keys(CATALOGO).filter((chave) =>
      chave.includes(".m2."),
    );
    expect(chavesM2.some((chave) => chave.startsWith("flag.m2."))).toBe(false);
  });
});
