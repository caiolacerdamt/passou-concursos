import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { clienteDaSessao } from "@/lib/db/sessao";
import { clienteDeServico } from "@/lib/db/servidor";
import { reportarErro } from "@/modules/observabilidade/reporte";

export type ClienteDoOperador = SupabaseClient;

export type OperadorAutorizado = {
  id: string;
};

export type ContextoDoOperador = {
  operador: OperadorAutorizado;
  cliente: ClienteDoOperador;
};

export type MotivoDeAcessoNegado = "sem_sessao" | "sem_papel";

export class OperadorNaoAutorizado extends Error {
  readonly codigo: MotivoDeAcessoNegado;

  constructor(codigo: MotivoDeAcessoNegado) {
    super("Acesso ao painel do operador negado.");
    this.name = "OperadorNaoAutorizado";
    this.codigo = codigo;
  }
}

export class EntradaDoOperadorInvalida extends Error {
  readonly codigo: string;

  constructor(codigo = "entrada_invalida") {
    super("Os dados enviados não são válidos.");
    this.name = "EntradaDoOperadorInvalida";
    this.codigo = codigo;
  }
}

export class FalhaNaOperacaoDoOperador extends Error {
  constructor() {
    super("Não foi possível concluir a operação.");
    this.name = "FalhaNaOperacaoDoOperador";
  }
}

function reportarAcessoNegado(operacao: string, codigo: MotivoDeAcessoNegado): void {
  reportarErro(new Error("tentativa de acesso ao painel do operador negada"), {
    modulo: "operador",
    operacao,
    motivo: codigo,
  });
}

async function autorizar(operacao: string): Promise<ContextoDoOperador> {
  try {
    const sessao = await clienteDaSessao();
    const { data, error } = await sessao.auth.getUser();
    if (error) throw error;

    if (!data.user) {
      const recusado = new OperadorNaoAutorizado("sem_sessao");
      reportarAcessoNegado(operacao, recusado.codigo);
      throw recusado;
    }

    const cliente = clienteDeServico();
    const autorizacao = await cliente.rpc("operador_ativo", {
      p_user_id: data.user.id,
    });
    if (autorizacao.error) throw autorizacao.error;

    if (autorizacao.data !== true) {
      const recusado = new OperadorNaoAutorizado("sem_papel");
      reportarAcessoNegado(operacao, recusado.codigo);
      throw recusado;
    }

    return { operador: { id: data.user.id }, cliente };
  } catch (erro) {
    if (erro instanceof OperadorNaoAutorizado) throw erro;

    reportarErro(erro, {
      modulo: "operador",
      operacao,
      motivo: "falha_ao_autorizar",
    });
    throw new FalhaNaOperacaoDoOperador();
  }
}

/** Guarda server-side. O retorno contém só o id necessário para autoria. */
export async function exigirOperadorAtivo(
  operacao = "autorizar",
): Promise<OperadorAutorizado> {
  const contexto = await autorizar(operacao);
  return contexto.operador;
}

/** Executa uma consulta ou mutação já depois da guarda do operador. */
export async function comOperador<T>(
  operacao: string,
  acao: (contexto: ContextoDoOperador) => Promise<T>,
): Promise<T> {
  const contexto = await autorizar(operacao);

  try {
    return await acao(contexto);
  } catch (erro) {
    if (
      erro instanceof EntradaDoOperadorInvalida ||
      erro instanceof FalhaNaOperacaoDoOperador
    ) {
      throw erro;
    }

    reportarErro(erro, {
      modulo: "operador",
      operacao,
      motivo: "falha_interna",
    });
    throw new FalhaNaOperacaoDoOperador();
  }
}
