"use client";

import { useLinkStatus } from "next/link";

/**
 * O ponto que acende enquanto a navegação do `<Link>` que o contém ainda não
 * respondeu.
 *
 * O `loading.tsx` resolve o caso normal, mas em rede lenta o prefetch pode não
 * ter terminado e nem o esqueleto aparece — o clique fica sem resposta visível.
 * Este ponto cobre exatamente essa janela.
 *
 * `useLinkStatus` só enxerga a navegação quando roda **dentro** do `<Link>`,
 * como filho: no mesmo componente que renderiza o link ele devolve sempre
 * `pending: false`. Por isso este arquivo existe separado.
 *
 * `aria-hidden` de propósito: quem usa leitor de tela já recebe o anúncio do
 * `role="status"` do esqueleto quando a tela troca. Dois anúncios para o mesmo
 * clique seriam ruído.
 */
export function PontoDeCarga({ className = "" }: { className?: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;

  return (
    <span
      aria-hidden="true"
      className={`size-1.5 shrink-0 rounded-full bg-current motion-safe:animate-pulse ${className}`}
    />
  );
}
