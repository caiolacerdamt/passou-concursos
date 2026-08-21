import Link from "next/link";

import { clienteDeServico } from "@/lib/db/servidor";
import { clienteDaSessao } from "@/lib/db/sessao";
import { obterPrecosPublicos } from "@/modules/pagamentos/preco";
import {
  calcularGarantia,
  mensagemDaRecusaDaGarantia,
  type ResultadoDaGarantia,
} from "@/modules/pagamentos/garantia";
import { criarRepositorioDePagamentos } from "@/modules/pagamentos/repositorio";
import { Shell } from "@/modules/ui/shell";

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
  const sessao = await clienteDaSessao();
  const {
    data: { user },
  } = await sessao.auth.getUser();
  const parametros = await searchParams;
  const precos = await obterPrecosPublicos();

  if (!user) {
    return (
      <Shell><h1 className="text-2xl font-semibold">Entre para consultar a garantia</h1></Shell>
    );
  }

  const pagamento = await criarRepositorioDePagamentos(clienteDeServico()).buscarUltimoPagamentoDoUsuario(user.id);
  if (!pagamento) {
    return (
      <Shell acoes={<Link href="/app" className="text-marca underline">Voltar para o estudo</Link>}>
        <h1 className="text-2xl font-semibold">Garantia do pagamento</h1>
        <p className="mt-4 text-suave">Não há um pagamento confirmado para consultar.</p>
      </Shell>
    );
  }

  const tela = dadosDaTelaDaGarantia(
    pagamento.estado,
    pagamento.confirmado_em,
    precos.garantiaDias,
    new Date(),
  );

  return (
    <Shell acoes={<Link href="/app" className="text-marca underline">Voltar para o estudo</Link>}>
      <p className="text-sm font-semibold uppercase tracking-wide text-marca">Garantia</p>
      <h1 className="mt-2 text-3xl font-semibold">Pedido de reembolso</h1>
      <p className="mt-4 leading-7 text-suave">
        A janela é contada em dias corridos desde a confirmação do pagamento.
      </p>
      <p className="mt-5 rounded-md border border-linha bg-fundo-suave p-4 text-sm" role="status">
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
          <button type="submit" className="rounded-md bg-marca px-5 py-3 font-medium text-fundo">
            Solicitar reembolso
          </button>
        </form>
      ) : (
        <p className="mt-6 rounded-md border border-linha p-4 text-sm" role="status">
          {tela.recusa ?? "O pedido não está disponível para este pagamento."}
        </p>
      )}
    </Shell>
  );
}
