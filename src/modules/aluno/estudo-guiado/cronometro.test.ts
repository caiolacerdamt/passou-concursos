import { describe, expect, it } from "vitest";

import {
  alternarCronometro,
  avancarCronometro,
  criarEstadoDoCronometro,
  DURACAO_POMODORO_FOCO_SEGUNDOS,
  DURACAO_POMODORO_PAUSA_SEGUNDOS,
  formatarTempoCronometro,
  sincronizarCronometro,
  trocarConfiguracaoDoCronometro,
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

  it("deriva o restante do relógio de parede, não da quantidade de ticks", () => {
    const iniciado = alternarCronometro(
      criarEstadoDoCronometro({ modo: "foco", duracaoMinutos: 30 }),
      1_000,
    );

    const depoisDeUmMinuto = sincronizarCronometro(iniciado, 61_500);

    expect(depoisDeUmMinuto).toMatchObject({
      restanteSegundos: 1_740,
      executando: true,
      iniciadoEm: 61_500,
    });

    const depoisDeMaisUmSegundo = sincronizarCronometro(
      depoisDeUmMinuto,
      62_500,
    );

    expect(depoisDeMaisUmSegundo.restanteSegundos).toBe(1_739);
  });

  it("pausa na transição de fase e encerra um retorno muito atrasado", () => {
    const pomodoro = alternarCronometro(
      criarEstadoDoCronometro({ modo: "pomodoro" }),
      0,
    );

    const pausa = sincronizarCronometro(
      pomodoro,
      DURACAO_POMODORO_FOCO_SEGUNDOS * 1_000,
    );

    expect(pausa).toMatchObject({
      fase: "pausa",
      restanteSegundos: DURACAO_POMODORO_PAUSA_SEGUNDOS,
      executando: false,
      iniciadoEm: null,
    });

    const atrasado = sincronizarCronometro(
      alternarCronometro(
        criarEstadoDoCronometro({ modo: "foco", duracaoMinutos: 30 }),
        0,
      ),
      (1_800 + 3_600 + 1) * 1_000,
    );

    expect(atrasado).toMatchObject({
      fase: "concluido",
      restanteSegundos: 0,
      executando: false,
      iniciadoEm: null,
    });
  });

  it("troca a duração preservando o foco transcorrido e os ciclos", () => {
    const cincoMinutosDeFoco = sincronizarCronometro(
      alternarCronometro(
        criarEstadoDoCronometro({ modo: "foco", duracaoMinutos: 30 }),
        0,
      ),
      5 * 60 * 1_000,
    );

    const comCiclos = { ...cincoMinutosDeFoco, ciclosCompletos: 3 };
    const trocado = trocarConfiguracaoDoCronometro(
      comCiclos,
      { modo: "foco", duracaoMinutos: 45 },
      5 * 60 * 1_000,
    );

    expect(trocado).toMatchObject({
      modo: "foco",
      restanteSegundos: 2_400,
      executando: true,
      ciclosCompletos: 3,
      iniciadoEm: 5 * 60 * 1_000,
    });
  });

  it("não transforma pausa em foco, mas mantém os ciclos na troca de técnica", () => {
    const pausaComCiclo = {
      ...avancarCronometro(
        alternarCronometro(
          avancarCronometro(
            alternarCronometro(
              criarEstadoDoCronometro({ modo: "pomodoro" }),
            ),
            DURACAO_POMODORO_FOCO_SEGUNDOS,
          ),
        ),
        DURACAO_POMODORO_PAUSA_SEGUNDOS,
      ),
      ciclosCompletos: 1,
    };

    const trocado = trocarConfiguracaoDoCronometro(
      pausaComCiclo,
      { modo: "foco", duracaoMinutos: 30 },
      0,
    );

    expect(trocado).toMatchObject({
      modo: "foco",
      fase: "foco",
      restanteSegundos: 1_800,
      executando: false,
      ciclosCompletos: 1,
    });
  });
});
