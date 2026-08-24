"use client";

import { useEffect, useState } from "react";

import {
  alternarCronometro,
  avancarCronometro,
  criarEstadoDoCronometro,
  DURACOES_DE_FOCO,
  formatarTempoCronometro,
  reiniciarCronometro,
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
  pomodoro: "Pomodoro · foco de 25 min + pausa de 5 min",
  foco: "Foco contínuo",
};

export function CronometroDeEstudo() {
  const [modo, setModo] = useState<ModoDeEstudo>("pomodoro");
  const [duracao, setDuracao] = useState<DuracaoDeFoco>(30);
  const [estado, setEstado] = useState<EstadoDoCronometro>(() =>
    criarEstadoDoCronometro({ modo: "pomodoro" }),
  );

  useEffect(() => {
    if (!estado.executando) return undefined;

    const relogio = window.setInterval(() => {
      setEstado((atual) => avancarCronometro(atual, 1));
    }, 1_000);

    return () => window.clearInterval(relogio);
  }, [estado.executando]);

  const configuracaoAtual: ConfiguracaoDoCronometro =
    modo === "pomodoro" ? { modo } : { modo, duracaoMinutos: duracao };

  function selecionarModo(novoModo: ModoDeEstudo) {
    setModo(novoModo);
    setEstado(
      criarEstadoDoCronometro(
        novoModo === "pomodoro"
          ? { modo: novoModo }
          : { modo: novoModo, duracaoMinutos: duracao },
      ),
    );
  }

  function selecionarDuracao(novaDuracao: DuracaoDeFoco) {
    setDuracao(novaDuracao);
    setEstado(reiniciarCronometro({ modo: "foco", duracaoMinutos: novaDuracao }));
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
    setEstado(alternarCronometro(estado));
  }

  return (
    <section
      className="rounded-card border border-linha bg-painel p-5 shadow-card sm:p-6"
      aria-labelledby="titulo-tecnica"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-evolucao">
            Técnica de estudo
          </p>
          <h2 id="titulo-tecnica" className="mt-2 font-display text-3xl leading-tight">
            Escolha como conduzir este bloco
          </h2>
        </div>
        <span className="rounded-full bg-fundo-suave px-3 py-1 text-xs font-semibold text-evolucao">
          {estado.ciclosCompletos > 0
            ? `${estado.ciclosCompletos} ${estado.ciclosCompletos === 1 ? "ciclo" : "ciclos"} concluído${estado.ciclosCompletos === 1 ? "" : "s"}`
            : "Relógio local"}
        </span>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <label className="grid gap-1 text-sm font-semibold" htmlFor="modo-estudo">
          Técnica
          <select
            id="modo-estudo"
            value={modo}
            onChange={(evento) => selecionarModo(evento.target.value as ModoDeEstudo)}
            className="mt-1 min-h-11 rounded-lg border border-linha bg-fundo px-3 font-normal text-texto"
          >
            <option value="pomodoro">{ROTULOS_DO_MODO.pomodoro}</option>
            <option value="foco">{ROTULOS_DO_MODO.foco}</option>
          </select>
        </label>

        {modo === "foco" ? (
          <label className="grid gap-1 text-sm font-semibold" htmlFor="duracao-foco">
            Duração do foco
            <select
              id="duracao-foco"
              value={duracao}
              onChange={(evento) => selecionarDuracao(Number(evento.target.value) as DuracaoDeFoco)}
              className="mt-1 min-h-11 rounded-lg border border-linha bg-fundo px-3 font-normal text-texto"
            >
              {DURACOES_DE_FOCO.map((minutos) => (
                <option key={minutos} value={minutos}>{minutos} minutos</option>
              ))}
            </select>
          </label>
        ) : (
          <p className="rounded-lg border border-marca/20 bg-marca-suave px-4 py-3 text-sm leading-6 text-suave">
            O Pomodoro conduz 25 minutos de foco e, ao terminar, oferece uma pausa de 5 minutos.
          </p>
        )}
      </div>

      <div className="mt-6 flex flex-col items-center rounded-lg border border-linha bg-fundo-suave px-4 py-6 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-suave" aria-live="polite">
          {ROTULOS_DA_FASE[estado.fase]}
        </p>
        <p
          className="mt-2 font-utilitaria text-6xl font-bold tracking-tight text-texto motion-reduce:transition-none"
          role="timer"
          aria-label={`${ROTULOS_DA_FASE[estado.fase]}: ${formatarTempoCronometro(estado.restanteSegundos)}`}
        >
          {formatarTempoCronometro(estado.restanteSegundos)}
        </p>
        <p className="mt-2 max-w-md text-sm leading-6 text-suave" aria-live="polite">
          {mensagemDoCronometro(estado)}
        </p>
        <div className="mt-5 flex w-full flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={acionarPrincipal}
            className="min-h-11 rounded-full bg-marca px-5 py-3 font-semibold text-white motion-safe:transition-colors motion-reduce:transition-none hover:bg-marca-apoio"
          >
            {botaoPrincipal}
          </button>
          <button
            type="button"
            onClick={() => setEstado(reiniciarCronometro(configuracaoAtual))}
            className="min-h-11 rounded-full border border-marca px-5 py-3 font-semibold text-marca motion-safe:transition-colors motion-reduce:transition-none hover:bg-marca hover:text-white"
          >
            Reiniciar
          </button>
        </div>
      </div>

      <p className="mt-4 text-center text-xs leading-5 text-suave">
        Este relógio fica no seu dispositivo. Ele não conclui o bloco nem grava progresso sozinho.
      </p>
    </section>
  );
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
