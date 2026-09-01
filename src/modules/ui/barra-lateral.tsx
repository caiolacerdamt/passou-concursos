"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { sair } from "@/app/entrar/acoes";

import { PontoDeCarga } from "./ponto-de-carga";

import {
  ITENS_DE_ACOMPANHAMENTO,
  ITENS_DE_CONTA,
  ITENS_DE_ESTUDO,
  IconeDeMarca,
  IconeDeSair,
  type ItemDaNavegacao,
} from "./navegacao";

/** Um ano: a preferência de barra é do aluno, não da sessão do navegador. */
const VIDA_DO_COOKIE = 60 * 60 * 24 * 365;

export const COOKIE_DA_BARRA = "barra-lateral";

/**
 * Casa a rota com o item. Prefixo puro marcaria `/app` como ativo em todas as
 * telas, porque toda rota do aluno começa por ele.
 */
function estaAtivo(caminho: string, href: string): boolean {
  if (href === "/app") return caminho === "/app";
  return caminho === href || caminho.startsWith(`${href}/`);
}

function Item({ item, ativo }: { item: ItemDaNavegacao; ativo: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={ativo ? "page" : undefined}
      className={`group relative flex min-h-11 items-center gap-3 rounded-[10px] py-2 pl-3.5 pr-3 text-sm transition-colors duration-150 ${
        ativo
          ? "bg-breu-alto text-breu-tinta"
          : "text-breu-suave hover:bg-breu-alto hover:text-breu-tinta"
      }`}
    >
      {ativo ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-2.5 left-0 w-[0.1875rem] rounded-r-[3px] bg-breu-verde"
        />
      ) : null}
      {item.icone}
      <span className="min-w-0 truncate">{item.nome}</span>
      <PontoDeCarga className="ml-auto" />
    </Link>
  );
}

function Grupo({
  titulo,
  itens,
  caminho,
}: {
  titulo: string;
  itens: ItemDaNavegacao[];
  caminho: string;
}) {
  return (
    <section aria-labelledby={`grupo-${titulo.toLowerCase()}`}>
      <h2
        id={`grupo-${titulo.toLowerCase()}`}
        className="mb-2 px-3.5 font-utilitaria text-[0.625rem] uppercase tracking-[0.18em] text-breu-suave/70"
      >
        {titulo}
      </h2>
      <div className="grid gap-0.5">
        {itens.map((item) => (
          <Item key={item.href} item={item} ativo={estaAtivo(caminho, item.href)} />
        ))}
      </div>
    </section>
  );
}

/**
 * O botão do rail fechado.
 *
 * O nome não vive dentro do botão: ele é uma peça irmã em `left-full` que só
 * aparece no hover e no foco. Fosse largura animada dentro da pílula, o rail
 * inteiro mudaria de tamanho a cada passada de mouse e empurraria o conteúdo.
 * Assim só o item sob o ponteiro cresce, e a pílula fica parada.
 */
function BotaoDoRail({ item, ativo }: { item: ItemDaNavegacao; ativo: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={ativo ? "page" : undefined}
      className={`group relative grid size-11 place-items-center rounded-[13px] transition-colors duration-150 ${
        ativo
          ? "bg-breu-verde text-breu"
          : "text-breu-suave hover:bg-breu-alto hover:text-breu-tinta"
      }`}
    >
      {item.icone}
      <PontoDeCarga className="absolute bottom-1 right-1" />
      <span
        className="pointer-events-none absolute left-full z-10 ml-1.5 hidden whitespace-nowrap rounded-[13px] bg-breu-alto px-4 py-2.5 text-sm text-breu-tinta shadow-[0_18px_36px_-20px_rgb(27_29_26/0.7)] group-hover:block group-focus-visible:block"
      >
        {item.nome}
      </span>
    </Link>
  );
}

