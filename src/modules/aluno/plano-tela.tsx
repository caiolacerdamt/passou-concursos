import Link from "next/link";

import {
  adiarBloco,
  escolherVersaoCurta,
  reordenarBlocosPendentes,
} from "@/app/app/plano/acoes";

import type { BlocoDoPlano, NivelDoPlano, PlanoDoDia } from "./plano";

const TITULOS: Record<BlocoDoPlano["tipo"], string> = {
  revisar: "Revisar",
  avancar: "Avançar",
  treinar: "Treinar",
  simulado: "Simulado",
};

const DESCRICOES: Record<BlocoDoPlano["tipo"], string> = {
  revisar: "Revisão de um assunto que já entrou na sua memória.",
  avancar: "Um assunto novo para aumentar seu domínio.",
  treinar: "Questões misturadas para testar se o conhecimento se sustenta.",
  simulado: "Uma prova curta para medir seu ritmo.",
};

export type SuperficieDoPlano = "hoje" | "plano";

export type ResultadoDoPlano = "reordenado" | "adiado" | "curta" | "erro" | null;

type Props = {
  plano: PlanoDoDia;
  rotulosDosTopicos?: ReadonlyMap<string, string>;
  superficie?: SuperficieDoPlano;
  resultado?: ResultadoDoPlano;
};

export function PlanoTela({
  plano,
  rotulosDosTopicos = new Map(),
  superficie = "hoje",
  resultado = null,
}: Props) {
  const blocos = [...plano.piso, ...plano.metaCheia];
  const pendentes = blocos.filter((bloco) => bloco.conclusao === null);
  const proximoBloco = pendentes[0] ?? null;
  const totalMinutos = blocos.reduce((total, bloco) => total + numero(bloco.minutosEstimados), 0);
  const totalQuestoes = blocos.reduce((total, bloco) => total + numero(bloco.nQuestoes), 0);
  const totalConcluidos = blocos.filter((bloco) => bloco.conclusao !== null).length;
  const rotaDaTela = superficie === "plano" ? "/app/plano" : "/app";

  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-marca">
          {superficie === "plano" ? "Ciclo do edital" : "Seu estudo de hoje"}
        </p>
        <h1 className="mt-3 font-display text-4xl leading-tight tracking-tight sm:text-5xl">
          {superficie === "plano"
            ? "Seu plano, na ordem que faz sentido para você."
            : "Clareza para começar. Controle para continuar."}
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-suave">
          Faça primeiro o essencial. Se houver tempo, avance até a meta cheia.
        </p>
      </header>

      {resultado ? <FeedbackDoPlano resultado={resultado} /> : null}

      <section
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Resumo real do plano"
      >
        <ResumoDoPlano rotulo="Blocos" valor={blocos.length} detalhe="no plano de hoje" />
        <ResumoDoPlano rotulo="Questões" valor={totalQuestoes} detalhe="previstas no ciclo" />
        <ResumoDoPlano rotulo="Tempo" valor={totalMinutos} unidade="min" detalhe="estimado" />
        <ResumoDoPlano
          rotulo="Concluídos"
          valor={totalConcluidos}
          detalhe={blocos.length === 1 ? "de 1 bloco" : `de ${blocos.length} blocos`}
        />
      </section>

      {plano.frase ? (
        <blockquote className="rounded-card border border-marca/20 bg-marca-suave px-5 py-4 text-lg leading-8 text-texto">
          {plano.frase}
        </blockquote>
      ) : null}

      <ProximoBloco
        bloco={proximoBloco}
        rotulosDosTopicos={rotulosDosTopicos}
        rotaDaTela={rotaDaTela}
      />

      <section
        className="grid gap-5 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]"
        aria-label="Níveis do plano"
      >
        <NivelDoPlano
          nivel="piso"
          titulo="Piso"
          subtitulo="O mínimo que mantém o ritmo"
          explicacao="Revisões devidas. Cumprir este bloco já protege o que você conquistou."
          blocos={plano.piso}
          compacto
          planoId={plano.id}
          rotulosDosTopicos={rotulosDosTopicos}
          origem={superficie}
        />
        <NivelDoPlano
          nivel="meta_cheia"
          titulo="Meta cheia"
          subtitulo="O dia inteiro de estudo"
          explicacao="Revisar, avançar e treinar dentro do tempo que você declarou."
          blocos={plano.metaCheia}
          planoId={plano.id}
          rotulosDosTopicos={rotulosDosTopicos}
          origem={superficie}
        />
      </section>
    </div>
  );
}

