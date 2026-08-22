import { redirect } from "next/navigation";

import { clienteDaSessao } from "@/lib/db/sessao";

/**
 * Confirma o link de recuperação enviado pelo Supabase (PAG-06/PAG-07).
 *
 * O cliente de serviço que dispara o e-mail após o pagamento não tem um
 * navegador onde guardar o verifier PKCE. Por isso o template de recuperação
 * usa `token_hash` e este handler troca o token por uma sessão nos cookies.
 * O token nunca é repassado para a tela de definição de senha.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const tipo = searchParams.get("type");

  if (tokenHash && tipo === "recovery") {
    const supabase = await clienteDaSessao();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "recovery",
    });

    if (!error) {
      redirect("/definir-senha");
    }
  }

  // Não diferenciar token ausente, expirado ou inválido para não vazar estado
  // do provedor nem transformar o callback em uma tela de diagnóstico.
  redirect("/entrar?erro=provedor");
}
