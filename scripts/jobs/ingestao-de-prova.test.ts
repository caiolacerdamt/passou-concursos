import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  type LeitorDeConfig,
  definirLeitorDeConfig,
  restaurarLeitorPadrao,
} from "@/modules/config";
import {
  type ClienteDeLote,
  type RepositorioDeIa,
  definirClienteDeLote,
  definirRepositorioDeIa,
  restaurarClienteDeLotePadrao,
  restaurarRepositorioAusente,
} from "@/modules/ia";
import {
  definirDestinoDeErro,
  restaurarDestinoPadrao,
} from "@/modules/observabilidade";

import {
  type Argumentos,
  colher,
  enviar,
  executar,
  lerArgumentos,
  motivoDeParada,
} from "./ingestao-de-prova.mts";

/** Um PDF sintetico: as paginas que se pedir, com o texto que se pedir. */
/**
 * Enche a pagina ate parecer pagina de prova.
 *
 * A trava de legibilidade (BANCO-12) exige uma amostra minima para poder medir,
 * e uma pagina real tem milhares de caracteres. Testar com "QUESTAO 1" faria os
 * testes passarem por um caminho que nenhuma prova percorre.
 */
function corpoDeProva(cabecalho: string): string {
  // Texto que ja tem tamanho de pagina entra como veio: e assim que o teste da
  // trava de legibilidade consegue montar uma pagina cheia e ilegivel.
  if (cabecalho.length >= 400) return cabecalho;

  const enchimento =
    "O aluno deve assinalar a alternativa correta de acordo com o " +
    "enunciado apresentado, considerando as regras vigentes. ";
  return `${cabecalho} ${enchimento.repeat(6)}`;
}

function pdfDeTeste(cabecalhos: string[]): Buffer {
  const paginas = cabecalhos.map(corpoDeProva);
  const pedacos: Buffer[] = [Buffer.from("%PDF-1.7\n", "latin1")];
  const ids = paginas.map((_, i) => 3 + i * 2);

  const escrever = (numero: number, corpo: string, stream?: Buffer) => {
    pedacos.push(Buffer.from(`${numero} 0 obj\n${corpo}\n`, "latin1"));
    if (stream !== undefined) {
      pedacos.push(Buffer.from("stream\n", "latin1"), stream, Buffer.from("\nendstream\n", "latin1"));
    }
    pedacos.push(Buffer.from("endobj\n", "latin1"));
  };

  escrever(1, "<< /Type /Catalog /Pages 2 0 R >>");
  escrever(
    2,
    `<< /Type /Pages /Count ${paginas.length} /Kids [${ids.map((id) => `${id} 0 R`).join(" ")}] >>`,
  );
  paginas.forEach((texto, i) => {
    const fluxo = Buffer.from(`BT (${texto}) Tj ET`, "latin1");
    escrever(ids[i], `<< /Type /Page /Parent 2 0 R /Contents ${ids[i] + 1} 0 R >>`);
    escrever(ids[i] + 1, `<< /Length ${fluxo.length} >>`, fluxo);
  });

  pedacos.push(Buffer.from("trailer\n<< /Root 1 0 R >>\n%%EOF\n", "latin1"));
  return Buffer.concat(pedacos);
}

/** Uma pagina que nao mostra texto nenhum: e o que um scanner produz. */
function pdfEscaneado(): Buffer {
  const bruto = pdfDeTeste(["x"]).toString("latin1");
  // Troca o operador de texto por um desenho: a pagina existe e nao mostra
  // letra nenhuma, que e o que um scanner produz.
  const semTexto = bruto.replace(/BT \([\s\S]*?\) Tj ET/, "0 0 612 792 re f");
  return Buffer.from(semTexto, "latin1");
}

const ARGUMENTOS: Argumentos = {
  provaId: "prova-1",
  pdf: "prova.pdf",
  acao: "enviar",
};

const PROVA = {
  id: "prova-1",
  banca: "Cesgranrio",
  ano: 2023,
  orgao: "Banco do Brasil",
  cargo: "Escriturario",
  status: "catalogada",
};

