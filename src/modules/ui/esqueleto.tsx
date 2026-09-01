import type { ReactNode } from "react";

/**
 * As primitivas do esqueleto de carregamento.
 *
 * Existem porque toda rota de `/app/*` é `force-dynamic`, e o Next só faz o
 * prefetch parcial (e a navegação imediata) de rota dinâmica quando há um
 * `loading.tsx`. Sem ele o clique não troca nada de tela até o servidor
 * terminar, e a navegação parece travada.
 *
 * Regra de desenho: o esqueleto **copia o esqueleto da tela real** — mesma
 * largura de coluna, mesma altura de cartão, mesma quantidade de blocos. Um
 * esqueleto genérico centralizado é pior que um spinner: ele mente sobre o que
 * vai aparecer e causa salto de layout quando o conteúdo chega.
 *
 * Nenhuma cor nova: `bg-linha` é o token de borda decorativa do `DESIGN.md`, e
 * nesta camada ele é preenchimento — nunca carrega texto.
 *
 * `motion-safe:` deixa o pulso de fora para quem pediu menos movimento no
 * sistema; a forma continua igual, só não pisca.
 */
export function Bloco({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block rounded-md bg-linha/60 motion-safe:animate-pulse ${className}`}
    />
  );
}

/** O cartão em repouso: a moldura real da tela, com linhas cegas dentro. */
export function CartaoEsqueleto({
  linhas = 3,
  className = "",
}: {
  linhas?: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-2xl border border-linha bg-painel px-6 pb-6 pt-5 ${className}`}
    >
      <Bloco className="h-2.5 w-24" />
      <div className="mt-4 grid gap-2.5">
        {Array.from({ length: linhas }, (_, indice) => (
          <Bloco
            key={indice}
            className={`h-3.5 ${indice === 0 ? "w-3/5" : indice === linhas - 1 ? "w-2/5" : "w-4/5"}`}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * O anúncio, uma vez por tela.
 *
 * Um `role="status"` por `loading.tsx` — se cada bloco tivesse o seu, o leitor
 * de tela repetiria "carregando" uma vez por retângulo. O `rotulo` é a única
 * coisa que ele lê, então diz o nome da tela, não "carregando".
 */
export function Carregando({
  rotulo,
  children,
}: {
  rotulo: string;
  children: ReactNode;
}) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{rotulo}</span>
      {children}
    </div>
  );
}

/** O cabeçalho editorial que abre quase toda tela de `/app`. */
export function CabecalhoEsqueleto({ comEtiqueta = true }: { comEtiqueta?: boolean }) {
  return (
    <div aria-hidden="true" className="max-w-3xl">
      {comEtiqueta ? <Bloco className="h-2.5 w-28" /> : null}
      <Bloco className="mt-3.5 h-9 w-4/5 max-w-[22rem]" />
      <Bloco className="mt-3.5 h-4 w-full max-w-[30rem]" />
    </div>
  );
}
