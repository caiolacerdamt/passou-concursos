"use client";

import Link from "next/link";
import { useState } from "react";

import { NOMES_DAS_CAUSAS } from "./causas";
import type { ItemDoResumo, ResumoDaSessao } from "./resumo-sessao";
import { TextoFormatado, separarEnunciado } from "@/modules/ui/enunciado";

const OPCOES_CERTO_ERRADO = [
  { letra: "C", texto: "Certo" },
  { letra: "E", texto: "Errado" },
] as const;

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

function alternativasDoItem(item: ItemDoResumo): readonly { letra: string; texto: string }[] {
  return item.questao.alternativas ?? OPCOES_CERTO_ERRADO;
}

/**
 * O resumo mostra uma questão por vez — AD-127.
 *
 * A pilha de dez cartões empurrava o aluno por uma página que não acabava, e
 * cada cartão trazia só as duas letras ("Sua resposta D · Gabarito E"), que uma
 * semana depois não lembram nada. Agora é uma questão por vez, com enunciado
 * inteiro e as alternativas, e a navegação é a mesma da sessão: quadrado
 * numerado para pular, seta para andar de uma em uma.
 *
 * A tela é de leitura. Nada aqui grava tentativa — invariante 1 continua sendo
 * assunto da sessão.
 */
export function ResumoTela({ resumo }: { resumo: ResumoDaSessao }) {
  const [indice, setIndice] = useState(0);
  const proximaRevisao = resumo.proximaRevisao ? formatarData(resumo.proximaRevisao) : null;
  const item = resumo.itens[indice];
  const ultimo = resumo.itens.length - 1;

  return (
    <div className="space-y-6">
      <header className="space-y-4 border-b border-linha pb-6">
        <p className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] text-marca-apoio">
          Bloco concluído
        </p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-semibold leading-[1.08] tracking-[-0.032em]">
              {resumo.nAcertos} de {resumo.nQuestoes} acertos
            </h1>
            <p className="mt-2 text-[1.0625rem] text-suave">{percentual(resumo)}% de aproveitamento</p>
            {proximaRevisao ? (
              <p className="mt-2.5 text-sm font-semibold text-marca">
                Próxima revisão: {proximaRevisao}
              </p>
            ) : null}
          </div>
          <Link
            href="/app"
            className="inline-flex min-h-11 items-center rounded-full border border-marca px-5 py-3 font-semibold text-marca no-underline transition-colors duration-150 hover:bg-marca hover:text-painel"
          >
            Voltar ao plano
          </Link>
        </div>
      </header>

      {item === undefined ? null : (
        <>
          <Navegacao
            itens={resumo.itens}
            posicao={indice}
            aoSelecionar={setIndice}
            ultimo={ultimo}
          />
          <QuestaoDoResumo key={`${item.questao.id}:${item.questao.questaoVersao}`} item={item} />
          <Rodape posicao={indice} ultimo={ultimo} aoSelecionar={setIndice} />
        </>
      )}
    </div>
  );
}

