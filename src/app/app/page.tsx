import { exigirMatriculaAtiva } from "@/modules/conta/matricula";
import { clienteDaSessao } from "@/lib/db/sessao";
import { consultarPerfilEstudo } from "@/modules/aluno/onboarding";
import { consultarPlanoDoDia } from "@/modules/aluno/plano";
import { OnboardingTela } from "@/modules/aluno/onboarding-tela";
import { PlanoTela } from "@/modules/aluno/plano-tela";
import { Estado } from "@/modules/ui/estado";

import { salvarOnboarding } from "./acoes";

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

  if (!perfil?.onboardingConcluido) {
    return (
      <div className="space-y-8">
        <CabecalhoDoPainel estado="onboarding" />
        <OnboardingTela acao={salvarOnboarding} erro={erro} />
      </div>
    );
  }

  return await conteudoDoPlano(supabase);
}

async function conteudoDoPlano(supabase: Awaited<ReturnType<typeof clienteDaSessao>>) {
  const plano = await consultarPlanoDoDia(supabase);
  if (!plano) {
    return (
      <div className="space-y-8">
        <CabecalhoDoPainel estado="preparando" />
        <Estado
          tipo="vazio"
          titulo="Seu plano de hoje ainda está sendo preparado"
          acao="Recarregue em alguns instantes. Seu perfil já está salvo e a geração do plano não depende de uma resposta da IA."
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <CabecalhoDoPainel estado="pronto" nBlocos={plano.piso.length + plano.metaCheia.length} />
      <PlanoTela plano={plano} />
    </div>
  );
}

function CabecalhoDoPainel({
  estado,
  nBlocos,
}: {
  estado: "onboarding" | "preparando" | "pronto";
  nBlocos?: number;
}) {
  const detalhes = {
    onboarding: "Configure seu ponto de partida para receber um plano compatível com a sua rotina.",
    preparando: "Seu perfil está salvo. A geração do plano acontece sem depender de uma resposta da IA.",
    pronto: `${nBlocos ?? 0} ${nBlocos === 1 ? "bloco disponível" : "blocos disponíveis"} no plano de hoje.`,
  }[estado];

  const status = {
    onboarding: "Perfil pendente",
    preparando: "Plano em preparação",
    pronto: "Plano de hoje disponível",
  }[estado];

  return (
    <section className="flex flex-col gap-5 border-b border-linha pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-marca">Área do aluno</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Bem-vindo ao seu estudo</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-suave">O que importa para hoje aparece aqui, em um só lugar.</p>
      </div>
      <div className="shrink-0 rounded-lg border border-linha bg-painel px-4 py-3 sm:min-w-56">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-suave">Estado atual</p>
        <p className="mt-1 font-semibold text-texto">{status}</p>
        <p className="mt-1 text-xs leading-5 text-suave">{detalhes}</p>
      </div>
    </section>
  );
}

function comoTexto(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}
