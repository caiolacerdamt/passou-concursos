import type { Metadata } from "next";

import { EventoDoFunilNaEntrada } from "@/modules/analytics/entrada";
import { obterPrecosPublicos } from "@/modules/pagamentos/preco";
import { DiaSeMonta } from "@/modules/ui/landing/dia";
import { Barra, Rodape } from "@/modules/ui/landing/estrutura";
import { MotorDaLanding } from "@/modules/ui/landing/motor";
import {
  AlguemContou,
  AQuestao,
  Comunidade,
  EvidenciaDaRevisao,
  Heroi,
  Oferta,
  OQueVolta,
  PerguntaDeTerca,
  PorQueAguenta,
} from "@/modules/ui/landing/secoes";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Passou Concursos — seu plano de estudos para a prova",
  description:
    "Escolha seu concurso e receba um plano de estudos atualizado pelo que mais cai, pelo seu desempenho e pelo que você ainda precisa dominar.",
};

/**
 * Página de vendas (PAG-08). É a única superfície de conversão: o produto está
 * inteiro atrás do paywall, então esta página é a única chance de convencer.
 *
 * O que ela SHALL conter está no AC de `m8 §P1` e é guardado por
 * `page.test.tsx` — método, evidência, os dois preços, garantia e links legais
 * antes do CTA.
 *
 * **Dez atos, dez server components.** Nenhum deles anima nada: eles só
 * produzem DOM com ganchos
 * `data-sc-*`, e `MotorDaLanding` — o único client component da página — liga o
 * motor de scroll neles depois da hidratação.
 *
 * A ordem é a curva de sentimento, não uma lista de features: reconhecimento,
 * desconforto, silêncio, o pico, concentração, confiança, segurança, decisão,
 * resolução. O ato 4 é o pico e tem o maior span depois do herói; o ato 3 é
 * curto e quieto de propósito, para o 4 ter de onde subir.
 *
 * Só `precos` vem de fora da página. Os exemplos de plano e questão são
 * demonstrações declaradas da experiência. A oferta encerra a sequência; não
 * há um ato extra depois dela.
 */
export default async function Home() {
  const precos = await obterPrecosPublicos();

  return (
    <>
      <EventoDoFunilNaEntrada evento="pagina_vista" />

      <Barra />

      <main id="topo">
        <Heroi />
        <PerguntaDeTerca />
        <AlguemContou />
        <DiaSeMonta />
        <AQuestao />
        <OQueVolta />
        <EvidenciaDaRevisao />
        <Comunidade />
        <PorQueAguenta />
        <Oferta precos={precos} />
      </main>

      <Rodape />

      <MotorDaLanding />
    </>
  );
}
