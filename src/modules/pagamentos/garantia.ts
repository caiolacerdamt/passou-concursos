import type { EstadoDePagamento } from "./contratos";

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
