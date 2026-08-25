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

function erroDePreferencias(motivo: string): never {
  redirect(`/app/preferencias?erro=onboarding&motivo=${encodeURIComponent(motivo)}`);
}

/**
 * Atualiza as declarações que alimentam o plano sem aceitar identidade do
 * formulário. O perfil continua concluído; depois da gravação o motor SQL
 * recalcula o dia conforme a nova rotina.
 */
export async function salvarPreferencias(formulario: FormData): Promise<never> {
  await exigirMatriculaAtiva();

  const supabase = await clienteDaSessao();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/entrar?proximo=%2Fapp%2Fpreferencias");

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
    if (erro instanceof OnboardingRecusado) erroDePreferencias(erro.motivo);
    reportarErro(erro, { modulo: "aluno", operacao: "validar_preferencias" });
    redirect("/app/preferencias?erro=onboarding");
  }

  const gravacao = await supabase.from("perfil_estudo").upsert(
    {
      user_id: user.id,
      concurso_alvo: perfil.concursoAlvo,
      minutos_por_dia: perfil.minutosPorDia,
      dias_estudo: perfil.diasEstudo,
      horario_estudo: perfil.horarioEstudo,
      nivel_declarado: perfil.nivelDeclarado,
    },
    { onConflict: "user_id" },
  );

  if (gravacao.error) {
    reportarErro(gravacao.error, { modulo: "aluno", operacao: "salvar_preferencias" });
    redirect("/app/preferencias?erro=salvar");
  }

  const plano = await clienteDeServico().rpc("gera_plano_do_dia", {
    p_user_id: user.id,
    p_data: dataHojeDoProduto(),
  });

  if (plano.error) {
    reportarErro(plano.error, { modulo: "aluno", operacao: "gerar_plano_preferencias" });
    redirect("/app/preferencias?erro=plano");
  }

  revalidatePath("/app");
  revalidatePath("/app/preferencias");
  redirect("/app/preferencias?resultado=salvo");
}
