import { NextResponse } from "next/server";

import { clienteDaSessao } from "@/lib/db/sessao";
import { isFlagOn } from "@/modules/config";
import { caminhoInternoOuRaiz } from "@/modules/conta/rotas";
import { concederTrial } from "@/modules/conta/trial";

/**
 * Onde o Google (e o link de "definir senha") devolve o aluno (PAG-07).
 *
 * O fluxo e PKCE: o provedor volta com um `code` de uso unico, e e aqui que ele
 * vira sessao. O `proximo` passa por `caminhoInternoOuRaiz` — sem isso, quem
 * montasse `/auth/callback?proximo=https://site.invalido` teria o produto
 * levando o aluno recem-autenticado para fora.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const proximo = caminhoInternoOuRaiz(searchParams.get("proximo"));

  if (code) {
    const supabase = await clienteDaSessao();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      /*
       * O Google entrega o e-mail ja verificado pelo provedor, entao a conta
       * criada por aqui pode receber o trial na hora (AD-133).
       *
       * `conceder_trial()` e idempotente: quem ja tem acesso recebe `null` e
       * nada nasce; quem ja usou o trial e recusado. A flag e conferida antes
       * so para nao gastar uma ida ao banco em todo login enquanto ela estiver
       * desligada — a tranca de verdade continua sendo a da funcao.
       */
      if (await isFlagOn("flag.m8.trial_gratuito")) {
        await concederTrial(supabase);
      }

      // Atras do balanceador da Vercel, `origin` e o host interno. O
      // `x-forwarded-host` e quem sabe o dominio que o aluno digitou.
      const encaminhado = request.headers.get("x-forwarded-host");
      const base =
        process.env.NODE_ENV === "development" || !encaminhado
          ? origin
          : `https://${encaminhado}`;

      return NextResponse.redirect(`${base}${proximo}`);
    }
  }

  // Codigo ausente, expirado ou ja usado. Volta ao login com aviso generico —
  // nada do erro do provedor chega ao aluno.
  return NextResponse.redirect(`${origin}/entrar?erro=provedor`);
}
