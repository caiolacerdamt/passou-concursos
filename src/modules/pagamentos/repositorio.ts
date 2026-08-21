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

    async buscarUltimoPagamentoDoUsuario(userId: string) {
      const { data, error } = await cliente
        .from("pagamentos")
        .select(COLUNAS_PAGAMENTO_OPERACIONAL)
        .eq("user_id", userId)
        .in("estado", ["pendente", "confirmada", "ativada", "expirada", "reembolsada"])
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as PagamentoOperacional | null;
    },

    async registrarSolicitacaoReembolso(
      pagamentoId: string,
      userId: string,
      meio: MeioDePagamento,
      quando: string,
    ): Promise<void> {
      const { error } = await cliente
        .from("pagamentos")
        .update({
          reembolso_solicitado_por: userId,
          reembolso_solicitado_em: quando,
          reembolso_meio: meio,
        })
        .eq("id", pagamentoId)
        .eq("user_id", userId);
      if (error) throw error;
    },

    async marcarMatriculaReembolsada(
      matriculaId: string,
      userId: string,
    ): Promise<void> {
      const { error } = await cliente
        .from("matriculas")
        .update({ estado: "reembolsada" })
        .eq("id", matriculaId)
        .eq("user_id", userId)
        .eq("estado", "ativa");
      if (error) throw error;
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

    async reservarAtivacao(pagamentoId: string, dono: string): Promise<boolean> {
      const { data, error } = await cliente.rpc("reservar_ativacao_pagamento", {
        p_pagamento_id: pagamentoId,
        p_dono: dono,
      });
      if (error) throw error;
      return data === true;
    },

    async buscarProduto(produtoId: string): Promise<ProdutoPagamento | null> {
      const { data, error } = await cliente
        .from("produtos")
        .select("id, codigo, meses_de_acesso")
        .eq("id", produtoId)
        .maybeSingle();
      if (error) throw error;
      return data as ProdutoPagamento | null;
    },

    async buscarMatriculaAtiva(userId: string): Promise<{ id: string } | null> {
      const { data, error } = await cliente
        .from("matriculas")
        .select("id")
        .eq("user_id", userId)
        .eq("estado", "ativa")
        .gt("fim_em", new Date().toISOString())
        .maybeSingle();
      if (error) throw error;
      return data as { id: string } | null;
    },

    async criarUsuario(email: string): Promise<{ id: string }> {
      const { data, error } = await cliente.auth.admin.createUser({
        email,
        email_confirm: true,
      });
      if (error || !data.user) {
        const existente = await obterUsuarioPorEmail(cliente, email);
        if (existente) return existente;
        throw error ?? new Error("usuario nao criado");
      }
      return { id: data.user.id };
    },

    async buscarUsuarioPorEmail(email: string): Promise<{ id: string } | null> {
      return obterUsuarioPorEmail(cliente, email);
    },

    async enviarDefinicaoDeSenha(email: string): Promise<void> {
      const origem = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
      const { error } = await cliente.auth.resetPasswordForEmail(email, {
        redirectTo: `${origem}/auth/callback?proximo=%2Fdefinir-senha`,
      });
      if (error) throw error;
    },

    async criarMatricula(userId: string, produtoId: string): Promise<{ id: string }> {
      const { data, error } = await cliente
        .from("matriculas")
        .insert({ user_id: userId, produto_id: produtoId })
        .select("id")
        .single();
      if (error || !data) throw error ?? new Error("matricula nao criada");
      return data as { id: string };
    },

    async vincularPagamento(
      pagamentoId: string,
      userId: string,
      matriculaId: string,
    ): Promise<void> {
      const { error } = await cliente
        .from("pagamentos")
        .update({ user_id: userId, matricula_id: matriculaId })
        .eq("id", pagamentoId);
      if (error) throw error;
    },

    async garantirFatura(pagamentoId: string): Promise<void> {
      const { error } = await cliente.from("faturas").upsert(
        { pagamento_id: pagamentoId, estado: "pendente" },
        { onConflict: "pagamento_id", ignoreDuplicates: true },
      );
      if (error) throw error;
    },

    async marcarFaturaEmitida(
      pagamentoId: string,
      nota: { id: string; referencia: string | null },
    ): Promise<void> {
      const { error } = await cliente
        .from("faturas")
        .update({
          asaas_fatura_id: nota.id,
          referencia_fiscal: nota.referencia,
          estado: "emitida",
          emitida_em: new Date().toISOString(),
          erro_codigo: null,
        })
        .eq("pagamento_id", pagamentoId);
      if (error) throw error;
    },

    async marcarFaturaFalha(pagamentoId: string, codigo: string): Promise<void> {
      const { error } = await cliente
        .from("faturas")
        .update({ estado: "falha", erro_codigo: codigo })
        .eq("pagamento_id", pagamentoId);
      if (error) throw error;
    },
  };
}

export type RepositorioDePagamentos = ReturnType<typeof criarRepositorioDePagamentos>;

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
