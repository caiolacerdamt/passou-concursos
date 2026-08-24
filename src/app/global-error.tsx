"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

import "./globals.css";

/**
 * Erro de renderizacao do React (INFRA-09 AC1).
 *
 * Existe porque erro que quebra a arvore do React **nao** passa pelo
 * `onRequestError` do `src/instrumentation.ts`: aquele pega o servidor, este
 * pega a tela. Sem os dois, o AC1 fica com metade do caminho coberto.
 *
 * A tela nao mostra a mensagem do erro. Mensagem de erro pode carregar dado
 * pessoal (contrato desta spec), e o aluno nao tem o que fazer com ela.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body className="app-ui flex min-h-dvh items-center justify-center px-4 py-10">
        <main className="w-full max-w-md rounded-card border border-linha bg-painel p-6 shadow-card sm:p-9">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-marca">Passou Concursos</p>
          <h1 className="mt-3 font-display text-4xl leading-tight tracking-tight">Algo deu errado</h1>
          <p className="mt-4 leading-7 text-suave">
            Já fomos avisados e estamos olhando. Tente recarregar a página em
            alguns instantes.
          </p>
        </main>
      </body>
    </html>
  );
}
