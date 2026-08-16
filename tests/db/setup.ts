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

export const MOTIVO_PULO_SUPABASE =
  "NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY nao estao definidas";

/**
 * Alguns testes falam com a API do Supabase, nao so com o Postgres, e precisam
 * de mais credencial. Gate separado de proposito: quem tem so o DATABASE_URL
 * continua rodando todo o resto.
 */
export function temSupabase(
  env: { NEXT_PUBLIC_SUPABASE_URL?: string; SUPABASE_SECRET_KEY?: string } = process.env,
): boolean {
  const preenchida = (v: string | undefined) =>
    typeof v === "string" && v.trim().length > 0;
  return preenchida(env.NEXT_PUBLIC_SUPABASE_URL) && preenchida(env.SUPABASE_SECRET_KEY);
}

export const TEM_SUPABASE = temSupabase();

export function descreveComSupabase(nome: string, corpo: () => void): void {
  if (TEM_BANCO && TEM_SUPABASE) {
    describe(nome, corpo);
  } else {
    const motivo = TEM_BANCO ? MOTIVO_PULO_SUPABASE : MOTIVO_PULO;
    describe.skip(`${nome} [pulado: ${motivo}]`, corpo);
  }
}

beforeAll(() => {
  if (!TEM_BANCO) {
    console.warn(`[db] ${MOTIVO_PULO}`);
  }
});
