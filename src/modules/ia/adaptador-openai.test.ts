import { afterEach, describe, expect, it } from "vitest";

import {
  SemChaveDaOpenAI,
  clienteDaOpenAI,
  corpoDoPedido,
  esquecerClienteDaOpenAI,
  idDoProvedor,
  montarLinhaDeLote,
} from "./adaptador-openai";

const destino = {
  modelo: "familia-de-teste",
  versao: "familia-de-teste-2026-01-01",
  esforco: "alto",
};

const pedido = {
  instrucao: "instrucao estavel",
  entrada: "a parte que muda",
};

afterEach(() => {
  delete process.env.OPENAI_API_KEY;
  esquecerClienteDaOpenAI();
});

describe("o corpo do pedido (IA-16, AD-074)", () => {
  it("manda a versao fixada, nunca o apelido da familia (IA-02 AC4)", () => {
    expect(idDoProvedor(destino)).toBe("familia-de-teste-2026-01-01");
    expect(corpoDoPedido(destino, pedido).model).toBe(
      "familia-de-teste-2026-01-01",
    );
  });

  it("repassa o esforco que a configuracao mandou, sem interpretar", () => {
    expect(corpoDoPedido({ ...destino, esforco: "qualquer-coisa" }, pedido))
      .toMatchObject({ reasoning: { effort: "qualquer-coisa" } });
  });

  it("poe a instrucao estavel na frente — e o que faz o cache acertar", () => {
    const entrada = corpoDoPedido(destino, pedido).input as {
      role: string;
      content: string;
    }[];

    expect(entrada[0]).toEqual({ role: "system", content: "instrucao estavel" });
    expect(entrada[1]).toEqual({ role: "user", content: "a parte que muda" });
  });

  it("so declara saida estruturada quando a tarefa pede", () => {
    expect(corpoDoPedido(destino, pedido).text).toBeUndefined();

    const comFormato = corpoDoPedido(destino, {
      ...pedido,
      formato: { nome: "citacoes", schema: { type: "object" } },
    });
    expect(comFormato.text).toEqual({
      format: {
        type: "json_schema",
        name: "citacoes",
        strict: true,
        schema: { type: "object" },
      },
    });
  });

  it("so manda teto de saida quando o perfil declarou um", () => {
    expect(corpoDoPedido(destino, pedido).max_output_tokens).toBeUndefined();
    expect(
      corpoDoPedido(destino, pedido, { tetoDeSaida: 400 }).max_output_tokens,
    ).toBe(400);
  });
});

describe("linha de lote (IA-02 AC9)", () => {
  it("carrega exatamente o mesmo corpo do pedido sincrono", () => {
    const linha = montarLinhaDeLote("questao-1", destino, pedido);

    expect(linha).toMatchObject({
      custom_id: "questao-1",
      method: "POST",
      url: "/v1/responses",
    });
    expect(linha.body).toEqual(corpoDoPedido(destino, pedido));
  });
});

describe("a chave da OpenAI", () => {
  it("sem chave, a falha diz o que fazer e nao inventa cliente", () => {
    delete process.env.OPENAI_API_KEY;
    expect(() => clienteDaOpenAI()).toThrow(SemChaveDaOpenAI);
    expect(() => clienteDaOpenAI()).toThrow(/OPENAI_API_KEY/);
  });

  it("chave so de espaco conta como ausente", () => {
    process.env.OPENAI_API_KEY = "   ";
    expect(() => clienteDaOpenAI()).toThrow(SemChaveDaOpenAI);
  });

  it("a mensagem de erro nao carrega o valor da chave", () => {
    process.env.OPENAI_API_KEY = "";
    try {
      clienteDaOpenAI();
      expect.unreachable("devia ter falhado");
    } catch (erro) {
      expect(String(erro)).not.toContain("sk-");
    }
  });
});
