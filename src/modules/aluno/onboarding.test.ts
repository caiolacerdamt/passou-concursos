import { describe, expect, it, vi } from "vitest";

import {
  OnboardingRecusado,
  consultarPerfilEstudo,
  validarOnboarding,
} from "./onboarding";

const entradaValida = () => ({
  concursoAlvo: "Banco do Brasil",
  minutosPorDia: "60",
  diasEstudo: ["1", "3", "5", "3"],
  horarioEstudo: "20:00",
  nivelDeclarado: "iniciante",
});

function recusa(motivo: string, entrada: Record<string, unknown>) {
  try {
    validarOnboarding(
      { diasEstudo: [], ...entrada } as unknown as Parameters<typeof validarOnboarding>[0],
    );
    expect.unreachable("deveria recusar");
  } catch (erro) {
    expect(erro).toBeInstanceOf(OnboardingRecusado);
    expect((erro as OnboardingRecusado).motivo).toBe(motivo);
  }
}

describe("validarOnboarding", () => {
  it("normaliza dados válidos e remove dias repetidos", () => {
    expect(validarOnboarding(entradaValida())).toEqual({
      concursoAlvo: "Banco do Brasil",
      minutosPorDia: 60,
      diasEstudo: [1, 3, 5],
      horarioEstudo: "20:00",
      nivelDeclarado: "iniciante",
    });
  });

  it("recusa os campos obrigatórios inválidos", () => {
    recusa("concurso_obrigatorio", { ...entradaValida(), concursoAlvo: "" });
    recusa("minutos_invalidos", { ...entradaValida(), minutosPorDia: "0" });
    recusa("agenda_obrigatoria", { ...entradaValida(), diasEstudo: [] });
    recusa("dia_invalido", { ...entradaValida(), diasEstudo: ["7"] });
    recusa("horario_invalido", { ...entradaValida(), horarioEstudo: "25:00" });
    recusa("nivel_invalido", { ...entradaValida(), nivelDeclarado: "expert" });
  });

  it("não aceita minutos fracionados ou mais que um dia", () => {
    recusa("minutos_invalidos", { ...entradaValida(), minutosPorDia: "30.5" });
    recusa("minutos_invalidos", { ...entradaValida(), minutosPorDia: "1441" });
  });

  it("aceita o domingo e o sábado como limites da agenda", () => {
    expect(
      validarOnboarding({ ...entradaValida(), diasEstudo: ["0", "6"] }).diasEstudo,
    ).toEqual([0, 6]);
  });
});

describe("consultarPerfilEstudo", () => {
  it("devolve null quando ainda não há perfil", async () => {
    const cliente = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: null, error: null })),
        })),
      })),
    };

    await expect(consultarPerfilEstudo(cliente as never)).resolves.toBeNull();
  });

  it("converte o formato do banco para o contrato da tela", async () => {
    const cliente = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({
            data: {
              concurso_alvo: "Banco do Brasil",
              minutos_por_dia: 45,
              dias_estudo: [1, 4],
              horario_estudo: "19:30:00",
              nivel_declarado: "intermediario",
              onboarding_concluido: true,
              data_prova: null,
            },
            error: null,
          })),
        })),
      })),
    };

    await expect(consultarPerfilEstudo(cliente as never)).resolves.toEqual({
      concursoAlvo: "Banco do Brasil",
      minutosPorDia: 45,
      diasEstudo: [1, 4],
      horarioEstudo: "19:30:00",
      nivelDeclarado: "intermediario",
      onboardingConcluido: true,
      dataProva: null,
    });
  });
});
