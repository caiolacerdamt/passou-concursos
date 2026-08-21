import Link from "next/link";

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
      <p className="text-sm font-semibold uppercase tracking-wide text-marca">Checkout</p>
      <h1 className="mt-2 text-3xl font-semibold">Finalize sua matrícula anual</h1>
      <p className="mt-4 leading-7 text-suave">
        Confira o valor, escolha o meio de pagamento e confirme os dados. O aceite
        da maioridade é afirmativo e datado no servidor; não solicitamos data de nascimento.
      </p>
      <FormularioCheckout precos={precos} />

      <p className="mt-7 text-sm text-suave">
        A garantia é de {precos.garantiaDias} dias corridos após a confirmação do pagamento.
        Consulte também a <Link href="/privacidade" className="text-marca underline">política de privacidade</Link>.
      </p>
    </Shell>
  );
}
