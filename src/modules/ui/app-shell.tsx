import type { ReactNode } from "react";
import { cookies } from "next/headers";

import { BarraLateral, COOKIE_DA_BARRA } from "./barra-lateral";
import { BarraDoCelular } from "./barra-do-celular";
import { EspelhoDoTema } from "./espelho-do-tema";
import { TEMA_PADRAO, type Tema } from "./tema";

/**
 * Shell da superfície de estudo. A landing usa o Shell editorial; tudo em
 * `/app/*` passa por este layout, que mantém as tarefas e a conta acessíveis
 * sem depender de voltar ou de digitar outra rota.
 *
 * A preferência de barra fechada vem de cookie e é lida **no servidor**: em
 * `localStorage` a barra nasceria expandida e colapsaria depois que o JS
 * rodasse, com piscada visível em todo carregamento.
 */
export async function AppShell({
  children,
  faixa = null,
  tema = TEMA_PADRAO,
}: {
  children: ReactNode;
  /**
   * Uma faixa de aviso acima do conteúdo, montada pela rota. O shell não sabe
   * o que ela diz nem consulta banco por ela: quem sabe do trial é
   * `src/app/app/layout.tsx`, e o shell continua sendo só a moldura.
   */
  faixa?: ReactNode;
  /**
   * O tema da superfície logada (AD-149). Chega resolvido de
   * `src/app/app/layout.tsx` — cookie, senão `perfil_estudo.tema`, senão
   * `sistema` — e sai no HTML do servidor pelo mesmo motivo da barra fechada:
   * atributo decidido no cliente pinta a tela de bege primeiro e escuro depois,
   * com piscada visível em todo carregamento.
   */
  tema?: Tema;
}) {
  const armazem = await cookies();
  const fechada = armazem.get(COOKIE_DA_BARRA)?.value === "fechada";

  return (
    <div className="app-ui app-platform min-h-dvh" data-surface="app" data-tema={tema}>
      <EspelhoDoTema tema={tema} />

      <a
        href="#conteudo"
        className="sr-only rounded-md bg-marca px-4 py-2 text-fundo focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
      >
        Pular para o conteúdo
      </a>

      <div className="flex min-h-dvh">
        <BarraLateral fechadaInicial={fechada} />

        <div className="min-w-0 flex-1">
          {faixa}
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