function Navegacao({
  itens,
  posicao,
  aoSelecionar,
  ultimo,
}: {
  itens: readonly ItemDoResumo[];
  posicao: number;
  aoSelecionar: (indice: number) => void;
  ultimo: number;
}) {
  return (
    <section>
      <div className="flex items-center justify-between gap-4">
        <p className="font-utilitaria text-[0.8125rem] text-suave">
          Questão <span className="font-semibold text-texto">{posicao + 1}</span> de {itens.length}
        </p>
        <p className="font-utilitaria text-xs text-suave">clique no número para ir direto</p>
      </div>

      <div className="mt-2.5 flex items-center gap-2.5">
        <Seta
          rotulo="Questão anterior"
          desabilitada={posicao === 0}
          aoClicar={() => aoSelecionar(Math.max(posicao - 1, 0))}
          sentido="anterior"
        />

        <div
          className="grid min-w-0 flex-1 gap-1.5"
          style={{ gridTemplateColumns: `repeat(${Math.max(itens.length, 1)}, minmax(0, 1fr))` }}
          aria-label="Navegação das questões do resumo"
        >
          {itens.map((item, indice) => {
            const materia = item.correta
              ? "border-marca-viva bg-marca-suave text-marca"
              : "border-erro/55 bg-erro-fundo text-erro";
            const atual =
              indice === posicao
                ? item.correta
                  ? "border-marca outline-2 outline-offset-2 outline-marca/25"
                  : "border-erro outline-2 outline-offset-2 outline-erro/25"
                : "";

            return (
              <button
                key={`${item.questao.id}:${item.ordem}`}
                type="button"
                onClick={() => aoSelecionar(indice)}
                className={`grid h-9.5 min-w-0 place-items-center rounded-lg border font-utilitaria text-[0.8125rem] font-semibold transition-colors duration-150 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-marca ${materia} ${atual}`}
                aria-label={`Rever questão ${indice + 1}, ${item.correta ? "acertou" : "para revisar"}`}
                aria-current={indice === posicao ? "step" : undefined}
              >
                {indice + 1}
              </button>
            );
          })}
        </div>

        <Seta
          rotulo="Próxima questão"
          desabilitada={posicao >= ultimo}
          aoClicar={() => aoSelecionar(Math.min(posicao + 1, ultimo))}
          sentido="proxima"
        />
      </div>

      <div className="mt-2.5 flex items-center gap-4 text-[0.78125rem] text-suave">
        <span className="inline-flex items-center gap-2">
          <span className="size-2.5 rounded-sm border border-marca-viva bg-marca-suave" aria-hidden="true" />
          acertou
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-2.5 rounded-sm border border-erro bg-erro-fundo" aria-hidden="true" />
          para revisar
        </span>
      </div>
    </section>
  );
}

function Seta({
  rotulo,
  desabilitada,
  aoClicar,
  sentido,
}: {
  rotulo: string;
  desabilitada: boolean;
  aoClicar: () => void;
  sentido: "anterior" | "proxima";
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      disabled={desabilitada}
      aria-label={rotulo}
      className="grid size-10 shrink-0 place-items-center rounded-full border border-linha bg-painel text-suave transition-colors duration-150 hover:border-marca/50 hover:text-marca disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-linha disabled:hover:text-suave focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-marca"
    >
      <SetaIcone sentido={sentido} />
    </button>
  );
}

function SetaIcone({ sentido }: { sentido: "anterior" | "proxima" }) {
  return (
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
      {sentido === "anterior" ? (
        <path d="M19 12H6m0 0 4.6-4.6M6 12l4.6 4.6" />
      ) : (
        <path d="M5 12h13m0 0-4.6-4.6M18 12l-4.6 4.6" />
      )}
    </svg>
  );
}

