import Link from "next/link";

import { clienteDeServico } from "@/lib/db/servidor";
import { clienteDaSessao } from "@/lib/db/sessao";
import { exigirMatriculaAtiva } from "@/modules/conta/matricula";
import { obterPrecosPublicos } from "@/modules/pagamentos/preco";
import {
  calcularGarantia,
  mensagemDaRecusaDaGarantia,
  type ResultadoDaGarantia,
} from "@/modules/pagamentos/garantia";
import { criarRepositorioDePagamentos } from "@/modules/pagamentos/repositorio";

import { pedirReembolso } from "./acoes";

export const dynamic = "force-dynamic";

export type DadosDaTelaDaGarantia = {
  estado: string;
  resultado: ResultadoDaGarantia;
  recusa: string | null;
};

export function dadosDaTelaDaGarantia(
  estado: string,
  confirmadoEm: string | null,
  garantiaDias: number,
  agora: Date,
): DadosDaTelaDaGarantia {
  const resultado = calcularGarantia({
    estadoPagamento: estado as "pendente" | "confirmada" | "ativada" | "expirada" | "reembolsada",
    confirmadoEm,
    garantiaDias,
    agora,
  });
  return {
    estado,
    resultado,
    recusa: mensagemDaRecusaDaGarantia(resultado),
  };
}

export default async function Reembolso({
  searchParams,
}: {
  searchParams: Promise<{ resultado?: string }>;
}) {
  await exigirMatriculaAtiva();
  const sessao = await clienteDaSessao();
  const {
    data: { user },
  } = await sessao.auth.getUser();
  const parametros = await searchParams;
  const precos = await obterPrecosPublicos();

  if (!user) return null;

  const pagamento = await criarRepositorioDePagamentos(clienteDeServico()).buscarUltimoPagamentoDoUsuario(user.id);
  if (!pagamento) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-4xl leading-tight tracking-tight">Garantia do pagamento</h1>
        <p className="mt-4 text-suave">Não há um pagamento confirmado para consultar.</p>
        <Link href="/app" className="mt-5 inline-flex text-sm font-semibold text-marca underline">Voltar para o estudo</Link>
      </div>
    );
  }

  const tela = dadosDaTelaDaGarantia(
    pagamento.estado,
    pagamento.confirmado_em,
    precos.garantiaDias,
    new Date(),
  );

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-marca">Garantia</p>
      <h1 className="mt-3 font-display text-4xl leading-tight tracking-tight sm:text-5xl">Pedido de reembolso</h1>
      <p className="mt-5 text-lg leading-8 text-suave">
        A janela é contada em dias corridos desde a confirmação do pagamento.
      </p>
      <Link href="/app" className="mt-4 inline-flex text-sm font-semibold text-marca underline">Voltar para o estudo</Link>
      <p className="mt-6 rounded-card border border-linha bg-painel p-5 text-sm shadow-card" role="status">
        {tela.resultado.diasPassados === null
          ? "Pagamento ainda não confirmado."
          : `Dia ${tela.resultado.diasPassados} de ${precos.garantiaDias}; ${tela.resultado.diasRestantes} dia(s) restante(s).`}
      </p>

      {parametros.resultado === "solicitado" ? (
        <p className="mt-5 rounded-md border border-aviso p-4 text-sm" role="alert">
          Reembolso confirmado. O acesso foi encerrado.
        </p>
      ) : null}
      {parametros.resultado === "pendente" ? (
        <p className="mt-5 rounded-md border border-aviso p-4 text-sm" role="alert">
          O pedido ficou em análise. O acesso continua até a confirmação do estorno.
        </p>
      ) : null}

      {tela.resultado.disponivel ? (
        <form action={pedirReembolso} className="mt-6">
          <button type="submit" className="min-h-11 rounded-full bg-marca px-5 py-3 font-medium text-fundo transition hover:bg-marca-apoio">
            Solicitar reembolso
          </button>
        </form>
      ) : (
        <p className="mt-6 rounded-md border border-linha p-4 text-sm" role="status">
          {tela.recusa ?? "O pedido não está disponível para este pagamento."}
        </p>
      )}
    </div>
  );
}
