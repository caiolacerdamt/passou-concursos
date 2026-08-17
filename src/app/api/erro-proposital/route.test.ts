import { afterEach, describe, expect, it } from "vitest";

import {
  type LeitorDeConfig,
  definirLeitorDeConfig,
  definirReporteDeErro,
  restaurarLeitorPadrao,
  restaurarReportePadrao,
} from "@/modules/config/leitura";

import { GET } from "./route";

afterEach(() => {
  restaurarLeitorPadrao();
  restaurarReportePadrao();
});

/** Leitor de mentira, no mesmo molde do teste da SPEC 02. */
function leitorFalso(resposta: Record<string, unknown>): LeitorDeConfig {
  return async () => resposta;
}

describe("GET /api/erro-proposital", () => {
  it("responde 404 e nao lanca quando a flag esta desligada", async () => {
    definirLeitorDeConfig(leitorFalso({}));

    const resposta = await GET();

    expect(resposta.status).toBe(404);
  });

  it("lanca quando a flag esta ligada, com mensagem reconhecivel", async () => {
    definirLeitorDeConfig(
      leitorFalso({ "flag.m9.rota_de_erro_proposital": true }),
    );

    await expect(GET()).rejects.toThrow(
      "erro proposital: conferindo o caminho ate o Sentry (INFRA-09)",
    );
  });

  it("config ilegivel deixa a rota fechada, nunca aberta (INFRA-11 AC6)", async () => {
    definirReporteDeErro(() => {});
    definirLeitorDeConfig(async () => {
      throw new Error("banco fora do ar");
    });

    const resposta = await GET();

    expect(resposta.status).toBe(404);
  });
});
