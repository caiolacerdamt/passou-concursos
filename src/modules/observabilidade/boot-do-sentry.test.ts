import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Guarda-corpo dos tres `Sentry.init` do projeto.
 *
 * Le o fonte em vez de importar de proposito: importar os arquivos executaria
 * `Sentry.init` de verdade dentro do teste `unit`, que o AD-083 mantem sem rede.
 * O que precisa ser garantido aqui e uma decisao escrita no arquivo — replay
 * proibido, tracing desligado, saneamento ligado —, e decisao escrita se le.
 */

const RAIZ_SRC = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

const INITS = [
  "sentry.server.config.ts",
  "sentry.edge.config.ts",
  "instrumentation-client.ts",
];

function fonte(arquivo: string): string {
  return readFileSync(path.join(RAIZ_SRC, arquivo), "utf8");
}

describe("boot do Sentry", () => {
  it("os tres runtimes inicializam o SDK", () => {
    for (const arquivo of INITS) {
      expect(fonte(arquivo)).toContain("Sentry.init({");
    }
  });

  it("todo init saneia o evento antes de mandar (contrato: sem dado pessoal)", () => {
    for (const arquivo of INITS) {
      expect(fonte(arquivo)).toContain("beforeSend: sanearEventoSentry");
      expect(fonte(arquivo)).toContain(
        "dataCollection: { userInfo: false, httpBodies: [] }",
      );
    }
  });

  it("todo init carrega dsn, release e ambiente da mesma fonte testada", () => {
    for (const arquivo of INITS) {
      const conteudo = fonte(arquivo);
      expect(conteudo).toContain("dsn: dsn()");
      expect(conteudo).toContain("release: release()");
      expect(conteudo).toContain("environment: ambienteDeExecucao()");
    }
  });

  it("nenhum init liga session replay — AD-079 vale para o Sentry tambem", () => {
    for (const arquivo of INITS) {
      const conteudo = fonte(arquivo);
      expect(conteudo).not.toContain("replayIntegration");
      expect(conteudo).not.toContain("replaysSessionSampleRate");
      expect(conteudo).not.toContain("replaysOnErrorSampleRate");
    }
  });

  it("nenhum init liga tracing — AD-037 pediu erro, nao desempenho", () => {
    for (const arquivo of INITS) {
      expect(fonte(arquivo)).toContain("tracesSampleRate: 0");
    }
  });

  it("o servidor exporta onRequestError, que e o contexto de rota do AC1", () => {
    const conteudo = fonte("instrumentation.ts");
    expect(conteudo).toContain(
      "export const onRequestError = Sentry.captureRequestError",
    );
    expect(conteudo).toContain('await import("./sentry.server.config")');
    expect(conteudo).toContain('await import("./sentry.edge.config")');
  });

  it("o erro de renderizacao do React tem quem o capture", () => {
    const conteudo = fonte(path.join("app", "global-error.tsx"));
    expect(conteudo).toContain("Sentry.captureException(error)");
    // A tela nao pode imprimir a mensagem: ela pode carregar dado pessoal.
    expect(conteudo).not.toContain("{error.message}");
  });
});