function Rodape({
  posicao,
  ultimo,
  aoSelecionar,
}: {
  posicao: number;
  ultimo: number;
  aoSelecionar: (indice: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <button
        type="button"
        onClick={() => aoSelecionar(Math.max(posicao - 1, 0))}
        disabled={posicao === 0}
        className="inline-flex min-h-11 items-center gap-2.5 rounded-full border border-linha bg-painel px-5 text-sm font-semibold text-suave transition-colors duration-150 hover:border-marca/50 hover:text-marca disabled:cursor-not-allowed disabled:opacity-40"
      >
        <SetaIcone sentido="anterior" />
        Anterior
      </button>
      <p className="font-utilitaria text-xs text-suave">
        {posicao + 1} / {ultimo + 1}
      </p>
      <button
        type="button"
        onClick={() => aoSelecionar(Math.min(posicao + 1, ultimo))}
        disabled={posicao >= ultimo}
        className="inline-flex min-h-11 items-center gap-2.5 rounded-full bg-marca px-6 text-sm font-semibold text-painel transition-colors duration-150 hover:bg-marca-apoio disabled:cursor-not-allowed disabled:opacity-40"
      >
        Próxima
        <SetaIcone sentido="proxima" />
      </button>
    </div>
  );
}

function QuestaoDoResumo({ item }: { item: ItemDoResumo }) {
  const { apoio, comando } = separarEnunciado(item.questao.enunciado);
  const [apoioAberto, setApoioAberto] = useState(false);
  const textoDeApoio = apoio.join("\n\n");
  const longo = textoDeApoio.length > 420;

  return (
    <article className="rounded-2xl border border-linha bg-painel px-6 pb-6 pt-5 sm:px-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <p className="min-w-0 font-utilitaria text-xs leading-5 text-suave">
          <span className="uppercase tracking-[0.16em] text-marca-apoio">Questão {item.ordem}</span>
          <span aria-hidden="true" className="mx-2 text-linha">
            |
          </span>
          {proveniencia(item)}
        </p>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-[0.8125rem] font-semibold ${
            item.correta ? "bg-marca-suave text-ok" : "bg-erro-fundo text-erro"
          }`}
        >
          {item.correta ? "Acertou" : "Para revisar"}
        </span>
      </header>

      {apoio.length > 0 ? (
        <div className="mt-5 border-l-2 border-linha pl-5">
          <div className={`relative ${longo && !apoioAberto ? "max-h-44 overflow-hidden" : ""}`}>
            <TextoFormatado
              texto={textoDeApoio}
              className="grid gap-3 text-[0.9375rem] leading-[1.7] text-suave"
            />
            {longo && !apoioAberto ? (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-painel"
              />
            ) : null}
          </div>
          {longo ? (
            <button
              type="button"
              onClick={() => setApoioAberto((atual) => !atual)}
              className="mt-2.5 text-[0.8125rem] font-semibold text-marca underline underline-offset-[3px]"
              aria-expanded={apoioAberto}
            >
              {apoioAberto ? "Recolher o texto de apoio" : "Ler o texto de apoio completo"}
            </button>
          ) : null}
        </div>
      ) : null}

      <TextoFormatado
        texto={comando}
        className="mt-5 grid max-w-[62ch] gap-3 text-[1.0625rem] leading-[1.6]"
      />

      <div className="mt-5 grid gap-2" role="group" aria-label="Alternativas da questão">
        {alternativasDoItem(item).map((alternativa) => {
          const eGabarito = alternativa.letra === item.questao.respostaCorreta;
          const foiEscolhida = alternativa.letra === item.respostaDada;

          return (
            <div
              key={alternativa.letra}
              className={`flex min-h-14 items-start gap-3.5 rounded-xl border px-5 py-3.5 leading-[1.55] ${
                eGabarito
                  ? "border-ok/45 bg-marca-suave"
                  : foiEscolhida
                    ? "border-erro/45 bg-erro-fundo"
                    : "border-linha bg-painel"
              }`}
            >
              <span
                aria-hidden="true"
                className={`grid size-7.5 shrink-0 place-items-center rounded-full border font-utilitaria text-[0.8125rem] font-semibold ${
                  eGabarito
                    ? "border-ok bg-ok text-painel"
                    : foiEscolhida
                      ? "border-erro text-erro"
                      : "border-linha bg-fundo text-suave"
                }`}
              >
                {alternativa.letra}
              </span>
              <span className={`min-w-0 flex-1 pt-0.5 ${eGabarito ? "font-medium" : ""}`}>
                {alternativa.texto}
              </span>
              {eGabarito || foiEscolhida ? (
                <span
                  className={`shrink-0 self-center font-utilitaria text-[0.6875rem] uppercase tracking-[0.14em] ${eGabarito ? "text-ok" : "text-erro"}`}
                >
                  {eGabarito && foiEscolhida
                    ? "Sua resposta · gabarito"
                    : eGabarito
                      ? "Gabarito"
                      : "Sua resposta"}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      {item.causaErro === null ? null : (
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-linha pt-4">
          <p className="text-sm text-suave">Você registrou:</p>
          <span className="inline-flex min-h-8 items-center rounded-full border border-linha bg-fundo-suave px-3.5 text-[0.8125rem] font-medium">
            {NOMES_DAS_CAUSAS[item.causaErro]}
          </span>
        </div>
      )}
    </article>
  );
}