/**
 * Banco de mentira que responde por consulta e anota tudo. As respostas de
 * `prova_lote` sao controlaveis: e como o teste da retomada monta o cenario
 * "estes blocos ja existem".
 */
function bancoFalso(
  opcoes: {
    blocosJaRegistrados?: number[];
    /** O que `blocosParaEnviar` devolve. Ausente = os que acabaram de nascer. */
    pendentesParaEnviar?: number[];
    emVoo?: Record<string, unknown>[];
    pendentes?: number;
    totalDeBlocos?: number;
  } = {},
) {
  const consultas: { texto: string; valores?: unknown[] }[] = [];
  const novosNestaExecucao: number[] = [];

  const cliente = {
    async query(texto: string, valores?: unknown[]) {
      consultas.push({ texto, valores });

      // `executar` injeta o leitor de configuracao por `pg`, entao a matriz
      // tem que sair daqui — e nao do leitor que o teste definiu.
      if (texto.includes("configuracoes_vigentes")) {
        return {
          rows: [
            {
              chave: "param.m2.matriz_de_modelos",
              valor: {
                extracao_pdf: {
                  modelo: "principal-de-teste",
                  versao: "2026-01-01",
                  esforco: "alto",
                  batch: true,
                  cache: true,
                  fallback: null,
                },
              },
            },
          ],
          rowCount: 1,
        };
      }
      if (texto.includes("from public.provas where id")) {
        return { rows: [PROVA], rowCount: 1 };
      }
      if (texto.includes("insert into public.prova_lote")) {
        const bloco = Number(valores?.[1]);
        const jaExiste = (opcoes.blocosJaRegistrados ?? []).includes(bloco);
        if (!jaExiste) novosNestaExecucao.push(bloco);
        return { rows: jaExiste ? [] : [{ bloco }], rowCount: jaExiste ? 0 : 1 };
      }
      if (texto.includes("status in ('montado', 'falhou')")) {
        const pendentes = opcoes.pendentesParaEnviar ?? novosNestaExecucao;
        const rows = pendentes.map((bloco) => ({ bloco }));
        return { rows, rowCount: rows.length };
      }
      if (texto.includes("where prova_id = $1 and status = 'enviado'")) {
        return { rows: opcoes.emVoo ?? [], rowCount: (opcoes.emVoo ?? []).length };
      }
      if (texto.includes("status <> 'colhido'")) {
        return { rows: [{ total: opcoes.pendentes ?? 0 }], rowCount: 1 };
      }
      if (texto.includes("count(*)::int as total from public.prova_lote")) {
        return { rows: [{ total: opcoes.totalDeBlocos ?? 1 }], rowCount: 1 };
      }
      if (texto.includes("insert into public.questoes")) {
        return { rows: [{ id: "q-1" }], rowCount: 1 };
      }
      if (texto.includes("registrar_topico_candidato")) {
        return { rows: [{ id: "cand-1" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
    async connect() {},
    async end() {},
  };

  return { cliente, consultas };
}

function comConfig(extras: Record<string, unknown> = {}): void {
  const leitor: LeitorDeConfig = async () => ({
    "param.m2.matriz_de_modelos": {
      extracao_pdf: {
        modelo: "principal-de-teste",
        versao: "2026-01-01",
        esforco: "alto",
        batch: true,
        cache: true,
        fallback: null,
      },
    },
    // Teto realista de proposito: a instrucao estavel e o schema da saida
    // estruturada ja custam ~3 mil tokens em **toda** linha do lote, entao um
    // teto de brinquedo faria a pagina 1 estourar sozinha. Quem corta nestes
    // testes e `paginas_por_bloco`, que e o que corta uma prova de verdade.
    "param.m1.teto_tokens_por_pedido": 272_000,
    "param.m1.margem_do_teto": 0.2,
    "param.m1.chars_por_token": 3.5,
    "param.m1.paginas_por_bloco": 4,
    ...extras,
  });
  definirLeitorDeConfig(leitor);
}

function clienteDeLoteFalso(saida = "") {
  const chamadas = { enviados: 0, jsonl: [] as string[] };
  const cliente: ClienteDeLote = {
    async subirArquivo(jsonl) {
      chamadas.jsonl.push(jsonl);
      return "arquivo-1";
    },
    async criarLote() {
      chamadas.enviados += 1;
      return "lote-1";
    },
    async estadoDoLote() {
      return {
        status: saida === "" ? "in_progress" : "completed",
        arquivoDeSaida: saida === "" ? null : "saida-1",
        arquivoDeErro: null,
      };
    },
    async baixarArquivo() {
      return saida;
    },
  };
  definirClienteDeLote(cliente);
  return chamadas;
}

function repositorioFalso() {
  const gravadas: unknown[] = [];
  const repositorio: RepositorioDeIa = {
    async buscarPorChave() {
      return null;
    },
    async gravar(registro) {
      gravadas.push(registro);
    },
    async gastoDoPeriodo() {
      return 0;
    },
    async registrarAlerta() {
      return false;
    },
  };
  definirRepositorioDeIa(repositorio);
  return gravadas;
}

const AMBIENTE_COMPLETO = {
  DATABASE_URL: "postgres://x",
  OPENAI_API_KEY: "chave",
  NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
  SUPABASE_SECRET_KEY: "segredo",
};

let reportes: unknown[];

beforeEach(() => {
  comConfig();
  reportes = [];
  definirDestinoDeErro((erro) => {
    reportes.push(erro);
  });
});

afterEach(() => {
  restaurarLeitorPadrao();
  restaurarClienteDeLotePadrao();
  restaurarRepositorioAusente();
  restaurarDestinoPadrao();
});

describe("lerArgumentos", () => {
  it("le prova, pdf e acao", () => {
    expect(
      lerArgumentos(["--prova", "p1", "--pdf", "a.pdf", "--acao", "colher"]),
    ).toEqual({ provaId: "p1", pdf: "a.pdf", acao: "colher" });
  });

  it("recusa acao desconhecida e argumento faltando", () => {
    expect(() => lerArgumentos(["--prova", "p1", "--pdf", "a.pdf"])).toThrow(/uso:/);
    expect(() =>
      lerArgumentos(["--prova", "p1", "--pdf", "a.pdf", "--acao", "publicar"]),
    ).toThrow(/uso:/);
  });
});

describe("enviar — BANCO-12: escaneada nao chama modelo", () => {
  it("PDF sem texto nativo cai em precisa_ocr sem enviar lote nenhum", async () => {
    const { cliente, consultas } = bancoFalso();
    const lote = clienteDeLoteFalso();

    const resumo = await enviar(cliente, ARGUMENTOS, pdfEscaneado());

    expect(resumo.precisaOcr).toBe(true);
    expect(resumo.enviados).toBe(0);
    // O ponto do AC: nenhuma chamada ao provedor, e nenhum bloco registrado.
    expect(lote.enviados).toBe(0);
    expect(consultas.some((c) => c.texto.includes("insert into public.prova_lote"))).toBe(
      false,
    );

    const marca = consultas.find((c) => c.texto.includes("update public.provas"));
    expect(marca?.valores?.[1]).toBe("precisa_ocr");
  });
});

describe("enviar — o caminho normal", () => {
  it("fatia, registra os blocos e manda um lote so", async () => {
    const { cliente, consultas } = bancoFalso();
    const lote = clienteDeLoteFalso();

    const resumo = await enviar(
      cliente,
      ARGUMENTOS,
      pdfDeTeste(["QUESTAO 1", "QUESTAO 2"]),
    );

    expect(resumo.precisaOcr).toBe(false);
    expect(resumo.paginas).toBe(2);
    expect(resumo.enviados).toBeGreaterThan(0);
    expect(lote.enviados).toBe(1);
    // O texto da prova chega ao pedido, e o schema da extracao vai junto.
    expect(lote.jsonl[0]).toContain("QUESTAO 1");
    expect(lote.jsonl[0]).toContain("json_schema");

    // O destino resolvido no envio fica gravado: a colheita e outra execucao.
    const enviado = consultas.find((c) => c.texto.includes("set status = 'enviado'"));
    expect(String(enviado?.valores?.[3])).toContain("principal-de-teste");
    const marca = consultas.filter((c) => c.texto.includes("update public.provas")).pop();
    expect(marca?.valores?.[1]).toBe("extraindo");
  });

  it("reenviar nao remonta bloco que ja tem linha (AD-036)", async () => {
    // A retomada: o bloco 0 ja foi registrado numa execucao anterior.
    const { cliente } = bancoFalso({ blocosJaRegistrados: [0] });
    const lote = clienteDeLoteFalso();

    const resumo = await enviar(cliente, ARGUMENTOS, pdfDeTeste(["QUESTAO 1"]));

    expect(resumo.blocos).toBe(1);
    expect(resumo.enviados).toBe(0);
    expect(lote.enviados).toBe(0);
  });

  it("prova longa vira mais de um bloco, num arquivo de lote so", async () => {
    comConfig({ "param.m1.paginas_por_bloco": 1 });
    const { cliente } = bancoFalso();
    const lote = clienteDeLoteFalso();

    const resumo = await enviar(
      cliente,
      ARGUMENTOS,
      pdfDeTeste(["A".repeat(40), "B".repeat(40), "C".repeat(40)]),
    );

    expect(resumo.blocos).toBeGreaterThan(1);
    // Um arquivo de lote so, com uma linha por bloco. O teto **em tokens** e
    // provado em `fatiamento.test.ts`; aqui se afirma so o que este teste mede.
    expect(lote.enviados).toBe(1);
    expect(lote.jsonl[0].split("\n")).toHaveLength(resumo.blocos);
  });

  it("bloco que falhou volta a ser enviado; bloco ja colhido nao", async () => {
    // O buraco que a verificacao independente achou: sem isto, um bloco que
    // falha fica preso — `enviar` nao o remonta porque a linha ja existe e
    // `colher` nao o enxerga porque so olha `enviado`. A prova nunca fechava.
    const { cliente, consultas } = bancoFalso({
      blocosJaRegistrados: [0, 1],
      pendentesParaEnviar: [1],
    });
    const lote = clienteDeLoteFalso();

    const resumo = await enviar(
      cliente,
      ARGUMENTOS,
      pdfDeTeste(["QUESTAO 1", "QUESTAO 2", "QUESTAO 3", "QUESTAO 4", "QUESTAO 5"]),
    );

    expect(resumo.enviados).toBe(1);
    expect(lote.enviados).toBe(1);
    // So o bloco 1 foi ao provedor, o `erro` dele foi limpo e a `chave_dedup`
    // foi regravada — ela embute a versao do prompt, que pode ter mudado desde
    // que o bloco nasceu.
    const enviados = consultas.filter((c) => c.texto.includes("set status = 'enviado'"));
    expect(enviados).toHaveLength(1);
    expect(enviados[0].valores?.[1]).toBe(1);
    expect(enviados[0].texto).toContain("erro = null");
    expect(enviados[0].texto).toContain("chave_dedup = $5");
    expect(String(enviados[0].valores?.[4])).toContain("bloco:1");
  });

  it("nada pendente nao chama o provedor", async () => {
    const { cliente } = bancoFalso({
      blocosJaRegistrados: [0],
      pendentesParaEnviar: [],
    });
    const lote = clienteDeLoteFalso();

    const resumo = await enviar(cliente, ARGUMENTOS, pdfDeTeste(["QUESTAO 1"]));

    expect(resumo.enviados).toBe(0);
    expect(lote.enviados).toBe(0);
  });
});

describe("colher", () => {
  const CHAVE = "extracao_pdf:1:prova:prova-1:bloco:0";

  function saidaComQuestoes(numeros: number[]) {
    return JSON.stringify({
      custom_id: CHAVE,
      response: {
        status_code: 200,
        body: {
          output_text: JSON.stringify({
            questoes: numeros.map((numero) => ({
              numero,
              tipo_questao: "certo_errado",
              enunciado: `Enunciado da questao ${numero}`,
              alternativas: null,
              materia_sugerida: "",
              topico_sugerido: "",
              dificuldade: 3,
              confianca_ia: 0.9,
              tem_imagem: false,
              pagina: 1,
              truncada: false,
            })),
          }),
          usage: { input_tokens: 100, output_tokens: 50 },
        },
      },
      error: null,
    });
  }

  const EM_VOO = [
    {
      bloco: 0,
      chave_dedup: CHAVE,
      lote_provedor: "lote-1",
      destino: { modelo: "principal-de-teste", versao: "2026-01-01", esforco: "alto" },
    },
  ];

  it("lote ainda rodando nao grava nada e nao e erro", async () => {
    const { cliente, consultas } = bancoFalso({ emVoo: EM_VOO, pendentes: 1 });
    clienteDeLoteFalso("");
    repositorioFalso();

    const resumo = await colher(cliente, ARGUMENTOS, pdfDeTeste(["x"]), async () => {});

    expect(resumo.blocosEsperando).toBe(1);
    expect(resumo.questoesInseridas).toBe(0);
    expect(consultas.some((c) => c.texto.includes("insert into public.questoes"))).toBe(
      false,
    );
  });

  it("lote pronto grava as questoes e fecha o bloco", async () => {
    const { cliente, consultas } = bancoFalso({
      emVoo: EM_VOO,
      pendentes: 0,
      totalDeBlocos: 1,
    });
    clienteDeLoteFalso(saidaComQuestoes([1, 2]));
    const gravadas = repositorioFalso();

    const resumo = await colher(cliente, ARGUMENTOS, pdfDeTeste(["x"]), async () => {});

    expect(resumo.blocosProntos).toBe(1);
    expect(resumo.questoesInseridas).toBe(2);
    expect(resumo.provaCompleta).toBe(true);

    // A auditoria registra o destino do **envio**, nao a matriz de hoje.
    expect(gravadas).toHaveLength(1);
    expect(gravadas[0]).toMatchObject({
      tarefa: "extracao_pdf",
      batch: true,
      modelo: "principal-de-teste",
    });

    const fecha = consultas.find((c) => c.texto.includes("set status = 'colhido'"));
    expect(fecha?.valores).toEqual(["prova-1", 0, 2, 0]);
    const marca = consultas.filter((c) => c.texto.includes("update public.provas")).pop();
    expect(marca?.valores?.[1]).toBe("extraida");
  });

  it("questao recusada nao derruba as irmas do bloco", async () => {
    // As duas questoes voltam com `confianca_ia` fora de 0-1: a saida
    // estruturada garante o campo, nao a faixa.
    const saida = saidaComQuestoes([1, 2]).replace(/confianca_ia..:0.9/g, 'confianca_ia\\":9');
    const { cliente } = bancoFalso({ emVoo: EM_VOO, pendentes: 0, totalDeBlocos: 1 });
    clienteDeLoteFalso(saida);
    repositorioFalso();

    const resumo = await colher(cliente, ARGUMENTOS, pdfDeTeste(["x"]), async () => {});

    expect(resumo.questoesRecusadas).toBe(2);
    expect(resumo.blocosProntos).toBe(1);
  });

  it("linha do lote com erro marca so aquele bloco como falhou", async () => {
    const { cliente, consultas } = bancoFalso({
      emVoo: EM_VOO,
      pendentes: 1,
      totalDeBlocos: 1,
    });
    clienteDeLoteFalso(
      JSON.stringify({
        custom_id: CHAVE,
        response: null,
        error: { message: "o modelo recusou" },
      }),
    );
    repositorioFalso();

    const resumo = await colher(cliente, ARGUMENTOS, pdfDeTeste(["x"]), async () => {});

    expect(resumo.questoesInseridas).toBe(0);
    expect(resumo.provaCompleta).toBe(false);
    const falhou = consultas.find((c) => c.texto.includes("status = $3::status_bloco"));
    expect(falhou?.valores?.[2]).toBe("falhou");
    expect(String(falhou?.valores?.[3])).toContain("recusou");
  });

  it("prova incompleta nao vira `extraida`", async () => {
    const { cliente, consultas } = bancoFalso({
      emVoo: EM_VOO,
      pendentes: 2,
      totalDeBlocos: 3,
    });
    clienteDeLoteFalso(saidaComQuestoes([1]));
    repositorioFalso();

    const resumo = await colher(cliente, ARGUMENTOS, pdfDeTeste(["x"]), async () => {});

    expect(resumo.provaCompleta).toBe(false);
    const marcas = consultas
      .filter((c) => c.texto.includes("update public.provas"))
      .map((c) => c.valores?.[1]);
    expect(marcas).not.toContain("extraida");
  });
});

describe("motivoDeParada — toda ausencia para", () => {
  it("sem DATABASE_URL, sem chave da IA ou sem Storage o job nao roda", () => {
    // Diferente da frase do plano, que sai limpa sem a chave: aqui, sair 0
    // faria o operador achar que a prova foi ingerida quando nao foi.
    expect(motivoDeParada({})).toContain("DATABASE_URL");
    expect(motivoDeParada({ DATABASE_URL: "x" })).toContain("OPENAI_API_KEY");
    expect(
      motivoDeParada({ DATABASE_URL: "x", OPENAI_API_KEY: "y" }),
    ).toContain("Storage");
    expect(motivoDeParada(AMBIENTE_COMPLETO)).toBeNull();
  });
});

describe("executar", () => {
  it("sem provisionamento sai 1 sem nem abrir conexao", async () => {
    const codigo = await executar({}, ["--prova", "p1", "--pdf", "a.pdf", "--acao", "enviar"], {
      abrirConexao: () => {
        throw new Error("nao deveria abrir conexao");
      },
    });
    expect(codigo).toBe(1);
  });

  it("PDF que nao existe no disco sai 1 antes de qualquer gasto", async () => {
    const codigo = await executar(
      AMBIENTE_COMPLETO,
      ["--prova", "p1", "--pdf", "nao-existe.pdf", "--acao", "enviar"],
      {
        abrirConexao: () => {
          throw new Error("nao deveria abrir conexao");
        },
        lerArquivo: () => {
          throw new Error("ENOENT");
        },
      },
    );
    expect(codigo).toBe(1);
  });

  it("caminho feliz de `enviar` sai 0", async () => {
    const { cliente } = bancoFalso();
    clienteDeLoteFalso();
    repositorioFalso();

    const codigo = await executar(
      AMBIENTE_COMPLETO,
      ["--prova", "prova-1", "--pdf", "a.pdf", "--acao", "enviar"],
      {
        abrirConexao: () => cliente,
        lerArquivo: () => pdfDeTeste(["QUESTAO 1"]),
      },
    );

    expect(codigo).toBe(0);
  });

  it("falha no meio sai 1 e reporta", async () => {
    const { cliente } = bancoFalso();
    clienteDeLoteFalso();

    const codigo = await executar(
      AMBIENTE_COMPLETO,
      ["--prova", "prova-1", "--pdf", "a.pdf", "--acao", "enviar"],
      {
        abrirConexao: () => ({
          ...cliente,
          query: async () => {
            throw new Error("banco fora do ar");
          },
        }),
        lerArquivo: () => pdfDeTeste(["QUESTAO 1"]),
      },
    );

    expect(codigo).toBe(1);
  });
});

describe("--acao inspecionar — o ensaio que nao gasta nada", () => {
  it("roda com o ambiente vazio: sem banco, sem chave de IA, sem Storage", async () => {
    // E o comando com que se testa um PDF de banca nova. Exigir provisionamento
    // dele derrotaria o ponto: ninguem provisiona para descobrir se vale.
    const codigo = await executar({}, ["--acao", "inspecionar", "--pdf", "a.pdf"], {
      abrirConexao: () => {
        throw new Error("inspecionar nao pode abrir conexao");
      },
      lerArquivo: () => pdfDeTeste(["QUESTAO 1", "QUESTAO 2"]),
    });

    expect(codigo).toBe(0);
  });

  it("nao chama o provedor", async () => {
    const lote = clienteDeLoteFalso();

    await executar({}, ["--acao", "inspecionar", "--pdf", "a.pdf"], {
      abrirConexao: () => {
        throw new Error("inspecionar nao pode abrir conexao");
      },
      lerArquivo: () => pdfDeTeste(["QUESTAO 1"]),
    });

    expect(lote.enviados).toBe(0);
    expect(lote.jsonl).toEqual([]);
  });

  it("dispensa --prova, mas exige --pdf", () => {
    expect(lerArgumentos(["--acao", "inspecionar", "--pdf", "a.pdf"]).provaId).toBe("");
    expect(() => lerArgumentos(["--acao", "inspecionar"])).toThrow(/uso:/);
  });
});

describe("--acao estado", () => {
  it("dispensa --pdf e nao exige chave de IA nem Storage", () => {
    expect(lerArgumentos(["--acao", "estado", "--prova", "p1"]).pdf).toBe("");
    expect(motivoDeParada({ DATABASE_URL: "x" }, "estado")).toBeNull();
    expect(motivoDeParada({}, "estado")).toContain("DATABASE_URL");
  });

  it("`inspecionar` nao exige nem o banco", () => {
    expect(motivoDeParada({}, "inspecionar")).toBeNull();
  });

  it("le os blocos da prova sem ler PDF nenhum", async () => {
    const { cliente, consultas } = bancoFalso();

    const codigo = await executar(
      { DATABASE_URL: "postgres://x" },
      ["--acao", "estado", "--prova", "prova-1"],
      {
        abrirConexao: () => cliente,
        lerArquivo: () => {
          throw new Error("estado nao pode ler PDF");
        },
      },
    );

    expect(codigo).toBe(0);
    expect(consultas.some((c) => c.texto.includes("from public.prova_lote"))).toBe(true);
  });
});

describe("enviar — a trava de texto ilegivel (BANCO-12 AC3)", () => {
  it("PDF com texto que nao forma palavra cai em precisa_ocr sem gastar", async () => {
    // O caso pior: sai **muito** texto e nenhuma palavra. Sem esta trava,
    // "tem texto nativo" seria verdade e o lixo viraria conta a pagar.
    // Consoantes e pontuacao: todo caractere e "plausivel", e nao ha vogal
    // nenhuma. E o que uma fonte com codificacao propria produz — e e
    // PDF-safe, ao contrario de parenteses soltos.
    const lixo = "bcdfg hjklm npqrs tvwxz. ".repeat(25);
    const { cliente, consultas } = bancoFalso();
    const lote = clienteDeLoteFalso();

    const resumo = await enviar(cliente, ARGUMENTOS, pdfDeTeste([lixo]));

    expect(resumo.precisaOcr).toBe(true);
    expect(lote.enviados).toBe(0);
    const marca = consultas.find((c) => c.texto.includes("update public.provas"));
    expect(marca?.valores?.[1]).toBe("precisa_ocr");
    // O motivo distingue "ilegivel" de "escaneada": a acao do operador e outra.
    expect(String(marca?.valores?.[2])).toContain("nao e legivel");
  });

  it("prova com secao em ingles passa: a medida e de escrita, nao de idioma", async () => {
    // A secao de Lingua Inglesa e prova legitima. Reprova-la mandaria a prova
    // inteira para uma fila de OCR que nem existe no MVP.
    const { cliente } = bancoFalso();
    const lote = clienteDeLoteFalso();

    const resumo = await enviar(
      cliente,
      ARGUMENTOS,
      pdfDeTeste([
        "QUESTION 11 American intelligence officials have found no evidence that aerial phenomena observed by Navy pilots are alien spacecraft, but they cannot explain the unusual movements",
        "QUESTION 12 In the second paragraph of the text the highlighted expression is associated with the idea of addition and consequence in the sentence",
      ]),
    );

    expect(resumo.precisaOcr).toBe(false);
    expect(lote.enviados).toBe(1);
  });
});
