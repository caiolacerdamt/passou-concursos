"use server";

import { redirect } from "next/navigation";

import { clienteDaSessao } from "@/lib/db/sessao";
import { clienteDeServico } from "@/lib/db/servidor";
import { exigirMatriculaAtiva } from "@/modules/conta/matricula";
import { executarEsquecimento } from "@/modules/lgpd/esquecimento";
import { reportarErro } from "@/modules/observabilidade/reporte";
import { gatewayAsaasDoAmbiente } from "@/modules/pagamentos/asaas";
import { solicitarReembolso } from "@/modules/pagamentos/garantia";
import { obterPrecosPublicos } from "@/modules/pagamentos/preco";
import { criarRepositorioDePagamentos } from "@/modules/pagamentos/repositorio";

const DE_VOLTA_AO_LOGIN = "/entrar?proximo=%2Fapp%2Fconta";

function confirmou(formulario: FormData): boolean {
  return String(formulario.get("confirmacao") ?? "").trim().toUpperCase() === "APAGAR";
}

/**
 * A action ignora qualquer `user_id` do formulário. O titular vem do cookie
 * de sessão, e a confirmação textual existe para tornar um clique acidental
 * incapaz de iniciar a rotina irreversível.
 */
export async function solicitarEsquecimento(formulario: FormData): Promise<never> {
  await exigirMatriculaAtiva();

  if (!confirmou(formulario)) {
    redirect("/app/conta?aba=privacidade&resultado=confirmacao");
  }

  const sessao = await clienteDaSessao();
  const {
    data: { user },
  } = await sessao.auth.getUser();

  if (!user || !user.email) {
    redirect(DE_VOLTA_AO_LOGIN);
  }

  try {
    await executarEsquecimento({ id: user.id, email: user.email });
  } catch (erro) {
    reportarErro(erro, { modulo: "lgpd", operacao: "solicitar_esquecimento" });
    redirect("/app/conta?aba=privacidade&resultado=erro");
  }

  redirect("/entrar?resultado=esquecimento");
}

/**
 * O pedido de reembolso, que antes morava em `/app/reembolso`.
 *
 * Mudou de endereço e nada mais: a regra continua inteira em
 * `garantia.solicitarReembolso`, que é quem confere a janela, fala com o
 * gateway e fecha a matrícula.
 *
 * De propósito NÃO exige matrícula ativa. Quem já teve o estorno confirmado
 * pelo gateway e travou no fechamento local precisa conseguir repetir o
 * pedido, e nesse estado a matrícula pode já ter caído. A dona da autorização
 * é a sessão: o pagamento é buscado pelo `user.id` do cookie, nunca por
 * identificador vindo do formulário ou da URL.
 */
export async function pedirReembolso(): Promise<never> {
  const sessao = await clienteDaSessao();
  const {
    data: { user },
  } = await sessao.auth.getUser();
  if (!user) redirect(DE_VOLTA_AO_LOGIN);

  const precos = await obterPrecosPublicos();
  const repositorio = criarRepositorioDePagamentos(clienteDeServico());

  let gateway: ReturnType<typeof gatewayAsaasDoAmbiente>;
  try {
    gateway = gatewayAsaasDoAmbiente();
  } catch (erro) {
    /*
     * Config do gateway ilegível: nada foi pedido, nada foi gravado, ninguém
     * do outro lado ficou sabendo. Não é "em análise" — dizer isso, e ainda
     * pedir para o aluno não tentar de novo, seria mentir para ele largar um
     * pedido que não existe. É `indisponivel`, e o erro sobe para alguém
     * consertar a configuração.
     */
    reportarErro(erro, {
      modulo: "pagamentos",
      operacao: "pedir_reembolso",
      motivo: "gateway_nao_configurado",
    });
    redirect("/app/conta?aba=assinatura&resultado=indisponivel");
  }

  const resultado = await solicitarReembolso(user.id, precos.garantiaDias, new Date(), {
    buscarPagamentoDoUsuario: repositorio.buscarUltimoPagamentoDoUsuario,
    estornarCobranca: repositorioEstorno(gateway!),
    registrarPedidoDeReembolso: repositorio.registrarPedidoDeReembolso,
    confirmarReembolsoLocal: repositorio.confirmarReembolsoLocal,
    buscarFatura: repositorio.buscarFatura,
    cancelarNotaFiscal: async (faturaId) => {
      const cancelamento = await gateway!.cancelarNotaFiscal(faturaId);
      return { status: cancelamento.status };
    },
    registrarResultadoCancelamentoNF: async (input) =>
      repositorio.registrarResultadoCancelamentoFatura(input.pagamentoId, {
        estado: input.estado,
        statusGateway: input.statusGateway,
        codigo: input.codigo,
      }),
    abrirPendencia: (pagamentoId, tipo, codigo) =>
      repositorio.abrirPendencia(pagamentoId, tipo, codigo),
  });

  redirect(`/app/conta?aba=assinatura&resultado=${resultado.estado}`);
}

function repositorioEstorno(gateway: ReturnType<typeof gatewayAsaasDoAmbiente>) {
  return async (
    cobrancaId: string,
    meio: "CREDIT_CARD" | "PIX" | "BOLETO",
    descricao: string,
    parcelamentoId: string | null,
  ) => {
    const resultado = await gateway.estornarCobranca(
      cobrancaId,
      meio,
      descricao,
      parcelamentoId,
    );
    return { status: resultado.status };
  };
}
