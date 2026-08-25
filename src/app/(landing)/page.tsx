import type { Metadata } from "next";

import { consultarFrequenciaReal } from "@/modules/acervo";
import { EventoDoFunilNaEntrada } from "@/modules/analytics/entrada";
import { obterPrecosPublicos } from "@/modules/pagamentos/preco";
import { Barra, Rodape } from "@/modules/ui/landing/estrutura";
import { MotorDaLanding } from "@/modules/ui/landing/motor";
import { Pico } from "@/modules/ui/landing/pico";
import {
  Heroi,
  Hoje,
  Medida,
  Metodo,
  Oferta,
  Problema,
} from "@/modules/ui/landing/secoes";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Passou Concursos — o que a banca do Banco do Brasil cobra de verdade",
  description:
    "A gente leu prova por prova do Banco do Brasil e contou, questão por questão, o que a banca mais cobra. Seu plano do dia sai dessa contagem, não do seu palpite.",
};

/**
 * Página de vendas (PAG-08). É a única superfície de conversão: o produto está
 * inteiro atrás do paywall, então esta página é a única chance de convencer.
 *
 * O que ela SHALL conter está no AC de `m8 §P1` e é guardado por
 * `page.test.tsx` — método, evidências, os dois preços, garantia e links legais
 * antes do CTA. A rodada de copy de 2026-08-25 (AD-110) tirou a declaração do
 * que ainda não existe: decisão do dono, revoga a AC2 original só para esta
 * página. O visual vem de `DESIGN.md` e do porte do protótipo aprovado em
 * `scrollcraft/builds/passou-lp` (AD-106).
 *
 * **Sete seções, sete server components.** Nenhuma delas anima nada: elas só
 * produzem DOM com ganchos `data-sc-*`, e `MotorDaLanding` — o único client
 * component da página — liga o motor de scroll neles depois da hidratação.
 *
 * Os dois números que a página cita vêm de fora dela: o preço da tabela de
 * configuração (INFRA-11) e a frequência do acervo (invariante 3: só
 * `origem='real'`). Nenhum dos dois é escrito na copy.
 */
export default async function Home() {
  const [precos, frequencia] = await Promise.all([
    obterPrecosPublicos(),
    consultarFrequenciaReal(),
  ]);

  return (
    <>
      <EventoDoFunilNaEntrada evento="pagina_vista" />

      <Barra />

      <main id="topo">
        <Heroi frequencia={frequencia} />
        <Problema frequencia={frequencia} />
        <Medida frequencia={frequencia} />
        <Pico frequencia={frequencia} />
        <Metodo />
        <Hoje />
        <Oferta precos={precos} />
      </main>

      <Rodape />

      <MotorDaLanding topicos={frequencia.topicos} />
    </>
  );
}
