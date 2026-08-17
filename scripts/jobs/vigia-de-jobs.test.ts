import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CONSULTA,
  JANELA_HORAS,
  ambienteDoScript,
  motivoDeParada,
  resumirFalhas,
} from "./vigia-de-jobs.mjs";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("janela do vigia", () => {
  it("e constante em codigo: 26 horas, o dia mais folga", () => {
    // Configuracao ilegivel e uma das falhas que este script denuncia. Se a
    // janela morasse na tabela de config, ele calaria justamente quando importa.
    expect(JANELA_HORAS).toBe(26);
    expect(CONSULTA).toContain("make_interval(hours => $1::int)");
  });
});

describe("ambienteDoScript", () => {
  it("o valor do .env vence o do sistema — a armadilha do Windows ja custou caro", () => {
    const pasta = mkdtempSync(path.join(tmpdir(), "vigia-"));
    try {
      writeFileSync(
        path.join(pasta, ".env"),
        "DATABASE_URL=postgres://do-arquivo\n# comentario\n",
        "utf8",
      );
      vi.stubEnv("DATABASE_URL", "postgres://do-sistema");

      expect(ambienteDoScript(pasta).DATABASE_URL).toBe("postgres://do-arquivo");
    } finally {
      rmSync(pasta, { recursive: true, force: true });
    }
  });

  it("sem .env, vale o ambiente do processo — e o caso do GitHub Actions", () => {
    const pasta = mkdtempSync(path.join(tmpdir(), "vigia-"));
    try {
      vi.stubEnv("DATABASE_URL", "postgres://do-sistema");
      expect(ambienteDoScript(pasta).DATABASE_URL).toBe("postgres://do-sistema");
    } finally {
      rmSync(pasta, { recursive: true, force: true });
    }
  });
});

describe("motivoDeParada", () => {
  it("sem DATABASE_URL, diz o que falta — nunca 'nada a reportar'", () => {
    expect(motivoDeParada({})).toContain("DATABASE_URL nao esta definida");
    expect(motivoDeParada({ DATABASE_URL: "   " })).toContain(
      "DATABASE_URL nao esta definida",
    );
  });

  it("com DATABASE_URL, nada impede de rodar", () => {
    expect(motivoDeParada({ DATABASE_URL: "postgres://u:s@host:5432/postgres" })).toBe(
      null,
    );
  });
});

describe("resumirFalhas", () => {
  it("lista vazia nao vira alerta nenhum", () => {
    expect(resumirFalhas([])).toEqual([]);
  });

  it("transforma a linha da view em erro com nome do job e detalhe", () => {
    const inicio = new Date("2026-08-17T03:00:00.000Z");
    const [falha] = resumirFalhas([
      {
        jobid: 7,
        runid: 42,
        jobname: "recalcula_projecoes",
        status: "failed",
        return_message: "division by zero",
        start_time: inicio,
      },
    ]);

    expect(falha.mensagem).toBe(
      "job de pg_cron falhou: recalcula_projecoes (failed)",
    );
    expect(falha.contexto).toEqual({
      origem: "pg_cron",
      jobid: 7,
      runid: 42,
      jobname: "recalcula_projecoes",
      status: "failed",
      detalhe: "division by zero",
      inicio: "2026-08-17T03:00:00.000Z",
    });
  });

  it("job sem nome e identificado pelo jobid, nao vira 'null'", () => {
    const [falha] = resumirFalhas([
      { jobid: 9, runid: 1, jobname: null, status: "canceled", return_message: null, start_time: null },
    ]);

    expect(falha.mensagem).toBe("job de pg_cron falhou: jobid 9 (canceled)");
    expect(falha.contexto.detalhe).toBe("sem mensagem");
    expect(falha.contexto.inicio).toBe(null);
  });

  it("dado pessoal dentro de return_message sai saneado", () => {
    // O erro do Postgres imprime o valor que quebrou a constraint. Uma violacao
    // de unicidade em e-mail de aluno chegaria inteira ao Sentry, nos EUA.
    const [falha] = resumirFalhas([
      {
        jobid: 1,
        runid: 2,
        jobname: "envia_avisos",
        status: "failed",
        return_message:
          'duplicate key value violates unique constraint: Key (email)=(aluno@exemplo.com) — cpf 529.982.247-25',
        start_time: null,
      },
    ]);

    expect(falha.contexto.detalhe).toBe(
      "duplicate key value violates unique constraint: Key (email)=([email]) — cpf [cpf]",
    );
  });

  it("varias falhas viram varios alertas, na ordem em que vieram", () => {
    const falhas = resumirFalhas([
      { jobid: 1, runid: 1, jobname: "a", status: "failed", return_message: "x", start_time: null },
      { jobid: 2, runid: 2, jobname: "b", status: "canceled", return_message: "y", start_time: null },
    ]);

    expect(falhas.map((f) => f.mensagem)).toEqual([
      "job de pg_cron falhou: a (failed)",
      "job de pg_cron falhou: b (canceled)",
    ]);
  });
});
