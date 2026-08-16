import { expect, it } from "vitest";

import { temBanco } from "./setup";

// T2: prova que `npm run test:db` roda, e que a decisao de pular tem uma regra
// explicita — nao depende de o arquivo ter sido esquecido.
it("so considera que ha banco quando DATABASE_URL tem valor de verdade", () => {
  expect(temBanco({})).toBe(false);
  expect(temBanco({ DATABASE_URL: "" })).toBe(false);
  expect(temBanco({ DATABASE_URL: "   " })).toBe(false);
  expect(temBanco({ DATABASE_URL: "postgresql://u:s@host:5432/postgres" })).toBe(
    true,
  );
});
