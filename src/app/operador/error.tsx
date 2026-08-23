"use client";

import { useEffect } from "react";

import { reportarErro } from "@/modules/observabilidade/reporte";
import { Estado } from "@/modules/ui/estado";

/** Falha fechada do segmento: nenhum detalhe do banco chega ao navegador. */
export default function OperadorErro({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    reportarErro(error, { origem: "app/operador/error.tsx", digest: error.digest });
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-painel items-center px-4 py-10 sm:px-6">
      <div className="w-full max-w-xl">
        <p className="font-utilitaria text-xs uppercase tracking-[0.2em] text-marca">mesa editorial</p>
        <h1 className="mt-3 font-display text-4xl leading-tight">A mesa não pôde ser aberta.</h1>
        <div className="mt-6">
          <Estado tipo="erro" />
        </div>
      </div>
    </main>
  );
}
