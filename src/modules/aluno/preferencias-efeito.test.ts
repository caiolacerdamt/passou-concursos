import { describe, expect, it } from "vitest";

import {
  cargaSemanal,
  contarMudancas,
  diaDaSemanaDe,
  formatarDuracao,
  horarioCurto,
  proximoEstudo,
  type EstadoDasPreferencias,
} from "./preferencias-efeito";

const SALVO: EstadoDasPreferencias = {
  concursoAlvo: "Banco do Brasil",
  minutosPorDia: 45,
  diasEstudo: [1, 3, 6],
  horarioEstudo: "19:30:00",
  nivelDeclarado: "intermediario",
};

describe("formatarDuracao", () => {
  it("não escreve 90 min nem 0 h", () => {
    expect(formatarDuracao(90)).toBe("1 h 30");
    expect(formatarDuracao(45)).toBe("45 min");
    expect(formatarDuracao(180)).toBe("3 h");
    expect(formatarDuracao(0)).toBe("0 min");
  });
});

describe("cargaSemanal", () => {
  it("multiplica os minutos pelos dias marcados", () => {
    expect(cargaSemanal(180, [1, 2, 3, 4, 5])).toBe(900);
  });

  it("é zero sem dia marcado, e não NaN com minutos inválidos", () => {
    expect(cargaSemanal(180, [])).toBe(0);
    expect(cargaSemanal(Number.NaN, [1, 2])).toBe(0);
  });
});

describe("proximoEstudo", () => {
  it("aponta hoje quando hoje está na agenda", () => {
    expect(proximoEstudo([1, 3, 5], 3)).toEqual({ dia: 3, hoje: true });
  });

  it("vira a semana quando o próximo dia já passou", () => {
    expect(proximoEstudo([1, 2], 5)).toEqual({ dia: 1, hoje: false });
  });

  it("não inventa dia quando a agenda está vazia", () => {
    expect(proximoEstudo([], 3)).toBeNull();
  });
});

describe("contarMudancas", () => {
  it("não conta nada quando nada mudou", () => {
    expect(contarMudancas(SALVO, { ...SALVO })).toBe(0);
  });

  it("ignora a diferença entre 19:30:00 do banco e 19:30 do input", () => {
    expect(contarMudancas(SALVO, { ...SALVO, horarioEstudo: "19:30" })).toBe(0);
  });

  it("trata a agenda como conjunto: a ordem não é mudança", () => {
    expect(contarMudancas(SALVO, { ...SALVO, diasEstudo: [6, 3, 1] })).toBe(0);
  });

  it("conta um campo por campo alterado", () => {
    expect(
      contarMudancas(SALVO, {
        ...SALVO,
        minutosPorDia: 180,
        nivelDeclarado: "avancado",
      }),
    ).toBe(2);
  });

  it("percebe dia trocado, e não só dia a mais", () => {
    expect(contarMudancas(SALVO, { ...SALVO, diasEstudo: [1, 3, 5] })).toBe(1);
  });
});

describe("diaDaSemanaDe", () => {
  it("lê a data do produto sem escorregar de fuso", () => {
    expect(diaDaSemanaDe("2026-09-03")).toBe(4);
    expect(diaDaSemanaDe("2026-09-06")).toBe(0);
  });
});

describe("horarioCurto", () => {
  it("corta os segundos e aceita o que já vem curto", () => {
    expect(horarioCurto("19:30:00")).toBe("19:30");
    expect(horarioCurto("19:30")).toBe("19:30");
  });
});
