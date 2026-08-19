"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { clienteDaSessao } from "@/lib/db/sessao";
import { caminhoInternoOuRaiz } from "@/modules/conta/rotas";
import { origemDoSite } from "@/modules/conta/origem";

/**
 * Os dois caminhos de entrada do lancamento (PAG-07 AC1): **e-mail+senha** e
 * **Google**. Link magico e o terceiro e fica para a SPEC 25.
 *
 * "Mesmo e-mail = mesma conta" nao e implementado aqui e nem deveria: e
 * propriedade do proprio Supabase Auth, que trata `auth.users.email` como
 * unico e liga a identidade do Google a conta existente. Reimplementar isso no
 * produto seria criar um segundo dono da verdade sobre quem e quem.
 */

export async function entrarComSenha(formulario: FormData) {
  const email = String(formulario.get("email") ?? "").trim();
  const senha = String(formulario.get("senha") ?? "");
  const proximo = caminhoInternoOuRaiz(String(formulario.get("proximo") ?? "/app"));

  const supabase = await clienteDaSessao();
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });

  if (error) {
    // A mensagem do provedor nao vai para a tela (UI-02 AC4): ela varia com a
    // versao do Supabase e pode descrever o estado da conta.
    redirect(`/entrar?erro=credencial&proximo=${encodeURIComponent(proximo)}`);
  }

  redirect(proximo);
}

export async function entrarComGoogle(formulario: FormData) {
  const proximo = caminhoInternoOuRaiz(String(formulario.get("proximo") ?? "/app"));

  const supabase = await clienteDaSessao();
  const origem = origemDoSite(await headers());

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origem}/auth/callback?proximo=${encodeURIComponent(proximo)}`,
    },
  });

  if (error || !data?.url) {
    redirect("/entrar?erro=provedor");
  }

  redirect(data.url);
}

export async function sair() {
  const supabase = await clienteDaSessao();
  await supabase.auth.signOut();
  redirect("/");
}
