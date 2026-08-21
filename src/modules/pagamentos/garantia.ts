import type { EstadoDePagamento } from "./contratos";
import type { MeioDePagamento } from "./contratos";
import type { FaturaOperacional, PagamentoOperacional } from "./repositorio";
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
  | {
      estado: "solicitado";
      mensagem: string;
      notaFiscal: "ausente" | "cancelada" | "processando" | "negada" | "pendente";
    }
  | { estado: "recusado"; mensagem: string }
  | { estado: "pendente"; mensagem: string };

export type DependenciasDeReembolso = {
  buscarPagamentoDoUsuario(userId: string): Promise<PagamentoOperacional | null>;
  estornarCobranca(
    cobrancaId: string,
    meio: MeioDePagamento,
    descricao: string,
  ): Promise<{ status: string | null }>;
  confirmarReembolsoLocal(input: {
    pagamentoId: string;
    userId: string;
    meio: MeioDePagamento;
    quando: string;
    motivo: string;
  }): Promise<void>;
  buscarFatura?(pagamentoId: string): Promise<FaturaOperacional | null>;
  cancelarNotaFiscal?(faturaId: string): Promise<{ status: string | null }>;
  registrarResultadoCancelamentoNF?(input: {
    pagamentoId: string;
    estado:
      | "cancelamento_processando"
      | "cancelada"
      | "cancelamento_negado"
      | "falha_cancelamento";
    statusGateway: string | null;
    codigo: string | null;
  }): Promise<void>;
  abrirPendencia(
    pagamentoId: string,
    tipo: "alerta" | "nota_fiscal",
    codigo: string,
  ): Promise<void>;
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

  // Se o gateway já confirmou em uma tentativa anterior, a operação segura é
  // repetir somente o fechamento local. Isso corrige a janela reembolsada +
  // matrícula ativa sem emitir um segundo estorno externo.
  if (pagamento.estado === "reembolsada") {
    try {
      await dependencias.confirmarReembolsoLocal({
        pagamentoId: pagamento.id,
        userId,
        meio: pagamento.meio,
        quando: agora.toISOString(),
        motivo: "reembolso_confirmado_retry_local",
      });
      const notaFiscal = await processarCancelamentoDaNotaFiscal(
        pagamento,
        dependencias,
      );
      return {
        estado: "solicitado",
        mensagem: mensagemDeSucessoDoReembolso(notaFiscal),
        notaFiscal,
      };
    } catch (erro) {
      await abrirPendenciaSegura(
        dependencias,
        pagamento.id,
        "alerta",
        "falha_fechamento_reembolso",
      );
      reportarErro(erro, {
        modulo: "pagamentos",
        operacao: "retry_fechamento_reembolso",
        pagamento_id: pagamento.id,
      });
      return {
        estado: "pendente",
        mensagem: "O acesso ainda está sendo encerrado. O pedido ficou em análise.",
      };
    }
  }

  const janela = calcularGarantia({
    estadoPagamento: pagamento.estado as EstadoDePagamento,
    confirmadoEm: pagamento.confirmado_em,
    garantiaDias,
    agora,
  });
  const recusa = mensagemDaRecusaDaGarantia(janela);
  if (recusa) {
    await abrirPendenciaSegura(
      dependencias,
      pagamento.id,
      "alerta",
      "tentativa_reembolso_invalida",
    );
    return { estado: "recusado", mensagem: recusa };
  }

  if (!pagamento.asaas_cobranca_id) {
    await abrirPendenciaSegura(
      dependencias,
      pagamento.id,
      "alerta",
      "cobranca_sem_id",
    );
    return {
      estado: "pendente",
      mensagem: "Não conseguimos localizar o estorno agora. O pedido ficou em análise.",
    };
  }

  let gatewayConfirmado = false;
  try {
    const estorno = await dependencias.estornarCobranca(
      pagamento.asaas_cobranca_id,
      pagamento.meio,
      "Garantia do plano anual",
    );
    if (!estornoConfirmado(estorno.status)) {
      await abrirPendenciaSegura(
        dependencias,
        pagamento.id,
        "alerta",
        "estorno_aguardando_confirmacao",
      );
      return {
        estado: "pendente",
        mensagem: "O estorno foi solicitado e aguarda confirmação do provedor.",
      };
    }
    gatewayConfirmado = true;

    const quando = agora.toISOString();
    await dependencias.confirmarReembolsoLocal({
      pagamentoId: pagamento.id,
      userId,
      meio: pagamento.meio,
      quando,
      motivo: "reembolso_confirmado",
    });
    const notaFiscal = await processarCancelamentoDaNotaFiscal(
      pagamento,
      dependencias,
    );

    return {
      estado: "solicitado",
      mensagem: mensagemDeSucessoDoReembolso(notaFiscal),
      notaFiscal,
    };
  } catch (erro) {
    await abrirPendenciaSegura(
      dependencias,
      pagamento.id,
      "alerta",
      gatewayConfirmado ? "falha_fechamento_reembolso" : "falha_no_estorno",
    );
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
  tipo: "alerta" | "nota_fiscal",
  codigo: string,
): Promise<void> {
  try {
    await dependencias.abrirPendencia(pagamentoId, tipo, codigo);
  } catch (erro) {
    reportarErro(erro, {
      modulo: "pagamentos",
      operacao: "abrir_pendencia_reembolso",
      pagamento_id: pagamentoId,
      codigo,
    });
  }
}

type ResultadoDoCancelamentoDaNota =
  | "ausente"
  | "cancelada"
  | "processando"
  | "negada"
  | "pendente";

async function processarCancelamentoDaNotaFiscal(
  pagamento: PagamentoOperacional,
  dependencias: DependenciasDeReembolso,
): Promise<ResultadoDoCancelamentoDaNota> {
  if (!dependencias.buscarFatura || !dependencias.registrarResultadoCancelamentoNF) {
    return "ausente";
  }

  let fatura: FaturaOperacional | null;
  try {
    fatura = await dependencias.buscarFatura(pagamento.id);
  } catch (erro) {
    await abrirPendenciaSegura(
      dependencias,
      pagamento.id,
      "nota_fiscal",
      "falha_consulta_nf_reembolso",
    );
    reportarErro(erro, {
      modulo: "pagamentos",
      operacao: "consultar_nf_reembolso",
      pagamento_id: pagamento.id,
    });
    return "pendente";
  }

  if (!fatura?.asaas_fatura_id) return "ausente";
  if (fatura.estado === "cancelada") return "cancelada";
  if (fatura.estado === "cancelamento_processando") return "processando";
  if (fatura.estado === "cancelamento_negado") return "negada";
  if (!dependencias.cancelarNotaFiscal) {
    await registrarFalhaDeCancelamentoNF(
      pagamento.id,
      null,
      "configuracao_cancelamento_nf_ausente",
      dependencias,
    );
    return "pendente";
  }

  try {
    const resposta = await dependencias.cancelarNotaFiscal(fatura.asaas_fatura_id);
    const status = resposta.status?.toUpperCase() ?? null;
    if (status === "CANCELED") {
      await dependencias.registrarResultadoCancelamentoNF({
        pagamentoId: pagamento.id,
        estado: "cancelada",
        statusGateway: status,
        codigo: null,
      });
      return "cancelada";
    }
    if (status === "PROCESSING_CANCELLATION") {
      await dependencias.registrarResultadoCancelamentoNF({
        pagamentoId: pagamento.id,
        estado: "cancelamento_processando",
        statusGateway: status,
        codigo: null,
      });
      await abrirPendenciaSegura(
        dependencias,
        pagamento.id,
        "nota_fiscal",
        "cancelamento_nf_em_processamento",
      );
      return "processando";
    }
    if (status === "CANCELLATION_DENIED") {
      await dependencias.registrarResultadoCancelamentoNF({
        pagamentoId: pagamento.id,
        estado: "cancelamento_negado",
        statusGateway: status,
        codigo: "cancelamento_nf_negado",
      });
      await abrirPendenciaSegura(
        dependencias,
        pagamento.id,
        "nota_fiscal",
        "cancelamento_nf_negado",
      );
      reportarErro(new Error("cancelamento de NF negado"), {
        modulo: "pagamentos",
        operacao: "cancelar_nf_reembolso",
        pagamento_id: pagamento.id,
        status_gateway: status,
      });
      return "negada";
    }

    await registrarFalhaDeCancelamentoNF(
      pagamento.id,
      status,
      "status_cancelamento_nf_desconhecido",
      dependencias,
    );
    return "pendente";
  } catch (erro) {
    await registrarFalhaDeCancelamentoNF(
      pagamento.id,
      null,
      "falha_cancelamento_nf",
      dependencias,
    );
    reportarErro(erro, {
      modulo: "pagamentos",
      operacao: "cancelar_nf_reembolso",
      pagamento_id: pagamento.id,
    });
    return "pendente";
  }
}

async function registrarFalhaDeCancelamentoNF(
  pagamentoId: string,
  statusGateway: string | null,
  codigo: string,
  dependencias: DependenciasDeReembolso,
): Promise<void> {
  try {
    await dependencias.registrarResultadoCancelamentoNF?.({
      pagamentoId,
      estado: "falha_cancelamento",
      statusGateway,
      codigo,
    });
    await abrirPendenciaSegura(
      dependencias,
      pagamentoId,
      "nota_fiscal",
      codigo,
    );
  } catch (erro) {
    reportarErro(erro, {
      modulo: "pagamentos",
      operacao: "persistir_cancelamento_nf",
      pagamento_id: pagamentoId,
      codigo,
    });
  }
}

function mensagemDeSucessoDoReembolso(
  notaFiscal: ResultadoDoCancelamentoDaNota,
): string {
  if (notaFiscal === "processando" || notaFiscal === "negada" || notaFiscal === "pendente") {
    return "Reembolso confirmado. O acesso foi encerrado; a nota fiscal ficou em análise.";
  }
  return "Reembolso confirmado. O acesso foi encerrado.";
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
