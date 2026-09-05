import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({
  trialEncerrado: false,
  resumo: null as unknown,
}));

vi.mock("@/lib/db/sessao", () => ({ clienteDaSessao: async () => ({}) }));
vi.mock("@/modules/conta/trial-encerrado", () => ({
  teveTrialEncerrado: async () => estado.trialEncerrado,
}));
vi.mock("@/modules/conta/resumo-do-trial", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  consultarResumoDoTrial: async () => estado.resumo,
}));

const Assinar = (await import("./page")).default;

async function renderizar(): Promise<string> {
  return renderToStaticMarkup(await Assinar());
}

afterEach(() => {
  estado.trialEncerrado = false;
  estado.resumo = null;
});

describe("/assinar", () => {
  it("quem nunca teve matricula ve o aviso generico, agora apontando o checkout", async () => {
    const html = await renderizar();

    expect(html).toContain("Sua matrícula não está ativa");
    expect(html).toContain('href="/checkout"');
    // Sem numero inventado para quem nunca respondeu nada.
    expect(html).not.toContain("questões respondidas");
  });

  it("trial vencido sem nenhuma resposta cai no estado generico, sem zeros", async () => {
    estado.trialEncerrado = true;
    estado.resumo = {
      diasEstudados: 0,
      questoesRespondidas: 0,
      acertos: 0,
      assuntosFracos: 0,
      assuntosNoCaderno: 0,
      revisoesAgendadas: 0,
    };

    const html = await renderizar();

    expect(html).toContain("Seu teste grátis terminou");
    expect(html).not.toContain("Veja o que você construiu");
  });

  it("trial vencido com historico ve os proprios numeros", async () => {
    estado.trialEncerrado = true;
    estado.resumo = {
      diasEstudados: 6,
      questoesRespondidas: 84,
      acertos: 51,
      assuntosFracos: 5,
      assuntosNoCaderno: 7,
      revisoesAgendadas: 9,
    };

    const html = await renderizar();

    expect(html).toContain("Veja o que você construiu");
    expect(html).toContain("84");
    expect(html).toContain("61% de acerto");
    expect(html).toContain("5");
    expect(html).toContain("7 assuntos");
    expect(html).toContain("Nada disso foi apagado");
  });

  /**
   * Acervo e o que fechou no dia 7. Se esta tela mostrar enunciado, alternativa
   * ou explicacao, ela devolve pela porta dos fundos o que a matricula fechou.
   */
  it("nao mostra conteudo de questao, so numero", async () => {
    estado.trialEncerrado = true;
    estado.resumo = {
      diasEstudados: 6,
      questoesRespondidas: 84,
      acertos: 51,
      assuntosFracos: 5,
      assuntosNoCaderno: 7,
      revisoesAgendadas: 9,
    };

    const html = await renderizar();

    expect(html).not.toMatch(/Alternativa|Gabarito|Enunciado/);
    // Nenhuma trava fabrica urgencia (invariante nº14).
    expect(html).not.toMatch(/última chance|expira em|só hoje/i);
  });
});
