import { reportarErro } from "@/modules/observabilidade/reporte";

import type { NotaFiscalAsaas } from "./asaas";
import type { PagamentoOperacional, ProdutoPagamento, RepositorioDePagamentos } from "./repositorio";

export type ResultadoDaAtivacao =
  | { estado: "ativada"; pendenciaFiscal: boolean }
  | { estado: "ja_ativada"; pendenciaFiscal: false }
  | { estado: "aguardando_claim"; pendenciaFiscal: false }
  | { estado: "pendente"; pendenciaFiscal: false };

export type DependenciasDeAtivacao = {
  buscarPagamento(pagamentoId: string): Promise<PagamentoOperacional | null>;
  reservarAtivacao(pagamentoId: string, dono: string): Promise<boolean>;
  buscarUsuario(email: string): Promise<{ id: string } | null>;
  criarUsuario(email: string): Promise<{ id: string }>;
  enviarDefinicaoDeSenha(email: string): Promise<void>;
  buscarProduto(produtoId: string): Promise<ProdutoPagamento | null>;
  buscarMatriculaAtiva(userId: string): Promise<{ id: string } | null>;
  criarMatricula(userId: string, produtoId: string): Promise<{ id: string }>;
  vincularPagamento(pagamentoId: string, userId: string, matriculaId: string): Promise<void>;
  mudarEstadoAtivado(pagamentoId: string, motivo: string): Promise<void>;
  garantirFatura(pagamentoId: string): Promise<void>;
  marcarFaturaEmitida(
    pagamentoId: string,
    nota: { id: string; referencia: string | null },
  ): Promise<void>;
  marcarFaturaFalha(pagamentoId: string, codigo: string): Promise<void>;
  abrirPendencia(
    pagamentoId: string,
    tipo: "ativacao" | "nota_fiscal",
    codigo: string,
  ): Promise<void>;
  agendarNotaFiscal?: (pagamento: PagamentoOperacional) => Promise<NotaFiscalAsaas>;
  donoDoClaim?: string;
};

export async function ativarPagamentoConfirmado(
  pagamentoId: string,
  dependencias: DependenciasDeAtivacao,
): Promise<ResultadoDaAtivacao> {
  const pagamento = await dependencias.buscarPagamento(pagamentoId);
  if (!pagamento) throw new Error("pagamento inexistente");

  if (pagamento.estado === "ativada") {
    return { estado: "ja_ativada", pendenciaFiscal: false };
  }
  if (pagamento.estado !== "confirmada") {
    await abrirPendenciaSegura(dependencias, pagamentoId, "ativacao", "estado_nao_confirmado");
    return { estado: "pendente", pendenciaFiscal: false };
  }

  const claim = await dependencias.reservarAtivacao(
    pagamentoId,
    dependencias.donoDoClaim ?? `ativacao-${crypto.randomUUID()}`,
  );
  if (!claim) return { estado: "aguardando_claim", pendenciaFiscal: false };

  try {
    const produto = await dependencias.buscarProduto(pagamento.produto_id);
    if (!produto) throw new Error("produto da matricula inexistente");

    const existente = pagamento.user_id
      ? { id: pagamento.user_id }
      : await dependencias.buscarUsuario(pagamento.email);
    const usuario = existente ?? (await dependencias.criarUsuario(pagamento.email));

    // Só quem acabou de ganhar conta por causa **deste** pagamento recebe o
    // convite para definir a senha. Quem veio do trial já definiu a dele, e
    // um pedido de redefinição que ele não fez tem o formato exato de um
    // phishing — pior: ensina o aluno a clicar nesse tipo de link (AD-133).
    if (existente === null) {
      await dependencias.enviarDefinicaoDeSenha(pagamento.email);
    }

    const matricula =
      (pagamento.matricula_id ? { id: pagamento.matricula_id } : null) ??
      (await dependencias.buscarMatriculaAtiva(usuario.id)) ??
      (await dependencias.criarMatricula(usuario.id, produto.id));

    await dependencias.vincularPagamento(pagamento.id, usuario.id, matricula.id);
    await dependencias.garantirFatura(pagamento.id);
    await dependencias.mudarEstadoAtivado(pagamento.id, "ativacao_concluida");

    const pendenciaFiscal = await processarNotaFiscal(pagamento, dependencias);
    return { estado: "ativada", pendenciaFiscal };
  } catch (erro) {
    await abrirPendenciaSegura(dependencias, pagamentoId, "ativacao", "falha_ativacao");
    reportarErro(erro, {
      modulo: "pagamentos",
      operacao: "ativar_pagamento",
      pagamento_id: pagamentoId,
      motivo: "falha_apos_confirmacao",
    });
    return { estado: "pendente", pendenciaFiscal: false };
  }
}

