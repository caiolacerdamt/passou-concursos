/**
 * De onde saem DSN, release e ambiente (INFRA-09 AC1).
 *
 * Estes tres sao **variavel de ambiente**, nao configuracao no banco, e isso
 * respeita o AC2 do INFRA-11 (AD-078): env var existe so para o que precisa
 * existir **antes** de o banco responder. O Sentry precisa estar de pe antes de
 * qualquer consulta — inclusive para reportar que a consulta falhou.
 *
 * Os tres `Sentry.init` do projeto (servidor, edge e navegador) leem daqui, para
 * a regra de queda ser uma so e ter teste.
 */

/** Vazio e espaco em branco valem por ausente — `.env` mal preenchido e comum. */
function ler(valor: string | undefined): string | undefined {
  const limpo = valor?.trim();
  return limpo === undefined || limpo === "" ? undefined : limpo;
}

/**
 * Endereco do projeto no Sentry. **Nao e segredo**: vai para o navegador por
 * desenho, e e por isso que carrega o prefixo `NEXT_PUBLIC_`.
 *
 * Vazio devolve `""`, que o SDK entende como "nao transmita nada" — e o que
 * mantem o `npm run dev` e o clone sem credencial funcionando iguais.
 */
export function dsn(): string {
  return ler(process.env.NEXT_PUBLIC_SENTRY_DSN) ?? "";
}

/** O Sentry esta ligado neste processo? */
export function sentryLigado(): boolean {
  return dsn() !== "";
}

/**
 * Qual versao do codigo produziu o erro (AC1 pede "contexto: rota, release").
 *
 * A cascata existe porque o release vem de um lugar diferente em cada lar:
 * a Vercel expoe `VERCEL_GIT_COMMIT_SHA`, o GitHub Actions expoe `GITHUB_SHA`, e
 * na maquina do desenvolvedor nao existe nenhum dos dois.
 */
export function release(): string {
  return (
    ler(process.env.NEXT_PUBLIC_SENTRY_RELEASE) ??
    ler(process.env.VERCEL_GIT_COMMIT_SHA) ??
    ler(process.env.GITHUB_SHA) ??
    "desenvolvimento"
  );
}

/**
 * Separa erro de producao de erro de quem esta desenvolvendo.
 *
 * Sem isto o SDK assume `production` por conta propria, e todo erro de
 * `npm run dev` viraria alerta no e-mail do time.
 */
export function ambienteDeExecucao(): string {
  return (
    ler(process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT) ??
    ler(process.env.VERCEL_ENV) ??
    ler(process.env.NODE_ENV) ??
    "development"
  );
}
