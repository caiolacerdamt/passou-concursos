import Link from "next/link";

import type { RecursoDeEstudo } from "@/modules/acervo/recursos";

import { CronometroDeEstudo } from "./cronometro-tela";
import type { DadosDoEstudoGuiado, SnapshotDoBlocoDeEstudo } from "./consulta";
import { nomeDoRotuloDoTopico } from "../rotulo-do-topico";

/**
 * Os rótulos são os mesmos do plano de hoje (`plano-tela.tsx`): o aluno clica
 * num cartão "Revisar" e não pode cair numa tela que chama aquilo de "Avançar".
 */
const NOMES_DOS_TIPOS: Record<SnapshotDoBlocoDeEstudo["tipo"], string> = {
  revisar: "Revisar",
  avancar: "Aprender",
  treinar: "Praticar",
  simulado: "Simulado",
};

const DESCRICOES: Record<SnapshotDoBlocoDeEstudo["tipo"], string> = {
  revisar: "Assunto que já está na sua memória e venceu a data de revisão.",
  avancar: "Assunto novo, escolhido pelo seu ponto mais fraco entre os que mais caem.",
  treinar: "Assunto que você já viu, para firmar o que ainda não está firme.",
  simulado: "Uma prova curta para medir seu ritmo.",
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

/** Cor do rótulo do tipo, na mesma chave que o cartão do plano usa. */
const COR_DO_TIPO: Record<SnapshotDoBlocoDeEstudo["tipo"], string> = {
  revisar: "text-conquista",
  avancar: "text-marca",
  treinar: "text-evolucao",
  simulado: "text-suave",
};

export function EstudoGuiadoTela({ estudo }: { estudo: DadosDoEstudoGuiado }) {
  const recursos = estudo.recursos.filter(recursoSeguro);
  const bloco = estudo.bloco;
  const titulo = nomeDoRotuloDoTopico({ materia: estudo.materia, topico: estudo.topico }) ?? "Estudo do bloco";

  return (
    <div className="space-y-6">
      <Link
        href="/app"
        className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-marca"
      >
        <svg
          viewBox="0 0 24 24"
          className="size-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M19 12H6m0 0 4.6-4.6M6 12l4.6 4.6" />
        </svg>
        Plano de hoje
      </Link>

      {/*
        A mesma composição do painel: título à esquerda, cartão de fatos à
        direita, no lugar onde o aluno acabou de ver o cartão do dia.
      */}
      <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,24.75rem)] lg:items-end">
        <div className="min-w-0">
          <p className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] text-marca-apoio">
            Estudo guiado · {NOMES_DOS_TIPOS[bloco.tipo]}
          </p>
          <h1 className="mt-3.5 max-w-[18ch] text-4xl font-semibold leading-[1.04] tracking-[-0.035em] sm:text-[2.75rem]">
            {titulo}
          </h1>
          <p className="mt-3.5 max-w-[46ch] text-[1.0625rem] leading-relaxed text-suave">
            {DESCRICOES[bloco.tipo]}
          </p>
        </div>

        <RetratoDoPlano bloco={bloco} />
      </section>

      {/*
        O único cartão escuro desta tela (AD-111). O relógio é a ferramenta
        ativa da página, e é ele que ganha o breu — não o conteúdo, que é para
        ler.
      */}
      <CronometroDeEstudo />

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.62fr)_minmax(0,1fr)] lg:items-start">
        <div
          className="rounded-2xl border border-linha bg-painel px-6 pb-7 pt-5 sm:px-7"
          aria-labelledby="titulo-conteudo"
        >
          <p className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] text-marca-apoio">
            Conteúdo do bloco
          </p>
          <h2 id="titulo-conteudo" className="mt-2.5 text-[1.375rem] font-semibold">
            Entre no assunto antes de responder
          </h2>
          <p className="mt-2 max-w-[56ch] text-sm leading-6 text-suave">
            {estudo.topico
              ? "Fontes curadas para este tópico. Nada aqui é escrito por IA — todas apontam para o material original."
              : "Este bloco não tem um tópico único associado. Não vamos inventar conteúdo: use a técnica e siga para as questões do plano."}
          </p>

          <RecursosDeEstudo recursos={recursos} />
        </div>

        <div className="grid gap-5">
          <section
            className="rounded-2xl border border-linha bg-painel px-6 pb-6 pt-5"
            aria-labelledby="titulo-proximo-passo"
          >
            <p className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] text-marca-apoio">
              Próximo passo
            </p>
            <h2 id="titulo-proximo-passo" className="mt-2.5 text-xl font-semibold leading-snug">
              Leve o assunto para as questões
            </h2>
            <p className="mt-2 text-sm leading-6 text-suave">
              {bloco.nQuestoes > 0
                ? `${bloco.nQuestoes} ${bloco.nQuestoes === 1 ? "questão" : "questões"} deste bloco, com as respostas registradas no seu histórico.`
                : "As questões deste bloco são definidas ao abrir a sessão, e as respostas ficam registradas no seu histórico."}
            </p>
            <Link
              href={`/app/sessao?bloco=${encodeURIComponent(bloco.id)}`}
              className="mt-4.5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-marca px-5 font-semibold text-painel transition-colors duration-150 hover:bg-marca-apoio"
            >
              Ir para as questões
              <svg
                viewBox="0 0 24 24"
                className="size-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h13m0 0-4.6-4.6M18 12l-4.6 4.6" />
              </svg>
            </Link>
          </section>

          {estudo.proximaRevisao ? <AvisoDeRevisao data={estudo.proximaRevisao} /> : null}
        </div>
      </section>
    </div>
  );
}

