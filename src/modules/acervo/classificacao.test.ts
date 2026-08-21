import { describe, expect, it } from "vitest";

import type { ClienteSql } from "@/modules/ia";

import {
  type TopicoCanonico,
  casarTopico,
  classificar,
  lerCatalogo,
  normalizarNome,
} from "./classificacao";

function topico(
  nome: string,
  materiaNome: string,
  id = `${materiaNome}/${nome}`,
): TopicoCanonico {
  return { id, nome, materiaId: `m-${materiaNome}`, materiaNome };
}

const CATALOGO = [
  topico("Juros Compostos", "Matematica Financeira"),
  topico("Juros Simples", "Matematica Financeira"),
  topico("Juros Simples", "Conhecimentos Bancarios"),
  topico("Concordância Verbal", "Lingua Portuguesa"),
];

/** Um banco de mentira que anota o SQL que recebeu. */
function bancoFalso(resposta: Record<string, unknown>[] = [{ id: "cand-1" }]) {
  const consultas: { texto: string; valores?: unknown[] }[] = [];
  const cliente: ClienteSql = {
    async query(texto, valores) {
      consultas.push({ texto, valores });
      return { rows: resposta, rowCount: resposta.length };
    },
  };
  return { cliente, consultas };
}

describe("normalizarNome", () => {
  it("ignora acento, caixa e espaco sobrando", () => {
    expect(normalizarNome("  JUROS   Compostos ")).toBe("juros compostos");
    expect(normalizarNome("Concordância Verbal")).toBe("concordancia verbal");
  });
});

describe("casarTopico — a IA sugere, o codigo casa", () => {
  it("casa o topico existente mesmo com acento e caixa diferentes", () => {
    expect(casarTopico("concordancia verbal", "", CATALOGO)?.nome).toBe(
      "Concordância Verbal",
    );
    expect(casarTopico("JUROS COMPOSTOS", "", CATALOGO)?.nome).toBe(
      "Juros Compostos",
    );
  });

  it("desempata pelo nome da materia quando o topico existe em duas", () => {
    // "Juros Simples" existe em duas materias de proposito — e o comentario da
    // propria migracao da taxonomia.
    const casado = casarTopico(
      "Juros Simples",
      "Conhecimentos Bancarios",
      CATALOGO,
    );
    expect(casado?.materiaNome).toBe("Conhecimentos Bancarios");
  });

  it("nome ambiguo sem materia nao casa: chutar poria a questao na materia errada", () => {
    expect(casarTopico("Juros Simples", "", CATALOGO)).toBeNull();
    expect(casarTopico("Juros Simples", "Materia Inventada", CATALOGO)).toBeNull();
  });

  it("topico inexistente nao casa com nada", () => {
    expect(casarTopico("Politica Monetaria", "Economia", CATALOGO)).toBeNull();
  });

  it("sugestao vazia nao casa", () => {
    expect(casarTopico("   ", "Matematica Financeira", CATALOGO)).toBeNull();
  });
});

describe("classificar — candidato, nunca canonico (BANCO-05 P3 AC1)", () => {
  it("topico existente vira topico_id e nao gera candidato", async () => {
    const { cliente, consultas } = bancoFalso();

    const resultado = await classificar(
      cliente,
      { topicoSugerido: "Juros Compostos", materiaSugerida: "Matematica Financeira" },
      CATALOGO,
    );

    expect(resultado.topicoId).toBe("Matematica Financeira/Juros Compostos");
    expect(resultado.candidatoId).toBeNull();
    // Nada foi escrito: casar e leitura pura.
    expect(consultas).toEqual([]);
  });

  it("topico inexistente vira candidato pendente", async () => {
    const { cliente, consultas } = bancoFalso();

    const resultado = await classificar(
      cliente,
      { topicoSugerido: "Politica Monetaria", materiaSugerida: "Matematica Financeira" },
      CATALOGO,
    );

    expect(resultado.topicoId).toBeNull();
    expect(resultado.candidatoId).toBe("cand-1");
    expect(consultas).toHaveLength(1);
    expect(consultas[0].texto).toContain("registrar_topico_candidato");
    expect(consultas[0].valores).toEqual([
      "Politica Monetaria",
      "m-Matematica Financeira",
    ]);
  });

  it("nunca escreve em `topicos`", async () => {
    // O AC e sobre uma ausencia, e e ela que este teste mede: nenhum comando
    // que a classificacao emita pode criar topico canonico.
    const { cliente, consultas } = bancoFalso();

    await classificar(
      cliente,
      { topicoSugerido: "Assunto Novo", materiaSugerida: "Economia" },
      CATALOGO,
    );

    for (const consulta of consultas) {
      expect(consulta.texto.toLowerCase()).not.toMatch(/insert\s+into\s+\S*topicos/);
    }
  });

  it("materia inexistente deixa o candidato sem materia, em vez de inventar uma", async () => {
    const { cliente, consultas } = bancoFalso();

    await classificar(
      cliente,
      { topicoSugerido: "Politica Monetaria", materiaSugerida: "Economia" },
      CATALOGO,
    );

    expect(consultas[0].valores).toEqual(["Politica Monetaria", null]);
  });

  it("sugestao vazia nao gera candidato vazio", async () => {
    const { cliente, consultas } = bancoFalso();

    const resultado = await classificar(
      cliente,
      { topicoSugerido: "", materiaSugerida: "" },
      CATALOGO,
    );

    expect(resultado).toEqual({ topicoId: null, candidatoId: null });
    expect(consultas).toEqual([]);
  });
});

describe("lerCatalogo", () => {
  it("le id, nome e materia de cada topico", async () => {
    const { cliente, consultas } = bancoFalso([
      { id: "t1", nome: "Juros", materia_id: "m1", materia_nome: "Matematica" },
    ]);

    const catalogo = await lerCatalogo(cliente);

    expect(catalogo).toEqual([
      { id: "t1", nome: "Juros", materiaId: "m1", materiaNome: "Matematica" },
    ]);
    // Topico desativado nao classifica nada novo (a taxonomia e editavel sem
    // deslocar o historico, que e o que `ativo` existe para permitir).
    expect(consultas[0].texto).toContain("t.ativo");
    expect(consultas[0].texto).toContain("m.ativa");
  });
});
