import { clienteDaSessao } from "@/lib/db/sessao";
import { consultarPerfilEstudo } from "./onboarding";
import { consultarPlanoDoDia, type PlanoDoDia } from "./plano";
import { consultarRotulosDosTopicos, type RotuloDoTopico } from "./plano-rotulos";
import type { DadosGamificacao } from "./gamificacao";
import { consultarPainelDoDia, type PainelDoDia } from "./painel-do-dia";
import { AcompanhamentoDoDia, CartaoDoDia } from "./painel-do-dia-tela";
import { Ofensiva } from "./ofensiva-tela";
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
  const supabase = await clienteDaSessao();
  const perfil = await consultarPerfilEstudo(supabase);
  const parametros = await searchParams;
  const erro = comoTexto(parametros.erro);

  if (!perfil?.onboardingConcluido) {
    return (
      <div className="space-y-10">
        <CabecalhoDoPainel estado="onboarding" superficie={superficie} />
        <OnboardingTela acao={acaoDeOnboarding} erro={erro} />
      </div>
    );
  }

  // A faixa integrada é exclusiva de Hoje: Plano continua sendo a leitura do
  // ciclo do edital, sem repetir gamificação e acompanhamento.
  const painel =
    superficie === "hoje"
      ? await consultarPainelDoDia(supabase, { dataProva: perfil.dataProva })
      : null;

  return conteudoDoPlano(supabase, {
    superficie,
    resultado: resultadoDoPlano(parametros.resultado),
    painel,
  });
}

async function conteudoDoPlano(
  supabase: Awaited<ReturnType<typeof clienteDaSessao>>,
  opcoes: {
    superficie: SuperficieDoPlano;
    resultado: ResultadoDoPlano;
    painel: PainelDoDia | null;
  },
) {
  const plano = await consultarPlanoDoDia(supabase);
  if (!plano) {
    return (
      <div className="space-y-10">
        <CabecalhoDoPainel
          estado="preparando"
          superficie={opcoes.superficie}
          gamificacao={opcoes.painel?.gamificacao ?? null}
        />
        <Estado
          tipo="vazio"
          titulo="Seu plano de hoje ainda está sendo preparado"
          acao="Recarregue em alguns instantes. Seu perfil já está salvo e a geração do plano não depende de uma resposta da IA."
        />
        {opcoes.painel ? <AcompanhamentoDoDia painel={opcoes.painel} /> : null}
      </div>
    );
  }

  const rotulosDosTopicos = await lerRotulosComFallback(supabase, plano);

  return (
    <div className="space-y-10">
      <CabecalhoDoPainel
        estado="pronto"
        superficie={opcoes.superficie}
        nBlocos={plano.metaCheia.length > 0 ? plano.metaCheia.length : plano.piso.length}
        gamificacao={opcoes.painel?.gamificacao ?? null}
      />
      <PlanoTela
        plano={plano}
        rotulosDosTopicos={rotulosDosTopicos}
        superficie={opcoes.superficie}
        resultado={opcoes.resultado}
      />
      {opcoes.painel ? <AcompanhamentoDoDia painel={opcoes.painel} /> : null}
    </div>
  );
}

async function lerRotulosComFallback(
  supabase: Awaited<ReturnType<typeof clienteDaSessao>>,
  plano: PlanoDoDia,
): Promise<ReadonlyMap<string, RotuloDoTopico>> {
  try {
    return await consultarRotulosDosTopicos(supabase, plano);
  } catch (erro) {
    reportarErro(erro, { modulo: "aluno", operacao: "consultar_rotulos_plano" });
    // O plano continua útil se a leitura opcional da taxonomia falhar.
    return new Map();
  }
}

/**
 * O alto da tela: quem é o aluno, em que dia ele está, e — no lugar onde antes
 * ficava a caixa "Estado atual" — o cartão do dia.
 *
 * A troca é deliberada: "Plano de hoje disponível" era o estado do *sistema*,
 * não do aluno. O cartão do dia diz o que ele já fez e o que falta, que é a
 * pergunta que ele traz ao abrir a tela. Com a gamificação desligada (AD-076) o
 * cartão não existe, e aí a caixa de estado do sistema volta a ser o que há de
 * mais honesto para ocupar o canto.
 */
function CabecalhoDoPainel({
  estado,
  nBlocos,
  superficie,
  gamificacao = null,
}: {
  estado: "onboarding" | "preparando" | "pronto";
  nBlocos?: number;
  superficie: SuperficieDoPlano;
  gamificacao?: DadosGamificacao | null;
}) {
  const nomeDaTela = superficie === "plano" ? "Seu plano de estudo" : "O que estudar hoje";
  const detalhes = {
    onboarding: "Configure seu ponto de partida para receber um plano compatível com a sua rotina.",
    preparando: "Seu perfil está salvo. A geração do plano acontece sem depender de uma resposta da IA.",
    pronto: `${nBlocos ?? 0} ${nBlocos === 1 ? "bloco" : "blocos"} no plano de hoje.`,
  }[estado];

  const status = {
    onboarding: "Perfil pendente",
    preparando: "Plano em preparação",
    pronto: "Plano de hoje disponível",
  }[estado];

  return (
    <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,24.75rem)] lg:items-start">
      <div className="lg:pt-1.5">
        <p className="font-utilitaria text-xs font-semibold uppercase tracking-[0.16em] text-marca-apoio">
          Área do aluno
        </p>
        <h1 className="mt-3.5 max-w-[15ch] text-4xl font-semibold leading-[1.04] tracking-[-0.035em] sm:text-[2.75rem]">
          {nomeDaTela}
        </h1>
        <p className="mt-3.5 max-w-[44ch] text-[1.0625rem] leading-relaxed text-suave">
          Estudo, revisão, questões, tudo em um só lugar planejado
        </p>
        {gamificacao?.sequencia ? <Ofensiva sequencia={gamificacao.sequencia} /> : null}
      </div>

      {gamificacao ? (
        <CartaoDoDia dados={gamificacao} />
      ) : (
        <div className="rounded-2xl border border-linha bg-painel px-6 pb-6 pt-5">
          <p className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] text-suave">
            Estado atual
          </p>
          <p className="mt-2.5 text-xl font-semibold">{status}</p>
          <p className="mt-2 text-sm leading-6 text-suave">{detalhes}</p>
        </div>
      )}
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
