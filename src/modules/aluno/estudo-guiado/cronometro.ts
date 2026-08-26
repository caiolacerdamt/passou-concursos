export const DURACOES_DE_FOCO = [30, 45, 60] as const;
export type DuracaoDeFoco = (typeof DURACOES_DE_FOCO)[number];

export const DURACAO_POMODORO_FOCO_SEGUNDOS = 25 * 60;
export const DURACAO_POMODORO_PAUSA_SEGUNDOS = 5 * 60;

/**
 * Depois de uma hora além do fim esperado, não há como saber se o aluno
 * deixou a aba aberta ou se continuou estudando. Encerrar parado evita
 * transformar um retorno após horas em tempo negativo ou vários ciclos.
 */
export const LIMITE_DE_ATRASO_APOS_FIM_SEGUNDOS = 60 * 60;

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
  iniciadoEm: number | null;
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
    iniciadoEm: null,
  };
}

export function alternarCronometro(
  estado: EstadoDoCronometro,
  agoraEmMs?: number,
): EstadoDoCronometro {
  if (estado.fase === "concluido") return estado;

  if (!estado.executando) {
    return {
      ...estado,
      executando: true,
      iniciadoEm: agoraEmMs ?? estado.iniciadoEm,
    };
  }

  const sincronizado =
    agoraEmMs === undefined
      ? estado
      : sincronizarCronometro(estado, agoraEmMs);

  if (!sincronizado.executando || sincronizado.fase === "concluido") {
    return sincronizado;
  }

  return { ...sincronizado, executando: false, iniciadoEm: null };
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
      iniciadoEm: null,
    };
  }

  if (estado.modo === "foco") {
    return {
      ...estado,
      fase: "concluido",
      restanteSegundos: 0,
      executando: false,
      iniciadoEm: null,
    };
  }

  if (estado.fase === "foco") {
    return {
      ...estado,
      fase: "pausa",
      restanteSegundos: DURACAO_POMODORO_PAUSA_SEGUNDOS,
      executando: false,
      iniciadoEm: null,
    };
  }

  return {
    ...estado,
    fase: "foco",
    restanteSegundos: DURACAO_POMODORO_FOCO_SEGUNDOS,
    executando: false,
    ciclosCompletos: estado.ciclosCompletos + 1,
    iniciadoEm: null,
  };
}

/**
 * Redesenha o estado a partir do relógio de parede, sem consultar o relógio
 * por conta própria. O componente fornece o instante, o que mantém esta
 * máquina determinística e testável.
 */
export function sincronizarCronometro(
  estado: EstadoDoCronometro,
  agoraEmMs: number,
): EstadoDoCronometro {
  if (
    !estado.executando ||
    estado.fase === "concluido" ||
    estado.iniciadoEm === null ||
    !Number.isFinite(agoraEmMs)
  ) {
    return estado;
  }

  const decorrido = Math.max(
    0,
    Math.floor((agoraEmMs - estado.iniciadoEm) / 1_000),
  );

  if (decorrido === 0) return estado;

  if (
    decorrido >
    duracaoDaFaseEmSegundos(estado) + LIMITE_DE_ATRASO_APOS_FIM_SEGUNDOS
  ) {
    return {
      ...estado,
      fase: "concluido",
      restanteSegundos: 0,
      executando: false,
      iniciadoEm: null,
    };
  }

  const avancado = avancarCronometro(
    {
      ...estado,
      restanteSegundos: duracaoDaFaseEmSegundos(estado),
    },
    decorrido,
  );

  return avancado.executando
    ? { ...avancado, iniciadoEm: estado.iniciadoEm }
    : { ...avancado, iniciadoEm: null };
}

/**
 * Troca a técnica sem apagar o que já foi contabilizado. O foco transcorrido
 * é recalculado no alvo novo quando as fases são compatíveis, e os ciclos
 * permanecem sempre. A pausa do Pomodoro não vira foco contínuo: nesse caso,
 * começa-se um novo foco, mantendo os ciclos já concluídos.
 */
export function trocarConfiguracaoDoCronometro(
  estado: EstadoDoCronometro,
  configuracao: ConfiguracaoDoCronometro,
  agoraEmMs: number,
): EstadoDoCronometro {
  const sincronizado = sincronizarCronometro(estado, agoraEmMs);
  const ciclosCompletos = sincronizado.ciclosCompletos;

  if (sincronizado.fase === "concluido") {
    return {
      ...criarEstadoDoCronometro(configuracao),
      ciclosCompletos,
    };
  }

  const duracaoAtual = duracaoDaFaseEmSegundos(sincronizado);
  const decorridoNaFase = Math.max(
    0,
    duracaoAtual - sincronizado.restanteSegundos,
  );
  const executando = sincronizado.executando;
  const iniciadoEm = executando ? agoraEmMs : null;

  if (configuracao.modo === "foco") {
    if (sincronizado.modo === "pomodoro" && sincronizado.fase === "pausa") {
      return {
        modo: "foco",
        duracaoFocoMinutos: configuracao.duracaoMinutos,
        fase: "foco",
        restanteSegundos: configuracao.duracaoMinutos * 60,
        executando,
        ciclosCompletos,
        iniciadoEm,
      };
    }

    const restanteSegundos = Math.max(
      0,
      configuracao.duracaoMinutos * 60 - decorridoNaFase,
    );

    return {
      modo: "foco",
      duracaoFocoMinutos: configuracao.duracaoMinutos,
      fase: restanteSegundos === 0 ? "concluido" : "foco",
      restanteSegundos,
      executando: restanteSegundos === 0 ? false : executando,
      ciclosCompletos,
      iniciadoEm: restanteSegundos === 0 ? null : iniciadoEm,
    };
  }

  if (sincronizado.modo === "pomodoro" && sincronizado.fase === "pausa") {
    return {
      modo: "pomodoro",
      duracaoFocoMinutos: 25,
      fase: "pausa",
      restanteSegundos: sincronizado.restanteSegundos,
      executando,
      ciclosCompletos,
      iniciadoEm,
    };
  }

  const restanteSegundos = Math.max(
    0,
    DURACAO_POMODORO_FOCO_SEGUNDOS - decorridoNaFase,
  );

  if (restanteSegundos === 0) {
    return {
      modo: "pomodoro",
      duracaoFocoMinutos: 25,
      fase: "pausa",
      restanteSegundos: DURACAO_POMODORO_PAUSA_SEGUNDOS,
      executando: false,
      ciclosCompletos,
      iniciadoEm: null,
    };
  }

  return {
    modo: "pomodoro",
    duracaoFocoMinutos: 25,
    fase: "foco",
    restanteSegundos,
    executando,
    ciclosCompletos,
    iniciadoEm,
  };
}

function duracaoDaFaseEmSegundos(estado: EstadoDoCronometro): number {
  if (estado.modo === "foco") return estado.duracaoFocoMinutos * 60;
  return estado.fase === "pausa"
    ? DURACAO_POMODORO_PAUSA_SEGUNDOS
    : DURACAO_POMODORO_FOCO_SEGUNDOS;
}

export function formatarTempoCronometro(segundos: number): string {
  const seguros = Math.max(0, Math.floor(segundos));
  const minutos = Math.floor(seguros / 60).toString().padStart(2, "0");
  const resto = (seguros % 60).toString().padStart(2, "0");
  return `${minutos}:${resto}`;
}
