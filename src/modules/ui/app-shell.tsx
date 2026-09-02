import type { ReactNode } from "react";
import { cookies } from "next/headers";

import { BarraLateral, COOKIE_DA_BARRA } from "./barra-lateral";
import { BarraDoCelular } from "./barra-do-celular";

/**
 * Shell da superfície de estudo. A landing usa o Shell editorial; tudo em
 * `/app/*` passa por este layout, que mantém as tarefas e a conta acessíveis
 * sem depender de voltar ou de digitar outra rota.
 *
 * A preferência de barra fechada vem de cookie e é lida **no servidor**: em
 * `localStorage` a barra nasceria expandida e colapsaria depois que o JS
 * rodasse, com piscada visível em todo carregamento.
 */
export async function AppShell({ children }: { children: ReactNode }) {
  const armazem = await cookies();
  const fechada = armazem.get(COOKIE_DA_BARRA)?.value === "fechada";

  return (
    <div className="app-ui app-platform min-h-dvh" data-surface="app">
      <a
        href="#conteudo"
        className="sr-only rounded-md bg-marca px-4 py-2 text-fundo focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
      >
        Pular para o conteúdo
      </a>

      <div className="flex min-h-dvh">
        <BarraLateral fechadaInicial={fechada} />

        <div className="min-w-0 flex-1">
          <main
            id="conteudo"
            className="mx-auto w-full max-w-painel px-4 pb-28 pt-16 sm:px-6 lg:px-14 lg:pb-20 lg:pt-11"
          >
            {children}
          </main>
        </div>
      </div>

      <BarraDoCelular />
    </div>
  );
}
