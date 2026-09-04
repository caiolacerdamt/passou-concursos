import { redirect } from "next/navigation";

import { clienteDaSessao } from "@/lib/db/sessao";
import { concederTrial } from "@/modules/conta/trial";

/**
 * Confirma os links enviados pelo Supabase por e-mail (PAG-06/PAG-07, AD-133).
 *
 * O cliente de serviço que dispara o e-mail após o pagamento não tem um
 * navegador onde guardar o verifier PKCE. Por isso os templates usam
 * `token_hash` e este handler troca o token por uma sessão nos cookies.
 * O token nunca é repassado para a tela nem gravado em log.
 *
 * Dois tipos passam por aqui, e cada um termina em um lugar:
 *
 *   - `recovery` — "defina sua senha", que leva a `/definir-senha`;
 *   - `signup` / `email` — a confirmação do cadastro gratuito, que concede o
 *     trial e leva direto ao plano de hoje.
 *
 * O e-mail confirmado é pré-requisito de `conceder_trial()`, e é por isso que a
 * concessão acontece **aqui** e não no cadastro: antes deste ponto o banco
 * recusaria, e com razão.
 */

const TIPOS_DE_CADASTRO = new Set(["signup", "email"]);

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

  if (tokenHash && tipo !== null && TIPOS_DE_CADASTRO.has(tipo)) {
    const supabase = await clienteDaSessao();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "email",
    });

    if (!error) {
      // A recusa não derruba a confirmação: a conta existe e o aluno está
      // autenticado. Sem trial ele cai no paywall, que explica o que houve —
      // muito melhor do que uma tela de erro sobre uma conta que foi criada.
      await concederTrial(supabase);
      redirect("/app");
    }
  }

  // Não diferenciar token ausente, expirado ou inválido para não vazar estado
  // do provedor nem transformar o callback em uma tela de diagnóstico.
  redirect("/entrar?erro=provedor");
}
