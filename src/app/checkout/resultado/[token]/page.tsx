import Link from "next/link";

import { clienteDeServico } from "@/lib/db/servidor";
import { criarRepositorioDePagamentos } from "@/modules/pagamentos/repositorio";
import { apresentarResultado } from "@/modules/pagamentos/resultado";
import { Shell } from "@/modules/ui/shell";

export const dynamic = "force-dynamic";

export default async function ResultadoCheckout({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const pagamento = await criarRepositorioDePagamentos(clienteDeServico()).buscarPagamentoPorToken(token);

  if (!pagamento) {
    return (
      <Shell acoes={<Link href="/" className="text-marca underline">Voltar para a oferta</Link>}>
        <h1 className="font-display text-4xl leading-tight tracking-tight sm:text-5xl">Resultado indisponível</h1>
        <p className="mt-4 text-suave">Não encontramos este resultado de pagamento.</p>
      </Shell>
    );
  }

  const resultado = apresentarResultado({
    estado: pagamento.estado,
    email: pagamento.email,
    meio: pagamento.meio,
    url: pagamento.resultado_url,
    boletoUrl: pagamento.resultado_boleto_url,
    pixQrCode: pagamento.resultado_pix_qr_code,
    pixCopiaECola: pagamento.resultado_pix_copia_e_cola,
  });

  return (
    <Shell acoes={<Link href="/" className="text-marca underline">Voltar para a oferta</Link>}>
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-marca">Resultado do pagamento</p>
      <h1 className="mt-3 font-display text-4xl leading-tight tracking-tight sm:text-5xl">{resultado.titulo}</h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-suave">{resultado.mensagem}</p>

      {resultado.mostraPix ? (
        <section aria-labelledby="pix-instrucoes" className="mt-8 rounded-card border border-linha bg-painel p-5 shadow-card sm:p-6">
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
          <a
            href={pagamento.resultado_boleto_url}
            className="text-marca underline"
            target="_blank"
            rel="noreferrer noopener"
          >
            Abrir boleto para pagar
          </a>
        </p>
      ) : null}
      {/*
        O rotulo diz PAGAR, nao "acompanhar". Na homologacao de 2026-08-22 o
        comprador de cartao nao descobriu que era ali que se paga: a cobranca ja
        existe, mas o formulario de cartao fica hospedado no gateway, e
        "Acompanhar cobranca" soa como consulta de status. Abre em aba nova para
        o resultado — que carrega o token de acesso a esta pagina — nao se perder
        no meio do pagamento.
      */}
      {resultado.mostraAcompanhamento && pagamento.resultado_url ? (
        <p className="mt-6">
          <a
            href={pagamento.resultado_url}
            className="inline-flex min-h-11 items-center rounded-full bg-marca px-5 py-3 font-medium text-fundo transition hover:bg-marca-apoio"
            target="_blank"
            rel="noreferrer noopener"
          >
            Pagar agora
          </a>
        </p>
      ) : null}
      {resultado.avisoDeSenha ? (
        <section
          aria-labelledby="proximo-passo"
          className="mt-8 rounded-card border border-marca/20 bg-marca-suave p-5 sm:p-6"
        >
          <h2 id="proximo-passo" className="font-semibold">Próximo passo: crie sua senha</h2>
          <p className="mt-2 leading-7 text-suave">{resultado.avisoDeSenha}</p>
        </section>
      ) : null}
      {resultado.acessoLiberado ? (
        <p className="mt-6">
          <Link href="/app" className="inline-flex min-h-11 items-center rounded-full bg-marca px-5 py-3 font-medium text-fundo transition hover:bg-marca-apoio">
            Já tenho senha — entrar
          </Link>
        </p>
      ) : null}
    </Shell>
  );
}
