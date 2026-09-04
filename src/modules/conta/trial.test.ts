import { afterEach, describe, expect, it, vi } from "vitest";

import {
  definirDestinoDeErro,
  restaurarDestinoPadrao,
} from "@/modules/observabilidade";

import { concederTrial, mensagemDaRecusaDoTrial } from "./trial";

function cliente(resposta: { data?: unknown; error?: { message: string } | null }) {
  return {
    rpc: vi.fn(async () => ({
      data: resposta.data ?? null,
      error: resposta.error ?? null,
    })),
  } as never;
}

afterEach(() => {
  restaurarDestinoPadrao();
});

describe("concederTrial", () => {
  it("devolve a matrícula quando o banco concede", async () => {
    await expect(
      concederTrial(cliente({ data: "mat-1" })),
    ).resolves.toEqual({ estado: "concedido", matriculaId: "mat-1" });
  });

  /**
   * `null` é "já tem acesso", não erro: `conceder_trial()` é idempotente de
   * propósito para o aluno que clica duas vezes no link do e-mail.
   */
  it("trata `null` como já tem acesso, e não como falha", async () => {
    await expect(concederTrial(cliente({ data: null }))).resolves.toEqual({
      estado: "ja_tem_acesso",
    });
  });

  it("nomeia as recusas conhecidas do banco", async () => {
    for (const motivo of [
      "trial_desligado",
      "trial_ja_usado",
      "email_nao_confirmado",
      "sem_sessao",
      "produto_trial_indisponivel",
    ] as const) {
      await expect(
        concederTrial(cliente({ error: { message: `erro: ${motivo} aqui` } })),
      ).resolves.toEqual({ estado: "recusado", motivo });
    }
  });

  /**
   * Recusa que ninguém nomeou é defeito nosso, e por isso vai para o Sentry.
   * As nomeadas, não: são estados esperados do produto e virariam ruído.
   */
  it("erro desconhecido vira `falha` e é reportado; recusa nomeada não é", async () => {
    const reportados: unknown[] = [];
    definirDestinoDeErro((erro) => {
      reportados.push(erro);
    });

    await expect(
      concederTrial(cliente({ error: { message: "connection reset" } })),
    ).resolves.toEqual({ estado: "recusado", motivo: "falha" });
    expect(reportados).toHaveLength(1);

    await concederTrial(cliente({ error: { message: "trial_ja_usado" } }));
    expect(reportados).toHaveLength(1);
  });
});

describe("mensagemDaRecusaDoTrial", () => {
  it("fala do que o aluno pode fazer nas duas recusas que ele vê", () => {
    expect(mensagemDaRecusaDoTrial("trial_ja_usado")).toMatch(/matrícula/i);
    expect(mensagemDaRecusaDoTrial("trial_desligado")).toMatch(/matrícula/i);
  });

  it("não expõe defeito nosso ao aluno", () => {
    expect(mensagemDaRecusaDoTrial("falha")).toBe(
      "Não foi possível liberar o teste grátis agora.",
    );
    expect(mensagemDaRecusaDoTrial("produto_trial_indisponivel")).toBe(
      "Não foi possível liberar o teste grátis agora.",
    );
  });
});
