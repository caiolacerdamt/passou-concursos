import { describe, expect, it } from "vitest";

import type { ClienteSql } from "@/modules/ia";

import type { TopicoCanonico } from "./classificacao";
import type { QuestaoExtraida } from "./extracao";
import {
  type ContextoDaGravacao,
  type ProvaCatalogada,
  ProvaNaoCatalogada,
  caminhoDaImagem,
  fonteCitacaoDe,
  gravarQuestoes,
  lerProva,
  marcarProva,
  registrarBlocos,
} from "./ingestao";
import type { ImagemDoPdf } from "./pdf";

const PROVA: ProvaCatalogada = {
  id: "prova-1",
  banca: "Cesgranrio",
  ano: 2023,
  orgao: "Banco do Brasil",
  cargo: "Escriturario",
  status: "extraindo",
};

const CATALOGO: TopicoCanonico[] = [
  {
    id: "t-juros",
    nome: "Juros Compostos",
    materiaId: "m-mat",
    materiaNome: "Matematica Financeira",
  },
];

function questao(campos: Partial<QuestaoExtraida> = {}): QuestaoExtraida {
  return {
    numero: 12,
    tipo_questao: "multipla_escolha",
    enunciado: "Qual e o montante?",
    alternativas: [
      { letra: "A", texto: "mil" },
      { letra: "B", texto: "dois mil" },
    ],
    materia_sugerida: "Matematica Financeira",
    topico_sugerido: "Juros Compostos",
    dificuldade: 3,
    confianca_ia: 0.9,
    tem_imagem: false,
    pagina: 4,
    truncada: false,
    ...campos,
  };
}

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

/**
 * Um banco de mentira que responde por consulta. `insert into public.questoes`
 * responde `[{ id }]` (linha nova) ou `[]` (o `on conflict do nothing` barrou).
 */
