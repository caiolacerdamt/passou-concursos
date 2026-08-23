"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  corrigirQuestao as corrigirQuestaoDoPainel,
  decidirRevisoesEmLote,
  EntradaDoOperadorInvalida,
} from "@/modules/operador";
import { reportarErro } from "@/modules/observabilidade/reporte";

function texto(formulario: FormData, campo: string): string {
  return String(formulario.get(campo) ?? "");
}

function voltar(estado: "decidido" | "corrigido" | "entrada" | "erro"): never {
  redirect(`/operador/fila?estado=${estado}`);
}

/** A decisão é uma única transação: ou o lote inteiro muda, ou nada muda. */
export async function decidirFila(formulario: FormData): Promise<never> {
  const revisoes = formulario.getAll("revisoes").map((valor) => Number(valor));

  try {
    await decidirRevisoesEmLote({
      revisoes,
      decisao: texto(formulario, "decisao"),
      motivo: texto(formulario, "motivo"),
    });
  } catch (erro) {
    if (erro instanceof EntradaDoOperadorInvalida) return voltar("entrada");
    reportarErro(erro, { modulo: "operador", operacao: "decidir_fila" });
    return voltar("erro");
  }

  revalidatePath("/operador/fila");
  return voltar("decidido");
}

function jsonDoFormulario(valor: string): unknown {
  if (valor.trim() === "") return undefined;
  try {
    return JSON.parse(valor);
  } catch {
    return "json_invalido";
  }
}

function camposDaCorrecao(formulario: FormData): Record<string, unknown> {
  const campos: Record<string, unknown> = {};
  const enunciado = texto(formulario, "enunciado").trim();
  const respostaCorreta = texto(formulario, "respostaCorreta").trim();
  const alternativas = texto(formulario, "alternativas");
  const dificuldade = texto(formulario, "dificuldade");
  const anulada = texto(formulario, "anulada");

  if (enunciado) campos.enunciado = enunciado;
  if (respostaCorreta) campos.respostaCorreta = respostaCorreta;
  if (alternativas.trim()) campos.alternativas = jsonDoFormulario(alternativas);
  if (dificuldade) campos.dificuldade = Number(dificuldade);
  if (anulada === "true" || anulada === "false") campos.anulada = anulada === "true";

  return campos;
}

/** A edição nunca atualiza a linha antiga: a RPC cria uma versão nova. */
export async function corrigirQuestao(formulario: FormData): Promise<never> {
  try {
    await corrigirQuestaoDoPainel({
      questaoId: texto(formulario, "questaoId"),
      questaoVersao: Number(texto(formulario, "questaoVersao")),
      mudancaTipo: texto(formulario, "mudancaTipo"),
      motivo: texto(formulario, "motivo"),
      campos: camposDaCorrecao(formulario),
    });
  } catch (erro) {
    if (erro instanceof EntradaDoOperadorInvalida) return voltar("entrada");
    reportarErro(erro, { modulo: "operador", operacao: "corrigir_questao" });
    return voltar("erro");
  }

  revalidatePath("/operador/fila");
  return voltar("corrigido");
}
