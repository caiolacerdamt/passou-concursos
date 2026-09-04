import { afterEach, describe, expect, it, vi } from "vitest";

import {
  definirDestinoDeErro,
  restaurarDestinoPadrao,
} from "@/modules/observabilidade";

import { ativarPagamentoConfirmado } from "./ativacao";

function pagamento(estado: string = "confirmada") {
  return {
    id: "pag_1",
    produto_id: "prod_1",
    email: "aluno@exemplo.com",
    valor_centavos: 17_730,
    meio: "PIX" as const,
    parcelas: 1,
    referencia_interna: "checkout-1",
    estado,
    asaas_cliente_id: "cus_1",
    asaas_cobranca_id: "pay_1",
    asaas_parcelamento_id: null,
    asaas_status: "RECEIVED",
    resultado_url: null,
    resultado_boleto_url: null,
    resultado_pix_qr_code: null,
    resultado_pix_copia_e_cola: null,
    user_id: null,
    matricula_id: null,
    confirmado_em: "2026-08-21T12:00:00.000Z",
    ativado_em: null,
    criado_em: "2026-08-21T12:00:00.000Z",
  };
}

function dependencias(opcoes: {
  estado?: string;
  usuario?: { id: string } | null;
  matricula?: { id: string } | null;
  criarUsuario?: { id: string };
  nota?: boolean;
} = {}) {
  void opcoes.nota;
  const dados = pagamento(opcoes.estado);
  const dependencias = {
    buscarPagamento: vi.fn(async () => dados),
    reservarAtivacao: vi.fn(async () => true),
    buscarUsuario: vi.fn(async () => opcoes.usuario ?? null),
    criarUsuario: vi.fn(async () => opcoes.criarUsuario ?? { id: "user_novo" }),
    enviarDefinicaoDeSenha: vi.fn(async () => undefined),
    buscarProduto: vi.fn(async () => ({ id: "prod_1", codigo: "anual-unico", meses_de_acesso: 12 })),
    buscarMatriculaAtiva: vi.fn(async () => opcoes.matricula ?? null),
    criarMatricula: vi.fn(async () => ({ id: "mat_nova" })),
    vincularPagamento: vi.fn(async () => undefined),
    mudarEstadoAtivado: vi.fn(async () => undefined),
    garantirFatura: vi.fn(async () => undefined),
    marcarFaturaEmitida: vi.fn(async () => undefined),
    marcarFaturaFalha: vi.fn(async () => undefined),
    abrirPendencia: vi.fn(async () => undefined),
    agendarNotaFiscal: vi.fn(async () => ({
      id: "nf_1",
      status: "SCHEDULED",
      externalReference: "checkout-1",
    })),
    donoDoClaim: "teste-ativacao",
  };
  return { dados, dependencias };
}

afterEach(() => {
  restaurarDestinoPadrao();
});