function bancoFalso(opcoes: { questaoJaExiste?: boolean } = {}) {
  const consultas: { texto: string; valores?: unknown[] }[] = [];

  const cliente: ClienteSql = {
    async query(texto, valores) {
      consultas.push({ texto, valores });

      if (texto.includes("insert into public.questoes")) {
        const rows = opcoes.questaoJaExiste ? [] : [{ id: "q-1" }];
        return { rows, rowCount: rows.length };
      }
      if (texto.includes("registrar_topico_candidato")) {
        return { rows: [{ id: "cand-1" }], rowCount: 1 };
      }
      if (texto.includes("insert into public.prova_lote")) {
        return { rows: [{ bloco: 0 }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
  };

  return { cliente, consultas };
}

function contexto(extras: Partial<ContextoDaGravacao> = {}): ContextoDaGravacao {
  return {
    prova: PROVA,
    catalogo: CATALOGO,
    imagensPorPagina: new Map<number, ImagemDoPdf[]>(),
    subirImagem: async () => {},
    bucket: "questoes",
    ...extras,
  };
}

/** Os valores do INSERT de questão, por nome de coluna. */
function valoresDoInsert(consultas: { texto: string; valores?: unknown[] }[]) {
  const insert = consultas.find((c) => c.texto.includes("insert into public.questoes"));
  const v = insert?.valores ?? [];
  return {
    provaId: v[0],
    numero: v[1],
    fonte: JSON.parse(String(v[2])),
    topicoId: v[3],
    tipo: v[4],
    enunciado: v[5],
    alternativas: v[6],
    imagens: JSON.parse(String(v[7])),
    dificuldade: v[8],
    confianca: v[9],
    status: v[10],
  };
}

describe("fonteCitacaoDe — proveniencia (BANCO-01 AC1)", () => {
  it("carrega as cinco chaves, com o numero da questao", () => {
    expect(fonteCitacaoDe(PROVA, 42)).toEqual({
      banca: "Cesgranrio",
      ano: 2023,
      orgao: "Banco do Brasil",
      cargo: "Escriturario",
      numero: 42,
    });
  });
});

describe("lerProva", () => {
  it("prova nao catalogada e parada visivel", async () => {
    const { cliente } = bancoFalso();
    await expect(lerProva(cliente, "prova-x")).rejects.toThrow(ProvaNaoCatalogada);
  });
});

describe("gravarQuestoes — status e proveniencia", () => {
  it("questao sem imagem nasce rascunho, com a proveniencia da prova", async () => {
    const { cliente, consultas } = bancoFalso();

    const resumo = await gravarQuestoes(cliente, [questao()], contexto());

    const insert = valoresDoInsert(consultas);
    expect(insert.status).toBe("rascunho");
    expect(insert.fonte.numero).toBe(12);
    expect(insert.fonte.banca).toBe("Cesgranrio");
    expect(insert.topicoId).toBe("t-juros");
    expect(resumo.inseridas).toBe(1);
    expect(resumo.emRevisao).toBe(0);
  });

  it("nenhum caminho escreve `publicada` (BANCO-03 AC6)", async () => {
    const { cliente, consultas } = bancoFalso();

    await gravarQuestoes(
      cliente,
      [questao({ numero: 1 }), questao({ numero: 2, tem_imagem: true })],
      contexto(),
    );

    for (const consulta of consultas) {
      expect(JSON.stringify(consulta.valores)).not.toContain("publicada");
    }
  });

  it("questao com imagem sobe o JPEG e vai para revisao", async () => {
    // BANCO-11 AC4 + acessibilidade: o `alt_text` de verdade so existe depois
    // que um humano olha a figura, e por isso a questao nasce em revisao.
    const subidas: { caminho: string; bytes: number }[] = [];
    const { cliente, consultas } = bancoFalso();

    const resumo = await gravarQuestoes(
      cliente,
      [questao({ tem_imagem: true })],
      contexto({
        imagensPorPagina: new Map([[4, [{ nome: "Im0", jpeg: JPEG }]]]),
        subirImagem: async (caminho, jpeg) => {
          subidas.push({ caminho, bytes: jpeg.length });
        },
      }),
    );

    expect(subidas).toEqual([
      { caminho: caminhoDaImagem("prova-1", 12, 0), bytes: JPEG.length },
    ]);
    const insert = valoresDoInsert(consultas);
    expect(insert.status).toBe("em_revisao");
    expect(insert.imagens).toHaveLength(1);
    expect(insert.imagens[0].storage_path).toBe("questoes/prova-1/q12-0.jpg");
    expect(insert.imagens[0].alt_text).not.toBe("");
    expect(resumo.imagensSubidas).toBe(1);
    expect(resumo.imagensQueFalharam).toBe(0);
  });

  it("imagem que o PDF nao entregou manda a questao para revisao sem imagem", async () => {
    // Bitmap que nao e JPEG: a lista da pagina vem vazia. Meia imagem no acervo
    // e pior do que nenhuma.
    const { cliente, consultas } = bancoFalso();

    const resumo = await gravarQuestoes(
      cliente,
      [questao({ tem_imagem: true })],
      contexto({ imagensPorPagina: new Map() }),
    );

    const insert = valoresDoInsert(consultas);
    expect(insert.status).toBe("em_revisao");
    expect(insert.imagens).toEqual([]);
    expect(resumo.imagensQueFalharam).toBe(1);
  });

  it("falha ao subir a imagem nao grava imagem pela metade", async () => {
    const { cliente, consultas } = bancoFalso();

    const resumo = await gravarQuestoes(
      cliente,
      [questao({ tem_imagem: true })],
      contexto({
        imagensPorPagina: new Map([
          [
            4,
            [
              { nome: "Im0", jpeg: JPEG },
              { nome: "Im1", jpeg: JPEG },
            ],
          ],
        ]),
        subirImagem: async (caminho) => {
          if (caminho.endsWith("-1.jpg")) throw new Error("storage fora do ar");
        },
      }),
    );

    // A primeira subiu, mas a lista sai **vazia**: gravar so a primeira daria
    // uma questao que parece completa e nao esta.
    expect(valoresDoInsert(consultas).imagens).toEqual([]);
    expect(resumo.imagensQueFalharam).toBe(1);
  });

  it("colher o mesmo bloco duas vezes nao insere a segunda linha", async () => {
    const { cliente, consultas } = bancoFalso({ questaoJaExiste: true });

    const resumo = await gravarQuestoes(cliente, [questao()], contexto());

    expect(resumo.inseridas).toBe(0);
    expect(resumo.jaExistiam).toBe(1);
    // O `on conflict` casa com o indice parcial da SPEC 04, predicado incluido.
    const insert = consultas.find((c) => c.texto.includes("insert into public.questoes"));
    expect(insert?.texto).toContain("on conflict (prova_id, numero) where vigente");
    expect(insert?.texto).toContain("do nothing");
  });

  it("certo-errado entra sem alternativas", async () => {
    const { cliente, consultas } = bancoFalso();

    await gravarQuestoes(
      cliente,
      [questao({ tipo_questao: "certo_errado", alternativas: null })],
      contexto(),
    );

    expect(valoresDoInsert(consultas).alternativas).toBeNull();
  });

  it("topico que nao esta na taxonomia deixa a questao sem topico e abre candidato", async () => {
    const { cliente, consultas } = bancoFalso();

    const resumo = await gravarQuestoes(
      cliente,
      [questao({ topico_sugerido: "Politica Monetaria" })],
      contexto(),
    );

    expect(valoresDoInsert(consultas).topicoId).toBeNull();
    expect(resumo.candidatosDeTopico).toBe(1);
  });

  it("preserva o numero oficial da banca, mesmo fora de ordem", async () => {
    // Edge case do M1: numeracao fora de ordem / duas colunas. O numero e o que
    // o modelo leu impresso, nunca o indice do laco.
    const { cliente, consultas } = bancoFalso();

    await gravarQuestoes(
      cliente,
      [questao({ numero: 57 }), questao({ numero: 3 })],
      contexto(),
    );

    const numeros = consultas
      .filter((c) => c.texto.includes("insert into public.questoes"))
      .map((c) => c.valores?.[1]);
    expect(numeros).toEqual([57, 3]);
  });
});

describe("registrarBlocos — a retomada (AD-036)", () => {
  it("insere com `on conflict do nothing` e devolve so os blocos novos", async () => {
    const { cliente, consultas } = bancoFalso();

    const novos = await registrarBlocos(
      cliente,
      "prova-1",
      [
        {
          indice: 0,
          primeiraPagina: 1,
          ultimaPagina: 4,
          texto: "",
          tokensEstimados: 10,
        },
      ],
      (bloco) => `chave-${bloco}`,
    );

    expect(novos).toEqual([0]);
    expect(consultas[0].texto).toContain("on conflict (prova_id, bloco) do nothing");
    expect(consultas[0].valores).toEqual(["prova-1", 0, "chave-0", 1, 4, 10]);
  });
});

describe("marcarProva", () => {
  it("move o status da prova sem apagar a observacao anterior", async () => {
    const { cliente, consultas } = bancoFalso();

    await marcarProva(cliente, "prova-1", "precisa_ocr");

    expect(consultas[0].valores).toEqual(["prova-1", "precisa_ocr", null]);
    expect(consultas[0].texto).toContain("coalesce($3, observacao)");
  });
});
