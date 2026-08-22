import { createHash, randomBytes } from "node:crypto";

export const RESULTADO_TOKEN_TTL_HORAS = 48;

export function criarTokenDeResultado(agora = new Date()): {
  token: string;
  hash: string;
  expiraEm: Date;
} {
  const token = randomBytes(32).toString("base64url");
  const expiraEm = new Date(
    agora.getTime() + RESULTADO_TOKEN_TTL_HORAS * 60 * 60 * 1_000,
  );

  return { token, hash: hashTokenDeResultado(token), expiraEm };
}

export function hashTokenDeResultado(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
