import Link from "next/link";

import { obterPrecosPublicos } from "@/modules/pagamentos/preco";
import { Shell } from "@/modules/ui/shell";

export const dynamic = "force-dynamic";

/**
 * Resumo público do checkout. A criação da cobrança é T112 e não entra neste
 * lote; esta tela já fixa preço, garantia e os requisitos do próximo passo sem
 * fingir que o pagamento foi criado.
 */
export default async function Checkout() {
  const precos = await obterPrecosPublicos();

  return (
    <Shell
      acoes={<Link href="/" className="text-marca underline">Voltar para a oferta</Link>}
    >
      <p className="text-sm font-semibold uppercase tracking-wide text-marca">Checkout</p>
      <h1 className="mt-2 text-3xl font-semibold">Confira a oferta antes de continuar</h1>
      <p className="mt-4 leading-7 text-suave">
        A próxima etapa vai pedir seu e-mail, sua declaração afirmativa de 18 anos
        ou mais e o aceite datado dos termos. Não solicitamos data de nascimento.
      </p>

      <section aria-labelledby="resumo-da-oferta" className="mt-7 grid gap-4 sm:grid-cols-2">
        <h2 id="resumo-da-oferta" className="sr-only">Resumo da oferta</h2>
        <article className="rounded-lg border border-linha p-5">
          <h3 className="font-semibold">Cartão de crédito</h3>
          <p className="mt-2 text-xl font-semibold">
            {precos.parcelado.parcelas}x de até {precos.parcelado.parcelaFormatada}
          </p>
          <p className="mt-1 text-sm text-suave">
            Total de {precos.parcelado.totalFormatado}; a última parcela pode ter
            ajuste de centavos.
          </p>
        </article>
        <article className="rounded-lg border border-linha p-5">
          <h3 className="font-semibold">Pix ou boleto</h3>
          <p className="mt-2 text-xl font-semibold">{precos.aVista.totalFormatado}</p>
          <p className="mt-1 text-sm text-suave">Valor à vista com desconto</p>
        </article>
      </section>

      <p className="mt-6 rounded-lg border border-linha bg-fundo-suave p-4 text-sm leading-6" role="status">
        O processamento da cobrança será conectado na próxima etapa de implementação.
        A garantia prevista é de {precos.garantiaDias} dias corridos após a confirmação.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-md bg-linha px-5 py-3 font-medium text-suave"
        >
          Continuar para pagamento
        </button>
        <Link href="/termos" className="text-marca underline">Ler os termos</Link>
        <Link href="/privacidade" className="text-marca underline">Ler a privacidade</Link>
      </div>
    </Shell>
  );
}
