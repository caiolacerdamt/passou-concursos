import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ambienteDeExecucao,
  dsn,
  release,
  sentryLigado,
} from "./ambiente";

const TODAS = [
  "NEXT_PUBLIC_SENTRY_DSN",
  "NEXT_PUBLIC_SENTRY_RELEASE",
  "NEXT_PUBLIC_SENTRY_ENVIRONMENT",
  "VERCEL_GIT_COMMIT_SHA",
  "VERCEL_ENV",
  "GITHUB_SHA",
  "NODE_ENV",
] as const;

beforeEach(() => {
  // `GITHUB_SHA` e `NODE_ENV` existem de verdade dentro do GitHub Actions. Sem
  // limpar, o teste da queda final passaria na maquina e falharia na CI.
  for (const nome of TODAS) vi.stubEnv(nome, undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("dsn e sentryLigado", () => {
  it("devolve o DSN configurado", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://chave@o1.ingest.us.sentry.io/2");
    expect(dsn()).toBe("https://chave@o1.ingest.us.sentry.io/2");
    expect(sentryLigado()).toBe(true);
  });

  it("trata ausente, vazio e so-espaco como desligado", () => {
    expect(dsn()).toBe("");
    expect(sentryLigado()).toBe(false);

    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    expect(dsn()).toBe("");
    expect(sentryLigado()).toBe(false);

    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "   ");
    expect(dsn()).toBe("");
    expect(sentryLigado()).toBe(false);
  });
});

describe("release", () => {
  it("prefere NEXT_PUBLIC_SENTRY_RELEASE quando existe", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_RELEASE", "v1.2.3");
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "sha-da-vercel");
    vi.stubEnv("GITHUB_SHA", "sha-do-github");
    expect(release()).toBe("v1.2.3");
  });

  it("cai para o commit da Vercel", () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "sha-da-vercel");
    vi.stubEnv("GITHUB_SHA", "sha-do-github");
    expect(release()).toBe("sha-da-vercel");
  });

  it("cai para o commit do GitHub Actions", () => {
    vi.stubEnv("GITHUB_SHA", "sha-do-github");
    expect(release()).toBe("sha-do-github");
  });

  it("sem nenhum dos tres, devolve 'desenvolvimento' e nao lanca", () => {
    expect(release()).toBe("desenvolvimento");
  });
});

describe("ambienteDeExecucao", () => {
  it("prefere a variavel explicita, depois a da Vercel, depois NODE_ENV", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_ENVIRONMENT", "staging");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("NODE_ENV", "production");
    expect(ambienteDeExecucao()).toBe("staging");

    vi.stubEnv("NEXT_PUBLIC_SENTRY_ENVIRONMENT", undefined);
    expect(ambienteDeExecucao()).toBe("preview");

    vi.stubEnv("VERCEL_ENV", undefined);
    expect(ambienteDeExecucao()).toBe("production");
  });

  it("sem nenhuma pista, assume 'development' e nao 'production'", () => {
    // O SDK assume `production` sozinho quando o campo fica vazio. Erro de
    // `npm run dev` viraria alerta no e-mail do time.
    expect(ambienteDeExecucao()).toBe("development");
  });
});
