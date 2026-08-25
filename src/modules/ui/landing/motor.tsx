"use client";

import Script from "next/script";
import { useEffect } from "react";

import type { TopicoFrequente } from "@/modules/acervo";

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
 * Camada de movimento da landing.
 *
 * Componente sem marcação própria: as sete seções continuam sendo server
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
export function MotorDaLanding({ topicos }: { topicos: readonly TopicoFrequente[] }) {
  /*
   * O comportamento próprio (barra, pico, contador) não espera o motor: ele lê
   * `--sc-p` do elemento do pico a cada quadro, e enquanto o motor não montou
   * esse valor é 0 — que é exatamente o primeiro quadro do movimento. Sem
   * ordem imposta entre os dois, nenhum deles pode travar o outro.
   */
  useEffect(() => ligarComportamento(topicos), [topicos]);

  return (
    <Script
      src="/motor/scrollcraft.js"
      strategy="afterInteractive"
      onReady={() => {
        const motor = window.ScrollCraft;
        // `onReady` dispara de novo a cada montagem, inclusive quando o script
        // já está no documento. Duas instâncias dirigiriam os mesmos atos.
        if (!motor || motor.instances.length > 0) return;
        motor.mount(document.body);
      }}
    />
  );
}
