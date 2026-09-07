import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import type { Relatorio } from "./abrir-concurso.mts";
import {
  USO,
  comoRetomar,
  formatarProcessamento,
  formatarPublicacao,
  formatarRelatorioDaAbertura,
  proximoPasso,
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
    // `pesquisar` e a tentacao obvia: a busca e da sessao, e nao existe acao
    // de comando para ela (AD-145).
    expect(() => lerArgumentos(["--acao", "pesquisar"])).toThrow(USO);
    expect(() => lerArgumentos(["--acao", "baixar-tudo"])).toThrow(USO);
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

// ── T6 · medicao, prontidao e fecho ─────────────────────────────────────────

describe("os argumentos das acoes que fecham a abertura", () => {
  it("`relatorio` nao exige operador: e o comando de quem chegou agora", () => {
    const lido = lerArgumentos(["--acao", "relatorio", "--abertura", UUID_A]);
    expect(lido.acao).toBe("relatorio");
    expect(lido.operador).toBe("");
  });

  it("`publicar` exige motivo — ele vai assinado a operador_acoes", () => {
    expect(() =>
      lerArgumentos(["--acao", "publicar", "--abertura", UUID_A, "--operador", UUID_B]),
    ).toThrow(/--motivo e obrigatorio em publicar/);

    expect(
      lerArgumentos([
        "--acao",
        "publicar",
        "--abertura",
        UUID_A,
        "--operador",
        UUID_B,
        "--motivo",
        "prontidao conferida com o operador",
      ]).motivo,
    ).toBe("prontidao conferida com o operador");
  });

  it("`processar-provas` e `recalcular` exigem abertura e operador", () => {
    for (const acao of ["processar-provas", "recalcular"]) {
      expect(() => lerArgumentos(["--acao", acao, "--abertura", UUID_A])).toThrow(
        /--operador precisa ser um uuid/,
      );
    }
  });
});

describe("o degrau vira proximo passo, e nao so um numero", () => {
  const base = { materia: "Português", nProvas: 0, anos: [], baseDoPeso: "sem_dado" };

  it("diz o que falta em cada degrau", () => {
    expect(proximoPasso({ ...base, degrau: 4 }, 4)).toMatch(/registrar o peso do edital/);
    expect(proximoPasso({ ...base, degrau: 3 }, 4)).toMatch(/outro orgao/);
    expect(proximoPasso({ ...base, degrau: 2 }, 4)).toMatch(/medir uma prova DESTE concurso/);
  });

  it("no degrau 1 conta quantas provas faltam para a meta, e reconhece quando ela chega", () => {
    expect(proximoPasso({ ...base, degrau: 1, nProvas: 1 }, 4)).toMatch(/faltam 3 prova/);
    expect(proximoPasso({ ...base, degrau: 1, nProvas: 4 }, 4)).toMatch(/meta de 4 atingida/);
    // Passar da meta nao vira "faltam -1".
    expect(proximoPasso({ ...base, degrau: 1, nProvas: 6 }, 4)).toMatch(/atingida/);
  });
});

describe("o relatorio diz onde parou e qual comando vem agora", () => {
  const base: Relatorio = {
    aberturaId: UUID_A,
    orgao: "CAIXA",
    cargo: "Técnico Bancário",
    estado: "pronto_para_recalculo",
    visibilidade: "oculto",
    descartados: 6,
    faltantes: ["prova 2018"],
    documentosPendentes: 0,
    documentosAprovados: 3,
    documentosBaixados: 3,
    provas: 2,
    metaDeProvas: 4,
    cobertura: 0.62,
    piso: 0.8,
    atingePiso: false,
    materias: [
      { materia: "Português", degrau: 1, nProvas: 2, anos: [2021, 2024], baseDoPeso: "itens" },
      { materia: "Atualidades", degrau: 4, nProvas: 0, anos: [], baseDoPeso: "sem_dado" },
    ],
  };

  it("mostra o lastro materia por materia, com anos e o que falta", () => {
    const texto = formatarRelatorioDaAbertura(base);

    expect(texto).toContain("CAIXA · Técnico Bancário");
    expect(texto).toContain("2 de 4 (meta operacional)");
    expect(texto).toContain("6 descartado(s)");
    expect(texto).toContain("prova 2018");
    expect(texto).toContain("Português · degrau 1 · 2 prova(s) (2021, 2024) · peso de itens");
    expect(texto).toContain("Atualidades · degrau 4");
    expect(texto).toMatch(/faltam 2 prova/);
    expect(texto).toMatch(/registrar o peso do edital/);
    expect(texto).toContain("cobertura 62.0% contra o piso de 80% — NAO atinge");
  });

  it("cada estado aponta o comando seguinte, para a retomada nao ser adivinhacao", () => {
    const passos: [string, RegExp][] = [
      ["pesquisa_pendente", /registrar-achados/],
      ["documentos_pendentes", /decidir-documentos/],
      ["documentos_aprovados", /programa.*processar-provas/],
      ["processamento_em_andamento", /propor-assuntos/],
      ["assuntos_pendentes", /decidir-assuntos/],
      ["pronto_para_recalculo", /recalcular/],
    ];
    for (const [estado, esperado] of passos) {
      expect(comoRetomar({ ...base, estado })).toMatch(esperado);
    }
  });

  it("concluida diz se falta publicar, e nao promete o que a prontidao nao permite", () => {
    expect(comoRetomar({ ...base, estado: "concluida" })).toMatch(/Publicar depende/);
    expect(
      comoRetomar({ ...base, estado: "concluida", visibilidade: "publicado" }),
    ).toMatch(/Nada pendente/);
  });

  it("sem materia projetada manda recalcular em vez de mentir que nao ha lastro", () => {
    expect(formatarRelatorioDaAbertura({ ...base, materias: [] })).toMatch(
      /nenhuma materia projetada ainda/,
    );
  });
});

describe("o processamento delega, e nao reimplementa a medicao", () => {
  it("sem prova baixada o relatorio diz que o concurso vive do edital", () => {
    expect(formatarProcessamento({ provas: [] })).toMatch(/degrau 2/);
  });

  it("mostra o veredito de cada prova e nao esconde a que falhou", () => {
    const texto = formatarProcessamento({
      provas: [
        { prova: UUID_A, arquivo: "provas/a.pdf", codigo: 0, saida: "[medicao] 60 etiquetas" },
        { prova: UUID_B, arquivo: "provas/b.pdf", codigo: 1, saida: "[medicao] precisa_ocr" },
      ],
    });
    expect(texto).toContain("2 prova(s) medidas");
    expect(texto).toContain("OK");
    expect(texto).toContain("FALHOU");
    expect(texto).toContain("60 etiquetas");
    expect(texto).toContain("precisa_ocr");
  });

  it("a publicacao diz que ficou registrada com operador e motivo", () => {
    expect(formatarPublicacao({ concurso: UUID_A, visibilidade: "publicado" })).toMatch(
      /operador e motivo registrados em operador_acoes/,
    );
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
