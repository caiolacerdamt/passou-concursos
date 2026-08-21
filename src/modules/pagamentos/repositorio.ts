import type { SupabaseClient } from "@supabase/supabase-js";

import { clienteDeServico } from "@/lib/db/servidor";

import type { MeioDePagamento } from "./contratos";

export type PagamentoCheckout = {
  id: string;
  email: string;
  valor_centavos: number;
  meio: MeioDePagamento;
  parcelas: number;
  referencia_interna: string;
  estado: string;
};

export type PagamentoOperacional = PagamentoCheckout & {
  produto_id: string;
  asaas_cliente_id: string | null;
  asaas_cobranca_id: string | null;
  asaas_status: string | null;
  resultado_url: string | null;
  resultado_boleto_url: string | null;
  resultado_pix_qr_code: string | null;
  resultado_pix_copia_e_cola: string | null;
  user_id: string | null;
  matricula_id: string | null;
  confirmado_em: string | null;
  ativado_em: string | null;
  criado_em: string;
};

export type ProdutoPagamento = {
  id: string;
  codigo: string;
  meses_de_acesso: number;
};

export type ResultadoGatewayPersistido = {
  clienteId: string;
  cobrancaId: string;
  status: string;
  invoiceUrl: string | null;
  bankSlipUrl: string | null;
  pixQrCode: string | null;
  pixCopiaECola: string | null;
};

type UsuarioAuth = { id: string; email?: string | undefined };

export function criarRepositorioDePagamentos(
  cliente: SupabaseClient = clienteDeServico(),
) {
  return {
    async existeMatriculaAtivaPorEmail(email: string): Promise<boolean> {
      const usuario = await obterUsuarioPorEmail(cliente, email);
      if (!usuario) return false;

      const { data, error } = await cliente
        .from("matriculas")
        .select("id")
        .eq("user_id", usuario.id)
        .eq("estado", "ativa")
        .gt("fim_em", new Date().toISOString())
        .maybeSingle();

      if (error) throw error;
      return data !== null;
    },

    async criarPagamentoPendente(input: {
      email: string;
      valorCentavos: number;
      meio: MeioDePagamento;
      parcelas: number;
      referenciaInterna: string;
      maiorDeIdade: boolean;
      termosVersao: string;
      aceitoEm: string;
    }): Promise<PagamentoCheckout> {
      const { data, error } = await cliente.rpc("criar_pagamento_checkout", {
        p_produto_codigo: "anual-unico",
        p_email: input.email,
        p_valor_centavos: input.valorCentavos,
        p_meio: input.meio,
        p_parcelas: input.parcelas,
        p_referencia_interna: input.referenciaInterna,
        p_maior_de_idade: input.maiorDeIdade,
        p_termos_versao: input.termosVersao,
        p_aceito_em: input.aceitoEm,
      });

      if (error || !data) throw error ?? new Error("pagamento nao criado");
      return data as PagamentoCheckout;
    },

    async salvarResultadoGateway(
      pagamentoId: string,
      resultado: ResultadoGatewayPersistido,
    ): Promise<void> {
      const { error } = await cliente
        .from("pagamentos")
        .update({
          asaas_cliente_id: resultado.clienteId,
          asaas_cobranca_id: resultado.cobrancaId,
          asaas_status: resultado.status,
          resultado_url: resultado.invoiceUrl,
          resultado_boleto_url: resultado.bankSlipUrl,
          resultado_pix_qr_code: resultado.pixQrCode,
          resultado_pix_copia_e_cola: resultado.pixCopiaECola,
        })
        .eq("id", pagamentoId);

      if (error) throw error;
    },

    async buscarPagamento(pagamentoId: string) {
      return buscarPagamentoCom(cliente, "id", pagamentoId);
    },

    async buscarPagamentoPorReferencia(referencia: string) {
      return buscarPagamentoCom(cliente, "referencia_interna", referencia);
    },

    async buscarPagamentoPorCobranca(cobrancaId: string) {
      return buscarPagamentoCom(cliente, "asaas_cobranca_id", cobrancaId);
    },

    async registrarEvento(input: {
      eventoId: string;
      tipo: string;
      cobrancaId: string | null;
      pagamentoId: string | null;
      resultado: "recebido" | "ignorado" | "rejeitado";
    }): Promise<boolean> {
      const { data, error } = await cliente.rpc("registrar_pagamento_evento", {
        p_evento_id: input.eventoId,
        p_tipo: input.tipo,
        p_asaas_cobranca_id: input.cobrancaId,
        p_pagamento_id: input.pagamentoId,
        p_resultado: input.resultado,
      });
      if (error) throw error;
      return data === true;
    },

    async mudarEstado(
      pagamentoId: string,
      novoEstado: "confirmada" | "ativada" | "expirada" | "reembolsada",
      motivo: string,
    ): Promise<void> {
      const { error } = await cliente.rpc("mudar_estado_pagamento", {
        p_pagamento_id: pagamentoId,
        p_novo_estado: novoEstado,
        p_motivo: motivo,
      });
      if (error) throw error;
    },

    async abrirPendencia(
      pagamentoId: string,
      tipo: "ativacao" | "nota_fiscal" | "reconciliacao" | "alerta",
      codigo: string,
    ): Promise<void> {
      const atual = await cliente
        .from("pagamento_pendencias")
        .select("id")
        .eq("pagamento_id", pagamentoId)
        .eq("tipo", tipo)
        .in("estado", ["aberta", "em_processamento"])
        .maybeSingle();
      if (atual.error) throw atual.error;
      if (atual.data) return;

      const { error } = await cliente.from("pagamento_pendencias").insert({
        pagamento_id: pagamentoId,
        tipo,
        ultima_falha_codigo: codigo,
        proxima_tentativa_em: new Date().toISOString(),
      });
      if (error) throw error;
    },
  };
}

const COLUNAS_PAGAMENTO_OPERACIONAL =
  "id, produto_id, email, valor_centavos, meio, parcelas, referencia_interna, asaas_cliente_id, asaas_cobranca_id, asaas_status, resultado_url, resultado_boleto_url, resultado_pix_qr_code, resultado_pix_copia_e_cola, estado, user_id, matricula_id, confirmado_em, ativado_em, criado_em";

async function buscarPagamentoCom(
  cliente: SupabaseClient,
  coluna: "id" | "referencia_interna" | "asaas_cobranca_id",
  valor: string,
): Promise<PagamentoOperacional | null> {
  const { data, error } = await cliente
    .from("pagamentos")
    .select(COLUNAS_PAGAMENTO_OPERACIONAL)
    .eq(coluna, valor)
    .maybeSingle();

  if (error) throw error;
  return data as PagamentoOperacional | null;
}

export async function obterUsuarioPorEmail(
  cliente: SupabaseClient,
  email: string,
): Promise<UsuarioAuth | null> {
  const procurado = email.trim().toLowerCase();
  for (let pagina = 1; pagina <= 100; pagina += 1) {
    const { data, error } = await cliente.auth.admin.listUsers({
      page: pagina,
      perPage: 1_000,
    });
    if (error) throw error;

    const usuario = data.users.find(
      (linha) => linha.email?.trim().toLowerCase() === procurado,
    );
    if (usuario) return { id: usuario.id, email: usuario.email };

    if (data.users.length === 0 || pagina >= (data.lastPage ?? pagina)) {
      break;
    }
  }

  return null;
}
