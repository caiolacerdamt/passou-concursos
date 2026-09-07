import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import {
  USO,
  formatarAchados,
  formatarDecisao,
  formatarDominios,
  lerArgumentos,
  formatarPrograma,
  formatarProposta,
  formatarSegundaConfirmacao,
  lerDecisoes,
  lerDecisoesDeAssunto,
  lerProposta,
  motivoDeParada,
  motivoOuPadrao,
} from "./abrir-concurso.mts";

const UUID_A = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
const UUID_B = "3f2504e0-4f89-11d3-9a0c-0305e82c3302";

describe("os argumentos do comando", () => {
  it("aceita cada acao com o que ela exige", () => {
    expect(lerArgumentos(["--acao", "dominios"]).acao).toBe("dominios");

    expect(
      lerArgumentos(["--acao", "iniciar", "--concurso", UUID_A, "--operador", UUID_B]),
    ).toMatchObject({ acao: "iniciar", concurso: UUID_A, operador: UUID_B });

    expect(
      lerArgumentos([
        "--acao",
        "registrar-achados",
        "--abertura",
        UUID_A,
        "--operador",
        UUID_B,
        "--entrada",
        "achados.json",
      ]),
    ).toMatchObject({ abertura: UUID_A, entrada: "achados.json" });
  });

  it("recusa acao desconhecida e acao inventada pelo agente", () => {
    expect(() => lerArgumentos([])).toThrow(USO);
    expect(() => lerArgumentos(["--acao", "pesquisar"])).toThrow(USO);
    expect(() => lerArgumentos(["--acao", "publicar"])).toThrow(USO);
  });

  it("exige uuid de verdade nos IDs, e nao qualquer texto", () => {
    expect(() =>
      lerArgumentos(["--acao", "iniciar", "--concurso", "caixa", "--operador", UUID_B]),
    ).toThrow(/--concurso precisa ser um uuid/);

    expect(() =>
      lerArgumentos(["--acao", "iniciar", "--concurso", UUID_A, "--operador", ""]),
    ).toThrow(/--operador precisa ser um uuid/);
  });

  it("exige o arquivo de entrada nas duas acoes que recebem JSON do agente", () => {
    for (const acao of ["registrar-achados", "decidir-documentos"]) {
      expect(() =>
        lerArgumentos(["--acao", acao, "--abertura", UUID_A, "--operador", UUID_B]),
      ).toThrow(/--entrada e obrigatorio/);
    }
  });

  it("o destino do download tem default e nao vem do servidor", () => {
    const padrao = lerArgumentos([
      "--acao",
      "decidir-documentos",
      "--abertura",
      UUID_A,
      "--operador",
      UUID_B,
      "--entrada",
      "d.json",
    ]);
    expect(padrao.destino).toBe("provas");
  });
});

describe("as decisoes do operador", () => {
  it("aceita a lista de aprovado/rejeitado", () => {
    expect(
      lerDecisoes([
        { id: UUID_A, decisao: "aprovado" },
        { id: UUID_B, decisao: "rejeitado" },
      ]),
    ).toHaveLength(2);
  });

  it("recusa lista vazia, ID que nao e uuid e decisao inventada", () => {
    expect(() => lerDecisoes([])).toThrow(/lista nao vazia/);
    expect(() => lerDecisoes({ id: UUID_A })).toThrow(/lista nao vazia/);
    expect(() => lerDecisoes([{ id: "todos", decisao: "aprovado" }])).toThrow(/uuid/);
    expect(() => lerDecisoes([{ id: UUID_A, decisao: "talvez" }])).toThrow(/aprovado.*rejeitado/);
    // "publicar" nao e decisao de documento: publicar e outra porta.
    expect(() => lerDecisoes([{ id: UUID_A, decisao: "publicar" }])).toThrow(/aprovado/);
  });
});

