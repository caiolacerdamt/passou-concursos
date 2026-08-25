import type { Metadata } from "next";

import { EventoDoFunilNaEntrada } from "@/modules/analytics/entrada";
import { Chamada, Ciclo } from "@/modules/ui/landing/ciclo";
import { Navegacao, Rodape } from "@/modules/ui/landing/estrutura";
import { Movimento } from "@/modules/ui/landing/movimento";
import { Evidencias, Heroi, Hoje, Metodo, Precos } from "@/modules/ui/landing/secoes";
import { obterPrecosPublicos } from "@/modules/pagamentos/preco";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Passou Concursos — estude o que a banca cobra de verdade",
  description:
    "Questões das provas oficiais do Banco do Brasil, com banca e ano na etiqueta, gabarito oficial e um plano diário que sai do seu histórico.",
};

/**
 * Página de vendas (PAG-08). É a única superfície de conversão: o produto está
 * inteiro atrás do paywall, então esta página é a única chance de convencer.
 *
 * O que ela SHALL conter está no AC de `m8 §P1` e é guardado por `page.test.tsx`
 * — método, evidências, os dois preços, garantia, links legais antes do CTA e a
 * declaração honesta do que existe hoje. O visual vem de `DESIGN.md` (modo
 * Persuade); o recorte da rodada está em `docs/design/brief-landing.md`.
 */
export default async function Home() {
  const precos = await obterPrecosPublicos();

  return (
    <>
      <EventoDoFunilNaEntrada evento="pagina_vista" />

      <Navegacao />

      <main>
        <Heroi />
        <Ciclo />
        <Metodo />
        <Evidencias />
        <Hoje />
        <Chamada />
        <Precos precos={precos} />
      </main>

      <Rodape />

      {/*
        Por último e sem marcação visível: só liga o GSAP nos ganchos `data-*`
        das seções acima, que continuam sendo server components.
      */}
      <Movimento />
    </>
  );
}
