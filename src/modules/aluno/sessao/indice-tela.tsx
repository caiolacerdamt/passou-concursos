import Link from "next/link";

import type { BlocoDoPlano } from "../plano";
import type { RevisaoDevida } from "../revisoes-devidas";
import { nomeDoRotuloDoTopico, type RotuloDoTopico } from "../rotulo-do-topico";
import { Estado } from "@/modules/ui/estado";

const NOMES_DOS_TIPOS: Record<BlocoDoPlano["tipo"], string> = {
  revisar: "Revisar",
  avancar: "Avançar",
  treinar: "Treinar",
  simulado: "Simulado",
};

type Props = {
  blocosPendentes: readonly BlocoDoPlano[];
  revisoesDevidas: readonly RevisaoDevida[];
  rotulosDosTopicos: ReadonlyMap<string, RotuloDoTopico>;
};

export function IndiceDeSessoes({
  blocosPendentes,
  revisoesDevidas,
  rotulosDosTopicos,
}: Props) {
  if (blocosPendentes.length === 0 && revisoesDevidas.length === 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <Estado
          tipo="vazio"
          titulo="Não há questões ou revisões pendentes agora"
          acao={
            <Link href="/app" className="font-semibold text-marca underline underline-offset-4">
              Voltar ao plano de hoje
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-marca">Prática</p>
        <h1 className="mt-3 font-display text-4xl leading-tight tracking-tight sm:text-5xl">
          Questões e revisões
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-suave">
          Escolha o próximo bloco disponível ou retome um assunto que já venceu na sua agenda.
        </p>
      </header>

      {blocosPendentes.length > 0 ? (
        <section className="space-y-3" aria-labelledby="blocos-pendentes">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-evolucao">Plano de hoje</p>
            <h2 id="blocos-pendentes" className="mt-1 font-display text-3xl leading-tight">
              Blocos pendentes
            </h2>
          </div>
          <ul className="grid gap-3">
            {blocosPendentes.map((bloco) => (
              <li key={bloco.id}>
                <div className="flex flex-col gap-3 rounded-card border border-linha bg-painel p-4 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-marca">
                      {NOMES_DOS_TIPOS[bloco.tipo]} · {bloco.minutosEstimados} min
                    </p>
                    <h3 className="mt-1 truncate font-semibold text-texto">
                      {nomeDoBloco(bloco, rotulosDosTopicos)}
                    </h3>
                    {bloco.motivo ? <p className="mt-1 text-sm leading-6 text-suave">{bloco.motivo}</p> : null}
                  </div>
                  <Link
                    href={hrefDoBloco(bloco.id)}
                    className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-full border border-marca px-4 py-2 text-sm font-semibold text-marca transition hover:bg-marca hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca"
                  >
                    Abrir questões
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {revisoesDevidas.length > 0 ? (
        <section className="space-y-3" aria-labelledby="revisoes-devidas">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-marca">Memória</p>
            <h2 id="revisoes-devidas" className="mt-1 font-display text-3xl leading-tight">
              Revisões devidas
            </h2>
          </div>
          <ul className="grid gap-3">
            {revisoesDevidas.map((revisao) => {
              const bloco = blocosPendentes.find(
                (item) => item.tipo === "revisar" && item.topicoId === revisao.topicoId,
              );
              return (
                <li key={`${revisao.topicoId}:${revisao.due}`}>
                  <div className="flex flex-col gap-3 rounded-card border border-marca/20 bg-marca-suave p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-marca">
                        Devida em {formatarData(revisao.due)}
                      </p>
                      <h3 className="mt-1 truncate font-semibold text-texto">
                        {nomeDoRotuloDoTopico(rotulosDosTopicos.get(revisao.topicoId)) ?? "Tópico da revisão"}
                      </h3>
                    </div>
                    {bloco ? (
                      <Link
                        href={hrefDoBloco(bloco.id)}
                        className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-full bg-marca px-4 py-2 text-sm font-semibold text-white transition hover:bg-marca-apoio focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca"
                      >
                        Abrir revisão
                      </Link>
                    ) : (
                      <span className="text-sm text-suave">Ainda não há bloco para esta revisão hoje.</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function nomeDoBloco(bloco: BlocoDoPlano, rotulosDosTopicos: ReadonlyMap<string, RotuloDoTopico>): string {
  if (bloco.topicoId === null) return "Assuntos misturados";
  return nomeDoRotuloDoTopico(rotulosDosTopicos.get(bloco.topicoId)) ?? "Tópico do ciclo";
}

function hrefDoBloco(blocoId: string): string {
  return `/app/sessao?bloco=${encodeURIComponent(blocoId)}`;
}

function formatarData(data: string): string {
  const valor = new Date(`${data}T12:00:00`);
  if (Number.isNaN(valor.getTime())) return "hoje";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeZone: "America/Sao_Paulo",
  }).format(valor);
}
