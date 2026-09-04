import type { ReactNode } from "react";
import Link from "next/link";

import { Marca } from "./marca";

/**
 * A moldura das telas de acesso (`/entrar`, `/recuperar-senha`).
 *
 * **Não é o `Shell`, e isso é deliberado.** UI-01 AC3 exige um shell só reusado
 * por toda **tela logada** — estas duas não são. O que elas são é o corredor
 * entre a landing e o app, e por isso vestem a matéria da landing (`DESIGN.md`,
 * modo Persuade): papel quente, breu racionado a um bloco, verde só em ação.
 *
 * A barra de navegação do `Shell` saiu junto. Numa tela de login ela só oferece
 * saída; ficou a marca, que é âncora, e um link de volta para o site.
 *
 * O que ela continua garantindo, porque UI-03 AC4 vale em toda rota:
 *
 *   1. o **link de pulo** como primeiro focável do documento;
 *   2. o `<main id="conteudo">` que é o alvo dele.
 *
 * Mobile-first (UI-01 AC2): a base empilha — faixa escura curta em cima,
 * formulário embaixo — e só em `lg:` as duas viram colunas lado a lado.
 */
export function MolduraDeAcesso({
  titulo,
  lede,
  children,
}: {
  /** A frase-âncora do painel escuro. Curta: ela compete com o formulário. */
  titulo: string;
  lede: string;
  children: ReactNode;
}) {
  return (
    <div className="acesso min-h-dvh bg-papel text-tinta">
      {/*
       * `sr-only focus:not-sr-only`: invisível para quem usa mouse, aparece no
       * instante em que recebe foco. Precisa ser o primeiro do documento — um
       * link de pulo no meio da página não pula nada.
       */}
      <a
        href="#conteudo"
        className="sr-only rounded-pill bg-verde px-4 py-2 text-papel-alto focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
      >
        Pular para o conteúdo
      </a>

      <div className="lg:grid lg:min-h-dvh lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
        <aside className="relative isolate overflow-hidden bg-breu px-6 py-7 text-breu-tinta sm:px-10 lg:flex lg:flex-col lg:px-14 lg:py-13">
          <div className="relative z-10 flex items-center justify-between gap-4">
            <Marca tom="escuro" />
            <Link
              href="/"
              className="text-sm text-breu-suave no-underline transition-colors hover:text-breu-tinta lg:hidden"
            >
              Voltar ao site
            </Link>
          </div>

          <div className="relative z-10 mt-7 lg:mt-0 lg:flex lg:grow lg:items-center">
            <div>
              <h2 className="max-w-[13ch] text-[1.75rem] leading-[1.08] font-medium tracking-[-0.03em] text-balance lg:text-5xl lg:leading-[1.06] lg:tracking-[-0.034em]">
                {titulo}
              </h2>
              <p className="mt-3 max-w-[34ch] leading-relaxed text-breu-suave lg:mt-6 lg:text-[1.1875rem] lg:leading-[1.5] lg:tracking-[-0.012em]">
                {lede}
              </p>
            </div>
          </div>

          <PilhaDePapel />
        </aside>

        <main
          id="conteudo"
          className="flex flex-col px-6 py-9 sm:px-10 lg:px-14 lg:py-8"
        >
          <div className="hidden justify-end lg:flex">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-[0.9375rem] text-tinta-suave no-underline transition-colors hover:text-tinta"
            >
              <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden="true">
                <path
                  d="M12 5l-5 5 5 5"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Voltar para o site
            </Link>
          </div>

          <div className="mx-auto flex w-full max-w-[25rem] grow flex-col justify-center py-2">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

/**
 * O motivo da pilha: réguas de papel empilhadas, chapadas, uma delas verde.
 *
 * É o mesmo gesto do movimento assinatura da landing reduzido a um adorno
 * parado — e é chapado de propósito: `DESIGN.md` §Anti-slop proíbe gradiente e
 * halo. Puramente decorativo, então `aria-hidden`.
 */
function PilhaDePapel() {
  const larguras = ["55%", "75%", "42%", "65%", "50%", "80%", "37%"];

  return (
    <div
      aria-hidden="true"
      /*
       * Só a partir de `lg`. No celular a faixa escura é uma tira curta e a
       * lede ocupa ela inteira — o adorno passaria por baixo do texto, e
       * adorno que atrapalha leitura não é adorno.
       */
      className="pointer-events-none absolute -right-16 bottom-12 z-0 hidden w-80 flex-col items-end gap-2.5 opacity-55 lg:flex"
    >
      {larguras.map((largura, indice) => (
        <span
          key={largura + indice}
          style={{ width: largura }}
          className={`block h-1 rounded-full ${
            indice === 2 ? "bg-verde-vivo" : "bg-breu-linha"
          }`}
        />
      ))}
    </div>
  );
}
