"use client";

import { useState } from "react";

import type { RecursoDeEstudoComVisto } from "@/modules/acervo/recursos";

import { desmarcarRecursoComoVisto, marcarRecursoComoVisto } from "./acoes";

const NOMES_DOS_RECURSOS: Record<RecursoDeEstudoComVisto["tipo"], string> = {
  video: "Vídeo",
  artigo: "Artigo",
  pdf: "PDF",
};

export function RecursosChecklist({
  recursos,
}: {
  recursos: readonly RecursoDeEstudoComVisto[];
}) {
  const [vistos, setVistos] = useState<Set<string>>(
    () => new Set(recursos.filter((recurso) => recurso.visto).map((recurso) => recurso.id)),
  );
  const [recursoPendente, setRecursoPendente] = useState<string | null>(null);
  const [mensagemDeErro, setMensagemDeErro] = useState<string | null>(null);
  const [principal, ...alternativas] = recursos;

  function alternar(recursoId: string, proximoEstado: boolean) {
    const estadoAnterior = vistos.has(recursoId);
    setVistos((atual) => atualizarVistos(atual, recursoId, proximoEstado));
    setMensagemDeErro(null);
    setRecursoPendente(recursoId);

    void (async () => {
      try {
        const resultado = proximoEstado
          ? await marcarRecursoComoVisto(recursoId)
          : await desmarcarRecursoComoVisto(recursoId);
        if (!resultado.ok) {
          setVistos((atual) => atualizarVistos(atual, recursoId, estadoAnterior));
          setMensagemDeErro(resultado.mensagem);
        }
      } catch {
        setVistos((atual) => atualizarVistos(atual, recursoId, estadoAnterior));
        setMensagemDeErro("Não conseguimos salvar esta marca. Tente novamente.");
      } finally {
        setRecursoPendente(null);
      }
    })();
  }

  return (
    <div className="mt-5.5" aria-busy={recursoPendente !== null}>
      <p className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] text-suave">
        Recurso principal
      </p>
      <RecursoCard
        recurso={principal}
        principal
        visto={vistos.has(principal.id)}
        desabilitado={recursoPendente !== null}
        aoAlternar={alternar}
      />

      {alternativas.length > 0 ? (
        <>
          <p className="mt-5.5 font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] text-suave">
            Outras fontes curadas
          </p>
          <ul className="mt-2.5 grid gap-2">
            {alternativas.map((recurso) => (
              <li key={recurso.id}>
                <RecursoCard
                  recurso={recurso}
                  visto={vistos.has(recurso.id)}
                  desabilitado={recursoPendente !== null}
                  aoAlternar={alternar}
                />
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {mensagemDeErro ? (
        <p className="mt-3 text-sm leading-6 text-erro" role="alert">
          {mensagemDeErro}
        </p>
      ) : null}
    </div>
  );
}

function RecursoCard({
  recurso,
  principal = false,
  visto,
  desabilitado,
  aoAlternar,
}: {
  recurso: RecursoDeEstudoComVisto;
  principal?: boolean;
  visto: boolean;
  desabilitado: boolean;
  aoAlternar: (recursoId: string, proximoEstado: boolean) => void;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl border px-5 ${
        principal
          ? "mt-2.5 min-h-19 border-marca/40 bg-marca-suave py-3.5"
          : "min-h-16 border-linha bg-painel py-3"
      }`}
    >
      <a
        href={recurso.url}
        target="_blank"
        rel="noopener noreferrer"
        referrerPolicy="no-referrer"
        className="flex min-w-0 flex-1 items-center justify-between gap-4 no-underline motion-safe:transition-colors motion-reduce:transition-none hover:text-marca"
      >
        <span className="min-w-0">
          <span
            className={`block font-semibold text-texto ${principal ? "text-base" : "text-[0.9375rem]"}`}
          >
            {recurso.titulo}
          </span>
          <span className="mt-1 block font-utilitaria text-[0.8125rem] text-suave">
            {NOMES_DOS_RECURSOS[recurso.tipo]} · {recurso.duracaoMinutos} min · {dominio(recurso.url)}
          </span>
        </span>
        <span
          aria-hidden="true"
          className={
            principal
              ? "grid size-9 shrink-0 place-items-center rounded-full bg-marca text-painel"
              : "shrink-0 text-marca"
          }
        >
          <svg
            viewBox="0 0 24 24"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={principal ? "2" : "1.8"}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M7 17 17 7m0 0h-7m7 0v7" />
          </svg>
        </span>
      </a>

      <label className="flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-linha bg-painel px-2.5 py-2 text-[0.75rem] font-semibold text-suave has-[:checked]:border-marca/40 has-[:checked]:bg-marca-suave has-[:checked]:text-marca has-[:disabled]:cursor-wait has-[:disabled]:opacity-60">
        <input
          type="checkbox"
          checked={visto}
          disabled={desabilitado}
          onChange={(evento) => aoAlternar(recurso.id, evento.currentTarget.checked)}
          className="size-4 accent-marca"
          aria-label={`Marcar ${recurso.titulo} como visto`}
        />
        Já vi
      </label>
    </div>
  );
}

function atualizarVistos(atual: Set<string>, recursoId: string, visto: boolean): Set<string> {
  const proximo = new Set(atual);
  if (visto) proximo.add(recursoId);
  else proximo.delete(recursoId);
  return proximo;
}

function dominio(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
