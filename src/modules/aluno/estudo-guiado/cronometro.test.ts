import { describe, expect, it } from "vitest";

import {
  alternarCronometro,
  avancarCronometro,
  criarEstadoDoCronometro,
  DURACAO_POMODORO_FOCO_SEGUNDOS,
  DURACAO_POMODORO_PAUSA_SEGUNDOS,
  formatarTempoCronometro,
} from "./cronometro";

describe("cronômetro de estudo", () => {
  it("começa parado e não registra nada fora do estado local", () => {
    const estado = criarEstadoDoCronometro({ modo: "foco", duracaoMinutos: 30 });

    expect(estado).toMatchObject({
      modo: "foco",
      fase: "foco",
      restanteSegundos: 1_800,
      executando: false,
    });
    expect(avancarCronometro(estado, 60)).toEqual(estado);
  });

  it("encerra foco contínuo exatamente no zero e para", () => {
    const inicial = alternarCronometro(
      criarEstadoDoCronometro({ modo: "foco", duracaoMinutos: 30 }),
    );

    const final = avancarCronometro(inicial, 1_800);

    expect(final).toMatchObject({ fase: "concluido", restanteSegundos: 0, executando: false });
    expect(avancarCronometro(final, 10)).toEqual(final);
  });

  it("guia foco e pausa do Pomodoro e começa novo ciclo parado", () => {
    const foco = alternarCronometro(criarEstadoDoCronometro({ modo: "pomodoro" }));
    const pausa = avancarCronometro(foco, DURACAO_POMODORO_FOCO_SEGUNDOS);

    expect(pausa).toMatchObject({
      fase: "pausa",
      restanteSegundos: DURACAO_POMODORO_PAUSA_SEGUNDOS,
      executando: false,
      ciclosCompletos: 0,
    });

    const novoFoco = avancarCronometro(alternarCronometro(pausa), DURACAO_POMODORO_PAUSA_SEGUNDOS);
    expect(novoFoco).toMatchObject({
      fase: "foco",
      restanteSegundos: DURACAO_POMODORO_FOCO_SEGUNDOS,
      executando: false,
      ciclosCompletos: 1,
    });
  });

  it("formata tempo e ignora avanço fracionado ou negativo", () => {
    expect(formatarTempoCronometro(0)).toBe("00:00");
    expect(formatarTempoCronometro(65)).toBe("01:05");
    expect(formatarTempoCronometro(-1)).toBe("00:00");

    const estado = alternarCronometro(criarEstadoDoCronometro({ modo: "foco", duracaoMinutos: 45 }));
    expect(avancarCronometro(estado, 0.9)).toEqual(estado);
    expect(avancarCronometro(estado, -4)).toEqual(estado);
  });
});
