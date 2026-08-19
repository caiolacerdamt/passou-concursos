"use server";

import { redirect } from "next/navigation";

import { clienteDaSessao } from "@/lib/db/sessao";
import { problemaDaSenha } from "@/modules/conta/senha";

/**
 * Grava a senha nova (PAG-07).
 *
 * Nao recebe token nenhum por formulario: quem chega aqui ja trocou o codigo do
 * e-mail por **sessao** no `/auth/callback`. `updateUser` age sobre a sessao
 * corrente, e por isso nao ha como um pedido trocar a senha de outra pessoa.
 */
export async function definirSenha(formulario: FormData) {
  const senha = String(formulario.get("senha") ?? "");

  const problema = problemaDaSenha(senha);
  if (problema) {
    redirect("/definir-senha?erro=curta");
  }

  const supabase = await clienteDaSessao();
  const { error } = await supabase.auth.updateUser({ password: senha });

  if (error) {
    // Link expirado ou ja usado cai aqui: a sessao de recuperacao nao existe
    // mais. Mandar para o pedido de novo link e a saida sem suporte humano.
    redirect("/recuperar-senha?erro=expirado");
  }

  redirect("/app");
}
