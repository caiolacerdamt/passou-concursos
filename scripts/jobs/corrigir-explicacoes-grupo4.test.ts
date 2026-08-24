import { describe, expect, it, vi } from "vitest";

import { corrigirExplicacoesGrupo4, type RelatorioDaCorrecao } from "./corrigir-explicacoes-grupo4.mts";
import type { ExplicacaoCurada } from "./publicar-lote-curado.mts";

const explicacao: ExplicacaoCurada = {
  lote: "grupo4-lote-1",
  source_id: "SRC-1",
  numero: 46,
  alternativa_correta: "C",
  texto:
    "A alternativa C é correta porque o enunciado descreve o conceito central " +
    "da questão, enquanto as demais opções tratam de situações diferentes.",
  fontes_citadas: [
    { doc_id: "questao:SRC-1:46", trecho: "Enunciado e alternativas oficiais da questão 46; gabarito oficial registrado no acervo: C." },
  ],
};

function clienteFalso(chave = "curado:lote-02-distribuicao:SRC-1:46:v1") {
  const executadas: string[] = [];
  const cliente = {
    query: vi.fn(async (sql: string) => {
      executadas.push(sql);
      if (sql.includes("from public.explicacoes e")) {
        return {
          rows: [
            {
              id: "e1",
              questao_id: "q1",
              questao_versao: 1,
              explicacao_versao: 1,
              chave_dedup: chave,
              resposta_correta: "C",
            },
          ],
        };
      }
      return { rows: [] };
    }),
  };
  return { cliente, executadas };
}

describe("corrigir explicações do Grupo 4", () => {
  it("alterna a vigência e insere versão nova sem publicar questão", async () => {
    const { cliente, executadas } = clienteFalso();

    const relatorio = await corrigirExplicacoesGrupo4(cliente as never, [explicacao], {
      transacao: false,
    });

    expect(relatorio).toEqual<RelatorioDaCorrecao>({
      lidas: 1,
      corrigidas: 1,
      reaproveitadas: 0,
      questoes: ["SRC-1#46"],
    });
    expect(executadas.some((sql) => sql.includes("update public.explicacoes"))).toBe(true);
    expect(executadas.some((sql) => sql.includes("insert into public.explicacoes"))).toBe(true);
    expect(executadas.some((sql) => sql.includes("publicar_questao"))).toBe(false);
  });

  it("não escreve no dry-run", async () => {
    const { cliente, executadas } = clienteFalso();

    const relatorio = await corrigirExplicacoesGrupo4(cliente as never, [explicacao], {
      transacao: false,
      dryRun: true,
    });

    expect(relatorio.corrigidas).toBe(0);
    expect(relatorio.reaproveitadas).toBe(0);
    expect(executadas.some((sql) => sql.includes("update public.explicacoes"))).toBe(false);
    expect(executadas.some((sql) => sql.includes("insert into public.explicacoes"))).toBe(false);
  });

  it("é idempotente quando a versão do Grupo 4 já está vigente", async () => {
    const { cliente } = clienteFalso("curado:grupo4-correcao:SRC-1:46:v2");

    const relatorio = await corrigirExplicacoesGrupo4(cliente as never, [explicacao], {
      transacao: false,
    });

    expect(relatorio.corrigidas).toBe(0);
    expect(relatorio.reaproveitadas).toBe(1);
  });
});
