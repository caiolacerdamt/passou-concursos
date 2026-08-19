import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * As fronteiras de erro da interface (UI-04).
 *
 * Este e um teste de **codigo**, nao de renderizacao, e de proposito: o que os
 * AC do UI-04 exigem e verificavel no arquivo — que o erro va ao ponto unico de
 * reporte, e que a mensagem nao va para a tela. Montar um React que quebra de
 * verdade so para reler essas duas propriedades nao acrescenta nada.
 */

const raiz = path.resolve(import.meta.dirname, "../../app");

function fronteiras(pasta: string): string[] {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = path.join(pasta, entrada.name);
    if (entrada.isDirectory()) return fronteiras(caminho);
    return entrada.name === "error.tsx" ? [caminho] : [];
  });
}

describe("fronteiras de erro", () => {
  const arquivos = fronteiras(raiz);

  it("existe fronteira por segmento alem do global-error", () => {
    // O `global-error.tsx` cobre o layout raiz quebrado e troca o documento
    // inteiro. Sozinho, ele apagaria o cabecalho por causa de um erro de
    // conteudo — o AC3 pede a fronteira mais perto do defeito.
    expect(arquivos.length).toBeGreaterThanOrEqual(2);
    expect(arquivos.map((a) => path.basename(path.dirname(a)))).toContain("app");
  });

  it("toda fronteira reporta pelo ponto unico (UI-04 AC1 · AD-087)", () => {
    for (const arquivo of arquivos) {
      const codigo = readFileSync(arquivo, "utf8");

      expect({ arquivo, reporta: codigo.includes("reportarErro(") }).toEqual({
        arquivo,
        reporta: true,
      });
      // Chamar o SDK direto pula o saneamento do contexto (AD-087).
      expect(codigo).not.toContain("Sentry.captureException");
    }
  });

  it("nenhuma fronteira imprime a mensagem do erro (UI-04 AC2)", () => {
    for (const arquivo of arquivos) {
      const codigo = readFileSync(arquivo, "utf8");

      // O que a tela nao pode conter e `{error.message}` — o `error` inteiro
      // pode e deve ir para o `reportarErro`.
      expect({ arquivo, imprime: /\{\s*error\.(message|stack)\s*\}/.test(codigo) }).toEqual(
        { arquivo, imprime: false },
      );
    }
  });
});
