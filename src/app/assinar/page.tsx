import Link from "next/link";

import { Shell } from "@/modules/ui/shell";

/**
 * Onde para quem tem conta e nao tem matricula (PAG-01).
 *
 * E so o aviso. A pagina de vendas, o preco e o checkout sao da SPEC 12 — esta
 * pagina SHALL NOT prometer o que ainda nao existe nem exibir preco que ainda
 * nao esta decidido.
 */
export default function Assinar() {
  return (
    <Shell
      acoes={
        <Link href="/entrar" className="text-marca underline">
          Entrar
        </Link>
      }
    >
      <section className="mx-auto max-w-2xl rounded-card border border-linha bg-painel p-6 shadow-card sm:p-9" aria-labelledby="titulo-matricula">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-marca">Acesso ao estudo</p>
        <h1 id="titulo-matricula" className="mt-3 font-display text-4xl leading-tight tracking-tight sm:text-5xl">Sua matrícula não está ativa</h1>
        <p className="mt-5 text-lg leading-8 text-suave">
          O conteúdo do Passou Concursos é liberado pela matrícula. A sua não está
          ativa no momento, então não há o que mostrar aqui.
        </p>
        <p className="mt-3 leading-7 text-suave">
          Se você acabou de pagar e chegou nesta tela, escreva para o suporte: a
          ativação é automática e algo saiu do lugar.
        </p>
      </section>
    </Shell>
  );
}
