export const DURACOES_DE_FOCO = [30, 45, 60] as const;
export type DuracaoDeFoco = (typeof DURACOES_DE_FOCO)[number];

export const DURACAO_POMODORO_FOCO_SEGUNDOS = 25 * 60;
export const DURACAO_POMODORO_PAUSA_SEGUNDOS = 5 * 60;

export type ModoDeEstudo = "pomodoro" | "foco";
export type FaseDoCronometro = "foco" | "pausa" | "concluido";

export type ConfiguracaoDoCronometro =
  | { modo: "pomodoro" }
  | { modo: "foco"; duracaoMinutos: DuracaoDeFoco };

export type EstadoDoCronometro = {
  modo: ModoDeEstudo;
  duracaoFocoMinutos: number;
  fase: FaseDoCronometro;
  restanteSegundos: number;
  executando: boolean;
  ciclosCompletos: number;
};

/** Estado inicial explícito: abrir a tela não começa a contar sozinho. */
export function criarEstadoDoCronometro(
  configuracao: ConfiguracaoDoCronometro,
): EstadoDoCronometro {
  return {
    modo: configuracao.modo,
    duracaoFocoMinutos:
      configuracao.modo === "foco" ? configuracao.duracaoMinutos : 25,
    fase: "foco",
    restanteSegundos:
      configuracao.modo === "pomodoro"
        ? DURACAO_POMODORO_FOCO_SEGUNDOS
        : configuracao.duracaoMinutos * 60,
    executando: false,
    ciclosCompletos: 0,
  };
}

export function alternarCronometro(
  estado: EstadoDoCronometro,
): EstadoDoCronometro {
  if (estado.fase === "concluido") return estado;
  return { ...estado, executando: !estado.executando };
}

export function reiniciarCronometro(
  configuracao: ConfiguracaoDoCronometro,
): EstadoDoCronometro {
  return criarEstadoDoCronometro(configuracao);
}

/**
 * Avança o relógio por uma quantidade inteira de segundos.
 *
 * A transição de uma fase para outra sempre pausa o relógio. Assim o aluno
 * escolhe explicitamente começar a pausa ou o próximo foco, e uma aba em
 * segundo plano não cria estudo fictício.
 */
export function avancarCronometro(
  estado: EstadoDoCronometro,
  segundos: number,
): EstadoDoCronometro {
  if (!estado.executando || estado.fase === "concluido") return estado;

  const quantidade = Math.max(0, Math.floor(segundos));
  if (quantidade === 0) return estado;

  if (quantidade < estado.restanteSegundos) {
    return {
      ...estado,
      restanteSegundos: estado.restanteSegundos - quantidade,
    };
  }

  if (estado.modo === "foco") {
    return {
      ...estado,
      fase: "concluido",
      restanteSegundos: 0,
      executando: false,
    };
  }

  if (estado.fase === "foco") {
    return {
      ...estado,
      fase: "pausa",
      restanteSegundos: DURACAO_POMODORO_PAUSA_SEGUNDOS,
      executando: false,
    };
  }

  return {
    ...estado,
    fase: "foco",
    restanteSegundos: DURACAO_POMODORO_FOCO_SEGUNDOS,
    executando: false,
    ciclosCompletos: estado.ciclosCompletos + 1,
  };
}

export function formatarTempoCronometro(segundos: number): string {
  const seguros = Math.max(0, Math.floor(segundos));
  const minutos = Math.floor(seguros / 60).toString().padStart(2, "0");
  const resto = (seguros % 60).toString().padStart(2, "0");
  return `${minutos}:${resto}`;
}
