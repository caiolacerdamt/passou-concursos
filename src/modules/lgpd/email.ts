/**
 * Transporte server-only por convenção de importação: este módulo só é usado
 * por Server Actions/rotas do servidor e nunca por componente `use client`.
 * A chave fica somente no header HTTPS; o corpo não carrega token nem dado
 * operacional apagado.
 */

const ENDPOINT_RESEND = "https://api.resend.com/emails";
const TEXTO_DA_CONFIRMACAO =
  "Recebemos e concluímos o apagamento dos seus dados operacionais. " +
  "Registros fiscais necessários permanecem pelo prazo legal. " +
  "Se você não fez este pedido, responda a esta mensagem.";

export type ResultadoDoEmail =
  | { enviado: true }
  | {
      enviado: false;
      motivo: "configuracao_ausente" | "destinatario_invalido" | "indisponivel";
    };

export type FetchDoEmail = typeof fetch;

export type DependenciasDoEmail = {
  ambiente?: Record<string, string | undefined>;
  fetchImpl?: FetchDoEmail;
  timeoutMs?: number;
};

function emailValido(valor: string): boolean {
  return (
    valor.length >= 3 &&
    valor.length <= 320 &&
    !/[\r\n]/.test(valor) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)
  );
}

function valorDeAmbiente(
  ambiente: Record<string, string | undefined>,
  chave: string,
): string | null {
  const valor = ambiente[chave]?.trim();
  if (!valor || /[\r\n]/.test(valor)) return null;
  return valor;
}

/**
 * Envia a confirmação mínima para o titular. Configuração ausente e falha de
 * rede são resultados explícitos: o chamador não pode invalidar Auth fingindo
 * que o aviso foi enviado.
 */
export async function enviarConfirmacaoEsquecimento(
  destinatario: string,
  dependencias: DependenciasDoEmail = {},
): Promise<ResultadoDoEmail> {
  const ambiente = dependencias.ambiente ?? process.env;
  const apiKey = valorDeAmbiente(ambiente, "RESEND_API_KEY");
  const remetente = valorDeAmbiente(ambiente, "RESEND_FROM");

  if (!apiKey || !remetente) {
    return { enviado: false, motivo: "configuracao_ausente" };
  }
  if (!emailValido(destinatario)) {
    return { enviado: false, motivo: "destinatario_invalido" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), dependencias.timeoutMs ?? 5_000);

  try {
    const resposta = await (dependencias.fetchImpl ?? fetch)(ENDPOINT_RESEND, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: remetente,
        to: [destinatario],
        subject: "Confirmação do apagamento da sua conta",
        text: TEXTO_DA_CONFIRMACAO,
      }),
      signal: controller.signal,
    });

    if (!resposta.ok) return { enviado: false, motivo: "indisponivel" };
    return { enviado: true };
  } catch {
    return { enviado: false, motivo: "indisponivel" };
  } finally {
    clearTimeout(timer);
  }
}

