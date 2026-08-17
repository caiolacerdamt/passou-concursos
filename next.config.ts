import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

/**
 * O embrulho do Sentry faz duas coisas no build: instrumenta o codigo do
 * servidor e sobe o source map, para a pilha de chamada do erro apontar o
 * arquivo original em vez do pacote minificado.
 *
 * `org` e `project` sao apelidos publicos, nao segredo — o que e segredo e o
 * `SENTRY_AUTH_TOKEN`, que mora em variavel de ambiente. Sem ele o build passa
 * igual e so deixa de subir o source map.
 */
export default withSentryConfig(nextConfig, {
  org: "passou-concursos",
  project: "passou-concursos",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
});
