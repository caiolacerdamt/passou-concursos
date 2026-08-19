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
      <h1 className="text-2xl font-semibold">Sua matrícula não está ativa</h1>
      <p className="mt-3 text-suave">
        O conteúdo do Passou Concursos é liberado pela matrícula. A sua não está
        ativa no momento, então não há o que mostrar aqui.
      </p>
      <p className="mt-3 text-suave">
        Se você acabou de pagar e chegou nesta tela, escreva para o suporte: a
        ativação é automática e algo saiu do lugar.
      </p>
    </Shell>
  );
}
