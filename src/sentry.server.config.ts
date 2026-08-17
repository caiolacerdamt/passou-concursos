import * as Sentry from "@sentry/nextjs";

import {
  ambienteDeExecucao,
  dsn,
  release,
} from "@/modules/observabilidade/ambiente";
import { sanearEventoSentry } from "@/modules/observabilidade/saneamento.mjs";

/**
 * Sentry do servidor Node (INFRA-09 AC1, AD-037).
 *
 * Carregado por `src/instrumentation.ts` no boot. O contexto de rota nao e
 * configurado aqui: quem o adiciona e o `onRequestError` do mesmo arquivo.
 */
Sentry.init({
  dsn: dsn(),
  release: release(),
  environment: ambienteDeExecucao(),

  // AD-037 pediu **erro**, nao desempenho. Span consome cota do plano gratuito
  // sem responder nenhuma pergunta que o projeto tenha hoje.
  tracesSampleRate: 0,

  // Nem dado do usuario, nem corpo de requisicao. O corpo de um POST de
  // checkout carregaria CPF e e-mail direto para fora do Brasil.
  dataCollection: { userInfo: false, httpBodies: [] },

  // Ultima peneira antes de sair do processo. Ver `saneamento.mjs`.
  beforeSend: sanearEventoSentry,
});
