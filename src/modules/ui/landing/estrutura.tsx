import Link from "next/link";
import type { ReactNode } from "react";

import { IconeSeta, Marca } from "./marca";

/**
 * Peças estruturais da landing: as que aparecem em mais de uma seção.
 *
 * `Faixa` existe para que o ritmo vertical seja decidido num lugar só. Cada
 * seção pedindo o próprio `py-` é como o espaçamento vira ruído.
 */

export function Faixa({
  children,
  id,
  rotulo,
  fundo,
  className,
}: {
  children: ReactNode;
  id?: string;
  rotulo?: string;
  fundo?: "papel" | "alto" | "recuo";
  className?: string;
}) {
  const superficie =
    fundo === "alto" ? "bg-papel-alto" : fundo === "recuo" ? "bg-papel-recuo" : "";

  return (
    <section
      id={id}
      aria-labelledby={rotulo}
      className={`${superficie} px-5 py-20 sm:px-8 sm:py-28 ${className ?? ""}`}
    >
      <div className="mx-auto w-full max-w-lp">{children}</div>
    </section>
  );
}

/*
 * O tom é uma prop e **não** uma classe passada por fora.
 *
 * Sobrescrever `bg-verde` mandando `bg-papel-alto` no `className` não funciona:
 * as duas utilidades têm a mesma especificidade, quem vence é a ordem na folha
 * de estilo, não a ordem no atributo. O botão da faixa verde saiu verde sobre
 * verde — invisível — até isto virar variante.
 */
const TONS = {
  verde: "bg-verde text-papel-alto hover:bg-verde-texto",
  claro: "bg-papel-alto text-verde hover:bg-verde-tenue",
} as const;

export function BotaoPrincipal({
  href,
  children,
  tom = "verde",
  className,
}: {
  href: string;
  children: ReactNode;
  tom?: keyof typeof TONS;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`group inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[0.9375rem] font-medium transition-colors ${TONS[tom]} ${className ?? ""}`}
    >
      {children}
      {/*
        A seta anda 2px no hover em vez de a cor piscar: o botão já é a coisa
        mais pesada da tela, e mudança de cor aqui lê como erro, não como alvo.
      */}
      <IconeSeta className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
    </Link>
  );
}

export function BotaoDiscreto({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-full border border-risco px-6 py-3.5 text-[0.9375rem] font-medium text-tinta transition-colors hover:border-tinta"
    >
      {children}
    </Link>
  );
}

export function Navegacao() {
  return (
    <header className="px-5 pt-5 sm:px-8 sm:pt-7">
      <nav
        aria-label="Principal"
        className="mx-auto flex w-full max-w-lp items-center gap-4 rounded-full bg-papel-alto py-2.5 pl-3.5 pr-2.5 shadow-[0_1px_2px_rgb(27_29_26/0.04),0_8px_24px_-12px_rgb(27_29_26/0.14)]"
      >
        <Link href="/" className="rounded-full">
          <Marca />
        </Link>

        <div className="ml-auto hidden items-center gap-1 sm:flex">
          <LinkDaNav href="#metodo">Método</LinkDaNav>
          <LinkDaNav href="#evidencias">Evidências</LinkDaNav>
          <LinkDaNav href="#precos">Preço</LinkDaNav>
          <LinkDaNav href="/entrar">Entrar</LinkDaNav>
        </div>

        <Link
          href="/checkout"
          className="ml-auto rounded-full bg-verde px-5 py-2.5 text-[0.875rem] font-medium text-papel-alto transition-colors hover:bg-verde-texto sm:ml-0"
        >
          Ver a oferta
        </Link>
      </nav>
    </header>
  );
}

function LinkDaNav({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-full px-3.5 py-2 text-[0.875rem] text-tinta-suave transition-colors hover:text-tinta"
    >
      {children}
    </Link>
  );
}

export function Rodape() {
  return (
    <footer className="border-t border-risco px-5 py-12 sm:px-8">
      <div className="mx-auto flex w-full max-w-lp flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Marca />
          <p className="mt-4 max-w-sm text-[0.875rem] leading-6 text-tinta-suave">
            Preparação para concursos da carreira bancária. Questões extraídas de provas
            oficiais, com banca, ano e número na etiqueta.
          </p>
        </div>

        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-[0.875rem]">
          <li>
            <Link href="/termos" className="text-tinta-suave underline underline-offset-4 hover:text-tinta">
              Termos de uso
            </Link>
          </li>
          <li>
            <Link href="/privacidade" className="text-tinta-suave underline underline-offset-4 hover:text-tinta">
              Política de privacidade
            </Link>
          </li>
          <li>
            <Link href="/entrar" className="text-tinta-suave underline underline-offset-4 hover:text-tinta">
              Entrar
            </Link>
          </li>
        </ul>
      </div>
    </footer>
  );
}
