"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { clienteDaSessao } from "@/lib/db/sessao";
import { clienteDeServico } from "@/lib/db/servidor";
import { exigirMatriculaAtiva } from "@/modules/conta/matricula";
import {
  OnboardingRecusado,
  validarOnboarding,
} from "@/modules/aluno/onboarding";
import { dataHojeDoProduto } from "@/modules/aluno/plano";
import { reportarErro } from "@/modules/observabilidade/reporte";

function texto(formulario: FormData, campo: string): string {
  return String(formulario.get(campo) ?? "");
}

function diasDoFormulario(formulario: FormData): string[] {
  return formulario.getAll("diasEstudo").map(String);
}

function erroDeOnboarding(motivo: string): never {
  redirect(`/app?erro=onboarding&motivo=${encodeURIComponent(motivo)}`);
}

/**
 * Fecha o primeiro passo do aluno e pede ao motor SQL o plano de hoje.
 *
 * A action e uma fronteira publica: o navegador pode chamar seu POST sem
 * passar pela tela. Por isso autentica, exige matricula e deriva user_id da
 * sessao antes de aceitar qualquer dado.
 */
export async function salvarOnboarding(formulario: FormData): Promise<never> {
  await exigirMatriculaAtiva();

  const supabase = await clienteDaSessao();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/entrar?proximo=%2Fapp");

  let perfil;
  try {
    perfil = validarOnboarding({
      concursoAlvo: texto(formulario, "concursoAlvo"),
      minutosPorDia: texto(formulario, "minutosPorDia"),
      diasEstudo: diasDoFormulario(formulario),
      horarioEstudo: texto(formulario, "horarioEstudo"),
      nivelDeclarado: texto(formulario, "nivelDeclarado"),
    });
  } catch (erro) {
    if (erro instanceof OnboardingRecusado) erroDeOnboarding(erro.motivo);
    reportarErro(erro, { modulo: "aluno", operacao: "validar_onboarding" });
    redirect("/app?erro=onboarding");
  }

  const gravacao = await supabase.from("perfil_estudo").upsert(
    {
      user_id: user.id,
      concurso_alvo: perfil.concursoAlvo,
      minutos_por_dia: perfil.minutosPorDia,
      dias_estudo: perfil.diasEstudo,
      horario_estudo: perfil.horarioEstudo,
      nivel_declarado: perfil.nivelDeclarado,
      onboarding_concluido: true,
    },
    { onConflict: "user_id" },
  );

  if (gravacao.error) {
    reportarErro(gravacao.error, { modulo: "aluno", operacao: "salvar_onboarding" });
    redirect("/app?erro=salvar");
  }

  const plano = await clienteDeServico().rpc("gera_plano_do_dia", {
    p_user_id: user.id,
    p_data: dataHojeDoProduto(),
  });

  if (plano.error) {
    reportarErro(plano.error, { modulo: "aluno", operacao: "gerar_primeiro_plano" });
    redirect("/app?erro=plano");
  }

  revalidatePath("/app");
  redirect("/app");
}
