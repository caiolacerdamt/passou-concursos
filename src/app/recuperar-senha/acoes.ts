"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { clienteDaSessao } from "@/lib/db/sessao";
import { origemDoSite } from "@/modules/conta/origem";

/**
 * Pedido de "defina sua senha" pelo Supabase Auth (PAG-07).
 *
 * O `redirect` final e **incondicional**: sai igual quando o e-mail existe e
 * quando nao existe. O `error` do provedor e ignorado de proposito — reagir a
 * ele (mensagem diferente, ou demora diferente) transformaria o formulario num
 * verificador de quem tem conta aqui.
 */
export async function pedirRecuperacao(formulario: FormData) {
  const email = String(formulario.get("email") ?? "").trim();

  const supabase = await clienteDaSessao();
  const origem = origemDoSite(await headers());

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origem}/auth/callback?proximo=%2Fdefinir-senha`,
  });

  redirect("/recuperar-senha?enviado=1");
}
