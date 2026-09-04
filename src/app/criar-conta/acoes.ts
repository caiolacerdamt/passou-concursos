"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { clienteDaSessao } from "@/lib/db/sessao";
import { getParam, isFlagOn } from "@/modules/config";
import { ehDominioBloqueado } from "@/modules/conta/dominio-de-email";
import { origemDoSite } from "@/modules/conta/origem";

/**
 * A porta da conta gratuita (AD-133).
 *
 * A flag é conferida **antes** de qualquer chamada ao provedor: com ela
 * desligada, nenhuma conta nasce e o produto continua sendo o de hoje, com o
 * checkout como única porta. A segunda tranca é `conceder_trial()`, no banco,
 * que confere a mesma flag — as duas existem porque esta aqui evita criar uma
 * conta órfã, e a de lá é a que vale.
 *
 * Não se pede CPF, nome nem declaração de 18+: CPF é exigência do meio de
 * pagamento e continua no checkout, e a declaração é aceite contratual da
 * compra. Duplicá-la aqui criaria dois registros de aceite para a mesma
 * pessoa — pior para a LGPD, não melhor.
 */

export async function criarContaComSenha(formulario: FormData) {
  const email = String(formulario.get("email") ?? "").trim();
  const senha = String(formulario.get("senha") ?? "");

  if (!(await isFlagOn("flag.m8.trial_gratuito"))) {
    redirect("/criar-conta?erro=desligado");
  }

  const bloqueados = await getParam("param.m8.dominios_bloqueados_no_trial");
  if (ehDominioBloqueado(email, bloqueados)) {
    // Recusa antes do provedor: não gasta um e-mail nem cria a conta.
    redirect("/criar-conta?erro=dominio");
  }

  const supabase = await clienteDaSessao();
  const origem = origemDoSite(await headers());

  const { error } = await supabase.auth.signUp({
    email,
    password: senha,
    options: {
      // O template **Confirm signup** precisa apontar para `/auth/confirm` com
      // `token_hash` (docs/DEPLOY.md). Sem isso o Supabase devolve os tokens
      // num fragmento `#...` que nunca chega ao servidor — foi exatamente o
      // defeito da SPEC 12, e não se repete aqui.
      emailRedirectTo: `${origem}/auth/confirm`,
    },
  });

  if (error) {
    // A mensagem do provedor não vai para a tela: ela varia com a versão do
    // Supabase e pode descrever o estado da conta.
    redirect("/criar-conta?erro=cadastro");
  }

  redirect("/criar-conta?enviado=1");
}

export async function criarContaComGoogle() {
  if (!(await isFlagOn("flag.m8.trial_gratuito"))) {
    redirect("/criar-conta?erro=desligado");
  }

  const supabase = await clienteDaSessao();
  const origem = origemDoSite(await headers());

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      // O callback é o mesmo do login: lá é que a sessão nasce, e é lá que a
      // concessão do trial acontece. Um segundo callback só para o cadastro
      // seria um segundo lugar para esquecer de conceder.
      redirectTo: `${origem}/auth/callback?proximo=%2Fapp`,
    },
  });

  if (error || !data?.url) {
    redirect("/criar-conta?erro=provedor");
  }

  redirect(data.url);
}
