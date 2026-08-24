import Link from "next/link";

import type { RecursoDeEstudo } from "@/modules/acervo/recursos";

import { CronometroDeEstudo } from "./cronometro-tela";
import type { DadosDoEstudoGuiado, SnapshotDoBlocoDeEstudo } from "./consulta";
import { nomeDoRotuloDoTopico } from "../rotulo-do-topico";

const NOMES_DOS_TIPOS: Record<SnapshotDoBlocoDeEstudo["tipo"], string> = {
  revisar: "Revisar",
  avancar: "Avançar",
  treinar: "Treinar",
  simulado: "Simulado",
};

const NOMES_DOS_NIVEIS: Record<SnapshotDoBlocoDeEstudo["nivel"], string> = {
  piso: "Piso do dia",
  meta_cheia: "Meta cheia",
};

const NOMES_DOS_RECURSOS: Record<RecursoDeEstudo["tipo"], string> = {
  video: "Vídeo",
  artigo: "Artigo",
  pdf: "PDF",
};

export function EstudoGuiadoTela({ estudo }: { estudo: DadosDoEstudoGuiado }) {
  const recursos = estudo.recursos.filter(recursoSeguro);
  const bloco = estudo.bloco;
  const titulo = nomeDoRotuloDoTopico({ materia: estudo.materia, topico: estudo.topico }) ?? "Estudo do bloco";
  const chamadaDaMateria = estudo.materia
    ? `Matéria: ${estudo.materia}`
    : "Matéria não informada neste bloco";

  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <Link
          href="/app"
          className="inline-flex min-h-10 items-center text-sm font-semibold text-marca underline underline-offset-4"
        >
          ← Voltar ao plano de hoje
        </Link>
        <p className="mt-7 text-sm font-semibold uppercase tracking-[0.16em] text-marca">
          Estudo guiado · {NOMES_DOS_TIPOS[bloco.tipo]}
        </p>
        <h1 className="mt-3 font-display text-4xl leading-tight tracking-tight sm:text-5xl">
          {titulo}
        </h1>
        <p className="mt-3 text-lg leading-8 text-suave">{chamadaDaMateria}</p>
      </header>

      <SnapshotDoBloco bloco={bloco} />

      <section className="space-y-4" aria-labelledby="titulo-conteudo">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-evolucao">
            Conteúdo do bloco
          </p>
          <h2 id="titulo-conteudo" className="mt-1 font-display text-3xl leading-tight">
            Recurso, técnica e próximo passo
          </h2>
          <p className="mt-2 max-w-3xl leading-7 text-suave">
            {estudo.topico
              ? "O assunto abaixo vem da taxonomia do acervo. Escolha uma fonte curada para entrar no contexto antes de responder."
              : "Este bloco não tem um tópico único associado. Não vamos inventar conteúdo: use a técnica e siga para as questões do plano."}
          </p>
        </div>

        <RecursosDeEstudo recursos={recursos} />
      </section>

      <CronometroDeEstudo />

      {estudo.proximaRevisao ? <AvisoDeRevisao data={estudo.proximaRevisao} /> : null}

      <section
        className="border-t border-linha pt-7"
        aria-labelledby="titulo-proximo-passo"
      >
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-marca">
          Próximo passo
        </p>
        <h2 id="titulo-proximo-passo" className="mt-2 font-display text-3xl leading-tight">
          Leve este estudo para as questões
        </h2>
        <p className="mt-2 max-w-2xl leading-7 text-suave">
          O bloco continua vinculado ao seu plano. A sessão vai buscar as questões disponíveis e registrar suas respostas no fluxo normal.
        </p>
        <Link
          href={`/app/sessao?bloco=${encodeURIComponent(bloco.id)}`}
          className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-marca px-5 py-3 font-semibold text-white motion-safe:transition-colors motion-reduce:transition-none hover:bg-marca-apoio sm:w-auto"
        >
          Ir para as questões
        </Link>
      </section>
    </div>
  );
}