describe("o comando nao exige chave de modelo (AD-145)", () => {
  it("so DATABASE_URL segura o comando", () => {
    expect(motivoDeParada({})).toMatch(/DATABASE_URL/);
    expect(motivoDeParada({ DATABASE_URL: "postgres://x" })).toBeNull();
    // Sem OPENAI_API_KEY o comando roda inteiro: ele nao chama modelo nenhum.
    expect(motivoDeParada({ DATABASE_URL: "postgres://x", OPENAI_API_KEY: "" })).toBeNull();
  });

  it("o arquivo nao importa gateway, tarefa de IA nem provedor de busca", () => {
    const fonte = readFileSync(new URL("./abrir-concurso.mts", import.meta.url), "utf8");
    expect(fonte).not.toMatch(/executarTarefa|perfilDaTarefa|definirRepositorioDeIa/);
    expect(fonte).not.toMatch(/OPENAI_API_KEY/);
    // A unica ida a rede e o download, e ele mora no modulo do acervo.
    expect(fonte).not.toMatch(/\bfetch\(/);
  });
});

describe("o que o agente le na tela", () => {
  it("a allowlist sai com a regra de casamento e o aviso do agregador", () => {
    const texto = formatarDominios(["cesgranrio.org.br", "gov.br"]);
    expect(texto).toContain("dominios oficiais (2)");
    expect(texto).toContain("host exato ou subdominio");
    expect(texto).toMatch(/agregador/i);
  });

  it("a lista de aprovacao mostra ID, titulo e URL aceita — e o descarte como NUMERO", () => {
    const texto = formatarAchados({
      aceitos: 1,
      descartados: 4,
      faltantes: ["prova 2019 do mesmo cargo"],
      documentos: [
        {
          id: UUID_A,
          tipo: "prova",
          titulo: "CAIXA 2021 · caderno 1",
          url: "https://cesgranrio.org.br/p.pdf",
        },
      ],
    });

    expect(texto).toContain("1 documento(s) em fonte oficial");
    expect(texto).toContain("4 descartado(s)");
    expect(texto).toContain(UUID_A);
    expect(texto).toContain("https://cesgranrio.org.br/p.pdf");
    expect(texto).toContain("prova 2019 do mesmo cargo");
    // A confirmacao e explicita, e o texto diz que nada foi baixado ainda.
    expect(texto).toMatch(/CONFIRMACAO 1/);
    expect(texto).toMatch(/nenhum download aconteceu ainda/);
  });

  it("o resumo da decisao mostra o que baixou e o que falhou, sem esconder a falha", () => {
    const texto = formatarDecisao({
      aprovados: 2,
      baixados: [
        { id: UUID_A, arquivo: "provas/prova-a.pdf", bytes: 1024, prova: UUID_B },
      ],
      falhas: [{ id: UUID_B, motivo: "resposta 503" }],
    });

    expect(texto).toContain("2 documento(s) aprovado(s); 1 baixado(s).");
    expect(texto).toContain("provas/prova-a.pdf");
    expect(texto).toContain(`prova ${UUID_B}`);
    expect(texto).toContain("FALHOU");
    expect(texto).toContain("resposta 503");
    expect(texto).toMatch(/nao duplica/);
  });
});

// ── T5 · a segunda confirmacao ──────────────────────────────────────────────

describe("os argumentos das acoes do programa e dos assuntos", () => {
  it("`programa` exige abertura e operador, e NAO exige entrada", () => {
    const lido = lerArgumentos([
      "--acao",
      "programa",
      "--abertura",
      UUID_A,
      "--operador",
      UUID_B,
    ]);
    expect(lido.acao).toBe("programa");
    expect(lido.entrada).toBe("");
  });

  it("`propor-assuntos` e `decidir-assuntos` exigem o JSON do agente", () => {
    for (const acao of ["propor-assuntos", "decidir-assuntos"]) {
      expect(() =>
        lerArgumentos(["--acao", acao, "--abertura", UUID_A, "--operador", UUID_B]),
      ).toThrow(/--entrada e obrigatorio/);
    }
  });

  it("o motivo nunca vai vazio ao banco", () => {
    expect(motivoOuPadrao("")).toMatch(/operador/);
    expect(motivoOuPadrao("conferido com o edital impresso")).toBe(
      "conferido com o edital impresso",
    );
  });
});

describe("a proposta que o agente escreve depois de ler o trecho", () => {
  const VALIDA = {
    materias: [
      {
        nome: "Língua Portuguesa",
        ordem: 1,
        peso: { valor: 20, base: "itens" },
        assuntos: ["Crase", "Regência Verbal"],
      },
      { nome: "Conhecimentos Bancários", ordem: 2, assuntos: ["Produtos"] },
    ],
  };

  it("aceita o formato combinado, com peso opcional", () => {
    const lida = lerProposta(VALIDA);
    expect(lida.materias).toHaveLength(2);
    expect(lida.materias[0].peso).toEqual({ valor: 20, base: "itens" });
    expect(lida.materias[1].peso).toBeUndefined();
    expect(lida.materias[1].ordem).toBe(2);
  });

  it("recusa campo desconhecido, materia sem assunto e base de peso inventada", () => {
    expect(() =>
      lerProposta({ materias: [{ ...VALIDA.materias[1], observacao: "extra" }] }),
    ).toThrow(/proposta recusada/);

    expect(() => lerProposta({ materias: [{ nome: "Vazia", assuntos: [] }] })).toThrow(
      /proposta recusada/,
    );

    expect(() =>
      lerProposta({
        materias: [{ nome: "X", assuntos: ["Y"], peso: { valor: 1, base: "estrelas" } }],
      }),
    ).toThrow(/proposta recusada/);

    expect(() => lerProposta({ materias: [] })).toThrow(/proposta recusada/);
    expect(() => lerProposta({})).toThrow(/proposta recusada/);
  });
});

describe("as decisoes de assunto exigem o que cada uma usa", () => {
  it("aceita as quatro decisoes com os campos certos", () => {
    const lidas = lerDecisoesDeAssunto({
      decisoes: [
        { id: UUID_A, decisao: "mapear", topico_id: UUID_B },
        { id: UUID_B, decisao: "rejeitar" },
      ],
      pesos: [{ materia_id: UUID_A, peso_declarado: 10, base: "pontos" }],
    });
    expect(lidas.decisoes).toHaveLength(2);
    expect(lidas.pesos).toHaveLength(1);
  });

  it("pesos e opcional e nasce vazio — edital sem tabela de pontos existe", () => {
    expect(
      lerDecisoesDeAssunto({ decisoes: [{ id: UUID_A, decisao: "rejeitar" }] }).pesos,
    ).toEqual([]);
  });

  it("recusa decisao que nao carrega o que precisa para ser aplicada", () => {
    expect(() =>
      lerDecisoesDeAssunto({ decisoes: [{ id: UUID_A, decisao: "mapear" }] }),
    ).toThrow(/mapear. exige/);

    expect(() =>
      lerDecisoesDeAssunto({ decisoes: [{ id: UUID_A, decisao: "criar" }] }),
    ).toThrow(/criar. exige/);

    // Fusao sem origem seria "funda com alguma coisa" — nunca automatica.
    expect(() =>
      lerDecisoesDeAssunto({ decisoes: [{ id: UUID_A, decisao: "fundir", topico_id: UUID_B }] }),
    ).toThrow(/fundir. exige/);
  });

  it("recusa `pendente` como decisao: linha sem decisao segura o quadro", () => {
    expect(() =>
      lerDecisoesDeAssunto({ decisoes: [{ id: UUID_A, decisao: "pendente" }] }),
    ).toThrow(/decisoes recusadas/);
    expect(() => lerDecisoesDeAssunto({ decisoes: [] })).toThrow(/decisoes recusadas/);
  });
});

describe("o que o operador le na segunda confirmacao", () => {
  it("separa o que ja existe do que nao existe, e mostra o parecido com o percentual", () => {
    const texto = formatarProposta({
      linhas: [
        {
          id: UUID_A,
          materiaEdital: "Língua Portuguesa",
          nomeProposto: "Crase",
          topicoId: UUID_B,
          candidatos: [],
        },
        {
          id: UUID_B,
          materiaEdital: "Língua Portuguesa",
          nomeProposto: "Regência verbal e nominal",
          topicoId: null,
          candidatos: [
            {
              topicoId: UUID_A,
              nome: "Regência Verbal",
              materiaNome: "Português",
              similaridade: 0.82,
            },
          ],
        },
      ],
      pesos: [
        { materia_id: UUID_A, materia_nome: "Português", peso_declarado: 20, base: "itens" },
      ],
      pesosSemMateria: ["Atualidades"],
    });

    expect(texto).toContain("ja existe (mapear)");
    expect(texto).toContain("nao existe");
    expect(texto).toContain("Regência Verbal");
    expect(texto).toContain("82%");
    expect(texto).toContain("Português: 20 em itens");
    expect(texto).toContain("AVISO");
    expect(texto).toContain("Atualidades");
    expect(texto).toMatch(/CONFIRMACAO 2/);
    expect(texto).toMatch(/nada do edital mudou ainda/i);
    expect(texto).toMatch(/Fusao e sempre humana/);
  });

  it("assunto sem nada parecido diz o que sobrou de opcao", () => {
    const texto = formatarProposta({
      linhas: [
        {
          id: UUID_A,
          materiaEdital: "Atualidades",
          nomeProposto: "Agenda ESG",
          topicoId: null,
          candidatos: [],
        },
      ],
      pesos: [],
      pesosSemMateria: [],
    });
    expect(texto).toContain("nenhum parecido — criar ou rejeitar");
  });

  it("o fecho da segunda confirmacao conta o que entrou", () => {
    const texto = formatarSegundaConfirmacao({ aplicados: 12, pesos: 3 });
    expect(texto).toContain("12 assunto(s) aplicados");
    expect(texto).toContain("3 peso(s)");
  });
});

describe("o trecho do programa e a unica saida de texto de documento", () => {
  it("o corte que fecha sai com paginas, tamanho e o texto do programa", () => {
    const texto = formatarPrograma({
      confiavel: true,
      trecho: "LÍNGUA PORTUGUESA: 1 Crase.",
      paginaInicial: 3,
      paginaFinal: 4,
      caracteres: 27,
      truncado: false,
      arquivo: "provas/edital-x.pdf",
    });
    expect(texto).toContain("paginas 3-4");
    expect(texto).toContain("LÍNGUA PORTUGUESA");
    expect(texto).toMatch(/Nao ha chamada de modelo do produto aqui/);
  });

  it("o corte que NAO fecha vira pendencia sem emitir uma linha do edital", () => {
    const texto = formatarPrograma({
      confiavel: false,
      motivo: "nao achei o inicio do conteudo programatico por regra de texto",
      arquivo: "provas/edital-x.pdf",
    });
    expect(texto).toMatch(/^PENDENCIA:/);
    expect(texto).toContain("provas/edital-x.pdf");
    expect(texto).toMatch(/documento inteiro NAO vai para a conversa/);
  });
});

describe("nenhum trecho de documento sai na conversa (AD-140)", () => {
  it("o formatador so recebe contagem, ID, titulo e URL — nunca conteudo", () => {
    // O tipo ja garante isso; o teste guarda a intencao contra uma mudanca
    // futura que resolvesse "mostrar um trechinho para ajudar".
    const espiao = vi.spyOn(console, "log").mockImplementation(() => {});
    console.log(
      formatarAchados({ aceitos: 0, descartados: 0, faltantes: [], documentos: [] }),
    );
    expect(espiao.mock.calls[0][0]).not.toMatch(/%PDF|Content-Disposition/);
    espiao.mockRestore();
  });
});
