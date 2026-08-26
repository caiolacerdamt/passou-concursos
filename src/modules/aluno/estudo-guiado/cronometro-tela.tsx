"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import {
  alternarCronometro,
  criarEstadoDoCronometro,
  DURACOES_DE_FOCO,
  DURACAO_POMODORO_FOCO_SEGUNDOS,
  DURACAO_POMODORO_PAUSA_SEGUNDOS,
  formatarTempoCronometro,
  reiniciarCronometro,
  sincronizarCronometro,
  trocarConfiguracaoDoCronometro,
  type ConfiguracaoDoCronometro,
  type DuracaoDeFoco,
  type EstadoDoCronometro,
  type ModoDeEstudo,
} from "./cronometro";

const ROTULOS_DA_FASE: Record<EstadoDoCronometro["fase"], string> = {
  foco: "Foco",
  pausa: "Pausa",
  concluido: "Foco concluído",
};

const ROTULOS_DO_MODO: Record<ModoDeEstudo, string> = {
  pomodoro: "Pomodoro · 25 + 5",
  foco: "Foco contínuo",
};

const CHAVE_DO_CRONOMETRO = "passou:cronometro:";

type EstadoPersistidoDoCronometro = {
  modo: ModoDeEstudo;
  duracaoMinutos: DuracaoDeFoco;
  estado: EstadoDoCronometro;
};

function instanteAtualEmMs(): number {
  return Date.now();
}

/**
 * O relógio do bloco, no cartão escuro que a tela tem direito de usar uma vez
 * (AD-111). O breu é o mesmo da barra de navegação e do cartão do próximo
 * bloco em `/app`: é a matéria que diz "isto é ferramenta, não leitura".
 *
 * A escolha da técnica virou par de pílulas em vez de `<select>` — são duas
 * opções, e um menu suspenso para duas opções esconde metade da informação
 * atrás de um clique.
 */
export function CronometroDeEstudo() {
  return (
    <Suspense fallback={<CronometroComPersistencia blocoId={null} />}>
      <CronometroComBloco />
    </Suspense>
  );
}

function CronometroComBloco() {
  const parametros = useSearchParams();

  return <CronometroComPersistencia blocoId={parametros.get("bloco")} />;
}

