import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { chavesPublicas } from "./chaves";

/**
 * Cliente Supabase **da sessao do aluno**, com a chave publicavel.
 *
 * Nao confundir com `servidor.ts`, que usa a chave secreta e passa por cima da
 * RLS. A diferenca nao e detalhe: e por este cliente que o paywall funciona.
 * Ele fala com o banco **como o aluno**, entao `tem_matricula_ativa()` enxerga
 * o `auth.uid()` certo e o acervo devolve zero linha para quem nao pagou. O
 * cliente de servico enxergaria tudo e o paywall viraria decoracao.
 */
export async function clienteDaSessao() {
  const { url, chave } = chavesPublicas();
  const cookieStore = await cookies();

  return createServerClient(url, chave, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(paraGravar) {
        try {
          for (const { name, value, options } of paraGravar) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Componente de servidor nao pode escrever cookie. E esperado: quem
          // renova a sessao e o `proxy.ts`, e sem ele este `catch` viraria
          // logout aleatorio — por isso os dois existem em par.
        }
      },
    },
  });
}
