import { describe, expect, it } from "vitest";

import type { ClienteSql } from "@/modules/ia";

import {
  gravarExplicacaoAprovada,
  gravarExplicacaoRejeitada,
} from "./explicacao";

const entrada = {
  questaoId: "11111111-1111-1111-1111-111111111111",
  questaoVersao: 3,
  chaveDedup: "explicacao:1:11111111-1111-1111-1111-111111111111:3",
  baseReferenciaId: "22222222-2222-2222-2222-222222222222",
  resultado: {
    texto: "A alternativa B é a correta.",
    alternativa_correta: "B",
    fontes_citadas: [{ doc_id: "base:2", trecho: "alternativa B" }],
    afirmacoes_externas: [],
  },
};

function clienteComDedup() {
  const chaves = new Set<string>();
  const consultas: { texto: string; valores: unknown[] | undefined }[] = [];
  const cliente: ClienteSql = {
    async query(texto, valores) {
      consultas.push({ texto, valores });
      const chave = String(valores?.at(-1));
      if (chaves.has(chave)) return { rows: [] };
      chaves.add(chave);
      return { rows: [{ id: "explicacao-1" }] };
    },
  };
  return { cliente, consultas };
}

describe("persistencia da explicacao", () => {
  it("grava aprovada com citacoes, par da questao e chave do gateway", async () => {
    const { cliente, consultas } = clienteComDedup();

    const resultado = await gravarExplicacaoAprovada(cliente, entrada);

    expect(resultado).toEqual({ inserida: true, id: "explicacao-1" });
    expect(consultas[0].texto).toMatch(/status/);
    expect(consultas[0].texto).toContain("'aprovada'");
    expect(consultas[0].texto).toContain("on conflict (chave_dedup) do nothing");
    expect(consultas[0].valores).toEqual([
      entrada.questaoId,
      3,
      1,
      entrada.resultado.texto,
      "B",
      JSON.stringify(entrada.resultado.fontes_citadas),
      entrada.baseReferenciaId,
      entrada.chaveDedup,
    ]);
  });

  it("duas execucoes com a mesma chave deixam uma so linha", async () => {
    const { cliente } = clienteComDedup();

    const primeira = await gravarExplicacaoAprovada(cliente, entrada);
    const segunda = await gravarExplicacaoAprovada(cliente, entrada);

    expect(primeira.inserida).toBe(true);
    expect(segunda).toEqual({ inserida: false, id: null });
  });

  it("registra rejeitada fora de vigencia e sem tratar citacao como conferida", async () => {
    const { cliente, consultas } = clienteComDedup();

    const resultado = await gravarExplicacaoRejeitada(cliente, entrada);

    expect(resultado.inserida).toBe(true);
    expect(consultas[0].texto).toContain("false, 'rejeitada'");
    expect(consultas[0].texto).toContain("'[]'::jsonb");
    expect(consultas[0].valores).toEqual([
      entrada.questaoId,
      3,
      1,
      entrada.resultado.texto,
      "B",
      entrada.baseReferenciaId,
      entrada.chaveDedup,
    ]);
  });
});

