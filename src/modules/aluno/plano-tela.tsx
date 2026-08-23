import Link from "next/link";

import type { BlocoDoPlano, PlanoDoDia } from "./plano";

const TITULOS: Record<BlocoDoPlano["tipo"], string> = {
  revisar: "Revisar",
  avancar: "Avançar",
  treinar: "Treinar",
  simulado: "Simulado",
};

const DESCRICOES: Record<BlocoDoPlano["tipo"], string> = {
  revisar: "Revisão de um assunto que já entrou na sua memória.",
  avancar: "Um assunto novo para aumentar seu domínio.",
  treinar: "Questões misturadas para testar se o conhecimento se sustenta.",
  simulado: "Uma prova curta para medir seu ritmo.",
};

export function PlanoTela({ plano }: { plano: PlanoDoDia }) {
  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-marca">Seu estudo de hoje</p>
        <h1 className="mt-3 font-display text-4xl leading-tight tracking-tight sm:text-5xl">
          Clareza para começar. Controle para continuar.
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-suave">
          Faça primeiro o essencial. Se houver tempo, avance até a meta cheia.
        </p>
      </header>

      {plano.frase ? (
        <blockquote className="rounded-card border-l-4 border-marca bg-marca/10 px-5 py-4 text-lg leading-8 text-texto">
          {plano.frase}
        </blockquote>
      ) : null}

      <section className="grid gap-5 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]" aria-label="Níveis do plano">
        <div className="rounded-card border border-linha bg-painel p-5 shadow-card sm:p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-evolucao">O mínimo que mantém o ritmo</p>
          <h2 className="mt-2 text-2xl font-semibold">Piso</h2>
          <p className="mt-2 text-sm leading-6 text-suave">
            Revisões devidas. Cumprir este bloco já protege o que você conquistou.
          </p>
          <div className="mt-5">
            {plano.piso.length > 0 ? (
              <ul className="space-y-2" aria-label="Blocos do piso">
                {plano.piso.map((bloco) => (
                  <li key={bloco.id}>
                    <BlocoCard bloco={bloco} compacto />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg bg-fundo-suave px-3 py-3 text-sm text-suave">
                Nenhuma revisão vencida hoje.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-card border border-linha bg-painel p-5 shadow-card sm:p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-marca">O dia inteiro de estudo</p>
          <h2 className="mt-2 text-2xl font-semibold">Meta cheia</h2>
          <p className="mt-2 text-sm leading-6 text-suave">
            Revisar, avançar e treinar dentro do tempo que você declarou.
          </p>
          <div className="mt-5">
            {plano.metaCheia.length > 0 ? (
              <ul className="grid gap-3 sm:grid-cols-2" aria-label="Blocos da meta cheia">
                {plano.metaCheia.map((bloco) => (
                  <li key={bloco.id}>
                    <BlocoCard bloco={bloco} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg bg-fundo-suave px-3 py-3 text-sm text-suave">
                O acervo ainda está preparando seu primeiro bloco.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function BlocoCard({ bloco, compacto = false }: { bloco: BlocoDoPlano; compacto?: boolean }) {
  return (
    <div className={`rounded-lg border border-linha bg-fundo-suave ${compacto ? "p-3" : "p-4"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-marca">{TITULOS[bloco.tipo]}</p>
          <h3 className="mt-1 truncate font-semibold">
            {bloco.topicoId ? "Bloco focado no assunto" : "Assuntos misturados"}
          </h3>
        </div>
        <span className="shrink-0 font-utilitaria text-xs text-suave">{bloco.minutosEstimados} min</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-suave">{bloco.motivo ?? DESCRICOES[bloco.tipo]}</p>
      <Link
        href={`/app/sessao?bloco=${encodeURIComponent(bloco.id)}`}
        className="mt-4 inline-flex rounded-lg border border-marca px-3 py-2 text-sm font-semibold text-marca transition hover:bg-marca hover:text-white"
      >
        Começar bloco
      </Link>
    </div>
  );
}
