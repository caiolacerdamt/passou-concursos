import { clienteDeServico } from "@/lib/db/servidor";
import { emitirEventoDoFunilNaoBloqueante } from "@/modules/analytics/posthog";
import { reportarErro } from "@/modules/observabilidade/reporte";
import { gatewayAsaasDoAmbiente } from "@/modules/pagamentos/asaas";
import {
  ativarPagamentoConfirmado,
  criarDependenciasDeAtivacao,
} from "@/modules/pagamentos/ativacao";
import { fecharReembolsoConfirmado } from "@/modules/pagamentos/garantia";
import {
  criarRepositorioDePagamentos,
  type PagamentoOperacional,
} from "@/modules/pagamentos/repositorio";
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
  let gateway: ReturnType<typeof gatewayAsaasDoAmbiente> | undefined;
  try {
    gateway = gatewayAsaasDoAmbiente();
  } catch (erro) {
    reportarErro(erro, {
      modulo: "pagamentos",
      operacao: "webhook_asaas",
      motivo: "gateway_ausente_para_nf",
    });
  }

  return tratarRequisicaoWebhook(request, {
    tokenEsperado: process.env.ASAAS_WEBHOOK_TOKEN,
    processar: async (evento) =>
      processarEventoAsaas(evento, {
        ...repositorio,
        emitirPagamentoConfirmado: () =>
          emitirEventoDoFunilNaoBloqueante("pagamento_confirmado"),
        fecharReembolso: async (pagamento) => {
          // Sem dono nao ha o que encerrar: o acesso ja nao existe. Vira
          // pendencia para a operacao olhar, nunca silencio.
          if (!pagamento.user_id) {
            await repositorio.abrirPendencia(
              pagamento.id,
              "alerta",
              "estorno_sem_dono",
            );
            return;
          }
          await fecharReembolsoConfirmado(
            pagamento,
            pagamento.user_id,
            new Date(),
            "reembolso_confirmado_webhook",
            {
              confirmarReembolsoLocal: repositorio.confirmarReembolsoLocal,
              buscarFatura: repositorio.buscarFatura,
              cancelarNotaFiscal: gateway
                ? async (faturaId) => ({
                    status: (await gateway.cancelarNotaFiscal(faturaId)).status,
                  })
                : undefined,
              registrarResultadoCancelamentoNF: async (input) =>
                repositorio.registrarResultadoCancelamentoFatura(input.pagamentoId, {
                  estado: input.estado,
                  statusGateway: input.statusGateway,
                  codigo: input.codigo,
                }),
              abrirPendencia: (pagamentoId, tipo, codigo) =>
                repositorio.abrirPendencia(pagamentoId, tipo, codigo),
            },
          );
        },
        encaminharParaAtivacao: async (pagamentoId) => {
          await ativarPagamentoConfirmado(
            pagamentoId,
            criarDependenciasDeAtivacao(
              repositorio,
              gateway ? criarAgendadorDeNotaFiscal(gateway) : undefined,
            ),
          );
        },
      }),
  });
}

function criarAgendadorDeNotaFiscal(
  gateway: ReturnType<typeof gatewayAsaasDoAmbiente>,
) {
  const nomeServico = process.env.ASAAS_NF_NOME_SERVICO?.trim();
  const codigoServico = process.env.ASAAS_NF_CODIGO_SERVICO?.trim();
  const impostos = lerImpostos(process.env.ASAAS_NF_IMPOSTOS_JSON);

  if (!nomeServico || !codigoServico || !impostos) return undefined;

  return async (pagamento: PagamentoOperacional) => {
    if (!pagamento.asaas_cobranca_id) throw new Error("cobranca sem referencia para NF");
    return gateway.agendarNotaFiscal({
      pagamentoId: pagamento.asaas_cobranca_id,
      referenciaExterna: pagamento.referencia_interna,
      descricaoServico: "Acesso anual ao Passou Concursos",
      observacoes: "Serviço educacional",
      valorCentavos: pagamento.valor_centavos,
      dataEfetiva: new Date().toISOString().slice(0, 10),
      nomeServicoMunicipal: nomeServico,
      codigoServicoMunicipal: codigoServico,
      impostos,
    });
  };
}

function lerImpostos(valor: string | undefined): Record<string, unknown> | null {
  if (!valor?.trim()) return null;
  try {
    const parsed: unknown = JSON.parse(valor);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
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
