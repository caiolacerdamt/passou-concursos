import { describe, expect, it } from "vitest";

import { tratarRequisicaoWebhook } from "./route";

function requestFake(
  corpo: string,
  token: string | null,
  contentType = "application/json",
): Request {
  return new Request("https://passou.test/api/webhooks/asaas", {
    method: "POST",
    headers: {
      "content-type": contentType,
      ...(token ? { "asaas-access-token": token } : {}),
    },
    body: corpo,
  });
}

describe("handler público do webhook", () => {
  it("rejeita token ausente antes de chamar o processador", async () => {
    let processado = false;
    const resposta = await tratarRequisicaoWebhook(requestFake("{\"id\":\"evt\"}", null), {
      tokenEsperado: "segredo",
      processar: async () => {
        processado = true;
        return "encaminhado";
      },
    });

    expect(resposta.status).toBe(401);
    expect(await resposta.json()).toEqual({ recebido: false, erro: "nao autorizado" });
    expect(processado).toBe(false);
  });

  it("rejeita content-type incorreto e aceita payload válido sem sessão", async () => {
    const rejeitada = await tratarRequisicaoWebhook(
      requestFake("{}", "segredo", "text/plain"),
      { tokenEsperado: "segredo", processar: async () => "ignorado" },
    );
    expect(rejeitada.status).toBe(415);

    const aceita = await tratarRequisicaoWebhook(
      requestFake(
        JSON.stringify({ id: "evt_1", event: "PAYMENT_CREATED", payment: { id: "pay_1" } }),
        "segredo",
      ),
      {
        tokenEsperado: "segredo",
        processar: async (evento) => {
          expect(evento.id).toBe("evt_1");
          return "ignorado";
        },
      },
    );
    expect(aceita.status).toBe(200);
    expect(await aceita.json()).toEqual({ recebido: true, resultado: "ignorado" });
  });
});
