import Link from "next/link";

import { clienteDeServico } from "@/lib/db/servidor";
import { criarRepositorioDePagamentos } from "@/modules/pagamentos/repositorio";
import { apresentarResultado } from "@/modules/pagamentos/resultado";
import { Shell } from "@/modules/ui/shell";

export const dynamic = "force-dynamic";

export default async function ResultadoCheckout({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pagamento = await criarRepositorioDePagamentos(clienteDeServico()).buscarPagamento(id);

  if (!pagamento) {
    return (
      <Shell acoes={<Link href="/" className="text-marca underline">Voltar para a oferta</Link>}>
        <h1 className="text-3xl font-semibold">Resultado indisponível</h1>
        <p className="mt-4 text-suave">Não encontramos este resultado de pagamento.</p>
      </Shell>
    );
  }

  const resultado = apresentarResultado({
    estado: pagamento.estado,
    meio: pagamento.meio,
    statusGateway: pagamento.asaas_status,
    url: pagamento.resultado_url,
    boletoUrl: pagamento.resultado_boleto_url,
    pixQrCode: pagamento.resultado_pix_qr_code,
    pixCopiaECola: pagamento.resultado_pix_copia_e_cola,
  });

  return (
    <Shell acoes={<Link href="/" className="text-marca underline">Voltar para a oferta</Link>}>
      <p className="text-sm font-semibold uppercase tracking-wide text-marca">Resultado do pagamento</p>
      <h1 className="mt-2 text-3xl font-semibold">{resultado.titulo}</h1>
      <p className="mt-4 leading-7 text-suave">{resultado.mensagem}</p>
      <p className="mt-5 rounded-md border border-linha bg-fundo-suave p-4 text-sm" role="status">
        Status operacional: <strong>{pagamento.estado}</strong>
        {pagamento.asaas_status ? ` · retorno do provedor: ${pagamento.asaas_status}` : ""}
      </p>

      {resultado.mostraPix ? (
        <section aria-labelledby="pix-instrucoes" className="mt-6 rounded-lg border border-linha p-5">
          <h2 id="pix-instrucoes" className="font-semibold">Instruções do Pix</h2>
          {pagamento.resultado_pix_copia_e_cola ? (
            <label className="mt-3 block text-sm">
              Código Pix copia e cola
              <textarea readOnly value={pagamento.resultado_pix_copia_e_cola} className="mt-2 block min-h-28 w-full rounded-md border border-linha p-3" />
            </label>
          ) : null}
          {pagamento.resultado_pix_qr_code ? (
            <p className="mt-3 break-all text-xs text-suave">Código do QR Pix: {pagamento.resultado_pix_qr_code}</p>
          ) : null}
        </section>
      ) : null}

      {resultado.mostraBoleto && pagamento.resultado_boleto_url ? (
        <p className="mt-6">
          <a href={pagamento.resultado_boleto_url} className="text-marca underline" rel="noreferrer">
            Abrir boleto
          </a>
        </p>
      ) : null}
      {resultado.mostraAcompanhamento && pagamento.resultado_url ? (
        <p className="mt-6">
          <a href={pagamento.resultado_url} className="text-marca underline" rel="noreferrer">
            Acompanhar cobrança
          </a>
        </p>
      ) : null}
      {resultado.acessoLiberado ? (
        <p className="mt-6"><Link href="/app" className="rounded-md bg-marca px-5 py-3 font-medium text-fundo">Entrar no estudo</Link></p>
      ) : null}
    </Shell>
  );
}