describe("ativação após pagamento confirmado", () => {
  it("cria conta nova, envia definição de senha, usa o produto do banco e ativa uma matrícula", async () => {
    const { dependencias } = dependenciasBase({ nota: true });

    const resultado = await ativarPagamentoConfirmado("pag_1", dependencias);

    expect(resultado).toEqual({ estado: "ativada", pendenciaFiscal: false });
    expect(dependencias.criarUsuario).toHaveBeenCalledWith("aluno@exemplo.com");
    expect(dependencias.enviarDefinicaoDeSenha).toHaveBeenCalledWith("aluno@exemplo.com");
    expect(dependencias.buscarProduto).toHaveBeenCalledWith("prod_1");
    expect(dependencias.criarMatricula).toHaveBeenCalledWith("user_novo", "prod_1");
    expect(dependencias.garantirFatura).toHaveBeenCalledWith("pag_1");
    expect(dependencias.mudarEstadoAtivado).toHaveBeenCalledWith("pag_1", "ativacao_concluida");
  });

  it("reaproveita usuário e matrícula existentes, sem duplicar nenhum dos dois", async () => {
    const { dependencias } = dependenciasBase({
      usuario: { id: "user_existente" },
      matricula: { id: "mat_existente" },
      nota: true,
    });

    await ativarPagamentoConfirmado("pag_1", dependencias);

    expect(dependencias.criarUsuario).not.toHaveBeenCalled();
    expect(dependencias.criarMatricula).not.toHaveBeenCalled();
    // Conta que já existia não recebe pedido de definir senha (AD-133).
    expect(dependencias.enviarDefinicaoDeSenha).not.toHaveBeenCalled();
    expect(dependencias.vincularPagamento).toHaveBeenCalledWith(
      "pag_1",
      "user_existente",
      "mat_existente",
    );
  });

  /**
   * O aluno que veio do trial (AD-133). `buscarMatriculaAtiva` só enxerga
   * matrícula **paga**: com um trial ativo ela devolve `null`, e a criação
   * roda — que é onde o trial é encerrado e a de 12 meses nasce. Se alguém
   * tirar o filtro de tipo do repositório, a consulta volta a achar o trial e
   * este teste cai.
   */
  it("aluno vindo do trial recebe matrícula nova e nenhum e-mail de definir senha", async () => {
    const { dependencias } = dependenciasBase({
      usuario: { id: "user_do_trial" },
      // O trial não é matrícula paga: a busca não o encontra.
      matricula: null,
      nota: true,
    });

    await ativarPagamentoConfirmado("pag_1", dependencias);

    expect(dependencias.criarUsuario).not.toHaveBeenCalled();
    expect(dependencias.enviarDefinicaoDeSenha).not.toHaveBeenCalled();
    expect(dependencias.criarMatricula).toHaveBeenCalledWith("user_do_trial", "prod_1");
    expect(dependencias.vincularPagamento).toHaveBeenCalledWith(
      "pag_1",
      "user_do_trial",
      "mat_nova",
    );
  });

  it("mantém a compra ativada quando NF falha, mas abre pendência fiscal separada", async () => {
    const { dependencias } = dependenciasBase({ nota: true });
    dependencias.agendarNotaFiscal.mockRejectedValue(new Error("falha fiscal"));
    definirDestinoDeErro(() => undefined);

    const resultado = await ativarPagamentoConfirmado("pag_1", dependencias);

    expect(resultado).toEqual({ estado: "ativada", pendenciaFiscal: true });
    expect(dependencias.mudarEstadoAtivado).toHaveBeenCalled();
    expect(dependencias.marcarFaturaFalha).toHaveBeenCalledWith(
      "pag_1",
      "falha_agendamento_nf",
    );
    expect(dependencias.abrirPendencia).toHaveBeenCalledWith(
      "pag_1",
      "nota_fiscal",
      "falha_agendamento_nf",
    );
  });

  it("falha de Auth fica pendente e não marca pagamento ativado", async () => {
    const { dependencias } = dependenciasBase({ nota: true });
    dependencias.enviarDefinicaoDeSenha.mockRejectedValue(new Error("auth fora"));
    definirDestinoDeErro(() => undefined);

    const resultado = await ativarPagamentoConfirmado("pag_1", dependencias);

    expect(resultado.estado).toBe("pendente");
    expect(dependencias.mudarEstadoAtivado).not.toHaveBeenCalled();
    expect(dependencias.abrirPendencia).toHaveBeenCalledWith(
      "pag_1",
      "ativacao",
      "falha_ativacao",
    );
  });

  it("repetição de pagamento já ativado é no-op e claim perdido aguarda reconciliação", async () => {
    const primeiro = dependenciasBase({ estado: "ativada", nota: true });
    expect(await ativarPagamentoConfirmado("pag_1", primeiro.dependencias)).toEqual({
      estado: "ja_ativada",
      pendenciaFiscal: false,
    });
    expect(primeiro.dependencias.reservarAtivacao).not.toHaveBeenCalled();

    const segundo = dependenciasBase({ nota: true });
    segundo.dependencias.reservarAtivacao.mockResolvedValue(false);
    expect(await ativarPagamentoConfirmado("pag_1", segundo.dependencias)).toEqual({
      estado: "aguardando_claim",
      pendenciaFiscal: false,
    });
  });
});

function dependenciasBase(opcoes: Parameters<typeof dependencias>[0] = {}) {
  const criado = dependencias(opcoes);
  return criado;
}
