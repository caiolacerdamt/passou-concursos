import Link from "next/link";

import type { BlocoDoPlano, NivelDoPlano, PlanoDoDia } from "./plano";
import { nomeDoRotuloDoTopico, type RotuloDoTopico } from "./rotulo-do-topico";

const TITULOS: Record<BlocoDoPlano["tipo"], string> = {
  revisar: "Revisar",
  avancar: "Aprender",
  treinar: "Praticar",
  simulado: "Simulado",
};

const DESCRICOES: Record<BlocoDoPlano["tipo"], string> = {
  revisar: "Assunto que já está na sua memória e venceu a data de revisão.",
  avancar: "Assunto novo, escolhido pelo seu ponto mais fraco entre os que mais caem.",
  treinar: "Assunto que você já viu, para firmar o que ainda não está firme.",
  simulado: "Uma prova curta para medir seu ritmo.",
};

export type SuperficieDoPlano = "hoje" | "plano";

type Props = {
  plano: PlanoDoDia;
  rotulosDosTopicos?: ReadonlyMap<string, RotuloDoTopico>;
  superficie?: SuperficieDoPlano;
};

function emHoras(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0 ? `${horas}h` : `${horas}h${String(resto).padStart(2, "0")}`;
}

export function PlanoTela({
  plano,
  rotulosDosTopicos = new Map(),
  superficie = "hoje",
}: Props) {
  const blocos = [...plano.piso, ...plano.metaCheia];
  const usaMetaCheia = plano.metaCheia.length > 0;
  const blocosDaMeta = usaMetaCheia ? plano.metaCheia : plano.piso;
  const escopoDoResumo = usaMetaCheia ? "na meta cheia" : "no piso disponível";
  const pendentes = blocos.filter((bloco) => bloco.conclusao === null);
  const proximoBloco = pendentes[0] ?? null;
  const totalMinutos = blocosDaMeta.reduce((total, bloco) => total + numero(bloco.minutosEstimados), 0);
  const totalQuestoes = blocosDaMeta.reduce((total, bloco) => total + numero(bloco.nQuestoes), 0);
  const totalConcluidos = blocosDaMeta.filter((bloco) => bloco.conclusao !== null).length;
  const rotaDaTela = superficie === "plano" ? "/app/plano" : "/app";
  const fracaoFeita = blocosDaMeta.length === 0 ? 0 : totalConcluidos / blocosDaMeta.length;

  return (
    <div className="grid gap-5">
      {/*
        O resumo do plano vive nesta linha e não num grid de quatro cartões de
        métrica: quatro números iguais em quatro caixas iguais não têm
        hierarquia, e a régua do DESIGN.md proíbe exatamente isso. Aqui o
        número que manda é a fração de blocos feitos, e ela é a única com
        representação visual.
      */}
      <header className="flex flex-col gap-5 border-b border-linha pb-4.5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {superficie === "plano" ? (
            <p className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] text-marca-apoio">
              Ciclo do edital
            </p>
          ) : null}
          <h2
            className={`max-w-[20ch] text-[2.125rem] font-semibold leading-[1.1] tracking-[-0.03em] ${
              superficie === "plano" ? "mt-3" : "mt-0"
            }`}
          >
            {superficie === "plano"
              ? "Seu plano, na ordem que faz sentido."
              : proximoBloco
                ? "Estudo de hoje"
                : "Você fechou o dia."}
          </h2>
        </div>

        <div className="shrink-0 sm:min-w-[13rem] sm:text-right">
          <p className="font-utilitaria text-[0.8125rem] text-suave">
            {totalConcluidos} de {blocosDaMeta.length}{" "}
            {blocosDaMeta.length === 1 ? "bloco" : "blocos"} · {emHoras(totalMinutos)} ·{" "}
            {totalQuestoes} {totalQuestoes === 1 ? "questão" : "questões"}
          </p>
          <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-linha">
            <div
              style={{ width: `${Math.round(fracaoFeita * 100)}%` }}
              className="h-full rounded-full bg-marca-viva"
            />
          </div>
          <p className="mt-2 text-xs text-suave">{escopoDoResumo}</p>
        </div>
      </header>

      {/*
        A frase do plano é texto, não caixa. Ela já é a única voz em primeira
        pessoa da tela — não precisa de fundo, de borda nem de tab lateral para
        se destacar, e "nem todo agrupamento é card" (DESIGN.md §Anti-slop).
        O que a separa é escala e espaço.
      */}
      {plano.frase ? (
        <blockquote className="max-w-[52ch] text-xl leading-relaxed tracking-[-0.01em] text-suave">
          {plano.frase}
        </blockquote>
      ) : null}

      <ProximoBloco
        bloco={proximoBloco}
        rotulosDosTopicos={rotulosDosTopicos}
        rotaDaTela={rotaDaTela}
      />

      <section
        className="grid items-start gap-5 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]"
        aria-label="Níveis do plano"
      >
        <NivelDoPlano
          nivel="piso"
          titulo="MÍNIMO"
          subtitulo="O mínimo para contar sua ofensiva de hoje"
          blocos={plano.piso}
          compacto
          rotulosDosTopicos={rotulosDosTopicos}
          idEmFoco={proximoBloco?.id ?? null}
        />
        <NivelDoPlano
          nivel="meta_cheia"
          titulo="META"
          subtitulo="Estudo completo do dia"
          blocos={plano.metaCheia}
          rotulosDosTopicos={rotulosDosTopicos}
          idEmFoco={proximoBloco?.id ?? null}
        />
      </section>
    </div>
  );
}

