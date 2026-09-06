import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { USO, formatarRelatorio, lerArgumentos, motivoDeParada } from "./medir-prova.mts";

describe("lerArgumentos", () => {
  it("aceita as quatro acoes", () => {
    for (const acao of ["grade", "separar", "etiquetar", "relatorio"]) {
      const argv =
        acao === "relatorio"
          ? ["--acao", acao, "--prova", "p1"]
          : ["--acao", acao, "--prova", "p1", "--pdf", "prova.pdf"];
      expect(lerArgumentos(argv).acao).toBe(acao);
    }
  });

  it("recusa acao que nao existe", () => {
    expect(() => lerArgumentos(["--acao", "extrair", "--prova", "p1"])).toThrow(USO);
  });

  it("exige o PDF em tudo que le a prova, e dispensa em relatorio", () => {
    expect(() => lerArgumentos(["--acao", "grade", "--prova", "p1"])).toThrow(USO);
    expect(lerArgumentos(["--acao", "relatorio", "--prova", "p1"]).pdf).toBe("");
  });

  it("exige a prova sempre: medir sem saber que linha e nao existe", () => {
    expect(() => lerArgumentos(["--acao", "grade", "--pdf", "x.pdf"])).toThrow(USO);
  });
});

describe("motivoDeParada", () => {
  it("para sem DATABASE_URL em qualquer acao", () => {
    expect(motivoDeParada({}, "grade")).toContain("DATABASE_URL");
    expect(motivoDeParada({}, "relatorio")).toContain("DATABASE_URL");
  });

  it("le a grade sem chave de modelo: medir a capa nao custa nada", () => {
    expect(motivoDeParada({ DATABASE_URL: "postgres://x" }, "grade")).toBeNull();
    expect(motivoDeParada({ DATABASE_URL: "postgres://x" }, "separar")).toBeNull();
  });

  it("exige a chave para etiquetar", () => {
    expect(motivoDeParada({ DATABASE_URL: "postgres://x" }, "etiquetar")).toContain(
      "OPENAI_API_KEY",
    );
  });
});

describe("formatarRelatorio", () => {
  const linha = {
    banca: "Cesgranrio",
    ano: 2021,
    orgao: "CAIXA",
    cargo: "Técnico Bancário Novo",
    caderno: null,
    gradeStatus: "lida",
    separacaoVia: "deterministica",
    conferenciaMotivo: null,
    cadernoIrmaoDe: null,
    itensDeclarados: 60,
    itensIngeridos: 60,
    cobertura: 1,
    blocos: [
      { nome: "LÍNGUA PORTUGUESA", inicial: 1, final: 10, peso: 10, base: "pontos" },
      { nome: null, inicial: 11, final: 20, peso: 10, base: "pontos" },
    ],
  };

  it("diz o veredito, a cobertura e o peso de cada bloco", () => {
    const relatorio = formatarRelatorio(linha);

    expect(relatorio).toContain("grade: lida (60 itens declarados)");
    expect(relatorio).toContain("cobertura 100.0%");
    expect(relatorio).toContain("LÍNGUA PORTUGUESA · itens 1-10 · peso 10 em pontos");
    expect(relatorio).toContain("(sem nome impresso)");
  });

  it("avisa quando a prova espera conferencia humana", () => {
    const relatorio = formatarRelatorio({
      ...linha,
      conferenciaMotivo: "separacao divergiu da grade: 20 itens separados contra 70 declarados",
    });

    expect(relatorio).toContain("conferencia humana pendente");
  });

  it("avisa que o caderno irmao nao soma peso ao ano", () => {
    expect(formatarRelatorio({ ...linha, cadernoIrmaoDe: "outra-prova" })).toContain(
      "NAO soma peso ao ano",
    );
  });
});

describe("o relatorio nao vaza a prova (AD-140)", () => {
  it("nao existe, no comando, nenhum caminho que imprima texto de item ou de pagina", () => {
    const fonte = readFileSync("scripts/jobs/medir-prova.mts", "utf8");

    // O que se procura aqui e a ausencia: nenhum `console.log` recebe `texto`,
    // `enunciado` ou o conteudo de uma pagina. O agente le contagem e veredito.
    const impressoes = [...fonte.matchAll(/console\.(log|warn|error)\(([\s\S]*?)\);/g)].map(
      (m) => m[2],
    );

    for (const impressao of impressoes) {
      expect(impressao).not.toMatch(/\.texto\b/);
      expect(impressao).not.toMatch(/paginas\.map/);
      expect(impressao).not.toMatch(/enunciado/);
    }
  });
});

describe("o workflow do GitHub Actions", () => {
  const workflow = readFileSync(".github/workflows/medicao-de-prova.yml", "utf8");

  it("roda fora da Vercel, por disparo manual, com as quatro acoes", () => {
    expect(workflow).toContain("workflow_dispatch");
    expect(workflow).toContain("options: [grade, separar, etiquetar, relatorio]");
    expect(workflow).toContain("npm run jobs:medir-prova --");
  });

  it("nao tem agendamento: medir prova e ato deliberado do operador", () => {
    expect(workflow).not.toContain("schedule:");
  });
});
