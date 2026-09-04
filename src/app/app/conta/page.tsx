import { redirect } from "next/navigation";

import { clienteDaSessao } from "@/lib/db/sessao";
import { clienteDeServico } from "@/lib/db/servidor";
import { exigirMatriculaAtiva } from "@/modules/conta/matricula";
import { ContaTela, abaValida, type DadosDaConta } from "@/modules/conta/conta-tela";
import { reportarErro } from "@/modules/observabilidade/reporte";
import { dadosDaTelaDaGarantia } from "@/modules/pagamentos/garantia-tela";
import { formatarBRL, obterPrecosPublicos } from "@/modules/pagamentos/preco";
import { criarRepositorioDePagamentos } from "@/modules/pagamentos/repositorio";

import { pedirReembolso, solicitarEsquecimento } from "./acoes";

export const dynamic = "force-dynamic";

function comoTexto(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

/**
 * Quanto do período contratado já correu, de 0 a 1.
 *
 * Sai da própria matrícula, e não de um "12 meses" fixo: se o produto vender
 * outro período, a trilha acompanha sem ninguém lembrar de mudar isto.
 */
function progressoDoPeriodo(
  confirmadoEm: string | null,
  fimEm: string,
  agora: Date,
): number | null {
  if (!confirmadoEm) return null;

  const inicio = new Date(confirmadoEm).getTime();
  const fim = new Date(fimEm).getTime();
  if (Number.isNaN(inicio) || Number.isNaN(fim) || fim <= inicio) return null;

  const fracao = (agora.getTime() - inicio) / (fim - inicio);
  return Math.min(1, Math.max(0, fracao));
}

/**
 * A parte da tela que depende de pagamento e configuração.
 *
 * Falhar aqui NÃO pode derrubar a conta inteira — e, principalmente, não pode
 * abrir o botão de reembolso por engano: sem preço legível não há janela para
 * conferir, então o bloco some em vez de aparecer liberado. Falha fechada.
 */
async function carregarAssinatura(
  userId: string,
  fimDoAcesso: string,
  agora: Date,
): Promise<Pick<DadosDaConta, "assinatura" | "garantia">> {
  try {
    const precos = await obterPrecosPublicos();
    const pagamento = await criarRepositorioDePagamentos(
      clienteDeServico(),
    ).buscarUltimoPagamentoDoUsuario(userId);

    if (!pagamento) return { assinatura: null, garantia: null };

    return {
      assinatura: {
        valorFormatado: formatarBRL(Number(pagamento.valor_centavos)),
        meio: pagamento.meio,
        parcelas: Number(pagamento.parcelas ?? 1),
        confirmadoEm: pagamento.confirmado_em,
        estado: pagamento.estado,
        progresso: progressoDoPeriodo(pagamento.confirmado_em, fimDoAcesso, agora),
      },
      garantia: {
        tela: dadosDaTelaDaGarantia(
          pagamento.estado,
          pagamento.confirmado_em,
          precos.garantiaDias,
          agora,
        ),
        dias: precos.garantiaDias,
      },
    };
  } catch (erro) {
    reportarErro(erro, { modulo: "pagamentos", operacao: "carregar_assinatura_da_conta" });
    return { assinatura: null, garantia: null };
  }
}

export default async function Conta({
  searchParams,
}: {
  searchParams: Promise<{ resultado?: string | string[]; aba?: string | string[] }>;
}) {
  const matricula = await exigirMatriculaAtiva();
  const sessao = await clienteDaSessao();
  const {
    data: { user },
  } = await sessao.auth.getUser();

  if (!user?.email) {
    redirect("/entrar?proximo=%2Fapp%2Fconta");
  }

  const parametros = await searchParams;
  const agora = new Date();
  const assinatura = await carregarAssinatura(user.id, matricula.fim_em, agora);

  return (
    <ContaTela
      aba={abaValida(comoTexto(parametros.aba))}
      resultado={comoTexto(parametros.resultado)}
      agora={agora}
      dados={{
        email: user.email,
        fimDoAcesso: matricula.fim_em,
        ...assinatura,
      }}
      solicitarEsquecimento={solicitarEsquecimento}
      pedirReembolso={pedirReembolso}
    />
  );
}
