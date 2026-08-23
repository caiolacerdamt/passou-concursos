import { describe, expect, it } from "vitest";

import { enviarConfirmacaoEsquecimento } from "./email";

const ambiente = {
  RESEND_API_KEY: "re_teste_nao_real",
  RESEND_FROM: "Passou Concursos <privacidade@passouconcursos.com>",
};

describe("e-mail de confirmação do esquecimento", () => {
  it("falha fechado sem configuração e não toca a rede", async () => {
    let chamou = false;
    const resultado = await enviarConfirmacaoEsquecimento("aluno@exemplo.com", {
      ambiente: {},
      fetchImpl: async () => {
        chamou = true;
        return new Response(null, { status: 200 });
      },
    });

    expect(resultado).toEqual({ enviado: false, motivo: "configuracao_ausente" });
    expect(chamou).toBe(false);
  });

  it("recusa destinatário malformado antes de chamar o provedor", async () => {
    let chamou = false;
    const resultado = await enviarConfirmacaoEsquecimento("aluno\r\n@invalido", {
      ambiente,
      fetchImpl: async () => {
        chamou = true;
        return new Response(null, { status: 200 });
      },
    });

    expect(resultado).toEqual({ enviado: false, motivo: "destinatario_invalido" });
    expect(chamou).toBe(false);
  });

  it("envia somente o payload mínimo ao endpoint fixo do Resend", async () => {
    let url = "";
    let corpo: Record<string, unknown> | undefined;
    let autorizacao = "";

    const resultado = await enviarConfirmacaoEsquecimento("aluno@exemplo.com", {
      ambiente,
      fetchImpl: async (destino, init = {}) => {
        url = String(destino);
        corpo = JSON.parse(String(init.body));
        autorizacao = String(new Headers(init.headers).get("authorization"));
        return new Response("{}", { status: 200 });
      },
    });

    expect(resultado).toEqual({ enviado: true });
    expect(url).toBe("https://api.resend.com/emails");
    expect(autorizacao).toBe("Bearer re_teste_nao_real");
    expect(corpo).toEqual({
      from: ambiente.RESEND_FROM,
      to: ["aluno@exemplo.com"],
      subject: "Confirmação do apagamento da sua conta",
      text: expect.stringContaining("apagamento dos seus dados operacionais"),
    });
    expect(JSON.stringify(corpo)).not.toContain("re_teste_nao_real");
  });

  it("não guarda token, user_id ou corpo operacional na mensagem", async () => {
    let corpo = "";
    await enviarConfirmacaoEsquecimento("aluno@exemplo.com", {
      ambiente,
      fetchImpl: async (_destino, init = {}) => {
        corpo = String(init.body);
        return new Response("{}", { status: 202 });
      },
    });

    expect(corpo).not.toContain("user_id");
    expect(corpo).not.toContain("token");
    expect(corpo).not.toContain("tentativas");
  });

  it("trata resposta não-2xx como indisponível", async () => {
    const resultado = await enviarConfirmacaoEsquecimento("aluno@exemplo.com", {
      ambiente,
      fetchImpl: async () => new Response("erro secreto do provedor", { status: 503 }),
    });

    expect(resultado).toEqual({ enviado: false, motivo: "indisponivel" });
  });

  it("trata timeout/erro de fetch sem vazar a mensagem externa", async () => {
    const resultado = await enviarConfirmacaoEsquecimento("aluno@exemplo.com", {
      ambiente,
      timeoutMs: 1,
      fetchImpl: async (_destino, init = {}) => {
        await new Promise((_, rejeitar) => {
          init.signal?.addEventListener("abort", () => rejeitar(new Error("segredo do provedor")));
        });
        return new Response(null, { status: 200 });
      },
    });

    expect(resultado).toEqual({ enviado: false, motivo: "indisponivel" });
    expect(JSON.stringify(resultado)).not.toContain("segredo do provedor");
  });

  it("não aceita remetente com quebra de linha", async () => {
    const resultado = await enviarConfirmacaoEsquecimento("aluno@exemplo.com", {
      ambiente: { ...ambiente, RESEND_FROM: "remetente\r\nBcc: atacante@example.com" },
      fetchImpl: async () => new Response(null, { status: 200 }),
    });

    expect(resultado).toEqual({ enviado: false, motivo: "configuracao_ausente" });
  });

  it("limpa o timer e aceita resposta 2xx sem precisar ler o corpo", async () => {
    const resultado = await enviarConfirmacaoEsquecimento("aluno@exemplo.com", {
      ambiente,
      fetchImpl: async () => new Response(null, { status: 204 }),
    });

    expect(resultado).toEqual({ enviado: true });
  });
});
