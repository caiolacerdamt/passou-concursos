import { afterEach, describe, expect, it } from "vitest";

import {
  definirPublicadorDeAnalytics,
  restaurarPublicadorDeAnalytics,
} from "@/modules/analytics/posthog";
import {
  definirDestinoDeErro,
  restaurarDestinoPadrao,
} from "@/modules/observabilidade/reporte";

import { POST } from "./route";

afterEach(() => {
  restaurarPublicadorDeAnalytics();
  restaurarDestinoPadrao();
});

function requisicao(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/analytics", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("POST /api/analytics", () => {
  it("envia somente o DTO anônimo e responde sucesso", async () => {
    const recebidos: unknown[] = [];
    definirPublicadorDeAnalytics(async (evento, propriedades) => {
      recebidos.push({ evento, propriedades });
      return { enviado: true };
    });

    const resposta = await POST(
      requisicao({
        evento: "meio_escolhido",
        propriedades: {
          meio: "PIX",
          email: "aluno@exemplo.com",
          cpf: "123",
          user_id: "user_1",
        },
      }),
    );

    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toEqual({ ok: true });
    expect(recebidos).toEqual([
      { evento: "meio_escolhido", propriedades: { meio: "PIX" } },
    ]);
  });

  it("não bloqueia quando o PostHog está indisponível", async () => {
    definirPublicadorDeAnalytics(async () => ({
      enviado: false,
      motivo: "indisponivel",
    }));
    const reportes: unknown[] = [];
    definirDestinoDeErro((_erro, contexto) => reportes.push(contexto));

    const resposta = await POST(
      requisicao({ evento: "pagamento_confirmado", propriedades: {} }),
    );

    expect(resposta.status).toBe(200);
    expect(reportes).toHaveLength(1);
  });

  it("recusa corpo que não é JSON sem tentar publicar", async () => {
    let publicou = false;
    definirPublicadorDeAnalytics(async () => {
      publicou = true;
      return { enviado: true };
    });

    const resposta = await POST(
      new Request("http://localhost/api/analytics", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: "pagina_vista",
      }),
    );

    expect(resposta.status).toBe(415);
    expect(publicou).toBe(false);
  });

  it("rejeita evento fora da allowlist sem expor detalhes", async () => {
    const resposta = await POST(requisicao({ evento: "usuario_email" }));

    expect(resposta.status).toBe(400);
    expect(await resposta.json()).toEqual({ ok: false });
  });
});
