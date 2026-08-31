"use client";

import Script from "next/script";
import { useEffect } from "react";

import { ligarComportamento } from "./assinatura";

declare global {
  interface Window {
    ScrollCraft?: {
      mount: (raiz: HTMLElement) => unknown;
      instances: unknown[];
    };
  }
}

/**
 * Raízes que já receberam uma instância do motor.
 *
 * A trava antiga era `instances.length > 0`, um contador global — e contador
 * global não sabe distinguir "já montei nesta página" de "montei na página
 * anterior, que o roteador já descartou". Numa volta por navegação
 * client-side o `<main>` é outro elemento, o contador continua em 1, o mount é
 * pulado, o IntersectionObserver nunca observa o DOM novo e todo `[data-sc-in]`
 * fica preso em `opacity: 0`. Um `WeakSet` de raízes responde a pergunta certa
 * e ainda solta a referência quando o elemento sai do documento.
 */
const raizesMontadas = new WeakSet<HTMLElement>();

/** Prazo do motor para publicar `sc-ready` antes de a rede de segurança valer. */
const PRAZO_DO_MOTOR_MS = 1500;

/**
 * Monta o motor na raiz da página, não no `body`.
 *
 * `mount()` só usa a raiz para dois `querySelectorAll` e para ler a taxa de
 * lerp, então montar no `<main>` da rota dá o mesmo resultado e ganha uma
 * propriedade que o `body` não tem: o `<main>` é descartado e recriado pelo
 * roteador, então "esta página já foi montada?" vira uma pergunta com resposta.
 */
function montarMotor() {
  const motor = window.ScrollCraft;
  const raiz = document.querySelector<HTMLElement>("main#topo");

  if (!motor || !raiz) return revelarSemMotor();
  if (raizesMontadas.has(raiz)) return;

  raizesMontadas.add(raiz);
  motor.mount(raiz);
}

/** O motor não vai vir. Solta o texto que ele estava segurando escondido. */
function revelarSemMotor() {
  document.documentElement.classList.add("sc-falhou");
}

/**
 * Camada de movimento da landing.
 *
 * Componente sem marcação própria: as dez seções continuam sendo server
 * components e só expõem ganchos `data-sc-*`. Isto aqui monta no cliente e liga
 * o motor neles — a mesma costura que a rodada anterior usava com o GSAP.
 *
 * **O motor não é editado.** `public/motor/scrollcraft.js` é a cópia literal do
 * arquivo da skill: JS vanilla, sem dependência, que não gera DOM nenhum. Ele
 * entra por `<Script>` e não por `import` porque é um IIFE que escreve em
 * `window` no topo do arquivo — importado, ele quebraria a renderização no
 * servidor, e "adaptar para importar" seria editar o motor pela porta dos
 * fundos.
 */
export function MotorDaLanding() {
  /*
   * O comportamento próprio (barra, assinatura, contador) não espera o motor:
   * ele lê `--sc-p` do ato 4 a cada quadro, e enquanto o motor não montou esse
   * valor é 0 — que é exatamente o primeiro quadro do movimento. Sem ordem
   * imposta entre os dois, nenhum deles pode travar o outro.
   */
  useEffect(() => ligarComportamento(), []);

  /*
   * Rede de segurança do revelar. O motor é a única coisa que devolve opacidade
   * a `[data-sc-in]`, então "motor não montou" e "página sem texto" eram o mesmo
   * evento. Este temporizador quebra esse acoplamento: passado o prazo sem
   * `sc-ready`, `sc-falhou` entra e o CSS revela tudo de uma vez.
   *
   * Ele vive aqui e não no `onReady` porque precisa cobrir também o caso em que
   * `onReady` nunca dispara — script bloqueado por rede, por extensão ou por
   * CSP. Se o motor montar dentro do prazo, o temporizador é cancelado e nada
   * disto aparece no DOM.
   */
  useEffect(() => {
    const raiz = document.documentElement;
    if (raiz.classList.contains("sc-ready")) return;

    const prazo = window.setTimeout(() => {
      if (!raiz.classList.contains("sc-ready")) raiz.classList.add("sc-falhou");
    }, PRAZO_DO_MOTOR_MS);

    return () => window.clearTimeout(prazo);
  }, []);

  return (
    <Script
      src="/motor/scrollcraft.js"
      strategy="afterInteractive"
      onReady={montarMotor}
      onError={revelarSemMotor}
    />
  );
}
