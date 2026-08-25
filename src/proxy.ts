import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { chavesPublicas } from "@/lib/db/chaves";
import { destinoSemSessao, ehRotaPublica } from "@/modules/conta/rotas";

/**
 * Renovacao da sessao e porta de entrada (PAG-07, PAG-01).
 *
 * O arquivo se chama `proxy.ts` porque o **Next 16 aposentou `middleware.ts`** —
 * mesmo papel, nome novo, e o runtime aqui e `nodejs` (o `edge` nao e suportado
 * neste arquivo). Ter os dois no projeto e erro de build, entao nao criar
 * `middleware.ts`.
 *
 * Duas regras que parecem cerimonia e nao sao:
 *
 *   1. **Nada roda entre `createServerClient` e `auth.getUser()`.** Qualquer
 *      coisa no meio pode ler cookie antigo e derrubar a sessao do aluno de
 *      forma intermitente — o tipo de defeito que nao se reproduz.
 *   2. **A resposta devolvida e a mesma que recebeu os cookies.** Criar um
 *      `NextResponse` novo no fim descarta os cookies renovados e o navegador
 *      sai de sincronia com o servidor.
 *
 * Este arquivo **nao** decide sobre matricula. Sessao e paywall sao perguntas
 * diferentes: quem tem conta e nao pagou passa por aqui e para em `/assinar`,
 * pela guarda do servidor (`modules/conta/matricula.ts`). Checar matricula aqui
 * custaria uma consulta ao banco em toda requisicao, inclusive nas publicas.
 */
export async function proxy(request: NextRequest) {
  let resposta = NextResponse.next({ request });

  const { url, chave } = chavesPublicas();

  const supabase = createServerClient(url, chave, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(paraGravar) {
        for (const { name, value } of paraGravar) {
          request.cookies.set(name, value);
        }
        resposta = NextResponse.next({ request });
        for (const { name, value, options } of paraGravar) {
          resposta.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  if (!user && !ehRotaPublica(pathname)) {
    return NextResponse.redirect(
      new URL(destinoSemSessao(pathname, search), request.url),
    );
  }

  return resposta;
}

export const config = {
  matcher: [
    /*
     * Tudo, menos o que nunca precisa de sessao: arquivo estatico, imagem
     * otimizada, favicon, o tunel do Sentry e o motor de scroll da landing.
     * Rota de pagina nova entra no matcher sozinha — e o default seguro.
     *
     * `motor/` esta na lista porque o default seguro custou um defeito real:
     * sem a excecao, `/motor/scrollcraft.js` era tratado como rota de pagina e
     * o visitante deslogado recebia o HTML de `/entrar` no lugar do script. A
     * landing e publica, mas o arquivo nao vem de `_next/static` — asset em
     * `public/` e servido pela raiz.
     */
    "/((?!_next/static|_next/image|favicon.ico|monitoring|motor/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
