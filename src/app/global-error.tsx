"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

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
      <body>
        <h1>Algo deu errado</h1>
        <p>
          Já fomos avisados e estamos olhando. Tente recarregar a página em
          alguns instantes.
        </p>
      </body>
    </html>
  );
}
