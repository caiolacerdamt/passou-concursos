import * as Sentry from "@sentry/nextjs";

import {
  ambienteDeExecucao,
  dsn,
  release,
} from "@/modules/observabilidade/ambiente";
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
