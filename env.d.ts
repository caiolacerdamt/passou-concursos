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

    /**
     * Endereco do projeto no Sentry (INFRA-09). **Nao e segredo**: vai para o
     * navegador de proposito. Vazio deixa o SDK calado, e o app funciona igual.
     */
    NEXT_PUBLIC_SENTRY_DSN?: string;
    /** Versao do codigo mostrada no erro. Sem ela, cai no commit ou em "desenvolvimento". */
    NEXT_PUBLIC_SENTRY_RELEASE?: string;
    /** Separa erro de producao de erro de quem esta desenvolvendo. */
    NEXT_PUBLIC_SENTRY_ENVIRONMENT?: string;
    /** **Segredo.** So o build usa, para subir o source map. */
    SENTRY_AUTH_TOKEN?: string;
    /** Preenchidas pela propria plataforma; entram na cascata do release. */
    VERCEL_GIT_COMMIT_SHA?: string;
    VERCEL_ENV?: string;
    GITHUB_SHA?: string;
  }
}
