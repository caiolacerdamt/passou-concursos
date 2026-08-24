import type { ReactNode } from "react";
import Link from "next/link";

import { sair } from "@/app/entrar/acoes";
import { exigirOperadorAtivo } from "@/modules/operador";

import estilos from "./operador.module.css";

export const dynamic = "force-dynamic";

/**
 * O layout e a primeira fronteira do painel: nenhuma pagina filha pode fazer
 * leitura antes de o operador ser conferido no servidor.
 *
 * O painel usa uma navegacao propria porque a mesa editorial nao e uma
 * extensao da experiencia do aluno. Ainda assim, a linguagem visual continua
 * usando os tokens globais do produto.
 */
export default async function OperadorLayout({ children }: { children: ReactNode }) {
  await exigirOperadorAtivo("abrir_painel");

  return (
    <div className="operador-shell app-ui min-h-dvh bg-fundo">
      <a
        href="#conteudo-operador"
        className="sr-only rounded-full bg-marca px-4 py-2 text-fundo focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-20"
      >
        Pular para o conteúdo da mesa
      </a>

      <header className="border-b border-verde/30 bg-verde text-papel-alto">
        <div className="mx-auto flex w-full max-w-painel flex-wrap items-center justify-between gap-x-6 gap-y-4 px-4 py-4 sm:px-6 lg:py-5">
          <div className="flex min-w-0 items-center gap-3">
            <span aria-hidden="true" className="operador-marca-linha h-10 w-1 shrink-0 rounded-full bg-papel-alto/80" />
            <div className="min-w-0">
              <p className="font-utilitaria text-[0.68rem] uppercase tracking-[0.2em] text-papel-alto/70">
                Passou Concursos · operação
              </p>
              <p className="mt-1 truncate font-display text-2xl leading-none tracking-tight sm:text-3xl">
                Mesa editorial
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs sm:gap-5 sm:text-sm">
              <span className="inline-flex items-center gap-2 font-utilitaria uppercase tracking-[0.12em] text-papel-alto/80">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-papel-alto" />
              registro vivo
            </span>
            <form action={sair}>
              <button
                type="submit"
                className="rounded-full border border-papel-alto/40 px-3.5 py-2 font-semibold text-papel-alto transition hover:border-papel-alto hover:bg-papel-alto/10"
              >
                Sair
              </button>
            </form>
          </div>
        </div>

        <nav
          aria-label="Áreas da mesa editorial"
          className="border-t border-papel-alto/15 bg-verde/95"
        >
          <div className="mx-auto flex w-full max-w-painel flex-wrap gap-2 px-4 py-3 sm:gap-3 sm:px-6">
            <Link className={estilos.navLink} href="/operador">
              Visão geral
            </Link>
            <Link className={estilos.navLink} href="/operador/fila">
              Fila de revisão
            </Link>
            <Link className={estilos.navLink} href="/operador/taxonomia">
              Taxonomia
            </Link>
            <Link className={estilos.navLink} href="/operador/configuracao">
              Configuração
            </Link>
          </div>
        </nav>
      </header>

      <main id="conteudo-operador" className="mx-auto w-full max-w-painel px-4 pb-14 pt-10 sm:px-6 sm:pt-14">
        {children}
      </main>

      <footer className="mx-auto w-full max-w-painel px-4 pb-8 sm:px-6">
        <p className="border-t border-linha pt-4 font-utilitaria text-[0.68rem] uppercase tracking-[0.14em] text-suave">
          Toda alteração exige autoria e motivo
        </p>
      </footer>
    </div>
  );
}
