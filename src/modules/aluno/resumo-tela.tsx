import Link from "next/link";

import type { ItemDoResumo, ResumoDaSessao } from "./resumo-sessao";

function percentual(resumo: ResumoDaSessao): number {
  if (resumo.nQuestoes === 0) return 0;
  return Math.round((resumo.nAcertos / resumo.nQuestoes) * 100);
}

function proveniencia(item: ItemDoResumo): string {
  const fonte = item.questao.fonteCitacao;
  if (fonte) {
    return `${fonte.banca} · ${fonte.ano} · ${fonte.orgao} · ${fonte.cargo} · questão ${fonte.numero}`;
  }
  return item.questao.origem === "gerada_ia" ? "Questão inédita do acervo" : "Fonte em revisão";
}

function formatarData(data: string): string | null {
  const valor = new Date(`${data}T12:00:00`);
  if (Number.isNaN(valor.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeZone: "America/Sao_Paulo",
  }).format(valor);
}

export function ResumoTela({ resumo }: { resumo: ResumoDaSessao }) {
  const proximaRevisao = resumo.proximaRevisao ? formatarData(resumo.proximaRevisao) : null;

  return (
    <div className="space-y-8">
      <header className="space-y-4 border-b border-linha pb-7">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-evolucao">Bloco concluído</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl leading-tight sm:text-5xl">
              {resumo.nAcertos} de {resumo.nQuestoes} acertos
            </h1>
            <p className="mt-2 text-lg text-suave">{percentual(resumo)}% de aproveitamento</p>
            {proximaRevisao ? (
              <p className="mt-3 text-sm font-semibold text-marca">
                Próxima revisão: {proximaRevisao}
              </p>
            ) : null}
          </div>
          <Link href="/app" className="inline-flex min-h-11 items-center rounded-full border border-marca px-5 py-3 font-semibold text-marca transition hover:bg-marca hover:text-white">
            Voltar ao plano
          </Link>
        </div>
      </header>

      <ol className="space-y-5" aria-label="Questões respondidas">
        {resumo.itens.map((item) => (
          <li key={`${item.questao.id}:${item.questao.questaoVersao}`}>
            <QuestaoDoResumo item={item} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function QuestaoDoResumo({ item }: { item: ItemDoResumo }) {
  return (
    <article className="space-y-5 rounded-card border border-linha bg-painel p-5 shadow-card sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-utilitaria text-xs text-suave">QUESTÃO {item.ordem}</p>
          <p className="mt-2 text-sm text-suave">{proveniencia(item)}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${item.correta ? "bg-evolucao/10 text-evolucao" : "bg-erro/10 text-erro"}`}>
          {item.correta ? "Acertou" : "Para revisar"}
        </span>
      </header>

      <h2 className="text-lg font-semibold leading-8">{item.questao.enunciado}</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-fundo-suave p-4">
          <p className="text-sm text-suave">Sua resposta</p>
          <p className="mt-1 font-utilitaria text-2xl font-bold text-texto">{item.respostaDada}</p>
        </div>
        <div className="rounded-lg bg-marca-suave p-4">
          <p className="text-sm text-suave">Gabarito</p>
          <p className="mt-1 font-utilitaria text-2xl font-bold text-marca">{item.questao.respostaCorreta}</p>
        </div>
      </div>
    </article>
  );
}
