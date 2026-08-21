import { clienteDeServico } from "@/lib/db/servidor";
import { reportarErro } from "@/modules/observabilidade/reporte";
import { criarRepositorioDePagamentos } from "@/modules/pagamentos/repositorio";
import {
  contentTypeWebhookValido,
  interpretarCorpoWebhook,
  processarEventoAsaas,
  tokenWebhookValido,
  type DependenciasDoWebhook,
} from "@/modules/pagamentos/webhook";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const repositorio = criarRepositorioDePagamentos(clienteDeServico());
  return tratarRequisicaoWebhook(request, {
    tokenEsperado: process.env.ASAAS_WEBHOOK_TOKEN,
    processar: async (evento) =>
      processarEventoAsaas(evento, {
        ...repositorio,
        encaminharParaAtivacao: async (pagamentoId) => {
          await repositorio.abrirPendencia(pagamentoId, "ativacao", "aguardando_ativacao");
        },
      }),
  });
}

export async function tratarRequisicaoWebhook(
  request: Request,
  dependencias: {
    tokenEsperado: string | undefined;
    processar: DependenciasDoWebhook["encaminharParaAtivacao"] extends never
      ? never
      : (evento: ReturnType<typeof interpretarCorpoWebhook> extends infer T ? T : never) => Promise<string>;
  },
): Promise<Response> {
  if (!contentTypeWebhookValido(request.headers.get("content-type"))) {
    return Response.json({ recebido: false, erro: "content_type_invalido" }, { status: 415 });
  }

  if (!tokenWebhookValido(
    request.headers.get("asaas-access-token"),
    dependencias.tokenEsperado,
  )) {
    reportarErro(new Error("token de webhook invalido"), {
      modulo: "pagamentos",
      operacao: "webhook_asaas",
      motivo: "autenticacao_rejeitada",
    });
    return Response.json({ recebido: false, erro: "nao autorizado" }, { status: 401 });
  }

  let evento: ReturnType<typeof interpretarCorpoWebhook>;
  try {
    evento = interpretarCorpoWebhook(await request.text());
  } catch (erro) {
    reportarErro(erro, {
      modulo: "pagamentos",
      operacao: "webhook_asaas",
      motivo: "corpo_invalido",
    });
    return Response.json({ recebido: false, erro: "corpo invalido" }, { status: 400 });
  }

  try {
    const resultado = await dependencias.processar(evento);
    if (resultado === "ignorado" || resultado === "rejeitado") {
      reportarErro(new Error("evento de pagamento nao processado"), {
        modulo: "pagamentos",
        operacao: "webhook_asaas",
        tipo_evento: evento.tipo,
        resultado,
      });
    }
    return Response.json({ recebido: true, resultado }, { status: 200 });
  } catch (erro) {
    reportarErro(erro, {
      modulo: "pagamentos",
      operacao: "webhook_asaas",
      tipo_evento: evento.tipo,
      motivo: "falha_de_processamento",
    });
    return Response.json({ recebido: false, erro: "processamento pendente" }, { status: 202 });
  }
}
