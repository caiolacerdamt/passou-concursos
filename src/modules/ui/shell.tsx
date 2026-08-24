import type { ReactNode } from "react";
import Link from "next/link";

/**
 * O shell de toda tela (UI-01 AC3, UI-03 AC4).
 *
 * Um so, reusado — o contrato da SPEC 07 diz que tela que monta o proprio
 * reprova. Ele resolve tres coisas que ninguem deveria reescrever:
 *
 *   1. o **link de pulo**, primeiro elemento focavel da pagina, que leva o
 *      teclado direto ao conteudo sem passar por todo o cabecalho;
 *   2. o `<main id="conteudo">`, que e o alvo desse link e o marco de "aqui
 *      comeca o conteudo" para leitor de tela;
 *   3. a **largura de leitura**, em `rem`, com o padding crescendo em `sm:` —
 *      nunca uma largura fixa em px, que e o que produz rolagem horizontal a
 *      360px (UI-01 AC1).
 */
export function Shell({
  children,
  acoes,
  largura = "leitura",
}: {
  children: ReactNode;
  /** Canto direito do cabecalho: entrar, sair, nome do aluno. */
  acoes?: ReactNode;
  /** A tela de estudo pode usar painel largo; leitura permanece o default. */
  largura?: "leitura" | "painel";
}) {
  const larguraClasse = largura === "painel" ? "max-w-painel" : "max-w-leitura";

  return (
    <div className="app-ui min-h-dvh">
      {/*
       * `sr-only focus:not-sr-only`: invisivel para quem usa mouse, aparece no
       * instante em que recebe foco. Precisa ser o primeiro do documento — um
       * link de pulo no meio da pagina nao pula nada.
       */}
      <a
        href="#conteudo"
        className="sr-only rounded-full bg-marca px-4 py-2 text-fundo focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
      >
        Pular para o conteúdo
      </a>

      <header className="sticky top-0 z-30 px-3 pt-3 sm:px-5">
        <div className={`mx-auto flex w-full ${larguraClasse} flex-wrap items-center gap-3 rounded-full border border-linha bg-painel/95 px-3 py-2.5 shadow-card backdrop-blur sm:px-4`}>
          <Link href="/" className="group inline-flex min-h-10 items-center gap-2 rounded-full px-2.5 text-sm font-semibold tracking-tight text-texto transition-colors hover:text-marca">
            <span aria-hidden="true" className="grid size-7 place-items-center rounded-[9px] bg-marca transition-transform group-hover:rotate-3">
              <svg viewBox="0 0 32 32" className="size-5" fill="none">
                <path d="M8 17.5l4.5 4.5L24 10.5" stroke="var(--color-painel)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span>Passou Concursos</span>
          </Link>
          <div className="app-actions ml-auto flex flex-wrap items-center justify-end gap-2 text-sm">
            {acoes}
          </div>
        </div>
      </header>

      <main id="conteudo" className={`mx-auto w-full ${larguraClasse} px-4 pb-14 pt-10 sm:px-6 sm:pt-14`}>
        {children}
      </main>
    </div>
  );
}