function ResumoDoPlano({
  rotulo,
  valor,
  unidade,
  detalhe,
}: {
  rotulo: string;
  valor: number;
  unidade?: string;
  detalhe: string;
}) {
  return (
    <div className="rounded-card border border-linha bg-painel px-4 py-4 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-suave">{rotulo}</p>
      <p className="mt-2 font-utilitaria text-2xl font-semibold text-texto">
        {valor}
        {unidade ? <span className="ml-1 text-sm font-medium text-suave">{unidade}</span> : null}
      </p>
      <p className="mt-1 text-xs text-suave">{detalhe}</p>
    </div>
  );
}

function FeedbackDoPlano({ resultado }: { resultado: Exclude<ResultadoDoPlano, null> }) {
  const mensagens: Record<Exclude<ResultadoDoPlano, null>, string> = {
    reordenado: "A ordem das pendências foi atualizada.",
    adiado: "Bloco adiado para o próximo dia disponível da sua agenda.",
    curta: "Versão curta escolhida. O bloco agora cabe em menos tempo.",
    erro: "Não foi possível atualizar este bloco. Recarregue o plano e tente novamente.",
  };

  return (
    <p
      role={resultado === "erro" ? "alert" : "status"}
      className={`rounded-lg border px-4 py-3 text-sm leading-6 ${
        resultado === "erro"
          ? "border-alerta/40 bg-alerta/5 text-texto"
          : "border-evolucao/40 bg-evolucao/5 text-texto"
      }`}
    >
      {mensagens[resultado]}
    </p>
  );
}

function ProximoBloco({
  bloco,
  rotulosDosTopicos,
  rotaDaTela,
}: {
  bloco: BlocoDoPlano | null;
  rotulosDosTopicos: ReadonlyMap<string, string>;
  rotaDaTela: string;
}) {
  return (
    <section
      className="rounded-card border border-marca/30 bg-marca-suave p-5 shadow-card sm:p-6"
      aria-labelledby="proximo-bloco"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-marca">Próximo bloco</p>
          <h2 id="proximo-bloco" className="mt-2 text-2xl font-semibold text-texto">
            {bloco ? nomeDoBloco(bloco, rotulosDosTopicos) : "Tudo concluído por hoje"}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-suave">
            {bloco
              ? `${TITULOS[bloco.tipo]} · ${numero(bloco.minutosEstimados)} min${bloco.motivo ? ` · ${bloco.motivo}` : ""}`
              : "Você cumpriu os blocos disponíveis. Volte amanhã para continuar o ciclo."}
          </p>
        </div>
        {bloco ? (
          <Link
            href={hrefDoBloco(bloco.id)}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-marca px-5 py-2 text-sm font-semibold text-white transition hover:bg-marca/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca"
          >
            Começar agora
          </Link>
        ) : (
          <Link
            href={rotaDaTela}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border border-marca px-5 py-2 text-sm font-semibold text-marca transition hover:bg-painel focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca"
          >
            Ver o plano
          </Link>
        )}
      </div>
    </section>
  );
}