export function BarraLateral({ fechadaInicial }: { fechadaInicial: boolean }) {
  const [fechada, setFechada] = useState(fechadaInicial);
  const caminho = usePathname();

  function alternar() {
    const proxima = !fechada;
    setFechada(proxima);
    document.cookie = `${COOKIE_DA_BARRA}=${
      proxima ? "fechada" : "aberta"
    }; path=/; max-age=${VIDA_DO_COOKIE}; samesite=lax`;
  }

  const rotulo = fechada ? "Expandir a barra de navegação" : "Fechar a barra de navegação";

  if (fechada) {
    return (
      <aside className="hidden w-23 shrink-0 lg:block">
        <div className="sticky top-0 flex h-dvh items-center justify-center">
          <nav
            aria-label="Navegação principal"
            className="flex flex-col items-center gap-1.5 rounded-[22px] bg-breu px-2.5 py-3 shadow-[0_2px_4px_rgb(27_29_26/0.08),0_28px_56px_-22px_rgb(27_29_26/0.5)]"
          >
            <button
              type="button"
              onClick={alternar}
              aria-label={rotulo}
              aria-expanded={false}
              className="grid size-11 place-items-center rounded-[13px] text-breu-suave transition-colors duration-150 hover:bg-breu-alto hover:text-breu-tinta"
            >
              <svg
                viewBox="0 0 24 24"
                className="size-[1.125rem]"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9.5 7 14.5 12l-5 5" />
                <path d="M19.5 5v14" />
              </svg>
            </button>

            <span aria-hidden="true" className="my-1.5 h-px w-6 bg-breu-linha" />

            {[...ITENS_DE_ESTUDO, ...ITENS_DE_ACOMPANHAMENTO].map((item) => (
              <BotaoDoRail key={item.href} item={item} ativo={estaAtivo(caminho, item.href)} />
            ))}

            <span aria-hidden="true" className="my-1.5 h-px w-6 bg-breu-linha" />

            {ITENS_DE_CONTA.map((item) => (
              <BotaoDoRail key={item.href} item={item} ativo={estaAtivo(caminho, item.href)} />
            ))}

            <form action={sair}>
              <button
                type="submit"
                aria-label="Sair da conta"
                className="group relative grid size-11 place-items-center rounded-[13px] text-breu-suave transition-colors duration-150 hover:bg-breu-alto hover:text-breu-tinta"
              >
                {IconeDeSair}
                <span className="pointer-events-none absolute left-full z-10 ml-1.5 hidden whitespace-nowrap rounded-[13px] bg-breu-alto px-4 py-2.5 text-sm text-breu-tinta shadow-[0_18px_36px_-20px_rgb(27_29_26/0.7)] group-hover:block group-focus-visible:block">
                  Sair da conta
                </span>
              </button>
            </form>
          </nav>
        </div>
      </aside>
    );
  }

  return (
    <aside className="hidden w-67 shrink-0 lg:block">
      <div className="sticky top-0 flex h-dvh flex-col gap-7 bg-breu px-3.5 pb-4.5 pt-6">
        <div className="flex items-center justify-between gap-2.5 pl-2.5">
          <Link
            href="/app"
            className="inline-flex items-center gap-2.5 text-[0.9375rem] font-medium tracking-[-0.02em] text-breu-tinta"
          >
            <span
              aria-hidden="true"
              className="grid size-7.5 place-items-center rounded-[9px] bg-breu-verde text-breu"
            >
              {IconeDeMarca}
            </span>
            Passou
          </Link>
          <button
            type="button"
            onClick={alternar}
            aria-label={rotulo}
            aria-expanded
            className="grid size-8 place-items-center rounded-[9px] border border-breu-linha text-breu-suave transition-colors duration-150 hover:bg-breu-alto hover:text-breu-tinta"
          >
            <svg
              viewBox="0 0 24 24"
              className="size-[1.0625rem]"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M14.5 7 9.5 12l5 5" />
              <path d="M4.5 5v14" />
            </svg>
          </button>
        </div>

        <div className="px-3.5">
          <p className="font-utilitaria text-[0.625rem] uppercase tracking-[0.18em] text-breu-suave/70">
            Concurso
          </p>
          <p className="mt-1.5 text-sm leading-snug text-breu-tinta">Banco do Brasil</p>
          <p className="text-[0.8125rem] leading-snug text-breu-suave">Agente Comercial</p>
        </div>

        <nav aria-label="Navegação principal" className="flex flex-col gap-6 overflow-y-auto">
          <Grupo titulo="Estudar" itens={ITENS_DE_ESTUDO} caminho={caminho} />
          <Grupo titulo="Acompanhar" itens={ITENS_DE_ACOMPANHAMENTO} caminho={caminho} />
        </nav>

        <div className="mt-auto grid gap-0.5 border-t border-breu-linha pt-4">
          {ITENS_DE_CONTA.map((item) => (
            <Item key={item.href} item={item} ativo={estaAtivo(caminho, item.href)} />
          ))}
          <form action={sair} className="mt-1.5">
            <button
              type="submit"
              className="flex min-h-11 w-full items-center gap-3 rounded-[10px] py-2 pl-3.5 pr-3 text-left text-sm text-breu-suave transition-colors duration-150 hover:bg-breu-alto hover:text-breu-tinta"
            >
              {IconeDeSair}
              Sair da conta
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
