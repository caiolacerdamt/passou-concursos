import { describe, expect, it, vi } from "vitest";

import {
  enviarFilaDoTrial,
  exigirConfiguracao,
  transporteResend,
  type ClienteSql,
} from "./emails-do-trial.mts";

const SITE = "https://exemplo.test";

function clienteFalso(
  fila: { id: string; email: string; tipo: string; contexto: unknown }[],
  updates: { sql: string; valores: unknown[] }[] = [],
): ClienteSql {
  return {
    async query(texto: string, valores: unknown[] = []) {
      if (texto.includes("select")) return { rows: fila as never[] };
      updates.push({ sql: texto, valores });
      return { rows: [] };
    },
  } as ClienteSql;
}

const LINHA = {
  id: "1",
  email: "aluno@exemplo.test",
  tipo: "dia_3",
  contexto: { questoes: 30, acertos: 18, dias: 3, assuntos: 4, caderno: 2, revisoes: 5 },
};

/**
 * Falha fecha, nao engole (AD-105). Um no-op silencioso aqui significaria uma
 * safra inteira de leads sem nenhum e-mail e ninguem sabendo.
 */
describe("exigirConfiguracao", () => {
  it("sem RESEND_API_KEY o job estoura, e estoura ANTES de tocar a fila", () => {
    expect(() =>
      exigirConfiguracao({ RESEND_FROM: "a@b.test", NEXT_PUBLIC_SITE_URL: SITE }),
    ).toThrow(/RESEND_API_KEY/);
  });

  it("sem remetente verificado o job estoura", () => {
    expect(() =>
      exigirConfiguracao({ RESEND_API_KEY: "k", NEXT_PUBLIC_SITE_URL: SITE }),
    ).toThrow(/RESEND_FROM/);
  });

  it("sem a URL do site o job estoura: link para lugar nenhum nao serve", () => {
    expect(() =>
      exigirConfiguracao({ RESEND_API_KEY: "k", RESEND_FROM: "a@b.test" }),
    ).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });

  it("tira a barra final da URL para o link nao sair com duas", () => {
    const config = exigirConfiguracao({
      RESEND_API_KEY: "k",
      RESEND_FROM: "a@b.test",
      NEXT_PUBLIC_SITE_URL: `${SITE}/`,
    });

    expect(config.site).toBe(SITE);
  });
});

describe("enviarFilaDoTrial", () => {
  it("envia a linha e a marca como enviada", async () => {
    const updates: { sql: string; valores: unknown[] }[] = [];
    const enviados: string[] = [];

    const resumo = await enviarFilaDoTrial(
      clienteFalso([LINHA], updates),
      async (destinatario, assunto) => {
        enviados.push(`${destinatario}|${assunto}`);
      },
      SITE,
    );

    expect(resumo).toEqual({ lidas: 1, enviados: 1, falhas: 0 });
    expect(enviados[0]).toContain("aluno@exemplo.test");
    expect(updates[0].sql).toContain("enviado_em = now()");
  });

  /**
   * A linha que falha continua na fila. Marca-la como enviada para "nao
   * repetir" e o jeito de perder o e-mail em silencio.
   */
  it("linha que falha nao e marcada como enviada e o job sai vermelho", async () => {
    const updates: { sql: string; valores: unknown[] }[] = [];

    const resumo = await enviarFilaDoTrial(
      clienteFalso([LINHA], updates),
      async () => {
        throw new Error("resend respondeu 429");
      },
      SITE,
    );

    expect(resumo).toEqual({ lidas: 1, enviados: 0, falhas: 1 });
    expect(updates[0].sql).not.toContain("enviado_em = now()");
    expect(updates[0].sql).toContain("ultimo_erro");
    expect(String(updates[0].valores[1])).toContain("429");
  });

  it("uma falha isolada nao impede as outras linhas", async () => {
    const fila = [LINHA, { ...LINHA, id: "2", email: "outro@exemplo.test" }];
    let primeira = true;

    const resumo = await enviarFilaDoTrial(
      clienteFalso(fila),
      async () => {
        if (primeira) {
          primeira = false;
          throw new Error("falhou");
        }
      },
      SITE,
    );

    expect(resumo).toEqual({ lidas: 2, enviados: 1, falhas: 1 });
  });

  it("fila vazia e um dia normal, nao um erro", async () => {
    const resumo = await enviarFilaDoTrial(clienteFalso([]), async () => {}, SITE);

    expect(resumo).toEqual({ lidas: 0, enviados: 0, falhas: 0 });
  });
});

describe("transporteResend", () => {
  it("manda pela API do Resend, e nao pelo Supabase Auth", async () => {
    const fetchFalso = vi.fn(async () => new Response("{}", { status: 200 }));

    await transporteResend("chave", "de@exemplo.test", fetchFalso as never)(
      "para@exemplo.test",
      "assunto",
      "texto",
    );

    const [url, opcoes] = fetchFalso.mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string>; body: string },
    ];

    expect(url).toBe("https://api.resend.com/emails");
    expect(opcoes.headers.authorization).toBe("Bearer chave");
    expect(JSON.parse(opcoes.body).to).toEqual(["para@exemplo.test"]);
  });

  it("resposta nao-ok vira erro, e nao envio fantasma", async () => {
    const fetchFalso = vi.fn(async () => new Response("", { status: 422 }));

    await expect(
      transporteResend("chave", "de@exemplo.test", fetchFalso as never)(
        "para@exemplo.test",
        "a",
        "t",
      ),
    ).rejects.toThrow(/422/);
  });
});