/**
 * O próximo bloco é a única superfície de conteúdo escura da tela.
 *
 * O breu vem da landing, onde duas das sete seções o usam — e é o racionamento
 * que faz ele valer. Aqui vale a mesma regra: um cartão, nunca dois. Se um dia
 * outro bloco quiser este tratamento, ele disputa este lugar; não ganha um
 * segundo.
 *
 * Sem bloco pendente ele troca de matéria em vez de sumir: verde tênue, porque
 * fechar o dia é um fato bom, e um vazio escuro leria como erro.
 */
function ProximoBloco({
  bloco,
  rotulosDosTopicos,
  rotaDaTela,
}: {
  bloco: BlocoDoPlano | null;
  rotulosDosTopicos: ReadonlyMap<string, RotuloDoTopico>;
  rotaDaTela: string;
}) {
  if (bloco === null) {
    return (
      <section
        aria-labelledby="proximo-bloco"
        className="grid gap-7 rounded-[1.25rem] border border-marca/30 bg-marca-suave px-8 py-8 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
      >
        <div>
          <p className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] text-marca">
            Próximo bloco
          </p>
          <h3 id="proximo-bloco" className="mt-3 max-w-[18ch] text-3xl font-semibold leading-[1.08] tracking-[-0.035em]">
            Tudo concluído por hoje
          </h3>
          <p className="mt-3 max-w-[46ch] leading-relaxed text-suave">
            Você cumpriu os blocos disponíveis. As revisões de hoje já estão marcadas para voltar no dia certo.
          </p>
        </div>
        <Link
          href={rotaDaTela}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border border-marca/40 px-6 text-sm font-semibold text-marca transition-colors duration-150 hover:bg-painel"
        >
          Ver o plano
        </Link>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="proximo-bloco"
      className="grid gap-8 rounded-[1.25rem] bg-breu px-9 py-8 text-breu-tinta sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
    >
      <div className="min-w-0">
        <p className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] text-breu-verde">
          Próximo bloco · {TITULOS[bloco.tipo]}
        </p>
        <h3
          id="proximo-bloco"
          className="mt-3.5 max-w-[20ch] text-[2.25rem] font-semibold leading-[1.06] tracking-[-0.035em]"
        >
          {nomeDoBloco(bloco, rotulosDosTopicos)}
        </h3>
        <p className="mt-3.5 max-w-[52ch] leading-relaxed text-breu-suave">
          {DESCRICOES[bloco.tipo]}
        </p>
        <p className="mt-5 font-utilitaria text-[0.8125rem] text-breu-suave">
          {numero(bloco.minutosEstimados)} min
          {numero(bloco.nQuestoes) > 0 ? ` · ${numero(bloco.nQuestoes)} questões` : ""}
        </p>
      </div>

      <div className="flex shrink-0 flex-col gap-2.5 sm:min-w-[13.5rem]">
        <Link
          href={hrefDoBloco(bloco.id)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-breu-verde px-6 text-[0.9375rem] font-semibold text-breu transition-colors duration-150 hover:bg-breu-tinta"
        >
          Começar agora
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
      </div>
    </section>
  );
}

