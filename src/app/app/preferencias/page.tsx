import { redirect } from "next/navigation";

import { clienteDaSessao } from "@/lib/db/sessao";
import { exigirMatriculaAtiva } from "@/modules/conta/matricula";
import { consultarPerfilEstudo } from "@/modules/aluno/onboarding";
import { dataHojeDoProduto } from "@/modules/aluno/plano";
import { diaDaSemanaDe } from "@/modules/aluno/preferencias-efeito";
import { PreferenciasTela } from "@/modules/aluno/preferencias-tela";

import { salvarPreferencias } from "./acoes";

export const dynamic = "force-dynamic";

export default async function Preferencias({
  searchParams,
}: {
  searchParams: Promise<{
    resultado?: string | string[];
    erro?: string | string[];
    motivo?: string | string[];
  }>;
}) {
  await exigirMatriculaAtiva();

  const supabase = await clienteDaSessao();
  const perfil = await consultarPerfilEstudo(supabase);

  if (!perfil?.onboardingConcluido) {
    redirect("/app");
  }

  const parametros = await searchParams;

  return (
    <PreferenciasTela
      acao={salvarPreferencias}
      perfil={perfil}
      diaDeHoje={diaDaSemanaDe(dataHojeDoProduto())}
      resultado={comoTexto(parametros.resultado)}
      erro={comoTexto(parametros.erro)}
      motivo={comoTexto(parametros.motivo)}
    />
  );
}

function comoTexto(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}
