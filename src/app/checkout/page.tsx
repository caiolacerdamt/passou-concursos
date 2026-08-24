import Link from "next/link";

import { EventoDoFunilNaEntrada } from "@/modules/analytics/entrada";
import { obterPrecosPublicos } from "@/modules/pagamentos/preco";
import { Shell } from "@/modules/ui/shell";

import { FormularioCheckout } from "./formulario";

export const dynamic = "force-dynamic";

export default async function Checkout() {
  const precos = await obterPrecosPublicos();

  return (
    <Shell
      acoes={<Link href="/" className="text-marca underline">Voltar para a oferta</Link>}
    >
      <EventoDoFunilNaEntrada evento="checkout_iniciado" />
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-marca">Checkout</p>
        <h1 className="mt-3 font-display text-4xl leading-tight tracking-tight sm:text-5xl">Finalize sua matrícula anual</h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-suave">
          Confira o valor, escolha o meio de pagamento e confirme os dados. O aceite
          da maioridade é afirmativo e datado no servidor; não solicitamos data de nascimento.
        </p>
        <FormularioCheckout precos={precos} />

        <p className="mt-7 text-sm leading-6 text-suave">
          A garantia é de {precos.garantiaDias} dias corridos após a confirmação do pagamento.
          Consulte também a <Link href="/privacidade" className="text-marca underline">política de privacidade</Link>.
        </p>
      </div>
    </Shell>
  );
}
