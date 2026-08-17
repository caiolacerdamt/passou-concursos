import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  montarContexto,
  montarMensagem,
  urlDaExecucao,
} from "./reportar-falha.mjs";
import { dsnDoAmbiente, iniciarSentry, reportar } from "./sentry-node.mjs";

const AMBIENTE_COMPLETO = {
  GITHUB_WORKFLOW: "CI",
  GITHUB_JOB: "app",
  GITHUB_REF: "refs/pull/12/merge",
  GITHUB_SERVER_URL: "https://github.com",
  GITHUB_REPOSITORY: "caiolacerdamt/passou-concursos",
  GITHUB_RUN_ID: "987654",
  DETALHE_DA_FALHA: "app=failure",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("montarMensagem", () => {
  it("diz qual workflow falhou e o detalhe recebido", () => {
    expect(montarMensagem(AMBIENTE_COMPLETO)).toBe(
      "GitHub Actions falhou: CI — app=failure",
    );
  });

  it("o argumento da linha de comando vence a variavel de ambiente", () => {
    expect(montarMensagem(AMBIENTE_COMPLETO, "migracao=failure")).toBe(
      "GitHub Actions falhou: CI — migracao=failure",
    );
  });

  it("com o ambiente vazio ainda produz mensagem util, sem lancar", () => {
    // Rodado a mao ou fora do Actions: nao pode explodir justamente aqui.
    expect(montarMensagem({})).toBe(
      "GitHub Actions falhou: workflow desconhecido — sem detalhe",
    );
  });
});

describe("urlDaExecucao", () => {
  it("monta a URL que leva direto ao log da execucao", () => {
    expect(urlDaExecucao(AMBIENTE_COMPLETO)).toBe(
      "https://github.com/caiolacerdamt/passou-concursos/actions/runs/987654",
    );
  });

  it("devolve null quando falta peca, em vez de uma URL quebrada", () => {
    expect(urlDaExecucao({ ...AMBIENTE_COMPLETO, GITHUB_RUN_ID: undefined })).toBe(null);
    expect(urlDaExecucao({})).toBe(null);
  });
});

describe("montarContexto", () => {
  it("carrega so metadado publico do GitHub — nenhum dado de aluno", () => {
    expect(montarContexto(AMBIENTE_COMPLETO)).toEqual({
      origem: "github-actions",
      workflow: "CI",
      job: "app",
      ref: "refs/pull/12/merge",
      execucao:
        "https://github.com/caiolacerdamt/passou-concursos/actions/runs/987654",
    });
  });

  it("campo ausente vira null, nunca 'undefined' virando texto", () => {
    expect(montarContexto({})).toEqual({
      origem: "github-actions",
      workflow: null,
      job: null,
      ref: null,
      execucao: null,
    });
  });
});

describe("sentry-node", () => {
  it("sem DSN nao inicializa e diz que nao inicializou", async () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", undefined);
    expect(dsnDoAmbiente()).toBe("");
    expect(await iniciarSentry()).toBe(false);

    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "   ");
    expect(await iniciarSentry()).toBe(false);
  });

  it("sem DSN o reporte continua visivel no console — a falha nao some", async () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", undefined);
    const espiao = vi.spyOn(console, "error").mockImplementation(() => {});

    await reportar(new Error("job caiu"), { origem: "github-actions" });

    expect(espiao).toHaveBeenCalledWith(
      "[job]",
      { origem: "github-actions" },
      "Error: job caiu",
    );
  });

  it("o console do job tambem sai saneado — log do Actions fica guardado pelo GitHub", async () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", undefined);
    const espiao = vi.spyOn(console, "error").mockImplementation(() => {});

    await reportar(new Error("falhou para aluno@exemplo.com"), {
      email: "aluno@exemplo.com",
      detalhe: "cpf 529.982.247-25 duplicado",
    });

    expect(espiao).toHaveBeenCalledWith(
      "[job]",
      { email: "[removido]", detalhe: "cpf [cpf] duplicado" },
      "Error: falhou para [email]",
    );
  });

  it("o init do job tem a mesma postura de privacidade do init da aplicacao", () => {
    // Duas pecas separadas com a mesma obrigacao. Se uma mudar sozinha, aqui quebra.
    const arquivo = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "sentry-node.mjs",
    );
    const conteudo = readFileSync(arquivo, "utf8");

    expect(conteudo).toContain("beforeSend: sanearEventoSentry");
    expect(conteudo).toContain("dataCollection: { userInfo: false, httpBodies: [] }");
    expect(conteudo).toContain("tracesSampleRate: 0");
    expect(conteudo).not.toContain("replayIntegration");
  });
});
