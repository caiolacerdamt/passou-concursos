"use server";

import { redirect } from "next/navigation";
import { ZodError } from "zod";

import { clienteDeServico } from "@/lib/db/servidor";
import { reportarErro } from "@/modules/observabilidade/reporte";
import {
  erroSeguroDePagamento,
  VERSAO_ATUAL_DOS_TERMOS,
} from "@/modules/pagamentos/contratos";
import {
  dadosDoFormularioCheckout,
  executarCheckout,
  type ResultadoDoCheckout,
} from "@/modules/pagamentos/checkout";
import { gatewayAsaasDoAmbiente } from "@/modules/pagamentos/asaas";
import { obterPrecosPublicos } from "@/modules/pagamentos/preco";
import { criarRepositorioDePagamentos } from "@/modules/pagamentos/repositorio";

export type EstadoDaActionDoCheckout =
  | { tipo: "inicial" }
  | { tipo: "erro"; mensagem: string; email: string; meio: string }
  | { tipo: "matricula_ativa"; email: string; meio: string };

const ESTADO_INICIAL: EstadoDaActionDoCheckout = { tipo: "inicial" };

export async function enviarCheckout(
  _anterior: EstadoDaActionDoCheckout = ESTADO_INICIAL,
  formulario: FormData,
): Promise<EstadoDaActionDoCheckout> {
  void _anterior;
  const entrada = dadosDoFormularioCheckout(formulario);
  const email = typeof entrada.email === "string" ? entrada.email : "";
  const meio = typeof entrada.meio === "string" ? entrada.meio : "";

  let resultado: ResultadoDoCheckout;
  try {
    resultado = await executarCheckout(entrada, {
      precos: await obterPrecosPublicos(),
      gateway: gatewayAsaasDoAmbiente(),
      repositorio: criarRepositorioDePagamentos(clienteDeServico()),
    });
  } catch (erro) {
    if (erro instanceof ZodError) {
      return {
        tipo: "erro",
        ...erroSeguroDePagamento("entrada_invalida"),
        email,
        meio,
      };
    }

    if (erro instanceof Error && /matricula_ativa/i.test(erro.message)) {
      return { tipo: "matricula_ativa", email, meio };
    }

    reportarErro(erro, {
      modulo: "pagamentos",
      operacao: "criar_checkout",
      termos_versao: VERSAO_ATUAL_DOS_TERMOS,
    });

    return {
      tipo: "erro",
      ...erroSeguroDePagamento("gateway_indisponivel"),
      email,
      meio,
    };
  }

  if (resultado.tipo === "matricula_ativa") {
    return { tipo: "matricula_ativa", email, meio };
  }

  redirect(`/checkout/resultado/${encodeURIComponent(resultado.resultadoToken)}`);
}
