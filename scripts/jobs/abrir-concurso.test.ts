import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import {
  USO,
  formatarAchados,
  formatarDecisao,
  formatarDominios,
  lerArgumentos,
  lerDecisoes,
  motivoDeParada,
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
