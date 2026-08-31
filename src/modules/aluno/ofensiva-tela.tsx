import type { CSSProperties } from "react";

import type { SequenciaVigente } from "./gamificacao";

const PERIMETRO_DO_ANEL = 110;
const NUMERO_DE_SEGMENTOS = 7;
const PASSO_DO_SEGMENTO = PERIMETRO_DO_ANEL / NUMERO_DE_SEGMENTOS;
const ESPACO_ENTRE_SEGMENTOS = 6;
const COMPRIMENTO_DO_SEGMENTO = PASSO_DO_SEGMENTO - ESPACO_ENTRE_SEGMENTOS;

const ESTILOS_DA_OFENSIVA = `
@keyframes ofensiva-preenchimento {
  from { stroke-dasharray: 0 var(--ofensiva-perimetro); }
  to { stroke-dasharray: var(--ofensiva-segmento) var(--ofensiva-restante); }
}

@keyframes ofensiva-pulso {
  0%, 100% { opacity: 0.45; }
  50% { opacity: 1; }
}

.ofensiva-preenchimento {
  animation: ofensiva-preenchimento 600ms ease-out both;
}

.ofensiva-pulso {
  animation: ofensiva-pulso 2.4s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .ofensiva-preenchimento,
  .ofensiva-pulso {
    animation: none;
  }
}
`;

function segmentosPreenchidos(sequencia: number, estado: SequenciaVigente["estado"]): number {
  const resto = sequencia % NUMERO_DE_SEGMENTOS;
  if (estado === "cumprido" && sequencia > 0 && resto === 0) return NUMERO_DE_SEGMENTOS;
  if (estado === "cumprido" || estado === "piso_pendente") return resto;
  return 0;
}

function textoDaOfensiva(sequencia: SequenciaVigente): string {
  switch (sequencia.estado) {
    case "piso_pendente":
      return "Seu mínimo de hoje ainda está aberto";
    case "folga":
      return "Folga declarada. Hoje não conta contra você";
    case "fora_agenda":
      return "Hoje está fora da sua agenda. Sua sequência está guardada";
    case "plano_indisponivel":
      return "Plano em preparação";
    case "cumprido":
      if (sequencia.sequencia === 0) {
        return sequencia.temHistorico
          ? "Sua sequência recomeça hoje"
          : "Sua sequência começa no primeiro dia cumprido";
      }
      return sequencia.sequencia === 1 ? "1 dia" : `${sequencia.sequencia} dias seguidos`;
  }
}

function corDoAnel(sequencia: SequenciaVigente): string {
  if (sequencia.estado === "folga" || sequencia.estado === "fora_agenda") {
    return "text-linha opacity-60";
  }
  if (sequencia.estado === "plano_indisponivel") return "text-suave opacity-45";
  return "text-linha";
}

function segmentosDoAnel({ sequencia, preenchidos }: { sequencia: SequenciaVigente; preenchidos: number }) {
  const indicePendente = sequencia.estado === "piso_pendente"
    ? sequencia.sequencia % NUMERO_DE_SEGMENTOS
    : null;
  const indiceAnimado = sequencia.estado === "cumprido" && sequencia.sequencia > 0
    ? (sequencia.sequencia - 1) % NUMERO_DE_SEGMENTOS
    : null;

  return Array.from({ length: NUMERO_DE_SEGMENTOS }, (_, indice) => {
    const preenchido = indice < preenchidos;
    const pendente = indicePendente === indice;
    if (!preenchido && !pendente) return null;

    const animado = indiceAnimado === indice && preenchido;
    const estilo = animado
      ? ({
          "--ofensiva-perimetro": `${PERIMETRO_DO_ANEL}`,
          "--ofensiva-segmento": `${COMPRIMENTO_DO_SEGMENTO}`,
          "--ofensiva-restante": `${PERIMETRO_DO_ANEL - COMPRIMENTO_DO_SEGMENTO}`,
        } as CSSProperties)
      : undefined;

    return (
      <circle
        key={indice}
        cx="22"
        cy="22"
        r="17.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={`${COMPRIMENTO_DO_SEGMENTO} ${PERIMETRO_DO_ANEL - COMPRIMENTO_DO_SEGMENTO}`}
        strokeDashoffset={-(indice * PASSO_DO_SEGMENTO)}
        transform="rotate(-90 22 22)"
        className={`${pendente ? "text-aviso ofensiva-pulso" : "text-marca"}${animado ? " ofensiva-preenchimento" : ""}`}
        data-segmento-pulsando={pendente ? indice : undefined}
        style={estilo}
      />
    );
  });
}

export function Ofensiva({ sequencia }: { sequencia: SequenciaVigente | null }) {
  if (sequencia === null) return null;

  const preenchidos = segmentosPreenchidos(sequencia.sequencia, sequencia.estado);
  const voltasCompletas = Math.floor(sequencia.sequencia / NUMERO_DE_SEGMENTOS);
  const temPulso = sequencia.estado === "piso_pendente";
  const tracejado = sequencia.estado === "folga" || sequencia.estado === "fora_agenda";
  const texto = textoDaOfensiva(sequencia);

  return (
    <section
      aria-labelledby="titulo-ofensiva"
      className="mt-8 flex max-w-[33rem] items-center gap-5 rounded-2xl border border-linha bg-painel px-5 py-5 sm:gap-6"
      data-estado={sequencia.estado}
    >
      <div className="relative size-36 shrink-0">
        <svg
          viewBox="0 0 44 44"
          className="size-full"
          aria-hidden="true"
          data-segmentos-preenchidos={preenchidos}
          data-pulso={temPulso}
          data-traco={tracejado ? "tracejado" : "continuo"}
        >
          <circle
            cx="22"
            cy="22"
            r="17.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={`${COMPRIMENTO_DO_SEGMENTO} ${ESPACO_ENTRE_SEGMENTOS}`}
            transform="rotate(-90 22 22)"
            className={corDoAnel(sequencia)}
          />

          {voltasCompletas > 0 ? (
            <circle
              cx="22"
              cy="22"
              r="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeDasharray={PERIMETRO_DO_ANEL}
              transform="rotate(-90 22 22)"
              className={sequencia.estado === "cumprido" || sequencia.estado === "piso_pendente" ? "text-marca-apoio" : "text-linha"}
              data-voltas-completas={voltasCompletas}
            />
          ) : null}

          {segmentosDoAnel({ sequencia, preenchidos })}
        </svg>
        <span className="absolute inset-0 flex items-center justify-center font-utilitaria text-5xl font-bold leading-none tracking-[-0.08em]">
          {sequencia.sequencia}
        </span>
      </div>

      <div className="min-w-0">
        <p className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] text-marca-apoio">
          Sua ofensiva
        </p>
        <p id="titulo-ofensiva" className="mt-2 max-w-[28ch] text-base font-semibold leading-6">
          {texto}
        </p>
      </div>

      <style>{ESTILOS_DA_OFENSIVA}</style>
    </section>
  );
}
