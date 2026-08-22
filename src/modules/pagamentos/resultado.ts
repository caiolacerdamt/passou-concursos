export type DadosDoResultado = {
  estado: string;
  /**
   * So para dizer ao comprador ONDE procurar o e-mail de senha, sempre
   * mascarado. A pagina e publica por capability token (aleatorio, TTL de 48h),
   * entao o endereco nunca aparece inteiro: mascarado ele confirma qual caixa
   * abrir sem entregar o endereco a quem topar com a URL.
   */
  email?: string | null;
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
  /**
   * O passo que falta para o comprador NOVO entrar. Sem isto a tela mandava
   * "voce ja pode entrar" para quem ainda nao tem senha, e o botao levava a uma
   * tela de login pedindo uma senha que nunca existiu.
   */
  avisoDeSenha: string | null;
  mostraPix: boolean;
  mostraBoleto: boolean;
  mostraAcompanhamento: boolean;
  acessoLiberado: boolean;
};

export function apresentarResultado(
  dados: DadosDoResultado,
): ResultadoApresentado {
  if (dados.estado === "ativada") {
    const destino = dados.email ? mascararEmail(dados.email) : null;
    return {
      titulo: "Pagamento confirmado",
      mensagem: "Sua conta foi ativada.",
      // Vale para os dois casos sem precisar consultar se a senha ja existe:
      // quem comprou pela primeira vez cria a senha pelo e-mail, e quem ja
      // tinha conta entra direto.
      avisoDeSenha: destino
        ? `Enviamos para ${destino} um e-mail com o link para você criar sua senha. Abra o e-mail para concluir. Se você já tem senha, é só entrar.`
        : "Enviamos um e-mail com o link para você criar sua senha. Abra o e-mail para concluir. Se você já tem senha, é só entrar.",
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
      avisoDeSenha: null,
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
    avisoDeSenha: null,
    mostraPix: dados.meio === "PIX" && Boolean(dados.pixCopiaECola || dados.pixQrCode),
    mostraBoleto: dados.meio === "BOLETO" && Boolean(dados.boletoUrl),
    mostraAcompanhamento: Boolean(dados.url),
    acessoLiberado: false,
  };
}

/**
 * Esconde o miolo do endereco, preservando o bastante para a pessoa reconhecer
 * a propria caixa: `caiolacerda07@gmail.com` vira `ca•••07@gmail.com`.
 *
 * Endereco curto perde o fim tambem — com duas letras de cada lado, um local
 * part de 4 caracteres apareceria inteiro, e mascara que nao mascara e pior que
 * mascara nenhuma, porque passa a impressao de protecao.
 */
export function mascararEmail(email: string): string {
  const arroba = email.lastIndexOf("@");
  if (arroba <= 0) return "•••";

  const local = email.slice(0, arroba);
  const dominio = email.slice(arroba);
  if (local.length <= 2) return `${local.slice(0, 1)}•••${dominio}`;

  const fim = local.length >= 7 ? local.slice(-2) : "";
  return `${local.slice(0, 2)}•••${fim}${dominio}`;
}
