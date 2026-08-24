import { clienteDaSessao } from "@/lib/db/sessao";
import { exigirMatriculaAtiva } from "@/modules/conta/matricula";
import { consultarPerfilEstudo } from "./onboarding";
import { consultarPlanoDoDia, type PlanoDoDia } from "./plano";
import { consultarRotulosDosTopicos } from "./plano-rotulos";
import { OnboardingTela } from "./onboarding-tela";
import {
  PlanoTela,
  type ResultadoDoPlano,
  type SuperficieDoPlano,
} from "./plano-tela";
import { Estado } from "@/modules/ui/estado";
import { reportarErro } from "@/modules/observabilidade/reporte";

export type ParametrosDaPagina = Promise<Record<string, string | string[] | undefined>>;

type AcaoDeOnboarding = (formulario: FormData) => Promise<never>;

/** Renderiza Hoje e Plano pelo mesmo contrato, sem exportar helpers na page. */
export async function renderizarPainelDoPlano({
  searchParams,
  superficie,
  acaoDeOnboarding,
}: {
  searchParams: ParametrosDaPagina;
  superficie: SuperficieDoPlano;
  acaoDeOnboarding: AcaoDeOnboarding;
}) {
  await exigirMatriculaAtiva();
  const supabase = await clienteDaSessao();
  const perfil = await consultarPerfilEstudo(supabase);
  const parametros = await searchParams;
  const erro = comoTexto(parametros.erro);

  if (!perfil?.onboardingConcluido) {
    return (
      <div className="space-y-8">
        <CabecalhoDoPainel estado="onboarding" superficie={superficie} />
        <OnboardingTela acao={acaoDeOnboarding} erro={erro} />
      </div>
    );
  }

  return conteudoDoPlano(supabase, {
    superficie,
    resultado: resultadoDoPlano(parametros.resultado),
  });
}

async function conteudoDoPlano(
  supabase: Awaited<ReturnType<typeof clienteDaSessao>>,
  opcoes: { superficie: SuperficieDoPlano; resultado: ResultadoDoPlano },
) {
  const plano = await consultarPlanoDoDia(supabase);
  if (!plano) {
    return (
      <div className="space-y-8">
        <CabecalhoDoPainel estado="preparando" superficie={opcoes.superficie} />
        <Estado
          tipo="vazio"
          titulo="Seu plano de hoje ainda está sendo preparado"
          acao="Recarregue em alguns instantes. Seu perfil já está salvo e a geração do plano não depende de uma resposta da IA."
        />
      </div>
    );
  }

  const rotulosDosTopicos = await lerRotulosComFallback(supabase, plano);

  return (
    <div className="space-y-8">
      <CabecalhoDoPainel
        estado="pronto"
        superficie={opcoes.superficie}
        nBlocos={plano.metaCheia.length > 0 ? plano.metaCheia.length : plano.piso.length}
      />
      <PlanoTela
        plano={plano}
        rotulosDosTopicos={rotulosDosTopicos}
        superficie={opcoes.superficie}
        resultado={opcoes.resultado}
      />
    </div>
  );
}

async function lerRotulosComFallback(
  supabase: Awaited<ReturnType<typeof clienteDaSessao>>,
  plano: PlanoDoDia,
): Promise<ReadonlyMap<string, string>> {
  try {
    return await consultarRotulosDosTopicos(supabase, plano);
  } catch (erro) {
    reportarErro(erro, { modulo: "aluno", operacao: "consultar_rotulos_plano" });
    // O plano continua útil se a leitura opcional da taxonomia falhar.
    return new Map();
  }
}

function CabecalhoDoPainel({
  estado,
  nBlocos,
  superficie,
}: {
  estado: "onboarding" | "preparando" | "pronto";
  nBlocos?: number;
  superficie: SuperficieDoPlano;
}) {
  const nomeDaTela = superficie === "plano" ? "Seu plano de estudo" : "Hoje, um passo de cada vez";
  const detalhes = {
    onboarding: "Configure seu ponto de partida para receber um plano compatível com a sua rotina.",
    preparando: "Seu perfil está salvo. A geração do plano acontece sem depender de uma resposta da IA.",
    pronto: `${nBlocos ?? 0} ${nBlocos === 1 ? "bloco" : "blocos"} na meta cheia de hoje.`,
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
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{nomeDaTela}</h1>
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

function resultadoDoPlano(valor: string | string[] | undefined): ResultadoDoPlano {
  const resultado = comoTexto(valor);
  return resultado === "reordenado" || resultado === "adiado" || resultado === "curta" || resultado === "erro"
    ? resultado
    : null;
}

function comoTexto(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}
