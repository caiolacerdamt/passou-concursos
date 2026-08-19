import type { Client } from "pg";

/**
 * Fixtures de conta e matricula (SPEC 07), no molde de `acervo.ts` e `aluno.ts`.
 *
 * Diferente de `novoAluno()` do `aluno.ts`, que devolve um uuid solto: aqui o
 * usuario precisa **existir em `auth.users`**, porque `matriculas.user_id` tem
 * FK de verdade para la.
 */

let contador = 0;

/** Cria um usuario em `auth.users` e devolve o id. */
export async function criarUsuario(
  cliente: Client,
  email?: string,
): Promise<string> {
  const id = crypto.randomUUID();
  contador += 1;

  await cliente.query(
    "insert into auth.users (id, email, aud, role) values ($1, $2, 'authenticated', 'authenticated')",
    [id, email ?? `teste-${Date.now()}-${contador}@exemplo.test`],
  );

  return id;
}

export async function idDoProdutoUnico(cliente: Client): Promise<string> {
  const { rows } = await cliente.query<{ id: string }>(
    "select id from public.produtos where codigo = 'anual-unico'",
  );
  return rows[0].id;
}

export type Matricula = {
  id: string;
  estado: string;
  inicio_em: Date;
  fim_em: Date;
};

export async function criarMatricula(
  cliente: Client,
  userId: string,
  opcoes: { estado?: string; inicio_em?: string; fim_em?: string } = {},
): Promise<Matricula> {
  const { rows } = await cliente.query<Matricula>(
    `insert into public.matriculas (user_id, produto_id, estado, inicio_em, fim_em)
     values ($1, $2, coalesce($3::public.matricula_estado, 'ativa'),
             coalesce($4::timestamptz, now()), $5::timestamptz)
     returning id, estado::text, inicio_em, fim_em`,
    [
      userId,
      await idDoProdutoUnico(cliente),
      opcoes.estado ?? null,
      opcoes.inicio_em ?? null,
      opcoes.fim_em ?? null,
    ],
  );

  return rows[0];
}

/**
 * Roda o corpo **como aquele aluno**, com a RLS valendo.
 *
 * Sem os dois `set local` a consulta roda como dono do banco, que ignora RLS —
 * e um teste de policy que roda como dono nao testa policy nenhuma. `role`
 * troca o papel; `request.jwt.claims` e de onde o `auth.uid()` do Supabase le o
 * `sub`. Os dois sao `local`: valem so ate o fim da transacao do teste.
 *
 * O `reset role` no fim devolve o poder de semear a proxima parte do teste.
 */
export async function comoAluno<T>(
  cliente: Client,
  userId: string,
  uso: () => Promise<T>,
): Promise<T> {
  await cliente.query("set local role authenticated");
  await cliente.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ sub: userId, role: "authenticated" }),
  ]);

  try {
    return await uso();
  } finally {
    await cliente.query("reset role");
    await cliente.query("select set_config('request.jwt.claims', null, true)");
  }
}
