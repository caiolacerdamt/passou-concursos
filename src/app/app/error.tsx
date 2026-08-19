"use client";

import { useEffect } from "react";

import { reportarErro } from "@/modules/observabilidade/reporte";
import { Estado } from "@/modules/ui/estado";
import { Shell } from "@/modules/ui/shell";

/**
 * Fronteira de erro da area logada (UI-04 AC3).
 *
 * Existe separada da raiz de proposito: um erro dentro de `/app` para aqui, e
 * o aluno continua com a navegacao e a sessao de pe. Sem esta, o erro subiria
 * para a fronteira da raiz e levaria a area inteira junto.
 */
export default function Erro({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    reportarErro(error, { origem: "app/app/error.tsx", digest: error.digest });
  }, [error]);

  return (
    <Shell>
      <Estado tipo="erro" />
    </Shell>
  );
}
