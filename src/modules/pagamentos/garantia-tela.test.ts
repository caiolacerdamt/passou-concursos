import { describe, expect, it } from "vitest";

import { dadosDaTelaDaGarantia, fraseDaGarantia } from "./garantia-tela";

function tela(estado: string, confirmadoEm: string | null, agora: string) {
  return dadosDaTelaDaGarantia(estado, confirmadoEm, 7, new Date(agora));
}

describe("tela de garantia", () => {
  it("mostra o quinto dia e mantém o pedido disponível", () => {
    const resultado = tela(
      "ativada",
      "2026-08-01T12:00:00.000Z",
      "2026-08-06T01:00:00.000Z",
    );

    expect(resultado.resultado.diasPassados).toBe(5);
    expect(resultado.resultado.diasRestantes).toBe(2);
    expect(resultado.resultado.disponivel).toBe(true);
    expect(resultado.recusa).toBeNull();
  });

  it("recusa o nono dia com mensagem clara", () => {
    const resultado = tela(
      "ativada",
      "2026-08-01T12:00:00.000Z",
      "2026-08-10T01:00:00.000Z",
    );

    expect(resultado.resultado.disponivel).toBe(false);
    expect(resultado.recusa).toMatch(/sete dias/);
  });
});

describe("frase da garantia", () => {
  it("chama o dia da confirmação de dia 1, e não de dia 0", () => {
    const frase = fraseDaGarantia(
      tela("ativada", "2026-08-01T12:00:00.000Z", "2026-08-01T20:00:00.000Z"),
      7,
    );

    expect(frase.diaAtual).toBe(1);
    expect(frase.titulo).toContain("dia 1 de 7");
    expect(frase.nota).toContain("Restam 7 dias, contando hoje");
  });

  it("avisa que hoje é o último dia quando resta um só", () => {
    const frase = fraseDaGarantia(
      tela("ativada", "2026-08-01T12:00:00.000Z", "2026-08-07T01:00:00.000Z"),
      7,
    );

    expect(frase.diaAtual).toBe(7);
    expect(frase.titulo).toContain("último dia");
  });

  it("não inventa contagem quando o pagamento não foi confirmado", () => {
    const frase = fraseDaGarantia(
      tela("pendente", null, "2026-08-07T01:00:00.000Z"),
      7,
    );

    expect(frase.diaAtual).toBeNull();
    expect(frase.titulo).toContain("ainda não foi confirmado");
  });

  it("diz que a janela fechou sem prometer que o acesso caiu junto", () => {
    const frase = fraseDaGarantia(
      tela("ativada", "2026-08-01T12:00:00.000Z", "2026-08-20T01:00:00.000Z"),
      7,
    );

    expect(frase.diaAtual).toBeNull();
    expect(frase.titulo).toContain("terminou");
    expect(frase.nota).toContain("acesso continua");
  });

  it("reconhece o pagamento já reembolsado", () => {
    const frase = fraseDaGarantia(
      tela("reembolsada", "2026-08-01T12:00:00.000Z", "2026-08-03T01:00:00.000Z"),
      7,
    );

    expect(frase.titulo).toContain("já foi reembolsado");
    expect(frase.diaAtual).toBeNull();
  });
});
