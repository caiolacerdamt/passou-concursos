import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * A ordem dentro de `clienteDaSessao` (regressao da CI de 2026-08-19).
 *
 * Nao da para provar isto por comportamento sem rodar um build inteiro sem
 * `.env` — que e caro e ja e o que a CI faz. O que da para travar aqui e a
 * **causa**: `cookies()` tem que vir antes de `chavesPublicas()`.
 *
 * Por que importa: `cookies()` e o que avisa ao Next que a rota depende do
 * pedido. Antes desse aviso, o Next tenta pre-renderizar a pagina no build, e
 * ali nao existe variavel de ambiente. Com a leitura das chaves na frente, o
 * build quebrava em `Error occurred prerendering page "/app"` em qualquer
 * maquina sem `.env` — e passava na do desenvolvedor, que tem.
 */
describe("clienteDaSessao", () => {
  const codigo = readFileSync(
    path.resolve(import.meta.dirname, "sessao.ts"),
    "utf8",
  );

  it("chama cookies() antes de ler variavel de ambiente", () => {
    const cookies = codigo.indexOf("await cookies()");
    const chaves = codigo.indexOf("chavesPublicas()", codigo.indexOf("export async function"));

    expect(cookies).toBeGreaterThan(-1);
    expect(chaves).toBeGreaterThan(-1);
    expect(cookies).toBeLessThan(chaves);
  });
});
