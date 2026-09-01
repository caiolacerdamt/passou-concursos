"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { sair } from "@/app/entrar/acoes";

import { PontoDeCarga } from "./ponto-de-carga";

import {
  ITENS_DE_ACOMPANHAMENTO,
  ITENS_DE_CONTA,
  ITENS_DE_ESTUDO,
  IconeDeMarca,
} from "./navegacao";

const ABAS = [...ITENS_DE_ESTUDO, ...ITENS_DE_ACOMPANHAMENTO];

function estaAtivo(caminho: string, href: string): boolean {
  if (href === "/app") return caminho === "/app";
  return caminho === href || caminho.startsWith(`${href}/`);
}

/**
 * A navegação do celular, em duas peças.
 *
 * Embaixo, a mesma pílula escura do rail, deitada: são as cinco superfícies de
 * estudo, no alcance do polegar. Em cima, o que não é tarefa diária — conta,
 * reembolso e sair. Separar assim é o que evita uma barra de sete abas em que
 * nenhuma cabe.
 *
 * Nenhuma das duas desenha status bar nem teclado falso: no aparelho o sistema
 * pinta isso por cima, e um desenho nosso apareceria dobrado.
 */
export function BarraDoCelular() {
  const caminho = usePathname();

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-30 flex items-center justify-between gap-3 border-b border-linha bg-painel px-4 py-3 lg:hidden">
        <Link
          href="/app"
          className="inline-flex items-center gap-2.5 text-sm font-medium tracking-[-0.02em] text-texto"
        >
          <span
            aria-hidden="true"
            className="grid size-7 place-items-center rounded-lg bg-marca text-painel"
          >
            {IconeDeMarca}
          </span>
          Passou
        </Link>

        <nav aria-label="Conta" className="flex items-center gap-1">
          {ITENS_DE_CONTA.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={estaAtivo(caminho, item.href) ? "page" : undefined}
              className="inline-flex min-h-10 items-center rounded-full px-3 text-[0.8125rem] font-medium text-suave transition-colors duration-150 hover:bg-marca-suave hover:text-marca"
            >
              {item.nome}
            </Link>
          ))}
          <form action={sair}>
            <button
              type="submit"
              className="inline-flex min-h-10 items-center rounded-full border border-linha px-3 text-[0.8125rem] font-medium text-suave"
            >
              Sair da conta
            </button>
          </form>
        </nav>
      </header>

      <nav
        aria-label="Navegação principal no celular"
        className="fixed inset-x-4 bottom-4 z-30 flex items-center rounded-[20px] bg-breu px-1.5 py-1 shadow-[0_2px_4px_rgb(27_29_26/0.08),0_24px_48px_-20px_rgb(27_29_26/0.55)] lg:hidden"
      >
        {ABAS.map((item) => {
          const ativo = estaAtivo(caminho, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={ativo ? "page" : undefined}
              className={`relative flex min-h-12 flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[0.625rem] leading-tight transition-colors duration-150 ${
                ativo ? "text-breu-verde" : "text-breu-suave"
              }`}
            >
              {item.icone}
              <span className="w-full truncate text-center">{item.nome}</span>
              <PontoDeCarga className="absolute right-2 top-2" />
            </Link>
          );
        })}
      </nav>
    </>
  );
}