/**
 * O retrato do plano deixa de ser uma faixa entre duas linhas e vira o cartão
 * do canto — mesmo lugar, mesma matéria e mesmo raio do cartão do dia em
 * `/app`. Os três números vêm do bloco; nada aqui é estimado na tela.
 */
function RetratoDoPlano({ bloco }: { bloco: SnapshotDoBlocoDeEstudo }) {
  return (
    <section
      className="rounded-2xl border border-linha bg-painel px-6 pb-6 pt-5"
      aria-labelledby="titulo-snapshot"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <p className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] text-suave">
          Retrato do plano
        </p>
        {bloco.ajusteUsuario ? (
          <span className="rounded-lg bg-fundo-suave px-2.5 py-1 text-[0.6875rem] font-semibold text-marca">
            Ajustado por você
          </span>
        ) : null}
      </div>

      <h2 id="titulo-snapshot" className="mt-2.5 text-xl font-semibold">
        {NOMES_DOS_NIVEIS[bloco.nivel]} · etapa {bloco.ordem}
      </h2>

      <dl className="mt-4.5 grid grid-cols-3 gap-3">
        <div>
          <dt className="text-xs text-suave">Tempo</dt>
          <dd className="mt-1.5 font-utilitaria text-xl font-semibold tracking-[-0.02em]">
            <span className="sr-only">{bloco.minutosEstimados} minutos</span>
            <span aria-hidden="true">
              {bloco.minutosEstimados}
              <span className="text-[0.8125rem] font-medium text-suave"> min</span>
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-suave">Questões</dt>
          <dd className="mt-1.5 font-utilitaria text-xl font-semibold tracking-[-0.02em]">
            {bloco.nQuestoes > 0 ? (
              bloco.nQuestoes
            ) : (
              <span className="text-[0.8125rem] font-medium text-suave">ao abrir</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-suave">Tipo</dt>
          <dd className={`mt-1.5 text-[0.9375rem] font-semibold ${COR_DO_TIPO[bloco.tipo]}`}>
            {NOMES_DOS_TIPOS[bloco.tipo]}
          </dd>
        </div>
      </dl>

      {bloco.motivo ? (
        <p className="mt-4.5 border-t border-linha pt-3.5 text-[0.8125rem] leading-6 text-suave">
          <span className="font-semibold text-texto">Por que agora: </span>
          {bloco.motivo}
        </p>
      ) : null}
      {bloco.adiadoDe ? (
        <p className="mt-2 text-xs text-suave">Este bloco foi trazido de {formatarData(bloco.adiadoDe)}.</p>
      ) : null}
    </section>
  );
}

function RecursosDeEstudo({ recursos }: { recursos: readonly RecursoDeEstudo[] }) {
  if (recursos.length === 0) {
    return (
      <div className="mt-5 rounded-xl border border-aviso/30 bg-conquista-fundo px-5 py-4">
        <p className="font-semibold text-aviso">Ainda não há recurso curado para este assunto.</p>
        <p className="mt-1.5 max-w-[56ch] text-sm leading-6 text-suave">
          A técnica continua disponível e as questões do bloco seguem liberadas. Quando houver uma fonte revisada, ela aparecerá aqui.
        </p>
      </div>
    );
  }

  const [principal, ...alternativas] = recursos;
  return (
    <div className="mt-5.5">
      <p className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] text-suave">
        Recurso principal
      </p>
      <RecursoLink recurso={principal} principal />

      {alternativas.length > 0 ? (
        <>
          <p className="mt-5.5 font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] text-suave">
            Outras fontes curadas
          </p>
          <ul className="mt-2.5 grid gap-2">
            {alternativas.map((recurso) => (
              <li key={recurso.id}>
                <RecursoLink recurso={recurso} />
              </li>
            ))}
          </ul>
        </>
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
      className={`flex items-center justify-between gap-4 rounded-xl border px-5 no-underline motion-safe:transition-colors motion-reduce:transition-none hover:border-marca ${
        principal
          ? "mt-2.5 min-h-19 border-marca/40 bg-marca-suave py-4"
          : "min-h-16 border-linha bg-painel py-3 hover:bg-marca-suave"
      }`}
    >
      <span className="min-w-0">
        <span className={`block font-semibold text-texto ${principal ? "text-base" : "text-[0.9375rem]"}`}>
          {recurso.titulo}
        </span>
        <span className="mt-1 block font-utilitaria text-[0.8125rem] text-suave">
          {NOMES_DOS_RECURSOS[recurso.tipo]} · {recurso.duracaoMinutos} min · {dominio(recurso.url)}
        </span>
      </span>
      <span
        aria-hidden="true"
        className={
          principal
            ? "grid size-9 shrink-0 place-items-center rounded-full bg-marca text-painel"
            : "shrink-0 text-marca"
        }
      >
        <svg
          viewBox="0 0 24 24"
          className={principal ? "size-4" : "size-4"}
          fill="none"
          stroke="currentColor"
          strokeWidth={principal ? "2" : "1.8"}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M7 17 17 7m0 0h-7m7 0v7" />
        </svg>
      </span>
    </a>
  );
}

function AvisoDeRevisao({ data }: { data: string }) {
  const formatada = formatarData(data);
  return (
    <aside
      className="rounded-2xl border border-marca/30 bg-marca-suave px-6 pb-5 pt-5"
      aria-label="Próxima revisão"
    >
      <p className="text-sm font-semibold text-marca">Próxima revisão registrada</p>
      {formatada ? (
        <p className="mt-1.5 font-utilitaria text-[0.9375rem] font-medium">{formatada}</p>
      ) : null}
      <p className="mt-2 text-[0.8125rem] leading-6 text-suave">
        A agenda não muda nesta tela — ela é recalculada quando você responde.
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

/** O domínio diz de onde a fonte vem antes do clique. URL quebrada some. */
function dominio(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
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
