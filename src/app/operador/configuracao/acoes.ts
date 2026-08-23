"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  alterarConfiguracao,
  EntradaDoOperadorInvalida,
} from "@/modules/operador";
import { reportarErro } from "@/modules/observabilidade/reporte";

function texto(formulario: FormData, campo: string): string {
  return String(formulario.get(campo) ?? "");
}

function voltar(estado: "salvo" | "entrada" | "erro"): never {
  redirect(`/operador/configuracao?estado=${estado}`);
}

export async function salvarConfiguracao(formulario: FormData): Promise<never> {
  try {
    const valor = JSON.parse(texto(formulario, "valor"));

    await alterarConfiguracao({
      chave: texto(formulario, "chave"),
      valor,
      motivo: texto(formulario, "motivo"),
    });
  } catch (erro) {
    if (erro instanceof SyntaxError || erro instanceof EntradaDoOperadorInvalida) {
      return voltar("entrada");
    }
    reportarErro(erro, { modulo: "operador", operacao: "alterar_configuracao" });
    return voltar("erro");
  }

  revalidatePath("/operador/configuracao");
  return voltar("salvo");
}
