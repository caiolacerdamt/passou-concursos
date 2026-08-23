"use server";

import { redirect } from "next/navigation";

import { clienteDaSessao } from "@/lib/db/sessao";
import { exigirMatriculaAtiva } from "@/modules/conta/matricula";
import { executarEsquecimento } from "@/modules/lgpd/esquecimento";
import { reportarErro } from "@/modules/observabilidade/reporte";

function confirmou(formulario: FormData): boolean {
  return String(formulario.get("confirmacao") ?? "").trim().toUpperCase() === "APAGAR";
}

/**
 * A action ignora qualquer `user_id` do formulário. O titular vem do cookie
 * de sessão, e a confirmação textual existe para tornar um clique acidental
 * incapaz de iniciar a rotina irreversível.
 */
export async function solicitarEsquecimento(formulario: FormData): Promise<never> {
  await exigirMatriculaAtiva();

  if (!confirmou(formulario)) {
    redirect("/app/conta?resultado=confirmacao");
  }

  const sessao = await clienteDaSessao();
  const {
    data: { user },
  } = await sessao.auth.getUser();

  if (!user || !user.email) {
    redirect("/entrar?proximo=%2Fapp%2Fconta");
  }

  try {
    await executarEsquecimento({ id: user.id, email: user.email });
  } catch (erro) {
    reportarErro(erro, { modulo: "lgpd", operacao: "solicitar_esquecimento" });
    redirect("/app/conta?resultado=erro");
  }

  redirect("/entrar?resultado=esquecimento");
}
