#!/usr/bin/env node
/**
 * Reconcilia pagamentos fora do serverless (PAG-06/PAG-13/INFRA-10).
 *
 * O job compara a lista de cobranças pagas do Asaas com o Postgres, repete a
 * ativação idempotente e expira tentativas sem confirmação. Nenhum dado de
 * cliente entra no resumo ou no alerta do job.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { Client } from "pg";

import { lerEnv } from "../alvo-do-banco.mjs";
import { CATALOGO } from "@/modules/config";
import { emitirEventoDoFunilNaoBloqueante } from "@/modules/analytics/posthog";
import {
  gatewayAsaasDoAmbiente,
  type ListagemDeCobrancasAsaas,
} from "@/modules/pagamentos/asaas";
import {
  ativarPagamentoConfirmado,
  criarDependenciasDeAtivacao,
  type ResultadoDaAtivacao,
} from "@/modules/pagamentos/ativacao";
import { criarRepositorioDePagamentos } from "@/modules/pagamentos/repositorio";
import { clienteDeServico } from "@/lib/db/servidor";
import { encerrar, iniciarSentry, reportar } from "./sentry-node.mjs";

export const CHAVE_EXPIRACAO = "param.m8.pagamento_pendente_expira_horas" as const;
export const LIMITE_DA_PAGINA = 100;

export type PagamentoRecon = {
  id: string;
  referencia_interna: string;
  asaas_cobranca_id: string | null;
  estado: string;
  criado_em: string;
};

export type ClienteSql = {
  query<T = Record<string, unknown>>(
    texto: string,
    valores?: unknown[],
  ): Promise<{ rows: T[]; rowCount?: number | null }>;
};

export type RepositorioDeRecon = {
  buscarPagamento(
    cobrancaId: string,
    referencia: string | null,
  ): Promise<PagamentoRecon | null>;
  registrarEvento(
    pagamento: PagamentoRecon,
    cobranca: ListagemDeCobrancasAsaas,
  ): Promise<boolean>;
  mudarEstado(
    pagamentoId: string,
    estado: "confirmada" | "expirada",
    motivo: string,
  ): Promise<void>;
  reabrirExpirada(pagamentoId: string, motivo: string): Promise<void>;
  listarPendentesExpiráveis(antesDe: Date): Promise<PagamentoRecon[]>;
  abrirPendencia(pagamentoId: string, codigo: string): Promise<void>;
  lerHorasExpiracao(): Promise<number>;
};

export type GatewayDeRecon = {
  listarCobrancasPagas(offset: number, limite: number): Promise<ListagemDeCobrancasAsaas[]>;
};

export type ResumoDaRecon = {
  cobrancasConsultadas: number;
  pagamentosEncontrados: number;
  ativacoesSolicitadas: number;
  expirados: number;
  desconhecidos: number;
  falhas: number;
};

export function criarRepositorioDeRecon(cliente: ClienteSql): RepositorioDeRecon {
  return {
    async buscarPagamento(cobrancaId, referencia) {
      const { rows } = await cliente.query<PagamentoRecon>(
        `select id, referencia_interna, asaas_cobranca_id, estado::text, criado_em
           from public.pagamentos
          where asaas_cobranca_id = $1
             or ($2::text is not null and referencia_interna = $2)
          order by criado_em desc
          limit 1`,
        [cobrancaId, referencia],
      );
      return rows[0] ?? null;
    },

    async registrarEvento(pagamento, cobranca) {
      const eventoId = `reconciliacao:${cobranca.id}:${cobranca.status}`;
      const { rows } = await cliente.query<{ registrar_pagamento_evento: boolean }>(
        `select public.registrar_pagamento_evento(
          $1, 'RECONCILIACAO', $2, $3, 'recebido'
        ) as registrar_pagamento_evento`,
        [eventoId, cobranca.id, pagamento.id],
      );
      return rows[0]?.registrar_pagamento_evento === true;
    },

    async mudarEstado(pagamentoId, estado, motivo) {
      await cliente.query(
        `select public.mudar_estado_pagamento(
          $1, $2::public.pagamento_estado, $3
        )`,
        [pagamentoId, estado, motivo],
      );
    },

    async reabrirExpirada(pagamentoId, motivo) {
      await cliente.query(
        `select public.reabrir_pagamento_expirado_reconciliacao($1, $2)`,
        [pagamentoId, motivo],
      );
    },

    async listarPendentesExpiráveis(antesDe) {
      const { rows } = await cliente.query<PagamentoRecon>(
        `select id, referencia_interna, asaas_cobranca_id, estado::text, criado_em
           from public.pagamentos
          where estado = 'pendente'
            and criado_em < $1
          order by criado_em
          limit 500`,
        [antesDe.toISOString()],
      );
      return rows;
    },

    async abrirPendencia(pagamentoId, codigo) {
      await cliente.query(
        `insert into public.pagamento_pendencias
          (pagamento_id, tipo, ultima_falha_codigo, proxima_tentativa_em)
         select $1, 'reconciliacao', $2, now()
          where not exists (
            select 1 from public.pagamento_pendencias
             where pagamento_id = $1
               and tipo = 'reconciliacao'
               and estado in ('aberta', 'em_processamento')
          )`,
        [pagamentoId, codigo],
      );
    },

    async lerHorasExpiracao() {
      const { rows } = await cliente.query<{ valor: unknown }>(
        `select valor from public.configuracoes_vigentes where chave = $1`,
        [CHAVE_EXPIRACAO],
      );
      const definicao = CATALOGO[CHAVE_EXPIRACAO];
      const valor = definicao.tipo.safeParse(rows[0]?.valor);
      return valor.success ? valor.data : definicao.padrao;
    },
  };
}

export async function executarReconciliacao(
  dependencias: {
    gateway: GatewayDeRecon;
    repositorio: RepositorioDeRecon;
    ativar: (pagamentoId: string) => Promise<ResultadoDaAtivacao>;
    emitirPagamentoConfirmado?: () => void;
    alertar?: (erro: unknown, contexto: Record<string, unknown>) => Promise<void> | void;
    agora?: Date;
    horasParaExpirar?: number;
  },
): Promise<ResumoDaRecon> {
  const resumo: ResumoDaRecon = {
    cobrancasConsultadas: 0,
    pagamentosEncontrados: 0,
    ativacoesSolicitadas: 0,
    expirados: 0,
    desconhecidos: 0,
    falhas: 0,
  };
  const agora = dependencias.agora ?? new Date();
  const horas = dependencias.horasParaExpirar ?? await dependencias.repositorio.lerHorasExpiracao();

  for (let offset = 0; offset < 10_000; offset += LIMITE_DA_PAGINA) {
    const cobrancas = await dependencias.gateway.listarCobrancasPagas(
      offset,
      LIMITE_DA_PAGINA,
    );
    resumo.cobrancasConsultadas += cobrancas.length;

    for (const cobranca of cobrancas) {
      await reconciliarCobranca(cobranca, dependencias, resumo);
    }

    if (cobrancas.length < LIMITE_DA_PAGINA) break;
  }

  const antesDe = new Date(agora.getTime() - horas * 60 * 60 * 1_000);
  for (const pagamento of await dependencias.repositorio.listarPendentesExpiráveis(antesDe)) {
    try {
      await dependencias.repositorio.mudarEstado(
        pagamento.id,
        "expirada",
        "reconciliacao_expiracao",
      );
      resumo.expirados += 1;
    } catch (erro) {
      resumo.falhas += 1;
      await alertar(dependencias, erro, {
        operacao: "expirar_pagamento",
        pagamento_id: pagamento.id,
      });
    }
  }

  return resumo;
}

export function motivoDeParada(
  ambiente: Record<string, string | undefined>,
): string | null {
  if (!ambiente.DATABASE_URL?.trim()) return "DATABASE_URL nao esta definida.";
  if (!ambiente.ASAAS_API_KEY?.trim() || !ambiente.ASAAS_API_URL?.trim()) {
    return "ASAAS_API_KEY e ASAAS_API_URL sao obrigatorias para reconciliacao.";
  }
  return null;
}

export function ambienteDoScript(
  raiz = process.cwd(),
): Record<string, string | undefined> {
  const caminho = path.join(raiz, ".env");
  if (!existsSync(caminho)) return { ...process.env };
  return { ...process.env, ...lerEnv(readFileSync(caminho, "utf8")) };
}

export async function executar(
  ambiente: Record<string, string | undefined>,
  opcoes: {
    abrirConexao?: () => ClienteSql & { connect(): Promise<void>; end(): Promise<void> };
    gateway?: GatewayDeRecon;
    ativar?: (pagamentoId: string) => Promise<ResultadoDaAtivacao>;
  } = {},
): Promise<number> {
  const motivo = motivoDeParada(ambiente);
  if (motivo) {
    console.error(`[reconciliacao] ${motivo}`);
    return 1;
  }

  await iniciarSentry();
  copiarVariaveisDoJob(ambiente);
  const cliente = opcoes.abrirConexao?.() ?? new Client({ connectionString: ambiente.DATABASE_URL });
  let codigo = 0;

  try {
    await cliente.connect();
    const gateway = opcoes.gateway ?? gatewayAsaasDoAmbiente(ambiente);
    let ativar = opcoes.ativar;
    if (!ativar) {
      const supabase = clienteDeServico();
      const repositorio = criarRepositorioDePagamentos(supabase);
      const dependencias = criarDependenciasDeAtivacao(repositorio);
      ativar = (pagamentoId) => ativarPagamentoConfirmado(pagamentoId, dependencias);
    }

    const resumo = await executarReconciliacao({
      gateway,
      repositorio: criarRepositorioDeRecon(cliente),
      ativar,
      emitirPagamentoConfirmado: () =>
        emitirEventoDoFunilNaoBloqueante("pagamento_confirmado"),
    });
    console.log("[reconciliacao]", resumo);
    codigo = resumo.falhas > 0 ? 1 : 0;
  } catch (erro) {
    codigo = 1;
    await reportar(erro, { job: "reconciliacao-pagamentos", motivo: "falha_principal" });
  } finally {
    await cliente.end().catch(() => undefined);
    await encerrar();
  }

  return codigo;
}

async function reconciliarCobranca(
  cobranca: ListagemDeCobrancasAsaas,
  dependencias: {
    repositorio: RepositorioDeRecon;
    ativar: (pagamentoId: string) => Promise<ResultadoDaAtivacao>;
    emitirPagamentoConfirmado?: () => void;
    alertar?: (erro: unknown, contexto: Record<string, unknown>) => Promise<void> | void;
  },
  resumo: ResumoDaRecon,
): Promise<void> {
  const pagamento = await dependencias.repositorio.buscarPagamento(
    cobranca.id,
    cobranca.externalReference,
  );
  if (!pagamento) {
    resumo.desconhecidos += 1;
    await alertar(dependencias, new Error("cobranca paga sem pagamento local"), {
      operacao: "localizar_pagamento",
      cobranca_id: cobranca.id,
    });
    return;
  }

  resumo.pagamentosEncontrados += 1;
  try {
    await dependencias.repositorio.registrarEvento(pagamento, cobranca);
    if (pagamento.estado === "pendente") {
      await dependencias.repositorio.mudarEstado(
        pagamento.id,
        "confirmada",
        "reconciliacao_pagamento_pago",
      );
    } else if (pagamento.estado === "expirada") {
      await dependencias.repositorio.reabrirExpirada(
        pagamento.id,
        "reconciliacao_pagamento_pago",
      );
    }
    if (
      pagamento.estado === "pendente" ||
      pagamento.estado === "confirmada" ||
      pagamento.estado === "expirada"
    ) {
      dependencias.emitirPagamentoConfirmado?.();
      resumo.ativacoesSolicitadas += 1;
      const resultado = await dependencias.ativar(pagamento.id);
      if (resultado.estado === "pendente") resumo.falhas += 1;
    }
  } catch (erro) {
    resumo.falhas += 1;
    await dependencias.repositorio.abrirPendencia(pagamento.id, "falha_reconciliacao");
    await alertar(dependencias, erro, {
      operacao: "reconciliar_pagamento",
      pagamento_id: pagamento.id,
    });
  }
}

async function alertar(
  dependencias: { alertar?: (erro: unknown, contexto: Record<string, unknown>) => Promise<void> | void },
  erro: unknown,
  contexto: Record<string, unknown>,
): Promise<void> {
  await dependencias.alertar?.(erro, contexto);
}

function copiarVariaveisDoJob(ambiente: Record<string, string | undefined>): void {
  for (const chave of [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SECRET_KEY",
    "NEXT_PUBLIC_SITE_URL",
    "ASAAS_NF_NOME_SERVICO",
    "ASAAS_NF_CODIGO_SERVICO",
    "ASAAS_NF_IMPOSTOS_JSON",
    "POSTHOG_API_KEY",
    "POSTHOG_API_URL",
  ]) {
    const valor = ambiente[chave];
    if (valor !== undefined) process.env[chave] = valor;
  }
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exit(await executar(ambienteDoScript()));
}
