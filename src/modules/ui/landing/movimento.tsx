"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/**
 * Camada de movimento da landing.
 *
 * Componente sem marcação própria: as seções continuam sendo server components
 * e só expõem ganchos `data-*`. Isto aqui monta no cliente e liga o GSAP neles.
 *
 * **Dois momentos, não sete.** A entrada do herói e a trilha do ciclo. O resto
 * da página não anima de propósito — a mesma revelação repetida em toda seção
 * é o que faz uma página parecer template, e some com o único movimento que
 * deveria ser notado.
 *
 * **Tudo parte do estado visível.** As animações usam `from()`, então o HTML já
 * nasce legível e o JS afasta a partir dali. Sem JS, a página inteira funciona;
 * é só o movimento que não acontece.
 */
export function Movimento() {
  const raiz = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      /*
       * `matchMedia` e não um `if`: o GSAP reverte tudo sozinho quando a
       * preferência muda no meio da sessão, e o `globals.css` já zera duração de
       * animação nesse modo — os dois precisam concordar, não brigar.
       */
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const arte = document.querySelector<HTMLElement>("[data-arte-heroi]");
        const moldura = document.querySelector<HTMLElement>("[data-parallax]");

        if (arte) {
          gsap.from(arte, {
            y: 48,
            opacity: 0,
            duration: 1.2,
            ease: "expo.out",
            delay: 0.15,
          });
        }

        /*
         * A arte sobe mais devagar que a página. O deslocamento vive na moldura
         * e a entrada vive na arte: empilhar as duas no mesmo `y` faria uma
         * cancelar a outra.
         */
        if (moldura) {
          gsap.to(moldura, {
            y: -70,
            ease: "none",
            scrollTrigger: {
              trigger: moldura,
              start: "top bottom",
              end: "bottom top",
              scrub: 0.6,
            },
          });
        }

        const trilha = document.querySelector<HTMLElement>("[data-trilha]");
        if (!trilha) return;

        const linha = trilha.querySelector<HTMLElement>("[data-linha]");
        const passos = gsap.utils.toArray<HTMLElement>("[data-passo]", trilha);

        /*
         * O momento assinado: a linha risca da esquerda para a direita e cada
         * passo entra atrás dela, preso ao scroll. É o ciclo se desenhando —
         * por isso é `scrub` e não uma entrada por tempo: quem controla o ritmo
         * é a pessoa rolando, e ela pode voltar para reler.
         */
        const linhaDoTempo = gsap.timeline({
          scrollTrigger: {
            trigger: trilha,
            start: "top 78%",
            end: "bottom 72%",
            scrub: 0.5,
          },
        });

        if (linha) {
          linhaDoTempo.from(linha, {
            scaleX: 0,
            transformOrigin: "left center",
            ease: "none",
            duration: passos.length,
          });
        }

        linhaDoTempo.from(
          passos,
          {
            opacity: 0,
            y: 20,
            ease: "power2.out",
            duration: 1,
            stagger: 0.85,
          },
          linha ? 0.2 : 0,
        );
      });

      return () => mm.revert();
    },
    { scope: raiz },
  );

  return <div ref={raiz} aria-hidden className="hidden" />;
}
