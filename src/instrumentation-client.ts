import * as Sentry from "@sentry/nextjs";

import {
  ambienteDeExecucao,
  dsn,
  release,
} from "@/modules/observabilidade/ambiente";
import { sanearEventoSentry } from "@/modules/observabilidade/saneamento.mjs";

/**
 * Sentry do navegador (INFRA-09 AC1).
 *
 * **Sem gravacao de sessao, em nenhuma etapa.** O SDK oferece a integracao e o
 * assistente de instalacao sugere liga-la. Fica de fora pela mesma razao que a
 * AD-079 usou contra o mesmo recurso no PostHog: gravar a tela do aluno
 * contraria o DADOS-07 AC6 com mais forca do que um log de erro.
 *
 * Ha teste que reprova se o nome da integracao aparecer neste arquivo — e por
 * isso que nem o comentario o escreve.
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
 * Com `tracesSampleRate: 0` este gancho nao produz nenhum span. Existe porque o
 * SDK imprime um aviso "ACTION REQUIRED" em **todo** build quando ele falta — e
 * time que aprende a ignorar aviso de build e exatamente o que esta spec existe
 * para evitar.
 */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
