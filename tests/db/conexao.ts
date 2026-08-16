import { Client } from "pg";

/**
 * Conexao com o banco de desenvolvimento para os testes do projeto `db`.
 *
 * Abre uma conexao, entrega ao teste e **fecha sempre** — inclusive quando o
 * teste falha. Cada teste abre a sua: um cliente vazado segura o processo do
 * Vitest aberto no fim da suite.
 */
export async function comBanco<T>(
  uso: (cliente: Client) => Promise<T>,
): Promise<T> {
  const cliente = new Client({ connectionString: process.env.DATABASE_URL });
  await cliente.connect();
  try {
    return await uso(cliente);
  } finally {
    await cliente.end();
  }
}
