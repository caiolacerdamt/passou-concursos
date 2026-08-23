import type { ReactNode } from "react";

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
    <div className="min-h-dvh">
      {/*
       * `sr-only focus:not-sr-only`: invisivel para quem usa mouse, aparece no
       * instante em que recebe foco. Precisa ser o primeiro do documento — um
       * link de pulo no meio da pagina nao pula nada.
       */}
      <a
        href="#conteudo"
        className="sr-only rounded bg-marca px-4 py-2 text-fundo focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
      >
        Pular para o conteúdo
      </a>

      <header className="border-b border-linha bg-painel/90">
        <div className={`mx-auto flex w-full ${larguraClasse} flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6`}>
          <span className="font-semibold">Passou Concursos</span>
          {acoes}
        </div>
      </header>

      <main id="conteudo" className={`mx-auto w-full ${larguraClasse} px-4 py-6 sm:px-6`}>
        {children}
      </main>
    </div>
  );
}
