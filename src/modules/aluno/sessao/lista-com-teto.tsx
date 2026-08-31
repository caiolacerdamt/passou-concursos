"use client";

import Link from "next/link";
import { useId, useRef, useState, type ReactNode } from "react";

/**
 * A lista que não deixa o bloco virar rolo — AD-117.
 *
 * Memória e Recuperar erro crescem com o aluno: uma linha por tópico vencido e
 * uma por par tópico×causa. Não são milhares (o teto real é o tamanho da
 * taxonomia), mas passam fácil das dezenas no fim de um ciclo — e aí o cartão
 * empurra o resto da tela para fora do campo de visão.
 *
 * Três regras, nesta ordem:
 *
 *   1. **Abre em lote, nunca "tudo".** Cada clique acrescenta {@link POR_LOTE}
 *      e o rótulo diz quanto sobra. Não existe um clique que despeje 200 linhas.
 *   2. **O que a consulta não trouxe vira link**, não mais um lote: o teto de
 *      `pratica.ts` corta no banco, e daí em diante quem manda é a tela dona da
 *      lista longa (`/app/progresso`). Prática não é navegador de lista.
 *   3. **O fechar acompanha.** Enquanto está aberto o rodapé é `sticky`: por
 *      mais que a lista tenha crescido, "Mostrar menos" está sempre à vista, e
 *      fechar devolve o corte e rola de volta ao topo do cartão.
 *
 * O estado não sobrevive à navegação de propósito — o corte é o normal da tela,
 * e lembrar que ele estava aberto devolveria o rolo que este componente evita.
 */

/** O que aparece antes de qualquer clique. Vale para os dois blocos. */
const PRIMEIRO_CORTE = 4;

/** Quanto cada clique acrescenta. */
const POR_LOTE = 8;

type Props = {
  /** Os `<li>` já montados pelo servidor, na ordem em que devem aparecer. */
  itens: readonly ReactNode[];
  /**
   * Quantos existem ao todo no banco, e não quantos vieram: é a diferença entre
   * os dois que decide se o rodapé abre mais um lote ou entrega a tela dona.
   */
  total: number;
  /** Para onde vai o que passou do teto da consulta. */
  hrefDoResto: string;
  /** Como chamar essa saída — já com o número, que o servidor conhece. */
  rotuloDoResto: string;
  /** Nome do bloco para o leitor de tela ("erros", "revisões"). */
  nomeDosItens: string;
};

export function ListaComTeto({ itens, total, hrefDoResto, rotuloDoResto, nomeDosItens }: Props) {
  const [visiveis, setVisiveis] = useState(PRIMEIRO_CORTE);
  const raiz = useRef<HTMLDivElement>(null);
  const idDaLista = useId();

  /** O que a consulta trouxe e o corte ainda esconde — abre com mais um lote. */
  const noBolso = Math.max(itens.length - visiveis, 0);
  /** O que nem veio do banco — esse não abre aqui, vira link. */
  const foraDaConsulta = Math.max(total - itens.length, 0);
  const expandido = visiveis > PRIMEIRO_CORTE;

  function abrirMais() {
    setVisiveis((atual) => Math.min(atual + POR_LOTE, itens.length));
  }

  function fechar() {
    setVisiveis(PRIMEIRO_CORTE);
    // O botão que fechou pode estar a três telas do topo do cartão: sem trazer
    // a rolagem de volta, fechar deixa o aluno olhando para o cartão seguinte.
    const suave =
      typeof window !== "undefined" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    raiz.current
      ?.closest("section")
      ?.scrollIntoView({ block: "start", behavior: suave ? "smooth" : "auto" });
  }

  const semRodape = noBolso === 0 && foraDaConsulta === 0 && !expandido;

  return (
    <div ref={raiz} className="flex min-w-0 flex-col">
      <ul id={idDaLista} className="mt-4">
        {itens.slice(0, visiveis)}
      </ul>

      {semRodape ? null : (
        <div className="sticky bottom-0 mt-0 flex flex-col bg-painel">
          {noBolso > 0 ? (
            <button
              type="button"
              onClick={abrirMais}
              aria-expanded={expandido}
              aria-controls={idDaLista}
              className="flex min-h-11 w-full items-center justify-center gap-2 border-t border-linha text-[0.8125rem] font-semibold text-marca transition-colors duration-150 hover:text-marca-apoio"
            >
              {`Mostrar mais ${Math.min(POR_LOTE, noBolso)}`}
              {noBolso + foraDaConsulta > POR_LOTE ? (
                <span className="font-utilitaria font-normal text-suave">
                  {`· restam ${noBolso + foraDaConsulta}`}
                </span>
              ) : null}
              <Chevron />
            </button>
          ) : null}

          {/*
            O resto só aparece quando não há mais lote a abrir: oferecer a tela
            dona antes disso seria mandar embora quem ainda podia resolver aqui.
          */}
          {noBolso === 0 && foraDaConsulta > 0 ? (
            <div className="border-t border-linha pt-3">
              <Link
                href={hrefDoResto}
                className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-marca px-5 text-[0.8125rem] font-semibold text-painel no-underline transition-colors duration-150 hover:bg-marca-apoio"
              >
                {rotuloDoResto}
                <Seta />
              </Link>
            </div>
          ) : null}

          {expandido ? (
            <button
              type="button"
              onClick={fechar}
              className={`flex min-h-10 w-full items-center justify-center gap-2 text-[0.8125rem] font-semibold text-suave transition-colors duration-150 hover:text-marca ${
                noBolso === 0 && foraDaConsulta > 0 ? "mt-1" : "border-t border-linha"
              }`}
            >
              {`Mostrar menos ${nomeDosItens}`}
              <Chevron aberto />
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

function Chevron({ aberto = false }: { aberto?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-[0.9375rem]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={aberto ? "m18 15-6-6-6 6" : "m6 9 6 6 6-6"} />
    </svg>
  );
}

function Seta() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h13m0 0-4.6-4.6M18 12l-4.6 4.6" />
    </svg>
  );
}
