import { expect, it } from "vitest";

// T2: prova que `npm run test:unit` roda. Falha se o `include` do projeto `unit`
// deixar de alcancar o teste que mora junto do codigo, dentro de src/.
it("o projeto unit coleta teste que mora junto do codigo em src/", () => {
  expect(import.meta.url).toContain("/src/modules/config/");
});
