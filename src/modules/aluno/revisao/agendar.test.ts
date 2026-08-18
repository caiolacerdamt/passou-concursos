import { describe, expect, it } from "vitest";

import { NOTA } from "./contrato";
import { notaDoPercentual } from "./agendar";

/**
 * SPEC 06 · T50 — a conversao percentual -> `Rating` (ALUNO-09 AC2, AD-072).
 *
 * Esta e a peca mais fragil do modulo, e por isso e a que tem teste unitario
 * proprio: o FSRS foi desenhado para o aluno avaliar **item a item**, e aqui a
 * nota e derivada do desempenho de um **bloco inteiro** de um assunto. As faixas
 * moram em configuracao justamente porque este numero vai mudar.
 */

// Os defaults declarados no catalogo. Copiados aqui de proposito: se alguem
// mudar o default sem pensar, e este teste que pergunta se foi de proposito.
const FAIXAS = { errei: 0.5, dificil: 0.7, bom: 0.9 };

describe("notaDoPercentual (ALUNO-09 AC2)", () => {
  it("classifica o meio de cada faixa", () => {
    expect(notaDoPercentual(0.2, FAIXAS)).toBe(NOTA.errei);
    expect(notaDoPercentual(0.6, FAIXAS)).toBe(NOTA.dificil);
    expect(notaDoPercentual(0.8, FAIXAS)).toBe(NOTA.bom);
    expect(notaDoPercentual(0.95, FAIXAS)).toBe(NOTA.facil);
  });

  it("a borda pertence a faixa de CIMA: exatamente 50% e dificil, nao errei", () => {
    // E a decisao que separa "acertou metade" de "nao sabe". Sem asserção de
    // borda, trocar `<` por `<=` no codigo passaria despercebido.
    expect(notaDoPercentual(0.5, FAIXAS)).toBe(NOTA.dificil);
    expect(notaDoPercentual(0.7, FAIXAS)).toBe(NOTA.bom);
    expect(notaDoPercentual(0.9, FAIXAS)).toBe(NOTA.facil);
  });

  it("os extremos 0 e 1 tem nota", () => {
    expect(notaDoPercentual(0, FAIXAS)).toBe(NOTA.errei);
    expect(notaDoPercentual(1, FAIXAS)).toBe(NOTA.facil);
  });

  it("acompanha as faixas quando a configuracao muda, sem numero solto no codigo", () => {
    const exigente = { errei: 0.8, dificil: 0.9, bom: 0.99 };
    // 85% seria `bom` com o default e vira `dificil` com faixas exigentes. E o
    // que "calibra sem deploy" quer dizer (AD-078).
    expect(notaDoPercentual(0.85, FAIXAS)).toBe(NOTA.bom);
    expect(notaDoPercentual(0.85, exigente)).toBe(NOTA.dificil);
  });
});
