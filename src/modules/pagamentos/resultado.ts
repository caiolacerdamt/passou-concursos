export type DadosDoResultado = {
  estado: string;
  meio: string;
  statusGateway: string | null;
  url: string | null;
  boletoUrl: string | null;
  pixQrCode: string | null;
  pixCopiaECola: string | null;
};

export type ResultadoApresentado = {
  titulo: string;
  mensagem: string;
  mostraPix: boolean;
  mostraBoleto: boolean;
  mostraAcompanhamento: boolean;
  acessoLiberado: boolean;
};

export function apresentarResultado(
  dados: DadosDoResultado,
): ResultadoApresentado {
  if (dados.estado === "ativada") {
    return {
      titulo: "Pagamento confirmado",
      mensagem: "Sua conta foi ativada. Você já pode entrar para começar.",
      mostraPix: false,
      mostraBoleto: false,
      mostraAcompanhamento: false,
      acessoLiberado: true,
    };
  }

  if (dados.estado === "reembolsada") {
    return {
      titulo: "Pagamento reembolsado",
      mensagem: "O acesso associado a este pagamento foi encerrado.",
      mostraPix: false,
      mostraBoleto: false,
      mostraAcompanhamento: false,
      acessoLiberado: false,
    };
  }

  return {
    titulo: "Cobrança criada",
    mensagem:
      "A cobrança foi registrada. A confirmação e a ativação da conta acontecem depois do retorno do meio de pagamento.",
    mostraPix: dados.meio === "PIX" && Boolean(dados.pixCopiaECola || dados.pixQrCode),
    mostraBoleto: dados.meio === "BOLETO" && Boolean(dados.boletoUrl),
    mostraAcompanhamento: Boolean(dados.url),
    acessoLiberado: false,
  };
}
