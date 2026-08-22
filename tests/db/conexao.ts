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

/**
 * Igual a `comTransacaoRevertida`, mas comeca com `perfil_concurso` **vazia**.
 *
 * O banco de desenvolvimento e compartilhado, e um unico perfil comitado por
 * homologacao de tela derruba tres grupos de teste por motivos diferentes:
 *
 *   1. `perfil_concurso_uma_ativa` e indice unico parcial — existe **um** perfil
 *      ativo no banco inteiro. Quem insere o proprio perfil ativo colide.
 *   2. `raiox_peso_topico` vira porteiro do edital quando ha perfil ativo: quem
 *      espera o fallback 1.0 passa a receber peso nenhum.
 *   3. `recalcula_raiox` percorre **todo** perfil, ativo ou nao, e devolve
 *      linhas gravadas — um perfil alheio soma projecoes na contagem.
 *
 * Por (3), desativar nao basta; a tabela precisa comecar vazia. O DELETE mora
 * dentro da transacao, entao o ROLLBACK devolve o perfil ao dono e o dado de
 * demonstracao sobrevive a suite. Aconteceu em 2026-08-21: um perfil de
 * demonstracao do Raio-X derrubou seis arquivos de teste na CI.
 *
 * Fica separado de `comTransacaoRevertida` para a ida extra a rede pesar so em
 * quem precisa dela — sao 326 transacoes na suite, contra um banco em outro
 * continente.
 */
export async function comTransacaoSemPerfilConcurso<T>(
  uso: (cliente: Client) => Promise<T>,
): Promise<T> {
  return comTransacaoRevertida(async (cliente) => {
    await cliente.query("delete from public.perfil_concurso");
    return uso(cliente);
  });
}