export function criarDependenciasDeAtivacao(
  repositorio: RepositorioDePagamentos,
  agendarNotaFiscal?: (pagamento: PagamentoOperacional) => Promise<NotaFiscalAsaas>,
): DependenciasDeAtivacao {
  return {
    buscarPagamento: repositorio.buscarPagamento,
    reservarAtivacao: repositorio.reservarAtivacao,
    buscarUsuario: repositorio.buscarUsuarioPorEmail,
    criarUsuario: repositorio.criarUsuario,
    enviarDefinicaoDeSenha: repositorio.enviarDefinicaoDeSenha,
    buscarProduto: repositorio.buscarProduto,
    buscarMatriculaAtiva: repositorio.buscarMatriculaAtiva,
    criarMatricula: repositorio.criarMatricula,
    vincularPagamento: repositorio.vincularPagamento,
    mudarEstadoAtivado: (pagamentoId, motivo) =>
      repositorio.mudarEstado(pagamentoId, "ativada", motivo),
    garantirFatura: repositorio.garantirFatura,
    marcarFaturaEmitida: repositorio.marcarFaturaEmitida,
    marcarFaturaFalha: repositorio.marcarFaturaFalha,
    abrirPendencia: repositorio.abrirPendencia,
    agendarNotaFiscal,
  };
}

async function processarNotaFiscal(
  pagamento: PagamentoOperacional,
  dependencias: DependenciasDeAtivacao,
): Promise<boolean> {
  if (!dependencias.agendarNotaFiscal) {
    await registrarFalhaFiscal(dependencias, pagamento.id, "configuracao_nf_ausente");
    return true;
  }

  try {
    const nota = await dependencias.agendarNotaFiscal(pagamento);
    await dependencias.marcarFaturaEmitida(pagamento.id, {
      id: nota.id,
      referencia: nota.externalReference,
    });
    return false;
  } catch (erro) {
    await registrarFalhaFiscal(dependencias, pagamento.id, "falha_agendamento_nf");
    reportarErro(erro, {
      modulo: "pagamentos",
      operacao: "agendar_nota_fiscal",
      pagamento_id: pagamento.id,
    });
    return true;
  }
}

async function registrarFalhaFiscal(
  dependencias: DependenciasDeAtivacao,
  pagamentoId: string,
  codigo: string,
): Promise<void> {
  await dependencias.marcarFaturaFalha(pagamentoId, codigo);
  await abrirPendenciaSegura(dependencias, pagamentoId, "nota_fiscal", codigo);
}

async function abrirPendenciaSegura(
  dependencias: DependenciasDeAtivacao,
  pagamentoId: string,
  tipo: "ativacao" | "nota_fiscal",
  codigo: string,
): Promise<void> {
  try {
    await dependencias.abrirPendencia(pagamentoId, tipo, codigo);
  } catch (erro) {
    reportarErro(erro, {
      modulo: "pagamentos",
      operacao: "abrir_pendencia",
      pagamento_id: pagamentoId,
      tipo,
      codigo,
    });
  }
}
