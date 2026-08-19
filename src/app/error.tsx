"use client";

import { useEffect } from "react";

import { reportarErro } from "@/modules/observabilidade/reporte";
import { Estado } from "@/modules/ui/estado";
import { Shell } from "@/modules/ui/shell";

/**
 * Fronteira de erro do segmento raiz (UI-04).
 *
 * Diferente do `global-error.tsx`, que substitui o documento inteiro quando o
 * layout raiz quebra: este mantem o cabecalho de pe e troca so o conteudo. E o
 * que o AC3 do UI-04 pede — um erro na lista de questoes nao deveria apagar a
 * navegacao.
 *
 * Repare no que **nao** e passado ao `<Estado>`: nada. O componente nao tem
 * onde receber a mensagem, e por isso nao ha como um `error.message` vazar para
 * a tela por descuido (UI-02 AC4). O erro inteiro vai para o Sentry pelo ponto
 * unico do AD-087, que e onde ele serve para alguma coisa.
 */
export default function Erro({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    reportarErro(error, { origem: "app/error.tsx", digest: error.digest });
  }, [error]);

  return (
    <Shell>
      <Estado tipo="erro" />
    </Shell>
  );
}
