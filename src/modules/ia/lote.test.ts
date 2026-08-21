import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  type LeitorDeConfig,
  definirLeitorDeConfig,
  restaurarLeitorPadrao,
} from "@/modules/config";

import { TarefaNaoEhDeLote } from "./gateway";
import {
  type ClienteDeLote,
  LoteFalhou,
  chaveDoBloco,
  colherLote,
  definirClienteDeLote,
  enviarLote,
  lerSaida,
  montarLote,
  chaveDaPagina,
  chaveDoBlocoDe,
  juntarPaginas,
  semCaracteresDeControle,
  restaurarClienteDeLotePadrao,
  textoDaResposta,
} from "./lote";

/**
 * Nenhum nome de modelo real aparece aqui. O que se prova e que o codigo manda
 * ao provedor o que a configuracao disser, seja o que for (IA-02 AC1).
 */
function comMatriz(campos: Record<string, unknown> = {}): void {
  const leitor: LeitorDeConfig = async () => ({
    "param.m2.matriz_de_modelos": {
      extracao_pdf: {
        modelo: "principal-de-teste",
        versao: "2026-01-01",
        esforco: "alto",
        batch: true,
        cache: true,
        fallback: null,
        ...campos,
      },
    },
  });
  definirLeitorDeConfig(leitor);
}

const PEDIDO = {
  idDaLinha: "extracao_pdf:1:prova:p1:bloco:0",
  pedido: { instrucao: "transcreva", entrada: "--- pagina 1 ---" },
};

/** Um cliente de mentira que anota tudo que recebeu. */
function clienteFalso(estado: Partial<Record<string, unknown>> = {}) {
  const chamadas = {
    jsonl: [] as string[],
    lotesCriados: [] as string[],
    baixados: [] as string[],
  };

  const cliente: ClienteDeLote = {
    async subirArquivo(jsonl) {
      chamadas.jsonl.push(jsonl);
      return "arquivo-1";
    },
    async criarLote(arquivoId) {
      chamadas.lotesCriados.push(arquivoId);
      return "lote-1";
    },
    async estadoDoLote() {
      return (estado.estado ?? {
        status: "completed",
        arquivoDeSaida: "saida-1",
        arquivoDeErro: null,
      }) as never;
    },
    async baixarArquivo(id) {
      chamadas.baixados.push(id);
      return String(estado.saida ?? "");
    },
  };

  definirClienteDeLote(cliente);
  return chamadas;
}

/** Uma linha de saida da Batch API, na forma crua do arquivo. */
function linhaDeSaida(
  idDaLinha: string,
  corpo: Record<string, unknown>,
  extras: Record<string, unknown> = {},
): string {
  return JSON.stringify({
    id: "batch_req_1",
    custom_id: idDaLinha,
    response: { status_code: 200, body: corpo },
    error: null,
    ...extras,
  });
}

/** Uma linha ja colhida, na forma que `juntarPaginas` consome. */
function linhaColhida(
  idDaLinha: string,
  estruturado: unknown,
  entrada: number,
  saida: number,
) {
  return {
    idDaLinha,
    estruturado,
    texto: JSON.stringify(estruturado),
    erro: null,
    tokensEntrada: entrada,
    tokensCacheados: null,
    tokensSaida: saida,
  };
}

beforeEach(() => {
  comMatriz();
});

afterEach(() => {
  restaurarLeitorPadrao();
  restaurarClienteDeLotePadrao();
});

