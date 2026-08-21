"use server";

import { redirect } from "next/navigation";

import { clienteDaSessao } from "@/lib/db/sessao";
import { clienteDeServico } from "@/lib/db/servidor";
import { obterPrecosPublicos } from "@/modules/pagamentos/preco";
import { gatewayAsaasDoAmbiente } from "@/modules/pagamentos/asaas";
import { solicitarReembolso } from "@/modules/pagamentos/garantia";
import { criarRepositorioDePagamentos } from "@/modules/pagamentos/repositorio";

export async function pedirReembolso() {
  const sessao = await clienteDaSessao();
  const {
    data: { user },
  } = await sessao.auth.getUser();
  if (!user) redirect("/entrar?proximo=%2Fapp%2Freembolso");

  const precos = await obterPrecosPublicos();
  const repositorio = criarRepositorioDePagamentos(clienteDeServico());
  let gateway: ReturnType<typeof gatewayAsaasDoAmbiente>;
  try {
    gateway = gatewayAsaasDoAmbiente();
  } catch {
    redirect("/app/reembolso?resultado=pendente");
  }

  const resultado = await solicitarReembolso(user.id, precos.garantiaDias, new Date(), {
    buscarPagamentoDoUsuario: repositorio.buscarUltimoPagamentoDoUsuario,
    estornarCobranca: repositorioEstorno(gateway!),
    registrarSolicitacaoReembolso: repositorio.registrarSolicitacaoReembolso,
    mudarEstado: (pagamentoId, motivo) =>
      repositorio.mudarEstado(pagamentoId, "reembolsada", motivo),
    marcarMatriculaReembolsada: repositorio.marcarMatriculaReembolsada,
    abrirPendencia: (pagamentoId, codigo) =>
      repositorio.abrirPendencia(pagamentoId, "alerta", codigo),
  });

  redirect(`/app/reembolso?resultado=${resultado.estado}`);
}

function repositorioEstorno(gateway: ReturnType<typeof gatewayAsaasDoAmbiente>) {
  return async (cobrancaId: string, meio: "CREDIT_CARD" | "PIX" | "BOLETO", descricao: string) => {
    const resultado = await gateway.estornarCobranca(cobrancaId, meio, descricao);
    return { status: resultado.status };
  };
}
