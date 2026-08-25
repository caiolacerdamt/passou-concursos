import { describe, expect, it } from "vitest";

import {
  TETO_DA_CAUDA,
  TOPO_DO_RAIOX,
  frequenciaDoExtrato,
  percentualEmPtBr,
  resumirFrequencia,
} from "./frequencia";
import { TOPICOS_DO_EXTRATO } from "./frequencia-extrato";

describe("resumo da frequência real", () => {
  it("ordena por questão e soma o total sem receber o total pronto", () => {
    const resumo = resumirFrequencia(
      [
        { topico: "Câmbio", materia: "Bancários", questoes: 4 },
        { topico: "Sintaxe", materia: "Português", questoes: 10 },
      ],
      { total: 2, anos: [2019, 2011] },
      "banco",
    );

    expect(resumo.topicos.map((t) => t.topico)).toEqual(["Sintaxe", "Câmbio"]);
    expect(resumo.totalQuestoes).toBe(14);
    expect(resumo.totalTopicos).toBe(2);
    expect(resumo.primeiroAno).toBe(2011);
    expect(resumo.ultimoAno).toBe(2019);
  });

  it("conta como cauda o tópico que empata com o teto, e não o de cima", () => {
    const resumo = resumirFrequencia(
      [
        { topico: "No teto", materia: "M", questoes: TETO_DA_CAUDA },
        { topico: "Acima", materia: "M", questoes: TETO_DA_CAUDA + 1 },
      ],
      { total: 1, anos: [2025] },
      "banco",
    );

    expect(resumo.caudaTopicos).toBe(1);
    expect(resumo.caudaQuestoes).toBe(TETO_DA_CAUDA);
  });

  it("não divide por zero quando o acervo está vazio", () => {
    const resumo = resumirFrequencia([], { total: 0, anos: [] }, "banco");

    expect(resumo.topPercentual).toBe(0);
    expect(resumo.caudaPercentual).toBe(0);
    expect(resumo.totalQuestoes).toBe(0);
  });
});

/**
 * Os números que a copy da landing cita saem daqui. Se o extrato for regerado e
 * um deles mudar, este teste falha antes de a página passar a mentir.
 */
describe("extrato congelado de 2026-08-25", () => {
  const resumo = frequenciaDoExtrato();

  it("reproduz o acervo medido: 1.395 questões, 86 tópicos, 28 provas", () => {
    expect(resumo.totalQuestoes).toBe(1395);
    expect(resumo.totalTopicos).toBe(86);
    expect(resumo.totalProvas).toBe(28);
    expect(resumo.primeiroAno).toBe(2010);
    expect(resumo.ultimoAno).toBe(2025);
    expect(resumo.fonte).toBe("extrato");
  });

  it("reproduz as duas fatias que a página afirma", () => {
    expect(resumo.topQuestoes).toBe(567);
    expect(percentualEmPtBr(resumo.topPercentual)).toBe("40,6");

    expect(resumo.caudaTopicos).toBe(19);
    expect(resumo.caudaQuestoes).toBe(65);
    expect(percentualEmPtBr(resumo.caudaPercentual)).toBe("4,7");
  });

  it("traz um tópico por linha, com nome e matéria, para os chips do pico", () => {
    expect(TOPICOS_DO_EXTRATO).toHaveLength(86);
    expect(resumo.topicos.slice(0, TOPO_DO_RAIOX).every((t) => t.topico && t.materia)).toBe(
      true,
    );
    expect(resumo.topicos[0]).toEqual({
      topico: "Interpretação",
      materia: "Língua Portuguesa",
      questoes: 93,
    });
  });
});
