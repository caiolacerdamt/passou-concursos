import { beforeAll, describe } from "vitest";

/**
 * Setup do projeto `db` do Vitest.
 *
 * Quem clona o repositorio sem credencial de banco ainda precisa conseguir rodar
 * `npm run test:db`. Sem DATABASE_URL, o teste que precisa de banco **pula com
 * aviso** — nunca falha por ausencia de credencial.
 */

export const MOTIVO_PULO =
  "DATABASE_URL nao esta definida: copie .env.example para .env e preencha DATABASE_URL";

export function temBanco(
  env: { DATABASE_URL?: string } = process.env,
): boolean {
  const url = env.DATABASE_URL;
  return typeof url === "string" && url.trim().length > 0;
}

export const TEM_BANCO = temBanco();

/** `describe` que pula, com o motivo no nome, quando nao ha banco configurado. */
export function descreveComBanco(nome: string, corpo: () => void): void {
  if (TEM_BANCO) {
    describe(nome, corpo);
  } else {
    describe.skip(`${nome} [pulado: ${MOTIVO_PULO}]`, corpo);
  }
}

beforeAll(() => {
  if (!TEM_BANCO) {
    console.warn(`[db] ${MOTIVO_PULO}`);
  }
});
