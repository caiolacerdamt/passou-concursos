"use server";

import { redirect } from "next/navigation";

import { clienteDaSessao } from "@/lib/db/sessao";
import { clienteDeServico } from "@/lib/db/servidor";
import { problemaDaSenha } from "@/modules/conta/senha";
import {
  conferirSenhaAtual,
  provedoresDoUsuario,
  temSenhaPropria,
} from "@/modules/conta/troca-de-senha";
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
 *
 * De propósito **não** exige matrícula ativa, pelo mesmo motivo de
 * `pedirReembolso` logo abaixo: o direito ao esquecimento (LGPD art. 18) não
 * vence junto com o acesso, e quem mais pede apagamento é exatamente quem já
 * saiu. Exigir matrícula aqui mandava esse aluno para `/assinar` — ou seja,
 * cobrava uma matrícula nova para ele conseguir apagar os dados.
 *
 * A dona da autorização continua sendo a sessão, e ela é única: o apagamento
 * roda sobre o `user.id` do cookie, nunca sobre identificador de formulário.
 */
export async function solicitarEsquecimento(formulario: FormData): Promise<never> {
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
 * Trocar a senha sem sair da conta (PAG-07).
 *
 * Também **não** exige matrícula: quem venceu continua tendo uma conta, e uma
 * conta que não dá para proteger é um problema de segurança, não de plano.
 *
 * A regra da senha nova é a única do produto, `problemaDaSenha`. A senha atual
 * é conferida num cliente descartável — `updateUser` não a pede, e sem isso uma
 * sessão esquecida aberta troca a senha e tranca o dono fora.
 *
 * Todas as recusas usam a **mesma** mensagem genérica. Dizer "a senha atual
 * está errada" transformaria o formulário num verificador de senha para quem
 * pegou a sessão aberta — que é exatamente contra quem a conferência existe.
 */
export async function trocarSenha(formulario: FormData): Promise<never> {
  const atual = String(formulario.get("senha_atual") ?? "");
  const nova = String(formulario.get("senha") ?? "");

  const sessao = await clienteDaSessao();
  const {
    data: { user },
  } = await sessao.auth.getUser();

  if (!user?.email) {
    redirect(DE_VOLTA_AO_LOGIN);
  }

  if (!temSenhaPropria(provedoresDoUsuario(user))) {
    /*
     * Conta só-Google não tem senha para trocar, e a tela nem mostra o
     * formulário. Chegar aqui é pedido forjado: recusa, sem criar senha nova
     * para uma conta que entra por outro caminho.
     */
    redirect("/app/conta?aba=privacidade&resultado=senha_sem_formulario");
  }

  // O comprimento antes da rede: senha curta não merece uma ida ao Auth.
  if (problemaDaSenha(nova)) {
    redirect("/app/conta?aba=privacidade&resultado=senha_curta");
  }

  if (!(await conferirSenhaAtual(user.email, atual))) {
    redirect("/app/conta?aba=privacidade&resultado=senha_recusada");
  }

  const { error } = await sessao.auth.updateUser({ password: nova });
  if (error) {
    reportarErro(error, { modulo: "conta", operacao: "trocar_senha" });
    redirect("/app/conta?aba=privacidade&resultado=senha_recusada");
  }

  redirect("/app/conta?aba=privacidade&resultado=senha_trocada");
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
