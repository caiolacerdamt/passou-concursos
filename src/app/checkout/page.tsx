import Link from "next/link";

import { EventoDoFunilNaEntrada } from "@/modules/analytics/entrada";
import { formatarBRL, obterPrecosPublicos } from "@/modules/pagamentos/preco";
import { Marca } from "@/modules/ui/marca";

import { DecisaoDoCheckout } from "./formulario";

export const dynamic = "force-dynamic";

/**
 * O checkout (PAG-09, PAG-12).
 *
 * **Não usa o `Shell`**, e isso segue o `DESIGN.md`: ele coloca `/checkout` no
 * modo Persuade, do lado da landing, e não no modo Operate do app. Vestido com
 * o shell do app ele parecia outro produto no meio da compra.
 *
 * A barra é mínima de propósito — marca e o processador, nada mais. Link de
 * navegação numa tela de pagamento é convite para sair antes de terminar; quem
 * quiser voltar volta pela marca.
 */
export default async function Checkout() {
  const precos = await obterPrecosPublicos();

  /*
   * A economia do pagamento à vista é calculada e **formatada aqui**, no
   * servidor. `formatarBRL` vive no mesmo módulo que lê a configuração, e a
   * configuração puxa `revalidateTag`, que não existe no cliente — importar o
   * formatador da tela quebraria o build inteiro. Um jeito só de escrever
   * dinheiro no produto continua valendo; ele só não atravessa a fronteira.
   */
  const economiaCentavos =
    precos.parcelado.totalCentavos - precos.aVista.totalCentavos;
  const economia = {
    formatada: formatarBRL(economiaCentavos),
    percentual: Math.round(
      (economiaCentavos / precos.parcelado.totalCentavos) * 100,
    ),
  };

  return (
    <div className="acesso min-h-dvh bg-papel text-tinta">
      <a
        href="#conteudo"
        className="sr-only rounded-pill bg-verde px-4 py-2 text-papel-alto focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
      >
        Pular para o conteúdo
      </a>

      <header className="flex min-h-18 flex-wrap items-center gap-x-8 gap-y-2 border-b border-risco px-6 py-3 sm:px-10 lg:px-14">
        <Marca />
        <p className="ml-auto flex items-center gap-2 text-sm text-tinta-suave">
          <svg viewBox="0 0 16 16" className="size-3.5 shrink-0" fill="none" aria-hidden="true">
            <rect x="3" y="7" width="10" height="6.5" rx="1.4" stroke="currentColor" strokeWidth="1.3" />
            <path d="M5.6 7V5.2a2.4 2.4 0 0 1 4.8 0V7" stroke="currentColor" strokeWidth="1.3" />
          </svg>
          Pagamento processado pelo Asaas
        </p>
      </header>

      <main id="conteudo" className="mx-auto w-full max-w-[74rem] px-6 py-10 sm:px-10 lg:px-14 lg:py-11">
        <EventoDoFunilNaEntrada evento="checkout_iniciado" />

        <p className="font-utilitaria text-[0.6875rem] tracking-[0.16em] text-tinta-suave uppercase">
          Checkout
        </p>
        <h1 className="mt-3 max-w-[18ch] text-[2rem] leading-[1.06] font-medium tracking-[-0.03em] text-balance sm:text-5xl sm:tracking-[-0.034em]">
          Falta só confirmar seus dados.
        </h1>
        <p className="mt-4 max-w-[52ch] leading-relaxed text-tinta-suave sm:text-[1.1875rem] sm:leading-[1.5]">
          Um ano de acesso, num pagamento só — com {precos.garantiaDias} dias de
          garantia para experimentar sem risco.
        </p>

        <DecisaoDoCheckout precos={precos} economia={economia} />

        <p className="mt-8 text-sm leading-6 text-tinta-suave">
          Consulte também os{" "}
          <Link href="/termos" className="text-verde-texto underline hover:text-verde">
            termos de uso
          </Link>{" "}
          e a{" "}
          <Link href="/privacidade" className="text-verde-texto underline hover:text-verde">
            política de privacidade
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
