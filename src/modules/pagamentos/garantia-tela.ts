import {
  calcularGarantia,
  mensagemDaRecusaDaGarantia,
  type ResultadoDaGarantia,
} from "./garantia";

/**
 * O que a tela precisa saber sobre a garantia — e nada mais.
 *
 * Mora aqui, e não na página, porque a garantia deixou de ter rota própria
 * (`/app/reembolso`) e passou a ser um bloco de `/app/conta`. Uma função pura
 * entre a regra (`garantia.ts`) e o React é o que permite testar as seis
 * saídas sem montar página, sessão nem gateway.
 */

export type EstadoDoPagamento =
  | "pendente"
  | "confirmada"
  | "ativada"
  | "expirada"
  | "reembolsada";

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
    estadoPagamento: estado as EstadoDoPagamento,
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

export type FraseDaGarantia = {
  /** A frase grande, em voz de gente. */
  titulo: string;
  /** A consequência, sempre dita — inclusive quando é boa notícia. */
  nota: string;
  /**
   * Quantos dias já correram, para a régua de pips. `null` quando não há
   * contagem: sem confirmação não existe dia 1.
   */
  diaAtual: number | null;
};

function plural(n: number, singular: string, plural: string): string {
  return n === 1 ? singular : plural;
}

/**
 * A frase de cada saída de `calcularGarantia`.
 *
 * `diasPassados` conta dias corridos DESDE a confirmação: no próprio dia do
 * pagamento ele vale 0. Quem lê não pensa assim — para o aluno aquele é o
 * primeiro dia da garantia. Por isso a tela soma 1 ao exibir, e a régua tem
 * exatamente `garantiaDias` casas.
 */
export function fraseDaGarantia(
  tela: DadosDaTelaDaGarantia,
  garantiaDias: number,
): FraseDaGarantia {
  const { resultado } = tela;

  if (resultado.motivo === "ja_reembolsado") {
    return {
      titulo: "Este pagamento já foi reembolsado.",
      nota: "O prazo de crédito é do seu banco. O acesso ao produto foi encerrado.",
      diaAtual: null,
    };
  }

  if (resultado.motivo === "nao_confirmado") {
    return {
      titulo: "Seu pagamento ainda não foi confirmado.",
      nota: `A garantia só pode ser pedida depois da confirmação — e os ${garantiaDias} dias começam a contar de lá.`,
      diaAtual: null,
    };
  }

  if (resultado.motivo === "janela_encerrada") {
    return {
      titulo: `O prazo de ${garantiaDias} dias corridos da garantia terminou.`,
      nota: "Seu acesso continua valendo até o fim do período contratado.",
      diaAtual: null,
    };
  }

  const diaAtual = (resultado.diasPassados ?? 0) + 1;

  if (resultado.diasRestantes <= 1) {
    return {
      titulo: `Hoje é o último dia da garantia.`,
      nota: "Depois de hoje o pedido deixa de aparecer, e o acesso segue até o fim do período contratado.",
      diaAtual,
    };
  }

  /*
   * `diasRestantes` inclui hoje — é `garantiaDias - diasPassados`, e no dia da
   * confirmação vale o prazo inteiro. Dizer "dia 1 de 7" e "restam 7 dias" sem
   * mais nada se contradiz na cara do aluno; "contando hoje" é o que fecha a
   * conta (`diaAtual + diasRestantes === garantiaDias + 1`).
   */
  return {
    titulo: `Você está no dia ${diaAtual} de ${garantiaDias}.`,
    nota: `${plural(resultado.diasRestantes, "Resta", "Restam")} ${resultado.diasRestantes} ${plural(resultado.diasRestantes, "dia", "dias")}, contando hoje, para pedir o dinheiro de volta.`,
    diaAtual,
  };
}