function SnapshotDoBloco({ bloco }: { bloco: SnapshotDoBlocoDeEstudo }) {
  return (
    <section
      className="border-y border-linha py-5"
      aria-labelledby="titulo-snapshot"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-suave">
            Retrato do plano
          </p>
          <h2 id="titulo-snapshot" className="mt-1 text-xl font-semibold">
            {NOMES_DOS_NIVEIS[bloco.nivel]} · etapa {bloco.ordem}
          </h2>
        </div>
        {bloco.ajusteUsuario ? (
          <span className="rounded-full bg-fundo-suave px-3 py-1 text-xs font-semibold text-marca">
            Versão ajustada por você
          </span>
        ) : null}
      </div>

      <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-suave">Tempo previsto</dt>
          <dd className="mt-1 font-semibold">{bloco.minutosEstimados} minutos</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-suave">Questões do bloco</dt>
          <dd className="mt-1 font-semibold">
            {bloco.nQuestoes > 0 ? bloco.nQuestoes : "definidas ao abrir"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-suave">Tipo</dt>
          <dd className="mt-1 font-semibold">{NOMES_DOS_TIPOS[bloco.tipo]}</dd>
        </div>
      </dl>

      {bloco.motivo ? (
        <p className="mt-5 max-w-3xl border-l-2 border-marca pl-4 text-sm leading-6 text-suave">
          <span className="font-semibold text-texto">Por que agora: </span>{bloco.motivo}
        </p>
      ) : null}
      {bloco.adiadoDe ? (
        <p className="mt-3 text-xs text-suave">Este bloco foi trazido de {formatarData(bloco.adiadoDe)}.</p>
      ) : null}
    </section>
  );
}

function RecursosDeEstudo({ recursos }: { recursos: readonly RecursoDeEstudo[] }) {
  if (recursos.length === 0) {
    return (
      <div className="rounded-card border border-aviso/30 bg-painel p-5 shadow-card sm:p-6">
        <p className="font-semibold text-aviso">Ainda não há recurso curado para este assunto.</p>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-suave">
          A técnica continua disponível e as questões do bloco seguem liberadas. Quando houver uma fonte revisada, ela aparecerá aqui.
        </p>
      </div>
    );
  }

  const [principal, ...alternativas] = recursos;
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-marca">Recurso principal</p>
        <RecursoLink recurso={principal} principal />
      </div>

      {alternativas.length > 0 ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-suave">Outras fontes curadas</p>
          <ul className="mt-2 grid gap-2">
            {alternativas.map((recurso) => (
              <li key={recurso.id}><RecursoLink recurso={recurso} /></li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function RecursoLink({ recurso, principal = false }: { recurso: RecursoDeEstudo; principal?: boolean }) {
  return (
    <a
      href={recurso.url}
      target="_blank"
      rel="noopener noreferrer"
      referrerPolicy="no-referrer"
      className={`mt-2 flex min-h-16 items-center justify-between gap-4 rounded-lg border bg-painel px-4 py-3 motion-safe:transition-colors motion-reduce:transition-none hover:border-marca hover:bg-marca-suave ${principal ? "border-marca/40 shadow-sm" : "border-linha"}`}
    >
      <span className="min-w-0">
        <span className="block truncate font-semibold text-texto">{recurso.titulo}</span>
        <span className="mt-1 block text-sm text-suave">
          {NOMES_DOS_RECURSOS[recurso.tipo]} · {recurso.duracaoMinutos} min
        </span>
      </span>
      <span aria-hidden="true" className="shrink-0 text-lg text-marca">↗</span>
    </a>
  );
}

function AvisoDeRevisao({ data }: { data: string }) {
  const formatada = formatarData(data);
  return (
    <aside className="rounded-lg border border-evolucao/30 bg-evolucao/5 px-4 py-4" aria-label="Próxima revisão">
      <p className="text-sm font-semibold text-evolucao">Próxima revisão registrada</p>
      <p className="mt-1 text-sm leading-6 text-suave">
        {formatada ? `Este tópico está agendado para ${formatada}. A agenda não é alterada nesta tela.` : "Há uma próxima revisão registrada para este tópico."}
      </p>
    </aside>
  );
}

function recursoSeguro(recurso: RecursoDeEstudo): boolean {
  if (!recurso.ativo) return false;
  try {
    return new URL(recurso.url).protocol === "https:";
  } catch {
    return false;
  }
}

function formatarData(data: string): string | null {
  const valor = new Date(`${data}T12:00:00`);
  if (Number.isNaN(valor.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeZone: "America/Sao_Paulo",
  }).format(valor);
}