function NivelDoPlano({
  nivel,
  titulo,
  subtitulo,
  blocos,
  compacto = false,
  rotulosDosTopicos,
  idEmFoco,
}: {
  nivel: NivelDoPlano;
  titulo: string;
  subtitulo: string;
  blocos: BlocoDoPlano[];
  compacto?: boolean;
  rotulosDosTopicos: ReadonlyMap<string, RotuloDoTopico>;
  idEmFoco: string | null;
}) {
  const pendentes = blocos.filter((bloco) => bloco.conclusao === null);
  const minutos = blocos.reduce((total, bloco) => total + numero(bloco.minutosEstimados), 0);

  return (
    <div
      id={nivel === "piso" ? "nivel-minimo" : undefined}
      className={`rounded-2xl border border-linha bg-painel px-6 pb-6 pt-5 ${
        nivel === "piso" ? "scroll-mt-24" : ""
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p
            className={`font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] ${
              nivel === "piso" ? "text-evolucao" : "text-marca-apoio"
            }`}
          >
            {titulo}
          </p>
          <h3 className="mt-2 text-[1.1875rem] font-semibold">{subtitulo}</h3>
        </div>
        <p className="shrink-0 text-right font-utilitaria text-[0.8125rem] text-suave">
          {emHoras(minutos)}
          {pendentes.length > 0 ? ` · ${pendentes.length} pendente${pendentes.length === 1 ? "" : "s"}` : ""}
        </p>
      </div>

      <div className="mt-5">
        {blocos.length > 0 ? (
          <ul
            className={compacto ? "grid gap-2.5" : "grid gap-2.5 sm:grid-cols-2"}
            aria-label={`Blocos do ${titulo.toLowerCase()}`}
          >
            {blocos.map((bloco) => (
              <li key={bloco.id}>
                <BlocoCard
                  bloco={bloco}
                  compacto={compacto}
                  rotulosDosTopicos={rotulosDosTopicos}
                  emFoco={bloco.id === idEmFoco}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl bg-fundo-suave px-4 py-3 text-sm text-suave">
            {nivel === "piso" ? "Nenhuma revisão vencida hoje." : "O acervo ainda está preparando seu primeiro bloco."}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * A matéria do cartão diz o estado antes de qualquer texto: papel é pendente,
 * verde tênue é feito, e a borda verde dupla marca o bloco que está aberto no
 * cartão de cima. São três estados, não quatro — "adiado" some da lista do dia
 * por definição, então não tem cartão aqui.
 */
function materiaDoBloco(feito: boolean, emFoco: boolean): string {
  if (feito) return "border-marca/30 bg-marca-suave";
  if (emFoco) return "border-marca/40 ring-1 ring-inset ring-marca/20 bg-painel";
  return "border-linha bg-painel";
}

function BlocoCard({
  bloco,
  compacto = false,
  rotulosDosTopicos,
  emFoco,
}: {
  bloco: BlocoDoPlano;
  compacto?: boolean;
  rotulosDosTopicos: ReadonlyMap<string, RotuloDoTopico>;
  emFoco: boolean;
}) {
  const conclusao = bloco.conclusao;
  const nome = nomeDoBloco(bloco, rotulosDosTopicos);
  const nQuestoes = numero(bloco.nQuestoes);

  return (
    <div
      className={`flex h-full flex-col rounded-xl border ${materiaDoBloco(conclusao !== null, emFoco)} ${
        compacto ? "px-4 py-3.5" : "p-4"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[0.6875rem] font-semibold ${
            conclusao
              ? "bg-ok/15 text-ok"
              : emFoco
                ? "bg-marca-suave text-marca"
                : "bg-fundo-suave text-suave"
          }`}
        >
          {conclusao ? (
            <svg
              viewBox="0 0 24 24"
              className="size-3"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m5 12.5 4.5 4.5L19 7" />
            </svg>
          ) : null}
          {conclusao ? "Concluído" : emFoco ? `Em foco · ${TITULOS[bloco.tipo]}` : TITULOS[bloco.tipo]}
        </span>
        <span className="shrink-0 font-utilitaria text-xs text-suave">
          {numero(bloco.minutosEstimados)} min
        </span>
      </div>

      <h4 className="mt-2.5 font-semibold tracking-[-0.015em]">
        {nome}
      </h4>
      <p className="mt-1.5 font-utilitaria text-xs text-suave">
        {numero(bloco.minutosEstimados)} min · {nQuestoes} {nQuestoes === 1 ? "questão" : "questões"}
      </p>

      {conclusao ? (
        <>
          <p className="mt-3.5 font-utilitaria text-[0.8125rem] font-semibold text-ok">
            {conclusao.nQuestoes} questões · {conclusao.nAcertos} acertos
          </p>
          <Link
            href={`/app/sessao/${encodeURIComponent(conclusao.sessaoId)}/resumo`}
            className="mt-auto inline-flex min-h-10 items-center self-start rounded-full border border-marca/30 px-4 py-2.5 text-[0.8125rem] font-semibold text-marca transition-colors duration-150 hover:bg-painel"
          >
            Ver resumo
          </Link>
        </>
      ) : (
        <Link
          href={hrefDoBloco(bloco.id)}
          className={`mt-auto inline-flex min-h-10 items-center self-start rounded-full px-4 py-2.5 text-[0.8125rem] font-semibold transition-colors duration-150 ${
            emFoco
              ? "bg-marca text-painel hover:bg-marca-apoio"
              : "border border-linha text-texto hover:border-marca/50 hover:text-marca"
          }`}
        >
          {emFoco ? "Continuar" : "Começar"}
        </Link>
      )}
    </div>
  );
}

function nomeDoBloco(bloco: BlocoDoPlano, rotulosDosTopicos: ReadonlyMap<string, RotuloDoTopico>): string {
  if (bloco.topicoId === null) return "Assuntos misturados";
  return nomeDoRotuloDoTopico(rotulosDosTopicos.get(bloco.topicoId)) ?? "Tópico do ciclo";
}

function hrefDoBloco(blocoId: string): string {
  return `/app/estudo?bloco=${encodeURIComponent(blocoId)}`;
}

function numero(valor: number | null | undefined): number {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : 0;
}
