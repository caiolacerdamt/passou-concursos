import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const contexto = vi.hoisted(() => ({
  valor: {
    matricula: null as unknown,
    tipo: null as string | null,
    ehTrial: false,
    diasRestantes: null as number | null,
    questoesRestantesHoje: null as number | null,
  },
}));

vi.mock("./contexto", () => ({
  contextoDaMatricula: async () => contexto.valor,
}));

const { FaixaDoTrial } = await import("./faixa-do-trial");

async function renderizar(): Promise<string> {
  const arvore = await FaixaDoTrial();
  return arvore === null ? "" : renderToStaticMarkup(arvore);
}

afterEach(() => {
  contexto.valor = {
    matricula: null,
    tipo: null,
    ehTrial: false,
    diasRestantes: null,
    questoesRestantesHoje: null,
  };
});

describe("FaixaDoTrial", () => {
  /**
   * O erro mais caro deste item seria a faixa vazando para quem pagou: ela diz
   * "teste gratis" a quem gastou R$ 197 e leva a /checkout de novo.
   */
  it("aluno pago nao ve faixa nenhuma, nem um wrapper vazio", async () => {
    contexto.valor = {
      matricula: { id: "m1" },
      tipo: "pago",
      ehTrial: false,
      diasRestantes: null,
      questoesRestantesHoje: null,
    };

    expect(await renderizar()).toBe("");
  });

  it("aluno de trial ve os dias e as questoes que restam hoje", async () => {
    contexto.valor = {
      matricula: { id: "m1" },
      tipo: "trial",
      ehTrial: true,
      diasRestantes: 4,
      questoesRestantesHoje: 7,
    };

    const html = await renderizar();

    expect(html).toContain("4 dias restantes");
    expect(html).toContain("7 questões ainda hoje");
    expect(html).toContain('href="/checkout"');
  });

  it("fala no singular quando e um so", async () => {
    contexto.valor = {
      matricula: { id: "m1" },
      tipo: "trial",
      ehTrial: true,
      diasRestantes: 1,
      questoesRestantesHoje: 1,
    };

    const html = await renderizar();

    expect(html).toContain("1 dia restante");
    expect(html).toContain("1 questão ainda hoje");
  });

  /**
   * Invariante nº14 do AGENTS.md: nunca mentir para criar urgencia. O numero e
   * verdadeiro e basta; contagem em segundos e "ultimas horas" nao entram.
   */
  it("nao usa urgencia fabricada", async () => {
    contexto.valor = {
      matricula: { id: "m1" },
      tipo: "trial",
      ehTrial: true,
      diasRestantes: 1,
      questoesRestantesHoje: 3,
    };

    const html = await renderizar();

    expect(html).not.toMatch(/última chance|últimas horas|acaba em|expira em/i);
  });

  /** Leitura falha do teto e `null`, e `null` cala a metade — nao vira "0". */
  it("sem o restante do dia, a faixa nao inventa numero", async () => {
    contexto.valor = {
      matricula: { id: "m1" },
      tipo: "trial",
      ehTrial: true,
      diasRestantes: 2,
      questoesRestantesHoje: null,
    };

    const html = await renderizar();

    expect(html).toContain("2 dias restantes");
    expect(html).not.toContain("ainda hoje");
    expect(html).not.toContain("acabaram");
  });
});
