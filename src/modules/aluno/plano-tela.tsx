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

const COR_DO_TIPO: Record<BlocoDoPlano["tipo"], string> = {
  revisar: "text-conquista",
  avancar: "text-marca-apoio",
  treinar: "text-suave",
  simulado: "text-marca-apoio",
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
  const maiorMinutosDoDia = Math.max(
    1,
    ...blocos.map((bloco) => numero(bloco.minutosEstimados)),
  );

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
        className="grid gap-5"
        aria-label="Níveis do plano"
      >
        <NivelDoPlano
          nivel="piso"
          titulo="MÍNIMO"
          subtitulo="O mínimo para contar sua ofensiva de hoje"
          blocos={plano.piso}
          rotulosDosTopicos={rotulosDosTopicos}
          idEmFoco={proximoBloco?.id ?? null}
          maiorMinutosDoDia={maiorMinutosDoDia}
        />
        <NivelDoPlano
          nivel="meta_cheia"
          titulo="META"
          subtitulo="Estudo completo do dia"
          blocos={plano.metaCheia}
          rotulosDosTopicos={rotulosDosTopicos}
          idEmFoco={proximoBloco?.id ?? null}
          maiorMinutosDoDia={maiorMinutosDoDia}
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
  rotulosDosTopicos,
  idEmFoco,
  maiorMinutosDoDia,
}: {
  nivel: NivelDoPlano;
  titulo: string;
  subtitulo: string;
  blocos: BlocoDoPlano[];
  rotulosDosTopicos: ReadonlyMap<string, RotuloDoTopico>;
  idEmFoco: string | null;
  maiorMinutosDoDia: number;
}) {
  const pendentes = blocos.filter((bloco) => bloco.conclusao === null);
  const minutos = blocos.reduce((total, bloco) => total + numero(bloco.minutosEstimados), 0);

  return (
    <div
      id={nivel === "piso" ? "nivel-minimo" : undefined}
      className={`min-w-0 rounded-[var(--radius-card)] border border-linha bg-painel ${
        nivel === "piso" ? "scroll-mt-24" : ""
      }`}
    >
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-linha px-6 pb-4 pt-5">
        <div className="min-w-0 flex-1">
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

      <div className="px-6 pb-6 pt-5">
        {blocos.length > 0 ? (
          <ul
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            aria-label={`Blocos do ${titulo.toLowerCase()}`}
          >
            {blocos.map((bloco) => (
              <li key={bloco.id} className="min-w-0">
                <BlocoCard
                  bloco={bloco}
                  rotulosDosTopicos={rotulosDosTopicos}
                  emFoco={bloco.id === idEmFoco}
                  maiorMinutosDoDia={maiorMinutosDoDia}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl bg-fundo-suave px-4 py-3 text-sm text-suave">
            {nivel === "piso" ? "Nenhuma revisão vencida hoje." : "O acervo ainda está preparando seu primeiro bloco."}
          </p>
        )}
        {nivel === "meta_cheia" ? <LegendaDosTipos /> : null}
      </div>
    </div>
  );
}

function LegendaDosTipos() {
  const semPonto = (texto: string) => texto.replace(/[.]$/, "");

  return (
    <p className="mt-4 max-w-[92ch] text-[0.8125rem] leading-5 text-suave">
      Revisar: {semPonto(DESCRICOES.revisar).toLocaleLowerCase("pt-BR")}; Aprender: {semPonto(DESCRICOES.avancar).toLocaleLowerCase("pt-BR")}; Praticar: {semPonto(DESCRICOES.treinar).toLocaleLowerCase("pt-BR")}.
    </p>
  );
}

function estiloDoBloco(feito: boolean, emFoco: boolean): string {
  if (feito) return "border-marca/20 bg-fundo-suave hover:border-marca-viva hover:bg-painel";
  if (emFoco) return "border-marca bg-painel hover:border-marca-viva";
  return "border-linha bg-painel hover:border-marca-viva";
}

function BlocoCard({
  bloco,
  rotulosDosTopicos,
  emFoco,
  maiorMinutosDoDia,
}: {
  bloco: BlocoDoPlano;
  rotulosDosTopicos: ReadonlyMap<string, RotuloDoTopico>;
  emFoco: boolean;
  maiorMinutosDoDia: number;
}) {
  const conclusao = bloco.conclusao;
  const linhas = linhasDoBloco(bloco, rotulosDosTopicos);
  const minutos = numero(bloco.minutosEstimados);
  const nQuestoes = numero(bloco.nQuestoes);
  const rotuloDoTipo = conclusao
    ? "Feito"
    : emFoco
      ? `${TITULOS[bloco.tipo]} · em foco`
      : TITULOS[bloco.tipo];
  const larguraDaRegua = Math.min(
    100,
    Math.max(0, (minutos / maiorMinutosDoDia) * 100),
  );
  const href = conclusao
    ? `/app/sessao/${encodeURIComponent(conclusao.sessaoId)}/resumo`
    : hrefDoBloco(bloco.id);

  return (
    <Link
      href={href}
      data-tipo={bloco.tipo}
      className={`group flex h-full min-w-0 flex-col overflow-hidden rounded-[var(--radius-card)] border text-texto transition-colors duration-150 ${
        conclusao ? "text-suave" : ""
      } ${estiloDoBloco(conclusao !== null, emFoco)} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca`}
    >
      <div className="flex h-full min-w-0 flex-col p-4">
        <span
          aria-label={conclusao ? "Status do bloco: Feito" : `Tipo de estudo: ${rotuloDoTipo}`}
          className={`inline-flex min-w-0 items-center gap-1.5 self-start font-utilitaria text-[0.625rem] uppercase tracking-[0.12em] ${
            conclusao ? "text-suave" : COR_DO_TIPO[bloco.tipo]
          }`}
        >
          {conclusao ? (
            <svg
              viewBox="0 0 24 24"
              className="size-3.5"
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
          <span className="truncate">{rotuloDoTipo}</span>
        </span>

        <h4 className="mt-3 text-[1.125rem] font-semibold leading-[1.25] tracking-[-0.02em]">
          {linhas.assunto}
        </h4>
        {linhas.materia ? (
          <p className="mt-1 text-[0.8125rem] leading-5 text-suave">{linhas.materia}</p>
        ) : null}

        <p className="mt-auto pt-4 font-utilitaria text-xs text-suave">
          {conclusao
            ? `${minutos} min · ${conclusao.nAcertos} de ${conclusao.nQuestoes} certas`
            : `${minutos} min · ${nQuestoes} q`}
        </p>
        <div className="-mx-4 -mb-4 mt-4 h-[3px] shrink-0 rounded-b-[var(--radius-card)] bg-linha" aria-hidden="true">
          <div
            className={`h-full ${conclusao ? "bg-marca-viva/40" : "bg-marca-viva"}`}
            style={{ width: `${larguraDaRegua}%` }}
          />
        </div>
      </div>
    </Link>
  );
}

function linhasDoBloco(
  bloco: BlocoDoPlano,
  rotulosDosTopicos: ReadonlyMap<string, RotuloDoTopico>,
): { assunto: string; materia: string | null } {
  if (bloco.topicoId === null) {
    return { assunto: "Assuntos misturados", materia: null };
  }

  const rotulo = rotulosDosTopicos.get(bloco.topicoId);
  const materia = textoDoRotulo(rotulo?.materia);
  const topico = textoDoRotulo(rotulo?.topico);

  if (materia === null && topico === null) {
    return { assunto: "Tópico do ciclo", materia: null };
  }
  if (materia === null) {
    return { assunto: topico ?? "Tópico do ciclo", materia: null };
  }
  if (topico === null || topico === "Geral") {
    return { assunto: materia, materia: null };
  }
  return { assunto: topico, materia };
}

function textoDoRotulo(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim().length > 0 ? valor.trim() : null;
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
