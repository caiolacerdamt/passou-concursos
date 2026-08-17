import { isFlagOn } from "@/modules/config";

/**
 * Rota que erra de proposito (INFRA-09, Success Criteria nº1 da SPEC 03).
 *
 * O criterio de sucesso da spec e "erro proposital numa rota aparece no Sentry
 * com alerta". Sem uma rota assim, conferir isso vira teste manual improvisado
 * toda vez — alguem edita um arquivo, roda, e desfaz.
 *
 * **A flag nasce desligada** (`flag.m9.rota_de_erro_proposital`). Ligada, a rota
 * lanca para quem chamar; entao ela so fica ligada durante a conferencia, e
 * desliga em seguida trocando uma linha na tabela — sem deploy (AD-078).
 *
 * Config ilegivel deixa a flag desligada, nunca ligada — e o mesmo AC6 do
 * INFRA-11 que vale para todas as outras.
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  if (!(await isFlagOn("flag.m9.rota_de_erro_proposital"))) {
    return new Response(null, { status: 404 });
  }

  throw new Error(
    "erro proposital: conferindo o caminho ate o Sentry (INFRA-09)",
  );
}