function NivelDoPlano({
  nivel,
  titulo,
  subtitulo,
  explicacao,
  blocos,
  compacto = false,
  planoId,
  rotulosDosTopicos,
  origem,
}: {
  nivel: NivelDoPlano;
  titulo: string;
  subtitulo: string;
  explicacao: string;
  blocos: BlocoDoPlano[];
  compacto?: boolean;
  planoId: string;
  rotulosDosTopicos: ReadonlyMap<string, string>;
  origem: SuperficieDoPlano;
}) {
  const pendentes = blocos.filter((bloco) => bloco.conclusao === null);
  const minutos = blocos.reduce((total, bloco) => total + numero(bloco.minutosEstimados), 0);

  return (
    <div className="rounded-card border border-linha bg-painel p-5 shadow-card sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className={`text-sm font-semibold uppercase tracking-[0.14em] ${
              nivel === "piso" ? "text-evolucao" : "text-marca"
            }`}
          >
            {subtitulo}
          </p>
          <h2 className="mt-2 text-2xl font-semibold">{titulo}</h2>
        </div>
        <p className="shrink-0 text-right text-xs text-suave">
          <span className="block font-utilitaria text-base font-semibold text-texto">{minutos} min</span>
          {pendentes.length} pendente{pendentes.length === 1 ? "" : "s"}
        </p>
      </div>
      <p className="mt-2 text-sm leading-6 text-suave">{explicacao}</p>
      <div className="mt-5">
        {blocos.length > 0 ? (
          <ul
            className={compacto ? "space-y-2" : "grid gap-3 sm:grid-cols-2"}
            aria-label={`Blocos do ${titulo.toLowerCase()}`}
          >
            {blocos.map((bloco) => (
              <li key={bloco.id}>
                <BlocoCard
                  bloco={bloco}
                  compacto={compacto}
                  planoId={planoId}
                  nivel={nivel}
                  pendentes={pendentes}
                  rotulosDosTopicos={rotulosDosTopicos}
                  origem={origem}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg bg-fundo-suave px-3 py-3 text-sm text-suave">
            {nivel === "piso" ? "Nenhuma revisão vencida hoje." : "O acervo ainda está preparando seu primeiro bloco."}
          </p>
        )}
      </div>
    </div>
  );
}

function BlocoCard({
  bloco,
  compacto = false,
  planoId,
  nivel,
  pendentes,
  rotulosDosTopicos,
  origem,
}: {
  bloco: BlocoDoPlano;
  compacto?: boolean;
  planoId: string;
  nivel: NivelDoPlano;
  pendentes: BlocoDoPlano[];
  rotulosDosTopicos: ReadonlyMap<string, string>;
  origem: SuperficieDoPlano;
}) {
  const conclusao = bloco.conclusao;
  const pendente = conclusao === null;
  const curta = versaoCurta(bloco);
  const indicePendente = pendentes.findIndex((pendenteDoPlano) => pendenteDoPlano.id === bloco.id);
  const podeSubir = pendente && indicePendente > 0;
  const podeDescer = pendente && indicePendente >= 0 && indicePendente < pendentes.length - 1;

  return (
    <div
      className={`rounded-lg border ${
        conclusao ? "border-evolucao/40 bg-evolucao/5" : "border-linha bg-fundo-suave"
      } ${compacto ? "p-3" : "p-4"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-marca">{TITULOS[bloco.tipo]}</p>
            {conclusao ? (
              <span className="rounded-full bg-evolucao/10 px-2 py-0.5 text-xs font-semibold text-evolucao">Concluído</span>
            ) : null}
          </div>
          <h3 className="mt-1 truncate font-semibold">{nomeDoBloco(bloco, rotulosDosTopicos)}</h3>
        </div>
        <span className="shrink-0 font-utilitaria text-xs text-suave">{numero(bloco.minutosEstimados)} min</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-suave">{bloco.motivo ?? DESCRICOES[bloco.tipo]}</p>
      {conclusao ? (
        <>
          <p className="mt-3 text-sm font-semibold text-evolucao">
            {conclusao.nQuestoes} questões · {conclusao.nAcertos} acertos
          </p>
          <Link
            href={`/app/sessao/${encodeURIComponent(conclusao.sessaoId)}/resumo`}
            className="mt-3 inline-flex min-h-10 items-center rounded-full border border-evolucao px-4 py-2 text-sm font-semibold text-evolucao transition hover:bg-evolucao hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-evolucao"
          >
            Ver resumo
          </Link>
        </>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link
              href={hrefDoBloco(bloco.id)}
              className="inline-flex min-h-10 items-center rounded-full border border-marca px-4 py-2 text-sm font-semibold text-marca transition hover:bg-marca hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca"
            >
              Começar bloco
            </Link>
            {!curta ? (
              <form action={escolherVersaoCurta}>
                <input type="hidden" name="blocoId" value={bloco.id} />
                <input type="hidden" name="origem" value={origem} />
                <button
                  type="submit"
                  className="inline-flex min-h-10 items-center rounded-full border border-linha px-4 py-2 text-sm font-semibold text-suave transition hover:border-marca/50 hover:text-marca focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca"
                >
                  Escolher versão curta
                </button>
              </form>
            ) : (
              <span className="inline-flex min-h-10 items-center rounded-full border border-evolucao/40 px-4 py-2 text-sm font-semibold text-evolucao">
                Versão curta escolhida
              </span>
            )}
            <form action={adiarBloco}>
              <input type="hidden" name="blocoId" value={bloco.id} />
              <input type="hidden" name="origem" value={origem} />
              <button
                type="submit"
                className="inline-flex min-h-10 items-center rounded-full border border-linha px-4 py-2 text-sm font-semibold text-suave transition hover:border-marca/50 hover:text-marca focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca"
              >
                Adiar para outro dia
              </button>
            </form>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-linha/70 pt-3">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-suave">Ordem</span>
            <form action={reordenarBlocosPendentes}>
              <input type="hidden" name="planoId" value={planoId} />
              <input type="hidden" name="nivel" value={nivel} />
              <input type="hidden" name="origem" value={origem} />
              {ordemPendenteIds(pendentes, bloco, "cima").map((id) => (
                <input key={id} type="hidden" name="blocoIds" value={id} />
              ))}
              <button
                type="submit"
                disabled={!podeSubir}
                aria-label={`Mover ${nomeDoBloco(bloco, rotulosDosTopicos)} para cima`}
                className="inline-flex min-h-9 items-center rounded-md border border-linha px-2.5 text-sm text-suave transition hover:border-marca/50 hover:text-marca disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca"
              >
                ↑ Subir
              </button>
            </form>
            <form action={reordenarBlocosPendentes}>
              <input type="hidden" name="planoId" value={planoId} />
              <input type="hidden" name="nivel" value={nivel} />
              <input type="hidden" name="origem" value={origem} />
              {ordemPendenteIds(pendentes, bloco, "baixo").map((id) => (
                <input key={id} type="hidden" name="blocoIds" value={id} />
              ))}
              <button
                type="submit"
                disabled={!podeDescer}
                aria-label={`Mover ${nomeDoBloco(bloco, rotulosDosTopicos)} para baixo`}
                className="inline-flex min-h-9 items-center rounded-md border border-linha px-2.5 text-sm text-suave transition hover:border-marca/50 hover:text-marca disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca"
              >
                ↓ Descer
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

function nomeDoBloco(bloco: BlocoDoPlano, rotulosDosTopicos: ReadonlyMap<string, string>): string {
  if (bloco.topicoId === null) return "Assuntos misturados";
  return rotulosDosTopicos.get(bloco.topicoId) ?? "Tópico do ciclo";
}

function hrefDoBloco(blocoId: string): string {
  return `/app/estudo?bloco=${encodeURIComponent(blocoId)}`;
}

function numero(valor: number | null | undefined): number {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : 0;
}

function versaoCurta(bloco: BlocoDoPlano): boolean {
  return numero(bloco.nQuestoes) < numero(bloco.nQuestoesCheias)
    || numero(bloco.minutosEstimados) < numero(bloco.minutosEstimadosCheios);
}

function ordemPendenteIds(
  pendentes: BlocoDoPlano[],
  bloco: BlocoDoPlano,
  direcao: "cima" | "baixo",
): string[] {
  const ordem = pendentes.map((pendente) => pendente.id);
  const indice = ordem.indexOf(bloco.id);
  if (indice < 0) return ordem;
  const outro = direcao === "cima" ? indice - 1 : indice + 1;
  if (outro >= 0 && outro < ordem.length) [ordem[indice], ordem[outro]] = [ordem[outro], ordem[indice]];
  return ordem;
}
