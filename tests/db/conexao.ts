import { Client, Pool, type PoolClient } from "pg";

const estatisticas = {
  conexoes: 0,
  usos: 0,
};

/**
 * Um socket para o worker sequencial inteiro.
 *
 * `allowExitOnIdle` deixa o processo do Vitest terminar sem chamar `pool.end()`;
 * `idleTimeoutMillis: 0` impede que o socket seja descartado entre dois arquivos
 * lentos. O limite 1 e parte do contrato: a suite de banco continua sequencial.
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  idleTimeoutMillis: 0,
  allowExitOnIdle: true,
});

let clienteAtivo: PoolClient | null = null;

/**
 * Fachada unica do worker. O `pg` deixa o objeto do PoolClient consultavel
 * depois de `release()`, o que permitiria uma query escapar do callback. Esta
 * fronteira recusa o uso quando nao existe uma locacao ativa.
 */
const clienteCompartilhado = {
  query(...argumentos: unknown[]) {
    if (clienteAtivo === null) {
      return Promise.reject(
        new Error("cliente de teste usado fora do callback de comBanco"),
      );
    }
    return Reflect.apply(clienteAtivo.query, clienteAtivo, argumentos);
  },
} as unknown as Client;

pool.on("connect", () => {
  estatisticas.conexoes += 1;
});

pool.on("error", (erro) => {
  console.error(`[db] conexao ociosa falhou: ${erro.message}`);
});

export function resumoDasConexoes(): Readonly<typeof estatisticas> {
  return { ...estatisticas };
}

/**
 * Conexao com o banco de desenvolvimento para os testes do projeto `db`.
 *
 * Reserva a conexao compartilhada, entrega ao teste e **libera sempre** —
 * inclusive quando o teste falha. Depois que o callback termina, o mesmo objeto
 * nao pode mais ser usado ate o pool entrega-lo de novo.
 */
export async function comBanco<T>(
  uso: (cliente: Client) => Promise<T>,
): Promise<T> {
  if (clienteAtivo !== null) {
    throw new Error("comBanco nao aceita uso aninhado no worker sequencial");
  }

  const cliente = await pool.connect();
  clienteAtivo = cliente;
  estatisticas.usos += 1;
  try {
    return await uso(clienteCompartilhado);
  } finally {
    clienteAtivo = null;
    cliente.release();
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
