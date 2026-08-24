import type { ReactNode } from "react";
import Link from "next/link";

import { sair } from "@/app/entrar/acoes";

type ItemDaNavegacao = {
  href: string;
  nome: string;
  descricao: string;
  atalho: string;
};

const ITENS_DE_ESTUDO: ItemDaNavegacao[] = [
  {
    href: "/app",
    nome: "Hoje",
    descricao: "O que estudar agora",
    atalho: "01",
  },
  {
    href: "/app/plano",
    nome: "Plano",
    descricao: "Ciclo do edital",
    atalho: "02",
  },
  {
    href: "/app/raio-x",
    nome: "Raio-X",
    descricao: "O que mais cai",
    atalho: "03",
  },
  {
    href: "/app/sessao",
    nome: "Questões e revisões",
    descricao: "Praticar e consolidar",
    atalho: "04",
  },
];

const ITENS_DE_ACOMPANHAMENTO: ItemDaNavegacao[] = [
  {
    href: "/app/progresso",
    nome: "Progresso",
    descricao: "Seu histórico de estudo",
    atalho: "05",
  },
];

const ITENS_DE_CONTA: ItemDaNavegacao[] = [
  {
    href: "/app/conta",
    nome: "Conta",
    descricao: "Privacidade e acesso",
    atalho: "06",
  },
  {
    href: "/app/reembolso",
    nome: "Reembolso",
    descricao: "Garantia do pagamento",
    atalho: "07",
  },
];

function Marca() {
  return (
    <Link
      href="/app"
      className="group inline-flex min-h-11 items-center gap-3 rounded-lg px-2 text-sm font-semibold tracking-tight text-texto"
    >
      <span
        aria-hidden="true"
        className="grid size-8 place-items-center rounded-lg bg-marca text-painel transition-transform duration-150 group-hover:rotate-3"
      >
        <svg viewBox="0 0 32 32" className="size-5" fill="none">
          <path
            d="m8 17.5 4.5 4.5L24 10.5"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span>Passou Concursos</span>
    </Link>
  );
}

function ItemDeNavegacao({ item, mobile = false }: { item: ItemDaNavegacao; mobile?: boolean }) {
  return (
    <Link
      href={item.href}
      className={
        mobile
          ? "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-linha bg-painel px-3 text-sm font-medium text-suave transition-colors duration-150 hover:border-marca/40 hover:bg-marca-suave hover:text-marca"
          : "group flex min-h-12 items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-sm text-suave transition-colors duration-150 hover:border-linha hover:bg-fundo-suave hover:text-marca"
      }
    >
      <span
        aria-hidden="true"
        className={
          mobile
            ? "font-utilitaria text-[0.68rem] text-marca"
            : "grid size-7 shrink-0 place-items-center rounded-md bg-fundo-suave font-utilitaria text-[0.68rem] text-marca group-hover:bg-marca-suave"
        }
      >
        {item.atalho}
      </span>
      <span className="min-w-0">
        <span className="block truncate">{item.nome}</span>
        {!mobile ? <span className="mt-0.5 block truncate text-xs text-suave/80">{item.descricao}</span> : null}
      </span>
    </Link>
  );
}

function GrupoDeNavegacao({ titulo, itens }: { titulo: string; itens: ItemDaNavegacao[] }) {
  return (
    <section aria-labelledby={`navegacao-${titulo.toLowerCase()}`}>
      <h2
        id={`navegacao-${titulo.toLowerCase()}`}
        className="px-3 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-suave"
      >
        {titulo}
      </h2>
      <div className="mt-2 grid gap-1">
        {itens.map((item) => (
          <ItemDeNavegacao key={item.href} item={item} />
        ))}
      </div>
    </section>
  );
}

function NavegacaoMobile() {
  return (
    <nav
      aria-label="Navegação principal no celular"
      className="app-mobile-nav flex gap-2 overflow-x-auto border-b border-linha bg-painel px-4 py-2.5 lg:hidden"
    >
      {[...ITENS_DE_ESTUDO, ...ITENS_DE_ACOMPANHAMENTO, ...ITENS_DE_CONTA].map((item) => (
        <ItemDeNavegacao key={item.href} item={item} mobile />
      ))}
    </nav>
  );
}

/**
 * Shell da superfície de estudo. A landing usa o Shell editorial; tudo em
 * `/app/*` passa por este layout, que mantém as tarefas e a conta acessíveis
 * sem depender de voltar ou de digitar outra rota.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-ui app-platform min-h-dvh" data-surface="app">
      <a
        href="#conteudo"
        className="sr-only rounded-md bg-marca px-4 py-2 text-fundo focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
      >
        Pular para o conteúdo
      </a>

      <div className="flex min-h-dvh">
        <aside className="hidden w-64 shrink-0 border-r border-linha bg-painel lg:flex lg:flex-col">
          <div className="px-5 pb-5 pt-6">
            <Marca />
            <p className="mt-4 px-2 text-xs leading-5 text-suave">
              Banco do Brasil · Agente Comercial
            </p>
          </div>

          <nav aria-label="Navegação principal" className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
            <GrupoDeNavegacao titulo="Estudar" itens={ITENS_DE_ESTUDO} />
            <GrupoDeNavegacao titulo="Acompanhar" itens={ITENS_DE_ACOMPANHAMENTO} />
            <GrupoDeNavegacao titulo="Conta" itens={ITENS_DE_CONTA} />
          </nav>

          <div className="border-t border-linha p-4">
            <form action={sair}>
              <button
                type="submit"
                className="flex min-h-10 w-full items-center rounded-lg px-3 text-left text-sm font-medium text-suave transition-colors duration-150 hover:bg-fundo-suave hover:text-marca"
              >
                Sair da conta
              </button>
            </form>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-linha bg-painel/95 px-4 py-3 backdrop-blur lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <Marca />
              <div className="flex items-center gap-2">
                <Link
                  href="/app/conta"
                  className="inline-flex min-h-10 items-center rounded-lg border border-linha px-3 text-sm font-medium text-marca"
                >
                  Conta
                </Link>
                <form action={sair}>
                  <button
                    type="submit"
                    className="inline-flex min-h-10 items-center rounded-lg border border-linha px-3 text-sm font-medium text-suave"
                  >
                    Sair
                  </button>
                </form>
              </div>
            </div>
          </header>

          <NavegacaoMobile />

          <main
            id="conteudo"
            className="mx-auto w-full max-w-painel px-4 pb-16 pt-8 sm:px-6 lg:px-8 lg:pt-10"
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

