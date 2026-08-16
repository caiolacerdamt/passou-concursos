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
    /** URL do projeto Supabase. Nao e segredo. */
    NEXT_PUBLIC_SUPABASE_URL?: string;
    /** Chave secreta do Supabase. **So no servidor** — passa por cima da RLS. */
    SUPABASE_SECRET_KEY?: string;
  }
}