describe("montarLote — o arquivo que vai ao provedor", () => {
  it("produz uma linha JSONL por pedido, com o modelo da configuracao", async () => {
    const lote = await montarLote("extracao_pdf", [
      PEDIDO,
      { ...PEDIDO, idDaLinha: "outra" },
    ]);

    const linhas = lote.jsonl.split("\n").map((l) => JSON.parse(l));
    expect(linhas).toHaveLength(2);
    expect(lote.linhas).toBe(2);
    expect(linhas[0].custom_id).toBe(PEDIDO.idDaLinha);
    expect(linhas[0].url).toBe("/v1/responses");
    expect(linhas[0].method).toBe("POST");
    // O id que vai ao provedor e a **versao fixada**, nunca o rotulo da familia.
    expect(linhas[0].body.model).toBe("2026-01-01");
    expect(lote.destino.modelo).toBe("principal-de-teste");
  });

  it("o JSONL nao tem linha em branco: o provedor recusaria o arquivo", async () => {
    const lote = await montarLote("extracao_pdf", [PEDIDO, PEDIDO]);
    expect(lote.jsonl.split("\n").every((linha) => linha.trim().length > 0)).toBe(
      true,
    );
  });

  it("trocar o modelo na configuracao troca o que vai ao provedor, sem tocar em codigo", async () => {
    comMatriz({ modelo: "outro-de-teste", versao: "2027-09-09", esforco: "baixo" });

    const lote = await montarLote("extracao_pdf", [PEDIDO]);
    const linha = JSON.parse(lote.jsonl);

    expect(linha.body.model).toBe("2027-09-09");
    expect(linha.body.reasoning.effort).toBe("baixo");
  });

  it("tarefa marcada batch: false nao entra na fila de lote", async () => {
    // O outro lado da mesma regra que `TarefaEhDeLote` protege no sincrono
    // (IA-02 AC9): o plano do dia tem hora marcada e nao pode esperar 24h.
    comMatriz({ batch: false });

    await expect(montarLote("extracao_pdf", [PEDIDO])).rejects.toThrow(
      TarefaNaoEhDeLote,
    );
  });
});

describe("chaveDoBloco", () => {
  it("identifica prova e bloco, e muda com a versao do prompt", () => {
    const chave = chaveDoBloco("extracao_pdf", "p1", 3);

    expect(chave).toContain("extracao_pdf");
    expect(chave).toContain("prova:p1");
    expect(chave).toContain("bloco:3");
    // Blocos diferentes da mesma prova nao colidem — e o que impede a retomada
    // de achar que o bloco 3 ja estava feito porque o 0 estava.
    expect(chaveDoBloco("extracao_pdf", "p1", 0)).not.toBe(chave);
  });
});

describe("enviarLote", () => {
  it("sobe o arquivo e cria o lote com o id que voltou", async () => {
    const chamadas = clienteFalso();
    const lote = await montarLote("extracao_pdf", [PEDIDO]);

    const id = await enviarLote(lote);

    expect(chamadas.jsonl[0]).toBe(lote.jsonl);
    expect(chamadas.lotesCriados).toEqual(["arquivo-1"]);
    expect(id).toBe("lote-1");
  });
});

describe("colherLote", () => {
  it("lote ainda rodando devolve espera, nao erro", async () => {
    // Janela de 24 horas: "ainda nao terminou" e o estado normal. Sair vermelho
    // aqui pintaria de falha o funcionamento correto.
    clienteFalso({
      estado: { status: "in_progress", arquivoDeSaida: null, arquivoDeErro: null },
    });

    const colheita = await colherLote("lote-1");

    expect(colheita.pronto).toBe(false);
    expect(colheita.status).toBe("in_progress");
  });

  it("lote completo mas sem arquivo de saida ainda e espera", async () => {
    clienteFalso({
      estado: { status: "completed", arquivoDeSaida: null, arquivoDeErro: null },
    });
    expect((await colherLote("lote-1")).pronto).toBe(false);
  });

  it("lote que o provedor encerrou mal e parada visivel", async () => {
    for (const status of ["failed", "expired", "cancelled"]) {
      clienteFalso({ estado: { status, arquivoDeSaida: null, arquivoDeErro: "e1" } });
      await expect(colherLote("lote-1")).rejects.toThrow(LoteFalhou);
    }
  });

  it("lote completo baixa a saida e devolve as linhas", async () => {
    const chamadas = clienteFalso({
      saida: linhaDeSaida("bloco-0", {
        output_text: '{"questoes":[]}',
        usage: {
          input_tokens: 900,
          output_tokens: 120,
          input_tokens_details: { cached_tokens: 800 },
        },
      }),
    });

    const colheita = await colherLote("lote-1");

    expect(chamadas.baixados).toEqual(["saida-1"]);
    expect(colheita.pronto).toBe(true);
    if (!colheita.pronto) return;
    expect(colheita.linhas[0].idDaLinha).toBe("bloco-0");
    expect(colheita.linhas[0].estruturado).toEqual({ questoes: [] });
    expect(colheita.linhas[0].tokensEntrada).toBe(900);
    expect(colheita.linhas[0].tokensCacheados).toBe(800);
    expect(colheita.linhas[0].tokensSaida).toBe(120);
  });
});

