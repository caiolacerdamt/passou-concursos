import * as Sentry from "@sentry/nextjs";

import {
  ambienteDeExecucao,
  dsn,
  release,
} from "@/modules/observabilidade/ambiente";
import { definirDestinoDeErro } from "@/modules/observabilidade/reporte";
import { sanearEventoSentry } from "@/modules/observabilidade/saneamento.mjs";

/**
 * Sentry do runtime Edge (INFRA-09 AC1).
 *
 * Nenhuma rota do projeto roda em Edge hoje. Existe porque o middleware do Next
 * roda ali por padrao, e um erro de middleware acontece **antes** de qualquer
 * rota — seria o tipo de apagao mais silencioso possivel.
 */
Sentry.init({
  dsn: dsn(),
  release: release(),
  environment: ambienteDeExecucao(),
  tracesSampleRate: 0,
  dataCollection: { userInfo: false, httpBodies: [] },
  beforeSend: sanearEventoSentry,
});

/**
 * Liga a ponta do ponto unico de reporte no Sentry.
 *
 * O nucleo em `src/modules/observabilidade` nao importa o SDK de proposito; e
 * aqui, no boot, que ele ganha destino. Os tres runtimes fazem isto para nao
 * sobrar caminho em que `reportarErro` cai so no console em silencio.
 */
definirDestinoDeErro((erro, contexto) => {
  Sentry.captureException(erro, { extra: contexto });
});
