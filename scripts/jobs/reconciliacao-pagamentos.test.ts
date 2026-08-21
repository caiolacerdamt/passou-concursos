import { describe, expect, it, vi } from "vitest";

import {
  executar,
  executarReconciliacao,
  motivoDeParada,
  type PagamentoRecon,
} from "./reconciliacao-pagamentos.mts";

function pagamento(estado = "pendente"): PagamentoRecon {
  return {
    id: "pag_1",
    referencia_interna: "checkout-1",
    asaas_cobranca_id: "pay_1",
    estado,
    criado_em: "2026-08-19T00:00:00.000Z",
  };
}

function dependencias() {
  let linha = pagamento();
  const eventos = new Set<string>();
  const ativacoes = new Set<string>();
  const repo = {
    buscarPagamento: vi.fn(async () => linha),
    registrarEvento: vi.fn(async (_pagamento: PagamentoRecon, cobranca: { id: string; status: string }) => {
      const id = `${cobranca.id}:${cobranca.status}`;
      const novo = !eventos.has(id);
      eventos.add(id);
      return novo;
    }),
    mudarEstado: vi.fn(async (_id: string, estado: "confirmada" | "expirada") => {
      linha = { ...linha, estado };
    }),
    reabrirExpirada: vi.fn(async (_id: string) => {
      void _id;
      linha = { ...linha, estado: "confirmada" };
    }),
    listarPendentesExpiráveis: vi.fn(async () => []),
    abrirPendencia: vi.fn(async () => undefined),
    lerHorasExpiracao: vi.fn(async () => 48),
  };
  const gateway = {
    listarCobrancasPagas: vi.fn(async () => [{
      id: "pay_1",
      status: "RECEIVED",
      billingType: "PIX",
      externalReference: "checkout-1",
    }]),
  };
  const ativar = vi.fn(async (id: string) => {
    if (ativacoes.has(id)) return { estado: "ja_ativada" as const, pendenciaFiscal: false as const };
    ativacoes.add(id);
    return { estado: "ativada" as const, pendenciaFiscal: false };
  });
  return { repo, gateway, ativar, linha: () => linha };
}

describe("job de reconciliação de pagamentos", () => {
  it("encontra pagamento pago sem webhook, confirma e solicita ativação", async () => {
    const deps = dependencias();

    const resumo = await executarReconciliacao({
      gateway: deps.gateway,
      repositorio: deps.repo,
      ativar: deps.ativar,
      agora: new Date("2026-08-21T12:00:00.000Z"),
      horasParaExpirar: 48,
    });

    expect(resumo).toMatchObject({
      cobrancasConsultadas: 1,
      pagamentosEncontrados: 1,
      ativacoesSolicitadas: 1,
      falhas: 0,
    });
    expect(deps.linha().estado).toBe("confirmada");
    expect(deps.ativar).toHaveBeenCalledWith("pag_1");
  });

  it("rerun não duplica evento nem conta/matrícula da ativação idempotente", async () => {
    const deps = dependencias();

    await executarReconciliacao({ gateway: deps.gateway, repositorio: deps.repo, ativar: deps.ativar, horasParaExpirar: 48 });
    await executarReconciliacao({ gateway: deps.gateway, repositorio: deps.repo, ativar: deps.ativar, horasParaExpirar: 48 });

    expect(deps.repo.registrarEvento).toHaveBeenCalledTimes(2);
    expect(deps.ativar).toHaveBeenCalledTimes(2);
    expect(deps.repo.mudarEstado).toHaveBeenCalledTimes(1);
  });

  it("expira pagamento pendente vencido e não chama ativação", async () => {
    const deps = dependencias();
    deps.gateway.listarCobrancasPagas.mockResolvedValue([]);
    deps.repo.listarPendentesExpiráveis.mockResolvedValue([pagamento()] as never);

    const resumo = await executarReconciliacao({
      gateway: deps.gateway,
      repositorio: deps.repo,
      ativar: deps.ativar,
      agora: new Date("2026-08-21T12:00:00.000Z"),
      horasParaExpirar: 48,
    });

    expect(resumo.expirados).toBe(1);
    expect(deps.repo.mudarEstado).toHaveBeenCalledWith(
      "pag_1",
      "expirada",
      "reconciliacao_expiracao",
    );
    expect(deps.ativar).not.toHaveBeenCalled();
  });

  it("reabre pagamento expirado que o Asaas confirmou e ativa de forma idempotente", async () => {
    const deps = dependencias();
    deps.repo.buscarPagamento.mockResolvedValue(pagamento("expirada"));

    const resumo = await executarReconciliacao({
      gateway: deps.gateway,
      repositorio: deps.repo,
      ativar: deps.ativar,
      agora: new Date("2026-08-21T12:00:00.000Z"),
      horasParaExpirar: 48,
    });

    expect(resumo.ativacoesSolicitadas).toBe(1);
    expect(deps.repo.reabrirExpirada).toHaveBeenCalledWith(
      "pag_1",
      "reconciliacao_pagamento_pago",
    );
    expect(deps.ativar).toHaveBeenCalledWith("pag_1");
  });

  it("falha de ativação abre pendência e deixa o job vermelho", async () => {
    const deps = dependencias();
    deps.ativar.mockRejectedValue(new Error("auth indisponivel"));
    const alertas: Record<string, unknown>[] = [];

    const resumo = await executarReconciliacao({
      gateway: deps.gateway,
      repositorio: deps.repo,
      ativar: deps.ativar,
      alertar: (_erro, contexto) => {
        alertas.push(contexto);
      },
      horasParaExpirar: 48,
    });

    expect(resumo.falhas).toBe(1);
    expect(deps.repo.abrirPendencia).toHaveBeenCalledWith("pag_1", "falha_reconciliacao");
    expect(alertas).toEqual([{ operacao: "reconciliar_pagamento", pagamento_id: "pag_1" }]);
  });
});

describe("configuração e entrada do job", () => {
  it("para vermelho sem banco ou sem credenciais Asaas", () => {
    expect(motivoDeParada({})).toContain("DATABASE_URL");
    expect(motivoDeParada({ DATABASE_URL: "postgres://x" })).toContain("ASAAS");
    expect(motivoDeParada({ DATABASE_URL: "postgres://x", ASAAS_API_KEY: "x", ASAAS_API_URL: "https://api-sandbox.asaas.com" })).toBeNull();
  });

  it("executar deixa código vermelho quando o gateway falha", async () => {
    const conexao = {
      async connect() {},
      async end() {},
      async query() { return { rows: [] }; },
    };
    const codigo = await executar(
      { DATABASE_URL: "postgres://x", ASAAS_API_KEY: "x", ASAAS_API_URL: "https://api-sandbox.asaas.com" },
      {
        abrirConexao: () => conexao,
        gateway: { listarCobrancasPagas: async () => { throw new Error("asaas fora"); } },
      },
    );
    expect(codigo).toBe(1);
  });
});