describe("lerSaida — uma linha ruim nao contamina as outras", () => {
  it("separa a linha com erro das que vieram boas", async () => {
    // O lote e a unidade de cobranca, nao a unidade de verdade: as boas ja
    // foram pagas e nao podem ser jogadas fora por causa da ruim.
    const bruto = [
      linhaDeSaida("bloco-0", { output_text: '{"questoes":[1]}' }),
      JSON.stringify({
        custom_id: "bloco-1",
        response: null,
        error: { message: "o modelo recusou o pedido" },
      }),
      linhaDeSaida("bloco-2", { output_text: '{"questoes":[2]}' }),
    ].join("\n");

    const linhas = lerSaida(bruto);

    expect(linhas.map((l) => l.idDaLinha)).toEqual(["bloco-0", "bloco-1", "bloco-2"]);
    expect(linhas[0].erro).toBeNull();
    expect(linhas[1].erro).toContain("recusou");
    expect(linhas[1].estruturado).toBeNull();
    expect(linhas[2].estruturado).toEqual({ questoes: [2] });
  });

  it("status de erro na linha vira erro, mesmo com corpo presente", () => {
    const bruto = linhaDeSaida("bloco-0", { output_text: "{}" }, {}).replace(
      '"status_code":200',
      '"status_code":429',
    );
    expect(lerSaida(bruto)[0].erro).toContain("429");
  });

  it("linha que nao e JSON nao derruba a leitura do arquivo", () => {
    const linhas = lerSaida(
      ["nao sou json", linhaDeSaida("bloco-1", { output_text: "{}" })].join("\n"),
    );

    expect(linhas).toHaveLength(2);
    expect(linhas[0].erro).toContain("nao e JSON");
    expect(linhas[1].erro).toBeNull();
  });

  it("linha em branco no fim do arquivo e ignorada", () => {
    expect(lerSaida("\n\n")).toEqual([]);
  });
});

describe("caracteres de controle — o bloco inteiro depende disto", () => {
  it("tira o byte nulo, que o jsonb do Postgres recusa", () => {
    // Medido na Prova B do BB 2021: o bloco das paginas 5-8 voltou inteiro e
    // correto, com 17 questoes, e morreu no INSERT com "unsupported Unicode
    // escape sequence" por causa de 8 bytes nulos no meio do texto. Sem esta
    // limpeza, um bloco ja pago e perdido inteiro.
    const sujo = { enunciado: "Qual e o \u0000 montante?" };
    expect(semCaracteresDeControle(sujo)).toEqual({ enunciado: "Qual e o  montante?" });
  });

  it("tira tambem os outros controles, e limpa dentro de array e de objeto aninhado", () => {
    const sujo = {
      questoes: [
        { enunciado: "a\u000bb", alternativas: [{ letra: "A", texto: "c\u0000d" }] },
      ],
    };
    expect(semCaracteresDeControle(sujo)).toEqual({
      questoes: [{ enunciado: "ab", alternativas: [{ letra: "A", texto: "cd" }] }],
    });
  });

  it("mantem tabulacao, quebra de linha e retorno: sao formatacao de enunciado", () => {
    // Enunciado tem paragrafo e tabela. Tirar estes tres achataria a questao.
    const texto = ["linha 1", "linha 2\tcoluna"].join("\n") + "\r";
    expect(semCaracteresDeControle(texto)).toBe(texto);
  });

  it("nao mexe em numero, booleano nem nulo", () => {
    expect(semCaracteresDeControle({ n: 3, b: true, z: null })).toEqual({
      n: 3,
      b: true,
      z: null,
    });
  });

  it("a limpeza acontece na colheita, antes de qualquer gravacao", () => {
    const bruto = linhaDeSaida("bloco-0", {
      output_text: JSON.stringify({ questoes: [{ enunciado: "a\u0000b" }] }),
    });
    const linha = lerSaida(bruto)[0];
    expect(JSON.stringify(linha.estruturado)).not.toContain("u0000");
    expect(linha.estruturado).toEqual({ questoes: [{ enunciado: "ab" }] });
  });
});

