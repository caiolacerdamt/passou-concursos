import { describe, expect, it } from "vitest";

import type { ClienteSql } from "@/modules/ia";

import { GabaritoInvalido, cruzarGabarito, lerGabarito } from "./gabarito";

describe("lerGabarito — JSON", () => {
  it("le versao e itens", () => {
    const gabarito = lerGabarito(
      JSON.stringify({
        versao: "definitivo-2023-10-05",
        itens: [
          { numero: 1, resposta: "C" },
          { numero: 2, anulada: true },
        ],
      }),
    );

    expect(gabarito.versao).toBe("definitivo-2023-10-05");
    expect(gabarito.itens).toEqual([
      { numero: 1, resposta: "C", anulada: false },
      { numero: 2, resposta: null, anulada: true },
    ]);
  });

  it("aceita a versao declarada por fora quando o arquivo nao a traz", () => {
    const gabarito = lerGabarito(
      JSON.stringify({ itens: [{ numero: 1, resposta: "A" }] }),
      "definitivo-1",
    );
    expect(gabarito.versao).toBe("definitivo-1");
  });

  it("recusa gabarito sem versao nenhuma", () => {
    // Sem versao, retificar e rodar duas vezes o mesmo arquivo sao a mesma
    // coisa para o banco (BANCO-04 AC1).
    expect(() =>
      lerGabarito(JSON.stringify({ itens: [{ numero: 1, resposta: "A" }] })),
    ).toThrow(GabaritoInvalido);
  });

  it("recusa questao nao anulada sem resposta", () => {
    expect(() =>
      lerGabarito(JSON.stringify({ versao: "v1", itens: [{ numero: 1 }] })),
    ).toThrow(/resposta/);
  });

  it("recusa letra que nao existe", () => {
    expect(() =>
      lerGabarito(
        JSON.stringify({ versao: "v1", itens: [{ numero: 1, resposta: "Z" }] }),
      ),
    ).toThrow(GabaritoInvalido);
  });

  it("recusa a mesma questao duas vezes no arquivo", () => {
    // Erro de transcricao em que o ultimo venceria em silencio.
    expect(() =>
      lerGabarito(
        JSON.stringify({
          versao: "v1",
          itens: [
            { numero: 5, resposta: "A" },
            { numero: 5, resposta: "B" },
          ],
        }),
      ),
    ).toThrow(/duas vezes/);
  });

  it("recusa arquivo vazio e arquivo sem item", () => {
    expect(() => lerGabarito("   ")).toThrow(/vazio/);
    expect(() => lerGabarito(JSON.stringify({ versao: "v1", itens: [] }))).toThrow(
      /nenhum item/,
    );
  });

  it("recusa JSON quebrado sem tentar ler como CSV", () => {
    expect(() => lerGabarito('{"versao": ')).toThrow(/nao e JSON valido/);
  });
});

describe("lerGabarito — CSV", () => {
  it("le numero, resposta e anulada, com cabecalho e comentario", () => {
    const csv = [
      "# gabarito definitivo publicado no DOU",
      "numero,resposta,anulada",
      "1,C,",
      "2,,true",
      "3,e,",
    ].join("\n");

    const gabarito = lerGabarito(csv, "definitivo-1");

    expect(gabarito.itens).toEqual([
      { numero: 1, resposta: "C", anulada: false },
      { numero: 2, resposta: null, anulada: true },
      // Caixa baixa na planilha e o normal; a letra e a mesma.
      { numero: 3, resposta: "E", anulada: false },
    ]);
  });

  it("aceita sim/1/x como anulada", () => {
    const gabarito = lerGabarito("1,,sim\n2,,1\n3,,x", "v1");
    expect(gabarito.itens.every((item) => item.anulada)).toBe(true);
  });

  it("CSV sem versao declarada e recusado", () => {
    expect(() => lerGabarito("1,C,")).toThrow(/versao/);
  });
});

describe("cruzarGabarito", () => {
  it("manda os itens e a versao para a funcao do banco", async () => {
    const consultas: { texto: string; valores?: unknown[] }[] = [];
    const cliente: ClienteSql = {
      async query(texto, valores) {
        consultas.push({ texto, valores });
        return {
          rows: [
            {
              resumo: {
                preenchidas: 3,
                inalteradas: 1,
                versionadas: 2,
                anuladas: 1,
                sem_questao: 4,
              },
            },
          ],
          rowCount: 1,
        };
      },
    };

    const resumo = await cruzarGabarito(cliente, "prova-1", {
      versao: "definitivo-1",
      itens: [{ numero: 1, resposta: "C", anulada: false }],
    });

    expect(consultas[0].texto).toContain("cruzar_gabarito");
    expect(consultas[0].valores?.[0]).toBe("prova-1");
    expect(consultas[0].valores?.[2]).toBe("definitivo-1");
    expect(resumo).toEqual({
      preenchidas: 3,
      inalteradas: 1,
      versionadas: 2,
      anuladas: 1,
      semQuestao: 4,
    });
  });
});