function CronometroComPersistencia({ blocoId }: { blocoId: string | null }) {
  const [modo, setModo] = useState<ModoDeEstudo>("pomodoro");
  const [duracao, setDuracao] = useState<DuracaoDeFoco>(30);
  const [estado, setEstado] = useState<EstadoDoCronometro>(() =>
    criarEstadoDoCronometro({ modo: "pomodoro" }),
  );
  const [carregadoParaBloco, setCarregadoParaBloco] = useState<
    string | null | undefined
  >();

  const chave = blocoId === null ? null : chaveDoCronometro(blocoId);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const persistido = chave === null ? null : lerEstadoPersistido(chave);

      if (persistido === null) {
        setModo("pomodoro");
        setDuracao(30);
        setEstado(criarEstadoDoCronometro({ modo: "pomodoro" }));
      } else {
        setModo(persistido.modo);
        setDuracao(persistido.duracaoMinutos);
        setEstado(sincronizarCronometro(persistido.estado, instanteAtualEmMs()));
      }

      setCarregadoParaBloco(blocoId);
    }, 0);

    return () => window.clearTimeout(id);
  }, [blocoId, chave]);

  const prontoParaPersistir =
    chave !== null && carregadoParaBloco === blocoId;

  useEffect(() => {
    if (!prontoParaPersistir || chave === null) return undefined;

    salvarEstadoPersistido(chave, { modo, duracaoMinutos: duracao, estado });
    return undefined;
  }, [chave, duracao, estado, modo, prontoParaPersistir]);

  useEffect(() => {
    if (!prontoParaPersistir || !estado.executando) return undefined;

    const relogio = window.setInterval(() => {
      setEstado((atual) => sincronizarCronometro(atual, instanteAtualEmMs()));
    }, 1_000);

    return () => window.clearInterval(relogio);
  }, [estado.executando, prontoParaPersistir]);

  const configuracaoAtual: ConfiguracaoDoCronometro =
    modo === "pomodoro" ? { modo } : { modo, duracaoMinutos: duracao };

  function selecionarModo(novoModo: ModoDeEstudo) {
    const agoraEmMs = instanteAtualEmMs();
    const novaConfiguracao: ConfiguracaoDoCronometro =
      novoModo === "pomodoro"
        ? { modo: novoModo }
        : { modo: novoModo, duracaoMinutos: duracao };

    setModo(novoModo);
    setEstado((atual) =>
      trocarConfiguracaoDoCronometro(atual, novaConfiguracao, agoraEmMs),
    );
  }

  function selecionarDuracao(novaDuracao: DuracaoDeFoco) {
    const agoraEmMs = instanteAtualEmMs();

    setDuracao(novaDuracao);
    setEstado((atual) =>
      trocarConfiguracaoDoCronometro(
        atual,
        { modo: "foco", duracaoMinutos: novaDuracao },
        agoraEmMs,
      ),
    );
  }

  const botaoPrincipal =
    estado.fase === "concluido"
      ? "Recomeçar foco"
      : estado.executando
        ? "Pausar"
        : estado.fase === "pausa"
          ? "Iniciar pausa"
          : "Iniciar foco";

  function acionarPrincipal() {
    if (estado.fase === "concluido") {
      setEstado(reiniciarCronometro(configuracaoAtual));
      return;
    }
    const agoraEmMs = instanteAtualEmMs();
    setEstado((atual) => alternarCronometro(atual, agoraEmMs));
  }

  return (
    <section
      className="grid gap-8 rounded-[1.25rem] bg-breu px-8 py-8 text-breu-tinta sm:px-9 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
      aria-labelledby="titulo-tecnica"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] text-breu-verde">
            Técnica de estudo
          </p>
          {estado.ciclosCompletos > 0 ? (
            <span className="rounded-lg bg-breu-alto px-2.5 py-1.5 text-[0.6875rem] font-semibold text-breu-verde">
              {estado.ciclosCompletos} {estado.ciclosCompletos === 1 ? "ciclo" : "ciclos"} concluído
              {estado.ciclosCompletos === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>

        <h2 id="titulo-tecnica" className="mt-3.5 text-[1.875rem] font-semibold leading-[1.1] tracking-[-0.03em]">
          Conduza este bloco no seu ritmo
        </h2>

        <div className="mt-5.5 flex flex-wrap gap-2" role="group" aria-label="Técnica de estudo">
          {(["pomodoro", "foco"] as const).map((opcao) => (
            <button
              key={opcao}
              type="button"
              onClick={() => selecionarModo(opcao)}
              aria-pressed={modo === opcao}
              className={`inline-flex min-h-10 items-center px-4.5 text-sm font-semibold motion-safe:transition-colors motion-reduce:transition-none ${
                modo === opcao
                  ? "bg-breu-verde text-breu"
                  : "border border-breu-linha font-medium text-breu-suave hover:text-breu-tinta"
              }`}
            >
              {ROTULOS_DO_MODO[opcao]}
            </button>
          ))}
        </div>

        {modo === "foco" ? (
          <label className="mt-5 grid max-w-xs gap-1.5 text-[0.8125rem] font-semibold text-breu-suave" htmlFor="duracao-foco">
            Duração do foco
            <select
              id="duracao-foco"
              value={duracao}
              onChange={(evento) => selecionarDuracao(Number(evento.target.value) as DuracaoDeFoco)}
              className="min-h-11 rounded-[0.625rem] border border-breu-linha bg-breu-alto px-3 font-normal text-breu-tinta"
            >
              {DURACOES_DE_FOCO.map((minutos) => (
                <option key={minutos} value={minutos}>
                  {minutos} minutos
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="mt-5 max-w-[48ch] text-sm leading-6 text-breu-suave">
            25 minutos de foco e, ao terminar, uma pausa de 5. O relógio fica no seu dispositivo: ele não conclui o bloco nem grava progresso sozinho.
          </p>
        )}
      </div>

      <div className="flex flex-col items-center gap-4 lg:min-w-[17rem]">
        <p className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] text-breu-suave" aria-live="polite">
          {ROTULOS_DA_FASE[estado.fase]}
        </p>
        <p
          className="font-utilitaria text-[4.25rem] font-semibold leading-none tracking-[-0.04em] text-breu-tinta"
          role="timer"
          aria-label={`${ROTULOS_DA_FASE[estado.fase]}: ${formatarTempoCronometro(estado.restanteSegundos)}`}
        >
          {formatarTempoCronometro(estado.restanteSegundos)}
        </p>
        <p className="max-w-[30ch] text-center text-[0.8125rem] leading-6 text-breu-suave" aria-live="polite">
          {mensagemDoCronometro(estado)}
        </p>
        <div className="flex flex-wrap justify-center gap-2.5">
          <button
            type="button"
            onClick={acionarPrincipal}
            className="min-h-11 bg-breu-verde px-6 font-semibold text-breu motion-safe:transition-colors motion-reduce:transition-none hover:bg-breu-tinta"
          >
            {botaoPrincipal}
          </button>
          <button
            type="button"
            onClick={() => setEstado(reiniciarCronometro(configuracaoAtual))}
            className="min-h-11 border border-breu-linha px-5 font-medium text-breu-tinta motion-safe:transition-colors motion-reduce:transition-none hover:bg-breu-alto"
          >
            Reiniciar
          </button>
        </div>
      </div>
    </section>
  );
}

function chaveDoCronometro(blocoId: string): string {
  return `${CHAVE_DO_CRONOMETRO}${encodeURIComponent(blocoId)}`;
}

function lerEstadoPersistido(
  chave: string,
): EstadoPersistidoDoCronometro | null {
  try {
    const bruto = window.localStorage.getItem(chave);
    return bruto === null ? null : interpretarEstadoPersistido(JSON.parse(bruto));
  } catch {
    // localStorage pode falhar em modo privado ou com cookies bloqueados.
    return null;
  }
}

function salvarEstadoPersistido(
  chave: string,
  persistido: EstadoPersistidoDoCronometro,
): void {
  try {
    window.localStorage.setItem(chave, JSON.stringify(persistido));
  } catch {
    // O relógio continua funcional mesmo quando o navegador nega a escrita.
  }
}

function interpretarEstadoPersistido(
  valor: unknown,
): EstadoPersistidoDoCronometro | null {
  if (!ehRegistro(valor)) return null;

  const modo = valor.modo;
  const duracaoMinutos = valor.duracaoMinutos;
  const estadoBruto = valor.estado;

  if (!ehModo(modo) || !ehDuracao(duracaoMinutos) || !ehRegistro(estadoBruto)) {
    return null;
  }

  const fase = estadoBruto.fase;
  const duracaoFocoMinutos = estadoBruto.duracaoFocoMinutos;
  const restanteSegundos = estadoBruto.restanteSegundos;
  const executando = estadoBruto.executando;
  const ciclosCompletos = estadoBruto.ciclosCompletos;
  const iniciadoEm = estadoBruto.iniciadoEm;

  if (
    !ehFase(fase) ||
    typeof duracaoFocoMinutos !== "number" ||
    !Number.isFinite(duracaoFocoMinutos) ||
    typeof restanteSegundos !== "number" ||
    !Number.isInteger(restanteSegundos) ||
    restanteSegundos < 0 ||
    typeof executando !== "boolean" ||
    typeof ciclosCompletos !== "number" ||
    !Number.isInteger(ciclosCompletos) ||
    ciclosCompletos < 0 ||
    (iniciadoEm !== null &&
      (typeof iniciadoEm !== "number" || !Number.isFinite(iniciadoEm))) ||
    estadoBruto.modo !== modo ||
    duracaoFocoMinutos !== (modo === "foco" ? duracaoMinutos : 25) ||
    (executando && iniciadoEm === null) ||
    (!executando && iniciadoEm !== null) ||
    (modo === "foco" && fase === "pausa") ||
    (fase === "concluido" && executando)
  ) {
    return null;
  }

  const limiteDaFase =
    fase === "concluido"
      ? 0
      : modo === "foco"
        ? duracaoMinutos * 60
        : fase === "pausa"
          ? DURACAO_POMODORO_PAUSA_SEGUNDOS
          : DURACAO_POMODORO_FOCO_SEGUNDOS;

  if (restanteSegundos > limiteDaFase) return null;

  return {
    modo,
    duracaoMinutos,
    estado: {
      modo,
      duracaoFocoMinutos,
      fase,
      restanteSegundos,
      executando,
      ciclosCompletos,
      iniciadoEm,
    },
  };
}

function ehRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null;
}

function ehModo(valor: unknown): valor is ModoDeEstudo {
  return valor === "pomodoro" || valor === "foco";
}

function ehDuracao(valor: unknown): valor is DuracaoDeFoco {
  return DURACOES_DE_FOCO.some((duracao) => duracao === valor);
}

function ehFase(
  valor: unknown,
): valor is EstadoDoCronometro["fase"] {
  return valor === "foco" || valor === "pausa" || valor === "concluido";
}

function mensagemDoCronometro(estado: EstadoDoCronometro): string {
  if (estado.fase === "concluido") {
    return "Tempo encerrado. Você pode recomeçar ou seguir para as questões.";
  }
  if (estado.fase === "pausa") {
    return estado.executando
      ? "Pausa em andamento. Volte quando o relógio chegar ao fim."
      : "O foco terminou. Inicie a pausa quando estiver pronto.";
  }
  return estado.executando
    ? "Mantenha o assunto à frente e avance no seu ritmo."
    : "O relógio está parado. Inicie quando estiver pronto.";
}
