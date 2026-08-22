import { describe, expect, it } from "vitest";

import {
  AsaasGateway,
  ErroAsaas,
  gatewayAsaasDoAmbiente,
  validarUrlAsaas,
} from "./asaas";

function respostaJson(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("adapter Asaas", () => {
  it("usa host oficial HTTPS e rejeita URL não permitida", () => {
    expect(validarUrlAsaas("https://api-sandbox.asaas.com").hostname).toBe(
      "api-sandbox.asaas.com",
    );
    expect(() => validarUrlAsaas("http://api-sandbox.asaas.com")).toThrow(
      ErroAsaas,
    );
    expect(() => validarUrlAsaas("https://servidor.exemplo.com")).toThrow(
      ErroAsaas,
    );
  });

  // Defeito F-11 da homologacao de 2026-08-22: o cartao vira parcelamento, e o
  // Asaas recusa o estorno pelo id da parcela. O que o teste do gateway falso
  // nunca provou foi o ENDERECO da chamada — e era so isso que estava errado.
  it("escolhe o endpoint do estorno pelo tipo da compra", async () => {
    const chamadas: { url: string; corpo: string | null }[] = [];
    const gateway = new AsaasGateway({
      apiKey: "chave-de-teste",
      apiUrl: "https://api-sandbox.asaas.com",
      fetchImpl: async (url, init = {}) => {
        chamadas.push({
          url: String(url),
          corpo: typeof init.body === "string" ? init.body : null,
        });
        return respostaJson({ id: "ref_1", status: "DONE" });
      },
    });

    // Cartao parcelado: o id do parcelamento manda, e o da parcela nem aparece.
    await gateway.estornarCobranca("pay_1", "CREDIT_CARD", "garantia", "d1b2c3");
    // Pix e boleto continuam nos endpoints de cobranca avulsa.
    await gateway.estornarCobranca("pay_2", "PIX", "garantia", null);
    await gateway.estornarCobranca("pay_3", "BOLETO", undefined, null);

    expect(chamadas.map(({ url }) => url)).toEqual([
      "https://api-sandbox.asaas.com/v3/installments/d1b2c3/refund",
      "https://api-sandbox.asaas.com/v3/payments/pay_2/refund",
      "https://api-sandbox.asaas.com/v3/payments/pay_3/bankSlip/refund",
    ]);
    // /installments/{id}/refund so aceita `value`; sem corpo = estorno total.
    expect(chamadas[0].corpo).toBeNull();
    expect(chamadas[1].corpo).toBe(JSON.stringify({ description: "garantia" }));
  });

  it("guarda o id do parcelamento devolvido na criação do cartão", async () => {
    const gateway = new AsaasGateway({
      apiKey: "chave-de-teste",
      apiUrl: "https://api-sandbox.asaas.com",
      fetchImpl: async () =>
        respostaJson({
          id: "pay_1",
          installment: "d1b2c3",
          status: "PENDING",
          billingType: "CREDIT_CARD",
        }),
    });

    const cobranca = await gateway.criarCobranca({
      clienteId: "cus_1",
      meio: "CREDIT_CARD",
      valorCentavos: 19_700,
      referenciaExterna: "checkout-1",
      vencimento: "2026-09-01",
      descricao: "Passou Concursos — plano anual",
    });

    expect(cobranca.parcelamentoId).toBe("d1b2c3");
  });

  it("cria cartão em 12 parcelas e envia somente o token de API", async () => {
    const chamadas: { url: string; init: RequestInit }[] = [];
    const gateway = new AsaasGateway({
      apiKey: "chave-de-teste",
      apiUrl: "https://api-sandbox.asaas.com",
      fetchImpl: async (url, init = {}) => {
        chamadas.push({ url: String(url), init });
        return respostaJson({
          id: "pay_123",
          status: "PENDING",
          billingType: "CREDIT_CARD",
          externalReference: "pag_123",
          invoiceUrl: "https://sandbox.asaas.com/i/pay_123",
        });
      },
    });

    const cobranca = await gateway.criarCobranca({
      clienteId: "cus_123",
      meio: "CREDIT_CARD",
      valorCentavos: 19_700,
      referenciaExterna: "pag_123",
      vencimento: "2026-09-01",
      descricao: "Passou Concursos — plano anual",
    });
    const corpo = JSON.parse(String(chamadas[0].init.body));

    expect(cobranca.id).toBe("pay_123");
    expect(corpo).toMatchObject({
      customer: "cus_123",
      billingType: "CREDIT_CARD",
      installmentCount: 12,
      totalValue: 197,
      externalReference: "pag_123",
    });
    expect(corpo).not.toHaveProperty("name");
    expect(corpo).not.toHaveProperty("cpfCnpj");
    expect(chamadas[0].init.headers).toMatchObject({
      access_token: "chave-de-teste",
    });
    expect(chamadas[0].init.headers).not.toHaveProperty("asaas-access-token");
  });

  it("cria o cliente com os dados fornecidos e não inventa cadastro", async () => {
    let corpoRecebido: Record<string, unknown> | undefined;
    const gateway = new AsaasGateway({
      apiKey: "chave-de-teste",
      apiUrl: "https://api-sandbox.asaas.com",
      fetchImpl: async (_url, init = {}) => {
        corpoRecebido = JSON.parse(String(init.body));
        return respostaJson({ id: "cus_123" });
      },
    });

    await expect(
      gateway.criarCliente({
        nomeCompleto: "Aluno Exemplo",
        email: "aluno@exemplo.com",
        cpfCnpj: "12345678909",
      }),
    ).resolves.toEqual({ id: "cus_123" });

    expect(corpoRecebido).toEqual({
      name: "Aluno Exemplo",
      email: "aluno@exemplo.com",
      cpfCnpj: "12345678909",
    });
    expect(corpoRecebido).not.toHaveProperty("birthDate");
  });

  it("Pix usa o valor à vista sem inventar parcela", async () => {
    let corpoRecebido: Record<string, unknown> | undefined;
    const gateway = new AsaasGateway({
      apiKey: "chave-de-teste",
      apiUrl: "https://api-sandbox.asaas.com",
      fetchImpl: async (_url, init = {}) => {
        corpoRecebido = JSON.parse(String(init.body));
        return respostaJson({ id: "pay_pix", status: "PENDING" });
      },
    });

    await gateway.criarCobranca({
      clienteId: "cus_123",
      meio: "PIX",
      valorCentavos: 17_730,
      referenciaExterna: "pag_pix",
      vencimento: "2026-09-01",
      descricao: "Plano anual",
    });

    expect(corpoRecebido).toMatchObject({ value: 177.3, billingType: "PIX" });
    expect(corpoRecebido).not.toHaveProperty("installmentCount");
    expect(corpoRecebido).not.toHaveProperty("totalValue");
  });

  it("consulta, lista pagos, agenda NF e escolhe endpoint de estorno", async () => {
    const chamadas: string[] = [];
    const gateway = new AsaasGateway({
      apiKey: "chave-de-teste",
      apiUrl: "https://api-sandbox.asaas.com",
        fetchImpl: async (url) => {
        chamadas.push(String(url));
        if (String(url).includes("invoices")) {
          return respostaJson({ id: "inv_1", status: "SCHEDULED" });
        }
        if (String(url).includes("bankSlip/refund")) {
          return respostaJson({ requestUrl: "https://sandbox.asaas.com/refund" });
        }
        if (String(url).includes("refund")) {
          return respostaJson({ id: "ref_1", status: "DONE" });
        }
        if (String(url).includes("status=RECEIVED")) {
          return respostaJson({ data: [{ id: "pay_1", status: "RECEIVED" }] });
        }
        if (String(url).includes("status=CONFIRMED")) {
          return respostaJson({ data: [{ id: "pay_2", status: "CONFIRMED" }] });
        }
        return respostaJson({ id: "pay_1", status: "RECEIVED" });
      },
    });

    await gateway.consultarCobranca("pay_1");
    const cobrancas = await gateway.listarCobrancasPagas();
    expect(cobrancas.map(({ id, status }) => ({ id, status }))).toEqual([
      { id: "pay_1", status: "RECEIVED" },
      { id: "pay_2", status: "CONFIRMED" },
    ]);
    await gateway.estornarCobranca("pay_1", "PIX", "garantia");
    await gateway.estornarCobranca("pay_2", "BOLETO");
    const nota = await gateway.agendarNotaFiscal({
      pagamentoId: "pay_1",
      referenciaExterna: "pag_1",
      descricaoServico: "Acesso anual",
      observacoes: "Serviço educacional",
      valorCentavos: 17_730,
      dataEfetiva: "2026-09-01",
      nomeServicoMunicipal: "Serviços educacionais",
      codigoServicoMunicipal: "1.03",
      impostos: {},
    });

    expect(nota.id).toBe("inv_1");
    expect(chamadas).toEqual([
      "https://api-sandbox.asaas.com/v3/payments/pay_1",
      "https://api-sandbox.asaas.com/v3/payments?status=RECEIVED&offset=0&limit=100",
      "https://api-sandbox.asaas.com/v3/payments?status=CONFIRMED&offset=0&limit=100",
      "https://api-sandbox.asaas.com/v3/payments/pay_1/refund",
      "https://api-sandbox.asaas.com/v3/payments/pay_2/bankSlip/refund",
      "https://api-sandbox.asaas.com/v3/invoices",
    ]);
  });

  it("solicita cancelamento da NF no endpoint oficial e envia cancelOnlyOnAsaas", async () => {
    let chamada: { url: string; body: unknown } | undefined;
    const gateway = new AsaasGateway({
      apiKey: "chave-de-teste",
      apiUrl: "https://api-sandbox.asaas.com",
      fetchImpl: async (url, init = {}) => {
        chamada = { url: String(url), body: JSON.parse(String(init.body)) };
        return respostaJson({ id: "nf_1", status: "PROCESSING_CANCELLATION" });
      },
    });

    await expect(gateway.cancelarNotaFiscal("nf_1")).resolves.toMatchObject({
      id: "nf_1",
      status: "PROCESSING_CANCELLATION",
    });
    expect(chamada).toEqual({
      url: "https://api-sandbox.asaas.com/v3/invoices/nf_1/cancel",
      body: { cancelOnlyOnAsaas: true },
    });
  });

  it("não expõe resposta do gateway e transforma timeout em erro seguro", async () => {
    const gateway = new AsaasGateway({
      apiKey: "segredo-super-secreto",
      apiUrl: "https://api-sandbox.asaas.com",
      timeoutMs: 5,
      fetchImpl: async (_url, init = {}) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(new Error("timeout")));
        }),
    });

    await expect(
      gateway.consultarCobranca("pay_1"),
    ).rejects.toMatchObject({ codigo: "gateway_indisponivel" });
    await expect(gateway.consultarCobranca("pay_1")).rejects.not.toThrow(
      /segredo-super-secreto|timeout/,
    );
  });

  it("não cria gateway com ambiente incompleto", () => {
    expect(() =>
      gatewayAsaasDoAmbiente({
        ASAAS_API_KEY: "",
        ASAAS_API_URL: "",
      }),
    ).toThrow(ErroAsaas);
  });
});
