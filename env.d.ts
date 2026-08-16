/**
 * Variaveis de ambiente que o projeto conhece.
 *
 * Env var existe **so** para o que precede o banco (INFRA-11, AC2). Todo
 * parametro de produto e toda feature flag moram na tabela `configuracoes`,
 * nunca aqui.
 */
declare namespace NodeJS {
  interface ProcessEnv {
    /** Conexao direta com o Postgres. Usada apenas pelos testes de banco. */
    DATABASE_URL?: string;
  }
}
