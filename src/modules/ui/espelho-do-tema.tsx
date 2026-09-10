"use client";

import { useEffect } from "react";

import type { Tema } from "./tema";

/**
 * O canto que o `data-tema` do shell não alcança (AD-149).
 *
 * O atributo de verdade nasce no `<div>` do shell, no servidor, e é ele que
 * pinta a tela — nada aqui participa disso. O layout raiz não pode carregar o
 * tema porque é compartilhado com a landing e com as telas de acesso: ler
 * cookie lá arrastaria a árvore inteira para render dinâmico e espalharia o
 * tema por superfícies que decidimos deixar claras.
 *
 * Sobram duas coisas que só o `<html>` resolve:
 *
 * 1. a área de *overscroll* no celular — a faixa que aparece ao puxar além do
 *    fim ficaria bege por baixo de uma tela escura;
 * 2. o `color-scheme` do documento, que decide a cor da barra de rolagem e dos
 *    widgets nativos (`select`, `checkbox`, calendário de `input[type=date]`).
 *
 * Isto roda depois da hidratação, e é aceitável **porque o conteúdo já veio
 * pintado do servidor**: o que chega tarde é a moldura do navegador, não a tela.
 * Não há flash de bege no conteúdo — se aparecer, a causa é o atributo ter ido
 * para o cliente, não este componente.
 *
 * **O cleanup não é higiene, é requisito.** Sem ele a landing herda barra de
 * rolagem escura e canvas escuro ao sair do app por navegação de cliente, que é
 * exatamente o caso do link "Fazer a matrícula" na faixa do trial.
 */
export function EspelhoDoTema({ tema }: { tema: Tema }) {
  useEffect(() => {
    const raiz = document.documentElement;
    const anterior = raiz.dataset.tema;

    raiz.dataset.tema = tema;

    /*
     * `theme-color` é o que a barra do navegador no celular lê, e ela carrega um
     * valor, não um token — por isso precisa ser resolvida aqui.
     *
     * O valor sai de `getComputedStyle` e **não** de um hex escrito neste
     * arquivo: cor em componente é a regra que o `DESIGN.md` proíbe, e uma cópia
     * daqui divergiria do `globals.css` na primeira troca de paleta. Ler o token
     * depois de gravar o atributo também resolve `sistema` de graça — quem
     * decide se o aparelho está no escuro é a media query do CSS, não um
     * `matchMedia` duplicado aqui.
     */
    const fundo = getComputedStyle(raiz).getPropertyValue("--color-fundo").trim();

    const existente = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const criada = existente === null;
    const meta = existente ?? document.createElement("meta");
    const valorAnterior = meta.getAttribute("content");

    if (criada) {
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    if (fundo) meta.setAttribute("content", fundo);

    return () => {
      if (anterior === undefined) delete raiz.dataset.tema;
      else raiz.dataset.tema = anterior;

      // Uma `<meta>` que já existia volta ao valor de antes; a que criamos sai.
      // Deixá-la para trás pintaria a barra do celular na landing.
      if (criada) meta.remove();
      else if (valorAnterior !== null) meta.setAttribute("content", valorAnterior);
      else meta.removeAttribute("content");
    };
  }, [tema]);

  return null;
}