describe("geracao encerrada no meio pelo provedor", () => {
  it("status incomplete vira erro com o motivo, nao 'resposta inaproveitavel'", () => {
    // Medido na Prova C do BB 2021: o filtro de conteudo do provedor cortou a
    // pagina de Lingua Inglesa. A mensagem generica mandava o operador procurar
    // no lugar errado — o motivo estava em `incomplete_details`.
    const bruto = linhaDeSaida("bloco-1", {
      status: "incomplete",
      incomplete_details: { reason: "content_filter" },
      output_text: "texto cortado no meio",
      usage: { input_tokens: 0, output_tokens: 0 },
    });

    const linha = lerSaida(bruto)[0];

    expect(linha.erro).toContain("content_filter");
    expect(linha.erro).toContain("encerrou a geracao no meio");
    // E **nao** entrega o pedaco como se fosse resultado.
    expect(linha.estruturado).toBeNull();
  });

  it("incomplete sem motivo declarado ainda vira erro", () => {
    const bruto = linhaDeSaida("bloco-1", {
      status: "incomplete",
      output_text: "{}",
    });
    expect(lerSaida(bruto)[0].erro).toContain("sem motivo declarado");
  });

  it("status completed segue o caminho normal", () => {
    const bruto = linhaDeSaida("bloco-0", {
      status: "completed",
      output_text: JSON.stringify({ questoes: [] }),
    });
    const linha = lerSaida(bruto)[0];
    expect(linha.erro).toBeNull();
    expect(linha.estruturado).toEqual({ questoes: [] });
  });
});

describe("textoDaResposta", () => {
  it("le `output_text` quando o provedor manda a conveniencia", () => {
    expect(textoDaResposta({ output_text: "oi" })).toBe("oi");
  });

  it("le o array `output` quando nao manda", () => {
    // No arquivo de saida do lote a resposta vem crua: `output_text` e do SDK e
    // pode simplesmente nao existir.
    const corpo = {
      output: [
        { type: "reasoning", content: null },
        {
          type: "message",
          content: [
            { type: "output_text", text: '{"questoes":' },
            { type: "output_text", text: "[]}" },
          ],
        },
      ],
    };
    expect(textoDaResposta(corpo)).toBe('{"questoes":[]}');
  });

  it("corpo sem saida nenhuma devolve string vazia, nao explode", () => {
    expect(textoDaResposta({})).toBe("");
  });
});

describe("bloco repartido por pagina", () => {
  it("a chave da pagina volta a ser a chave do bloco", () => {
    const bloco = "extracao_pdf:3:prova:p1:bloco:1";
    expect(chaveDoBlocoDe(chaveDaPagina(bloco, 5))).toBe(bloco);
    // Bloco inteiro (nao repartido) passa direto.
    expect(chaveDoBlocoDe(bloco)).toBe(bloco);
  });

  it("junta as questoes das paginas na ordem, somando os tokens", () => {
    const bloco = "b:1";
    const linhas = [
      // Fora de ordem de proposito: o provedor nao promete ordem.
      linhaColhida(chaveDaPagina(bloco, 6), { questoes: [{ numero: 12 }] }, 10, 20),
      linhaColhida(
        chaveDaPagina(bloco, 5),
        { textos_base: [{ id: "T1", conteudo: "texto" }], questoes: [{ numero: 11 }] },
        30,
        40,
      ),
    ];

    const junto = juntarPaginas(linhas);

    expect(junto.erros).toEqual([]);
    expect(junto.estruturado).toEqual({
      textos_base: [{ id: "T1", conteudo: "texto" }],
      questoes: [{ numero: 11 }, { numero: 12 }],
    });
    expect(junto.tokensEntrada).toBe(40);
    expect(junto.tokensSaida).toBe(60);
  });

  it("uma pagina que falhou nao derruba as outras do bloco", () => {
    // E o ponto inteiro de repartir: o estado anterior era perder as quatro
    // paginas juntas, sempre.
    const bloco = "b:1";
    const linhas = [
      linhaColhida(chaveDaPagina(bloco, 5), { questoes: [{ numero: 11 }] }, 10, 20),
      {
        idDaLinha: chaveDaPagina(bloco, 6),
        estruturado: null,
        texto: "",
        erro: "o provedor encerrou a geracao no meio: content_filter",
        tokensEntrada: null,
        tokensCacheados: null,
        tokensSaida: null,
      },
    ];

    const junto = juntarPaginas(linhas);

    expect((junto.estruturado as { questoes: unknown[] }).questoes).toHaveLength(1);
    expect(junto.erros).toHaveLength(1);
    expect(junto.erros[0]).toContain("content_filter");
  });

  it("todas as paginas falhando devolve lista vazia e os motivos", () => {
    const junto = juntarPaginas([
      {
        idDaLinha: "b:1#p5",
        estruturado: null,
        texto: "",
        erro: "content_filter",
        tokensEntrada: null,
        tokensCacheados: null,
        tokensSaida: null,
      },
    ]);

    expect((junto.estruturado as { questoes: unknown[] }).questoes).toEqual([]);
    expect(junto.erros).toHaveLength(1);
  });
});
