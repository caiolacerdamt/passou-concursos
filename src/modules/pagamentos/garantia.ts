import type { EstadoDePagamento } from "./contratos";
import type { MeioDePagamento } from "./contratos";
import type { PagamentoOperacional } from "./repositorio";
import { reportarErro } from "@/modules/observabilidade/reporte";

export type DadosDaGarantia = {
  estadoPagamento: EstadoDePagamento;
  confirmadoEm: Date | string | null;
  garantiaDias: number;
  agora: Date | string;
};

export type ResultadoDaGarantia = {
  disponivel: boolean;
  diasPassados: number | null;
  diasRestantes: number;
  motivo: "nao_confirmado" | "janela_encerrada" | "ja_reembolsado" | null;
};

export type ResultadoDoReembolso =
  | { estado: "solicitado"; mensagem: string }
  | { estado: "recusado"; mensagem: string }
  | { estado: "pendente"; mensagem: string };

export type DependenciasDeReembolso = {
  buscarPagamentoDoUsuario(userId: string): Promise<PagamentoOperacional | null>;
  estornarCobranca(
    cobrancaId: string,
    meio: MeioDePagamento,
    descricao: string,
  ): Promise<{ status: string | null }>;
  registrarSolicitacaoReembolso(
    pagamentoId: string,
    userId: string,
    meio: MeioDePagamento,
    quando: string,
  ): Promise<void>;
  mudarEstado(pagamentoId: string, motivo: string): Promise<void>;
  marcarMatriculaReembolsada(matriculaId: string, userId: string): Promise<void>;
  abrirPendencia(pagamentoId: string, codigo: string): Promise<void>;
};

const MILISSEGUNDOS_POR_DIA = 86_400_000;

/**
 * Conta dias corridos por data UTC. Assim, a decisão é a mesma no navegador,
 * no servidor e no job, independentemente do horário em que cada um roda.
 */
export function diasCorridosEntre(
  inicio: Date | string,
  fim: Date | string,
): number {
  const inicioDia = inicioDoDiaUTC(converterData(inicio));
  const fimDia = inicioDoDiaUTC(converterData(fim));
  return Math.floor((fimDia - inicioDia) / MILISSEGUNDOS_POR_DIA);
}

export function calcularGarantia(dados: DadosDaGarantia): ResultadoDaGarantia {
  if (dados.estadoPagamento === "reembolsada") {
    return {
      disponivel: false,
      diasPassados: null,
      diasRestantes: 0,
      motivo: "ja_reembolsado",
    };
  }

  if (
    (dados.estadoPagamento !== "confirmada" &&
      dados.estadoPagamento !== "ativada") ||
    dados.confirmadoEm === null
  ) {
    return {
      disponivel: false,
      diasPassados: null,
      diasRestantes: 0,
      motivo: "nao_confirmado",
    };
  }

  const diasPassados = Math.max(
    0,
    diasCorridosEntre(dados.confirmadoEm, dados.agora),
  );
  const diasRestantes = Math.max(0, Math.trunc(dados.garantiaDias) - diasPassados);
  const disponivel = diasPassados < dados.garantiaDias;

  return {
    disponivel,
    diasPassados,
    diasRestantes,
    motivo: disponivel ? null : "janela_encerrada",
  };
}

export function mensagemDaRecusaDaGarantia(
  resultado: ResultadoDaGarantia,
): string | null {
  switch (resultado.motivo) {
    case "nao_confirmado":
      return "O reembolso só pode ser solicitado depois da confirmação do pagamento.";
    case "janela_encerrada":
      return "O prazo de sete dias corridos da garantia terminou.";
    case "ja_reembolsado":
      return "Este pagamento já foi reembolsado.";
    default:
      return null;
  }
}

export async function solicitarReembolso(
  userId: string,
  garantiaDias: number,
  agora: Date,
  dependencias: DependenciasDeReembolso,
): Promise<ResultadoDoReembolso> {
  const pagamento = await dependencias.buscarPagamentoDoUsuario(userId);
  if (!pagamento) {
    return {
      estado: "recusado",
      mensagem: "Não há um pagamento confirmado disponível para reembolso.",
    };
  }

  const janela = calcularGarantia({
    estadoPagamento: pagamento.estado as EstadoDePagamento,
    confirmadoEm: pagamento.confirmado_em,
    garantiaDias,
    agora,
  });
  const recusa = mensagemDaRecusaDaGarantia(janela);
  if (recusa) {
    await abrirPendenciaSegura(dependencias, pagamento.id, "tentativa_reembolso_invalida");
    return { estado: "recusado", mensagem: recusa };
  }

  if (!pagamento.asaas_cobranca_id) {
    await abrirPendenciaSegura(dependencias, pagamento.id, "cobranca_sem_id");
    return {
      estado: "pendente",
      mensagem: "Não conseguimos localizar o estorno agora. O pedido ficou em análise.",
    };
  }

  try {
    const estorno = await dependencias.estornarCobranca(
      pagamento.asaas_cobranca_id,
      pagamento.meio,
      "Garantia do plano anual",
    );
    if (!estornoConfirmado(estorno.status)) {
      await abrirPendenciaSegura(dependencias, pagamento.id, "estorno_aguardando_confirmacao");
      return {
        estado: "pendente",
        mensagem: "O estorno foi solicitado e aguarda confirmação do provedor.",
      };
    }

    const quando = agora.toISOString();
    await dependencias.registrarSolicitacaoReembolso(
      pagamento.id,
      userId,
      pagamento.meio,
      quando,
    );
    await dependencias.mudarEstado(pagamento.id, "reembolso_confirmado");
    if (pagamento.matricula_id) {
      await dependencias.marcarMatriculaReembolsada(pagamento.matricula_id, userId);
    }

    return {
      estado: "solicitado",
      mensagem: "Reembolso confirmado. O acesso foi encerrado.",
    };
  } catch (erro) {
    await abrirPendenciaSegura(dependencias, pagamento.id, "falha_no_estorno");
    reportarErro(erro, {
      modulo: "pagamentos",
      operacao: "solicitar_reembolso",
      pagamento_id: pagamento.id,
      motivo: "gateway_ou_persistencia_falhou",
    });
    return {
      estado: "pendente",
      mensagem: "Não conseguimos concluir o reembolso agora. O pedido ficou em análise.",
    };
  }
}

function estornoConfirmado(status: string | null): boolean {
  return status !== null && ["DONE", "CONFIRMED", "REFUNDED"].includes(status.toUpperCase());
}

async function abrirPendenciaSegura(
  dependencias: Pick<DependenciasDeReembolso, "abrirPendencia">,
  pagamentoId: string,
  codigo: string,
): Promise<void> {
  try {
    await dependencias.abrirPendencia(pagamentoId, codigo);
  } catch (erro) {
    reportarErro(erro, {
      modulo: "pagamentos",
      operacao: "abrir_pendencia_reembolso",
      pagamento_id: pagamentoId,
      codigo,
    });
  }
}

function converterData(data: Date | string): Date {
  const convertida = data instanceof Date ? new Date(data.getTime()) : new Date(data);
  if (Number.isNaN(convertida.getTime())) {
    throw new Error("data da garantia invalida");
  }
  return convertida;
}

function inicioDoDiaUTC(data: Date): number {
  return Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate());
}
