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

/**
 * Roda o teste dentro de uma transacao que **sempre** volta atras.
 *
 * E a unica forma de um teste limpar o que criou em tabela append-only: as
 * tabelas de log do projeto recusam DELETE por gatilho (AD-081, AD-082), entao
 * apagar a linha no fim nao e opcao. O ROLLBACK desfaz o INSERT sem precisar de
 * privilegio nenhum, e ainda deixa cada teste isolado do outro.
 */
export async function comTransacaoRevertida<T>(
  uso: (cliente: Client) => Promise<T>,
): Promise<T> {
  return comBanco(async (cliente) => {
    await cliente.query("begin");
    try {
      return await uso(cliente);
    } finally {
      await cliente.query("rollback");
    }
  });
}
