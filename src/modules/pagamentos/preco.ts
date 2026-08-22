import { getParams } from "@/modules/config";

export const PARCELAS_DO_CARTAO = 12;

export type PrecosPublicos = {
  parcelado: {
    totalCentavos: number;
    parcelas: number;
    parcelaCentavos: number;
    totalFormatado: string;
    parcelaFormatada: string;
  };
  aVista: {
    totalCentavos: number;
    totalFormatado: string;
  };
  garantiaDias: number;
};

type EntradaDePreco = {
  precoAnualCentavos: number;
  descontoAVistaPercentual: number;
  garantiaDias: number;
};

/**
 * Calcula o DTO que pode chegar a uma pagina publica.
 *
 * As chaves da tabela de configuracao nao atravessam esta fronteira: a tela
 * recebe somente os valores comerciais que precisa mostrar.
 */
export function calcularPrecosPublicos(entrada: EntradaDePreco): PrecosPublicos {
  const totalParcelado = Math.trunc(entrada.precoAnualCentavos);
  const totalAVista = Math.round(
    totalParcelado * (1 - entrada.descontoAVistaPercentual),
  );

  return {
    parcelado: {
      totalCentavos: totalParcelado,
      parcelas: PARCELAS_DO_CARTAO,
      parcelaCentavos: Math.round(totalParcelado / PARCELAS_DO_CARTAO),
      totalFormatado: formatarBRL(totalParcelado),
      parcelaFormatada: formatarBRL(
        Math.round(totalParcelado / PARCELAS_DO_CARTAO),
      ),
    },
    aVista: {
      totalCentavos: totalAVista,
      totalFormatado: formatarBRL(totalAVista),
    },
    garantiaDias: Math.trunc(entrada.garantiaDias),
  };
}

/** Lê a configuração vigente e devolve apenas o contrato público da oferta. */
export async function obterPrecosPublicos(): Promise<PrecosPublicos> {
  const [precoAnualCentavos, descontoAVistaPercentual, garantiaDias] =
    await getParams(
      "param.m8.preco_anual_centavos",
      "param.m8.desconto_a_vista_percentual",
      "param.m8.garantia_dias",
    );

  return calcularPrecosPublicos({
    precoAnualCentavos,
    descontoAVistaPercentual,
    garantiaDias,
  });
}

function formatarBRL(centavos: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(centavos / 100);
}
