import { exigirMatriculaAtiva } from "@/modules/conta/matricula";
import Link from "next/link";
import { clienteDaSessao } from "@/lib/db/sessao";
import { consultarPerfilEstudo } from "@/modules/aluno/onboarding";
import { consultarPlanoDoDia } from "@/modules/aluno/plano";
import { OnboardingTela } from "@/modules/aluno/onboarding-tela";
import { PlanoTela } from "@/modules/aluno/plano-tela";
import { Estado } from "@/modules/ui/estado";
import { Shell } from "@/modules/ui/shell";

import { salvarOnboarding } from "./acoes";
import { sair } from "../entrar/acoes";

/**
 * A primeira tela logada. O plano do dia de verdade e da SPEC 13 — aqui existe
 * o esqueleto que prova a corrente inteira: sessao → matricula → conteudo.
 */
export default async function App({ searchParams }: PageProps<"/app">) {
  await exigirMatriculaAtiva();
  const supabase = await clienteDaSessao();
  const perfil = await consultarPerfilEstudo(supabase);
  const parametros = await searchParams;
  const erro = comoTexto(parametros.erro);

  return (
    <Shell
      largura="painel"
      acoes={
        <div className="flex flex-wrap items-center justify-end gap-3 text-sm">
          <Link href="/app/progresso" className="text-marca underline">Progresso</Link>
          <form action={sair}>
            <button type="submit" className="text-marca underline">Sair</button>
          </form>
        </div>
      }
    >
      {perfil?.onboardingConcluido ? (
        await conteudoDoPlano(supabase)
      ) : (
        <OnboardingTela acao={salvarOnboarding} erro={erro} />
      )}
    </Shell>
  );
}

async function conteudoDoPlano(supabase: Awaited<ReturnType<typeof clienteDaSessao>>) {
  const plano = await consultarPlanoDoDia(supabase);
  if (!plano) {
    return (
      <Estado
        tipo="vazio"
        titulo="Seu plano de hoje ainda está sendo preparado"
        acao="Recarregue em alguns instantes. Seu perfil já está salvo e a geração do plano não depende de uma resposta da IA."
      />
    );
  }

  return <PlanoTela plano={plano} />;
}

function comoTexto(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}
