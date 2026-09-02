"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";

import type { EstadoDaResposta } from "@/app/app/sessao/acoes";
import { responderQuestao } from "@/app/app/sessao/acoes";
import type { ItemDaSessao, ImagemDaSessao, QuestaoDaSessao, SessaoDaTela } from "@/modules/aluno/sessao";
import type { Contexto } from "@/modules/aluno/tentativas";
import { TextoFormatado, separarEnunciado } from "@/modules/ui/enunciado";

const CAUSAS = [
  ["confundi_conceitos", "Confundi conceitos"],
  ["nao_sabia_conteudo", "Não sabia o conteúdo"],
  ["entendi_errado_enunciado", "Entendi errado o enunciado"],
  ["fiquei_na_duvida", "Fiquei na dúvida"],
  ["errei_a_conta", "Errei a conta"],
  ["chutei", "Chutei"],
  ["nao_sei_dizer", "Não sei dizer"],
] as const;

const OPCOES_CERTO_ERRADO = [
  ["C", "Certo"],
  ["E", "Errado"],
] as const;

const NOMES_DOS_CONTEXTOS: Record<Contexto, string> = {
  diagnostico: "Diagnóstico",
  plano: "Bloco do plano",
  treino: "Treino",
  simulado: "Simulado",
  revisao: "Revisão",
};

const ESTADO_INICIAL: EstadoDaResposta = { status: "inicial" };

/** O que já aconteceu nesta passagem pela tela. Não é histórico: é a sessão. */
type PlacarLocal = { respondidas: number; acertos: number; erros: readonly number[] };

export function SessaoTela({ sessao }: { sessao: SessaoDaTela }) {
  const [indice, setIndice] = useState(() => primeiroIndicePendente(sessao.itens));
  const [placar, setPlacar] = useState<PlacarLocal>({ respondidas: 0, acertos: 0, erros: [] });
  const item = sessao.itens[indice];
  const hrefDoResumo = `/app/sessao/${sessao.id}/resumo`;
  const hrefDeRetorno = retornoDaSessao(sessao.blocoId);

  function registrarNoPlacar(correta: boolean) {
    setPlacar((atual) => ({
      respondidas: atual.respondidas + 1,
      acertos: atual.acertos + (correta ? 1 : 0),
      erros: correta ? atual.erros : [...atual.erros, indice],
    }));
  }

  function avancarParaProximaPendente() {
    const proxima = indiceSeguintePendente(sessao.itens, indice);
    setIndice(proxima ?? sessao.itens.length);
  }

  if (item === undefined) {
    return (
      <div className="mx-auto max-w-leitura space-y-5">
        <p className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] text-marca-apoio">
          Sessão salva
        </p>
        <h1 className="max-w-[18ch] text-4xl font-semibold leading-[1.06] tracking-[-0.035em]">
          Você chegou ao fim deste bloco.
        </h1>
        <p className="text-[1.0625rem] leading-relaxed text-suave">
          {placar.respondidas > 0
            ? `${placar.acertos} de ${placar.respondidas} nesta sessão. Tudo já está registrado no seu histórico.`
            : "Tudo já está registrado no seu histórico."}
        </p>
        <Link
          href={sessao.encerradaEm ? hrefDoResumo : hrefDeRetorno}
          className="inline-flex min-h-12 items-center rounded-full bg-marca px-6 font-semibold text-painel transition-colors duration-150 hover:bg-marca-apoio"
        >
          {sessao.encerradaEm ? "Ver resumo da sessão" : "Voltar ao estudo"}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-leitura">
      <CabecalhoDaSessao contexto={sessao.contexto} blocoId={sessao.blocoId} />
      <TrilhaDaSessao
        itens={sessao.itens}
        total={sessao.totalItens}
        posicao={indice}
        respondidas={sessao.itensRespondidos + placar.respondidas}
        erros={placar.erros}
        aoSelecionar={setIndice}
      />
      {item.somenteLeitura ? (
        <QuestaoRespondida key={item.id} item={item} />
      ) : (
        <QuestaoAtual
          key={item.id}
          sessaoId={sessao.id}
          item={item}
          aoRegistrar={registrarNoPlacar}
          aoAvancar={avancarParaProximaPendente}
          ultima={indiceSeguintePendente(sessao.itens, indice) === null}
          hrefResumo={hrefDoResumo}
        />
      )}
    </div>
  );
}

function primeiroIndicePendente(itens: readonly ItemDaSessao[]): number {
  const indice = itens.findIndex((item) => !item.somenteLeitura);
  return indice === -1 ? 0 : indice;
}

function indiceSeguintePendente(
  itens: readonly ItemDaSessao[],
  indiceAtual: number,
): number | null {
  const indice = itens.findIndex(
    (item, indice) => indice > indiceAtual && !item.somenteLeitura,
  );
  return indice === -1 ? null : indice;
}

function retornoDaSessao(blocoId: string | null): string {
  return blocoId === null
    ? "/app/progresso"
    : `/app/estudo?bloco=${encodeURIComponent(blocoId)}`;
}

function CabecalhoDaSessao({ contexto, blocoId }: { contexto: Contexto; blocoId: string | null }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] text-marca-apoio">
          Sessão de questões
        </p>
        <h1 className="mt-3 text-[1.625rem] font-semibold leading-[1.15] tracking-[-0.03em]">
          {NOMES_DOS_CONTEXTOS[contexto]}
        </h1>
      </div>
      <Link
        href={retornoDaSessao(blocoId)}
        className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-linha px-4 text-[0.8125rem] font-semibold text-suave no-underline transition-colors duration-150 hover:border-marca/50 hover:text-marca"
      >
        Pausar e sair
      </Link>
    </header>
  );
}

/**
 * A trilha de tracinhos virou quadrado numerado — AD-125.
 *
 * O tracinho dizia "quanto falta" e nada mais: para pular da questão 1 para a 7
 * era preciso acertar um alvo de 1px de altura sem saber qual era qual. O
 * quadrado carrega o número, o estado (feito, errado, atual, pendente) e um
 * alvo de toque de verdade. As setas nas pontas andam de uma em uma; o
 * quadrado é o atalho.
 *
 * Cor aqui é estado, não decoração: verde é acerto, vermelho é erro registrado,
 * anel é onde o aluno está. Questão pendente continua sem gabarito.
 */
function TrilhaDaSessao({
  itens,
  total,
  posicao,
  respondidas,
  erros,
  aoSelecionar,
}: {
  itens: readonly ItemDaSessao[];
  total: number;
  posicao: number;
  respondidas: number;
  erros: readonly number[];
  aoSelecionar: (indice: number) => void;
}) {
  const ultimo = itens.length - 1;

  return (
    <div className="mt-6.5">
      <div className="flex items-center justify-between gap-4">
        <p className="font-utilitaria text-[0.8125rem] text-suave">
          Questão <span className="font-semibold text-texto">{posicao + 1}</span> de {total}
        </p>
        {respondidas > 0 ? (
          <p className="font-utilitaria text-[0.8125rem] text-suave">
            {respondidas} de {total} respondidas
          </p>
        ) : null}
      </div>

      <div className="mt-2.5 flex items-center gap-2.5">
        <SetaDaTrilha
          rotulo="Questão anterior"
          desabilitada={posicao === 0}
          aoClicar={() => aoSelecionar(Math.max(posicao - 1, 0))}
          sentido="anterior"
        />

        <div
          className="grid min-w-0 flex-1 gap-1.5"
          style={{ gridTemplateColumns: `repeat(${Math.max(itens.length, 1)}, minmax(0, 1fr))` }}
          aria-label="Navegação das questões"
        >
          {itens.map((item, indice) => {
            const respondidaAntes = item.somenteLeitura;
            const erro = respondidaAntes ? !item.correta : erros.includes(indice);
            const feita = respondidaAntes || erros.includes(indice) || indice < posicao;
            const materia = erro
              ? "border-erro/55 bg-erro-fundo text-erro"
              : feita
                ? "border-marca-viva bg-marca-suave text-marca"
                : "border-linha bg-painel text-suave";
            const atual =
              indice === posicao
                ? erro
                  ? "border-erro outline-2 outline-offset-2 outline-erro/25"
                  : "border-marca outline-2 outline-offset-2 outline-marca/25"
                : "";

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => aoSelecionar(indice)}
                className={`grid h-9.5 min-w-0 place-items-center rounded-lg border font-utilitaria text-[0.8125rem] font-semibold transition-colors duration-150 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-marca ${materia} ${atual}`}
                aria-label={`${respondidaAntes ? "Rever" : "Abrir"} questão ${indice + 1}`}
                aria-current={indice === posicao ? "step" : undefined}
              >
                {indice + 1}
              </button>
            );
          })}
        </div>

        <SetaDaTrilha
          rotulo="Próxima questão"
          desabilitada={posicao >= ultimo}
          aoClicar={() => aoSelecionar(Math.min(posicao + 1, ultimo))}
          sentido="proxima"
        />
      </div>
    </div>
  );
}

function SetaDaTrilha({
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
    </button>
  );
}

/**
 * O enunciado que o acervo entrega é o texto de apoio e o comando no mesmo
 * campo. Imprimir tudo de uma vez é o scroll infinito que a tela tinha: numa
 * questão de interpretação o comando some 40 linhas abaixo. O apoio entra
 * recolhido e o comando fica sempre visível, que é a ordem em que a questão se
 * responde.
 */
function EnunciadoDaQuestao({ enunciado }: { enunciado: string }) {
  const { apoio, comando } = separarEnunciado(enunciado);
  const [aberto, setAberto] = useState(false);
  const textoDeApoio = apoio.join("\n\n");
  const longo = textoDeApoio.length > 420;

  return (
    <div>
      {apoio.length > 0 ? (
        <div className="mt-5 border-l-2 border-linha pl-5">
          <div className={`relative ${longo && !aberto ? "max-h-44 overflow-hidden" : ""}`}>
            <TextoFormatado
              texto={textoDeApoio}
              className="grid gap-3 text-[0.9375rem] leading-[1.7] text-suave"
            />
            {longo && !aberto ? (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-painel"
              />
            ) : null}
          </div>
          {longo ? (
            <button
              type="button"
              onClick={() => setAberto((atual) => !atual)}
              className="mt-2.5 font-semibold text-[0.8125rem] text-marca underline underline-offset-[3px]"
              aria-expanded={aberto}
            >
              {aberto ? "Recolher o texto de apoio" : "Ler o texto de apoio completo"}
            </button>
          ) : null}
        </div>
      ) : null}

      <TextoFormatado
        texto={comando}
        className="mt-5.5 grid max-w-[62ch] gap-3 text-[1.1875rem] leading-[1.65] tracking-[-0.005em] sm:text-xl"
      />
    </div>
  );
}

function QuestaoAtual({
  sessaoId,
  item,
  aoRegistrar,
  aoAvancar,
  ultima,
  hrefResumo,
}: {
  sessaoId: string;
  item: Extract<ItemDaSessao, { somenteLeitura: false }>;
  aoRegistrar: (correta: boolean) => void;
  aoAvancar: () => void;
  ultima: boolean;
  hrefResumo: string;
}) {
  const [estado, action, pendente] = useActionState(responderQuestao, ESTADO_INICIAL);
  const [inicio] = useState(() => Date.now());
  const [decorridoMs, setDecorridoMs] = useState(0);
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const contada = useRef(false);
  const [viuGabarito, setViuGabarito] = useState(false);
  const respondida = estado.status === "respondida" && estado.itemId === item.id;
  const pedindoCausa = estado.status === "causa_necessaria" && estado.itemId === item.id;

  useEffect(() => {
    const relogio = window.setInterval(() => setDecorridoMs(Date.now() - inicio), 1000);
    return () => window.clearInterval(relogio);
  }, [inicio]);

  // O placar da sessão conta uma vez por questão: `duplicada` é duplo clique
  // no servidor, não uma segunda resposta.
  //
  // Quem errou já viu o gabarito na tela da causa (AD-126). Repetir o mesmo
  // gabarito numa terceira tela seria pedir dois cliques para dizer a mesma
  // coisa, então o registro da causa leva direto à próxima questão.
  useEffect(() => {
    if (!respondida || contada.current) return;
    if (estado.status !== "respondida") return;
    contada.current = true;
    aoRegistrar(estado.correta);
    if (viuGabarito) aoAvancar();
  }, [respondida, estado, viuGabarito, aoRegistrar, aoAvancar]);

  if (respondida && estado.status === "respondida" && !viuGabarito) {
    return (
      <FeedbackDaResposta
        estado={estado}
        ultima={ultima}
        aoAvancar={aoAvancar}
        hrefResumo={hrefResumo}
        questao={item.questao}
        respostaDada={escolhida}
      />
    );
  }

  // Passo entre o registro da causa e a próxima questão: o efeito acima já
  // pediu para avançar. Mostrar a questão de novo aqui seria um piscar.
  if (respondida) {
    return (
      <p className="mt-8 text-center text-[0.9375rem] text-suave" aria-live="polite">
        Resposta registrada. Indo para a próxima questão…
      </p>
    );
  }

  if (pedindoCausa && estado.status === "causa_necessaria") {
    return (
      <ErroComCausa
        estado={estado}
        questao={item.questao}
        sessaoId={sessaoId}
        itemId={item.id}
        decorridoMs={decorridoMs}
        aoConfirmar={() => setViuGabarito(true)}
        action={action}
        pendente={pendente}
        ultima={ultima}
      />
    );
  }

  return (
    <article className="mt-5">
      {estado.status === "erro" && estado.itemId === item.id ? (
        <p role="alert" className="mb-4 rounded-xl border border-erro/40 bg-erro-fundo px-4 py-3 text-sm leading-6 text-erro">
          {estado.mensagem}
        </p>
      ) : null}

      <div className="rounded-2xl border border-linha bg-painel px-6 pb-6 pt-6 sm:px-9 sm:pb-7 sm:pt-7">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <Proveniencia questao={item.questao} />
          <p className="shrink-0 font-utilitaria text-xs text-suave" aria-label="Tempo nesta questão">
            {formatarTempo(decorridoMs)}
          </p>
        </div>

        <EnunciadoDaQuestao enunciado={item.questao.enunciado} />
        <Imagens imagens={item.questao.imagens.filter((imagem) => imagem.posicao === "enunciado")} />

        <form action={action} className="mt-6.5">
          <input type="hidden" name="sessaoId" value={sessaoId} />
          <input type="hidden" name="itemId" value={item.id} />
          <input type="hidden" name="tempoMs" value={decorridoMs} />

          <Alternativas
            questao={item.questao}
            escolhida={escolhida}
            aoEscolher={(letra) => setEscolhida(letra)}
          />

          <div className="mt-6.5 flex flex-wrap items-center justify-end gap-4 border-t border-linha pt-5">
            <button
              type="submit"
              disabled={pendente}
              className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-marca px-8 font-semibold text-painel transition-colors duration-150 hover:bg-marca-apoio disabled:cursor-wait disabled:opacity-60"
            >
              {pendente ? "Registrando…" : "Responder"}
              {pendente ? null : (
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
              )}
            </button>
          </div>
        </form>
      </div>

      <p className="mt-4 text-center text-[0.8125rem] leading-6 text-suave">
        Cada resposta entra como um registro novo no seu histórico. Nada é sobrescrito.
      </p>
    </article>
  );
}

function QuestaoRespondida({
  item,
}: {
  item: Extract<ItemDaSessao, { somenteLeitura: true }>;
}) {
  const alternativas = alternativasDaQuestao(item.questao);

  return (
    <article className="mt-5">
      <header>
        <p className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] text-marca-apoio">
          Questão já respondida · somente leitura
        </p>
        <EnunciadoDaQuestao enunciado={item.questao.enunciado} />
        <Imagens imagens={item.questao.imagens.filter((imagem) => imagem.posicao === "enunciado")} />
      </header>

      <section className="mt-5 rounded-2xl border border-linha bg-painel px-6 pb-6 pt-6 sm:px-9 sm:pb-7 sm:pt-7">
        <p className="text-sm leading-6 text-suave">
          Sua resposta e o gabarito estão preservados. Esta revisão não registra uma nova tentativa.
        </p>

        <div className="mt-5 grid gap-2" role="group" aria-label="Alternativas da questão respondida">
          {alternativas.map((alternativa) => {
            const foiEscolhida = alternativa.letra === item.respostaDada;
            const eGabarito = alternativa.letra === item.questao.respostaCorreta;
            const tom = eGabarito ? "certo" : foiEscolhida ? "errado" : "neutro";

            return (
              <div
                key={alternativa.letra}
                className={`flex min-h-15 items-start gap-3.5 rounded-xl border px-5 py-4 leading-[1.55] ${
                  eGabarito
                    ? "border-ok/45 bg-marca-suave"
                    : foiEscolhida
                      ? "border-erro/45 bg-erro-fundo"
                      : "border-linha bg-painel"
                }`}
              >
                <LetraDaAlternativa letra={alternativa.letra} tom={tom} />
                <span className="min-w-0 flex-1 pt-0.5">{alternativa.texto}</span>
                {eGabarito || foiEscolhida ? (
                  <span className={`shrink-0 self-center font-utilitaria text-[0.6875rem] uppercase tracking-[0.14em] ${eGabarito ? "text-ok" : "text-erro"}`}>
                    {eGabarito && foiEscolhida ? "Sua resposta · gabarito" : eGabarito ? "Gabarito" : "Sua resposta"}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
    </article>
  );
}

/**
 * Errou: gabarito e causa na mesma tela — AD-126.
 *
 * Antes eram dois passos. O primeiro perguntava a causa **sem** mostrar o
 * gabarito, e só o segundo revelava a alternativa certa — ou seja, o aluno
 * dizia por que errou antes de saber o que era certo, e depois clicava de novo
 * para ver a mesma questão. Agora a tela mostra o gabarito ao lado da resposta
 * dada e pergunta a causa embaixo; um clique fecha a questão.
 *
 * Nada foi gravado quando esta tela aparece: a função SQL recusou o INSERT sem
 * causa (`causa_obrigatoria`), e é o `Registrar e continuar` que grava a linha
 * única no log. Invariante 1 continua de pé — não existe UPDATE de tentativa.
 *
 * A causa não é um `<select>` escondido numa caixa de alerta: são sete opções
 * curtas, e vê-las todas é o que faz o aluno escolher a verdadeira em vez da
 * primeira.
 */
export function ErroComCausa({
  estado,
  questao,
  sessaoId,
  itemId,
  decorridoMs,
  aoConfirmar,
  action,
  pendente,
  ultima,
}: {
  estado: Extract<EstadoDaResposta, { status: "causa_necessaria" }>;
  questao: QuestaoDaSessao;
  sessaoId: string;
  itemId: string;
  decorridoMs: number;
  /** Avisa a tela que o gabarito já foi visto aqui — evita repeti-lo depois. */
  aoConfirmar: () => void;
  action: (formulario: FormData) => void;
  pendente: boolean;
  ultima: boolean;
}) {
  const alternativas = alternativasDaQuestao(questao);
  const gabarito = alternativas.find((alternativa) => alternativa.letra === estado.respostaCorreta);
  const escolhida = alternativas.find((alternativa) => alternativa.letra === estado.respostaDada);
  const outras = alternativas.filter(
    (alternativa) =>
      alternativa.letra !== estado.respostaCorreta && alternativa.letra !== estado.respostaDada,
  );
  const { comando } = separarEnunciado(questao.enunciado);

  return (
    <article className="mt-5">
      <header>
        <p className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] text-erro">
          Resposta para revisar
        </p>
        <h2 className="mt-3 max-w-[22ch] text-3xl font-semibold leading-[1.08] tracking-[-0.032em]">
          Este é um ponto para entender melhor.
        </h2>
      </header>

      <section className="mt-5 rounded-2xl border border-linha bg-painel px-6 pb-6 pt-5 sm:px-8">
        <TextoFormatado
          texto={comando}
          className="grid max-w-[62ch] gap-3 text-[0.9375rem] leading-[1.6] text-suave"
        />

        <div className="mt-5 grid gap-2">
          <div className="flex min-h-14 items-start gap-3.5 rounded-xl border border-ok/45 bg-marca-suave px-5 py-3.5 leading-[1.55]">
            <LetraDaAlternativa letra={estado.respostaCorreta} tom="certo" />
            <span className="min-w-0 flex-1 pt-0.5 font-medium">
              {gabarito ? gabarito.texto : `Alternativa ${estado.respostaCorreta}`}
            </span>
            <span className="shrink-0 self-center font-utilitaria text-[0.6875rem] uppercase tracking-[0.14em] text-ok">
              Gabarito
            </span>
          </div>

          <div className="flex min-h-14 items-start gap-3.5 rounded-xl border border-erro/45 bg-erro-fundo px-5 py-3.5 leading-[1.55]">
            <LetraDaAlternativa letra={estado.respostaDada} tom="errado" />
            <span className="min-w-0 flex-1 pt-0.5">
              {escolhida ? escolhida.texto : `Alternativa ${estado.respostaDada}`}
            </span>
            <span className="shrink-0 self-center font-utilitaria text-[0.6875rem] uppercase tracking-[0.14em] text-erro">
              Sua resposta
            </span>
          </div>
        </div>

        {outras.length > 0 ? (
          <details className="mt-3">
            <summary className="cursor-pointer text-[0.8125rem] font-semibold text-marca">
              Ver as outras alternativas
            </summary>
            <div className="mt-2.5 grid gap-2">
              {outras.map((alternativa) => (
                <div
                  key={alternativa.letra}
                  className="flex min-h-14 items-start gap-3.5 rounded-xl border border-linha bg-painel px-5 py-3.5 leading-[1.55]"
                >
                  <LetraDaAlternativa letra={alternativa.letra} />
                  <span className="min-w-0 flex-1 pt-0.5">{alternativa.texto}</span>
                </div>
              ))}
            </div>
          </details>
        ) : null}

        <form action={action} onSubmit={aoConfirmar} className="mt-6 border-t border-linha pt-5">
          <input type="hidden" name="sessaoId" value={sessaoId} />
          <input type="hidden" name="itemId" value={itemId} />
          <input type="hidden" name="tempoMs" value={decorridoMs} />
          <input type="hidden" name="respostaDada" value={estado.respostaDada} />
          <input type="hidden" name="marcouChute" value={String(estado.marcouChute)} />

          <fieldset>
            <legend className="text-base font-semibold">O que explica este erro?</legend>
            <p className="mt-1.5 max-w-[56ch] text-sm leading-6 text-suave">
              {estado.mensagem} É isto que separa o assunto que você não sabe do assunto que você sabe e escorregou.
            </p>

            <div className="mt-3.5 flex flex-wrap gap-2">
              {CAUSAS.map(([valor, rotulo]) => (
                <label
                  key={valor}
                  className="inline-flex min-h-10 cursor-pointer items-center rounded-full border border-linha bg-painel px-4 text-sm transition-colors duration-150 hover:border-marca/50 has-[:checked]:border-marca has-[:checked]:bg-marca-suave has-[:checked]:font-semibold has-[:checked]:text-marca has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-marca"
                >
                  <input
                    type="radio"
                    id={valor === CAUSAS[0][0] ? `causa-${itemId}` : undefined}
                    name="causaErro"
                    value={valor}
                    required
                    className="sr-only"
                  />
                  {rotulo}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <p className="font-utilitaria text-xs text-suave">
              {questao.fonteCitacao
                ? `${questao.fonteCitacao.banca} · ${questao.fonteCitacao.ano} · ${questao.fonteCitacao.orgao} · questão ${questao.fonteCitacao.numero}`
                : "A causa fica no seu caderno de erros e orienta a próxima revisão."}
            </p>

            <button
              type="submit"
              disabled={pendente}
              className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-marca px-7 font-semibold text-painel transition-colors duration-150 hover:bg-marca-apoio disabled:cursor-wait disabled:opacity-60"
            >
              {pendente ? "Registrando…" : ultima ? "Registrar e concluir" : "Registrar e continuar"}
              {pendente ? null : (
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
              )}
            </button>
          </div>
        </form>
      </section>
    </article>
  );
}

/**
 * A proveniência é linha, não caixa cinza: ela precisa estar visível — é o
 * fosso do produto — sem competir com o enunciado.
 */
function Proveniencia({ questao }: { questao: QuestaoDaSessao }) {
  const fonte = questao.fonteCitacao;
  return (
    <p className="min-w-0 font-utilitaria text-xs leading-5 text-suave">
      <span className="uppercase tracking-[0.16em] text-marca-apoio">
        {fonte ? "Prova real" : questao.origem === "gerada_ia" ? "Questão inédita" : "Fonte em revisão"}
      </span>
      {fonte ? (
        <>
          <span aria-hidden="true" className="mx-2 text-linha">
            |
          </span>
          {`${fonte.banca} · ${fonte.ano} · ${fonte.orgao} · ${fonte.cargo} · questão ${fonte.numero}`}
        </>
      ) : null}
    </p>
  );
}

function Alternativas({
  questao,
  escolhida,
  aoEscolher,
}: {
  questao: QuestaoDaSessao;
  escolhida: string | null;
  aoEscolher: (letra: string) => void;
}) {
  const alternativas = alternativasDaQuestao(questao);
  const imagens = new Map(questao.imagens.map((imagem) => [imagem.posicao, imagem]));

  return (
    <fieldset>
      <legend className="sr-only">Escolha uma alternativa</legend>
      <div className="grid gap-2">
        {alternativas.map((alternativa) => {
          const imagem = imagens.get(`alternativa_${alternativa.letra}` as ImagemDaSessao["posicao"]);
          const marcada = escolhida === alternativa.letra;
          return (
            <label
              key={alternativa.letra}
              className={`flex min-h-15 cursor-pointer items-start gap-3.5 rounded-xl border px-5 py-4 leading-[1.55] transition-colors duration-150 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-marca ${
                marcada
                  ? "border-marca bg-marca-suave font-medium"
                  : "border-linha bg-painel hover:border-marca/50"
              }`}
            >
              <input
                type="radio"
                name="respostaDada"
                value={alternativa.letra}
                required
                checked={marcada}
                onChange={() => aoEscolher(alternativa.letra)}
                className="sr-only"
              />
              <LetraDaAlternativa letra={alternativa.letra} marcada={marcada} />
              <span className="min-w-0 flex-1 pt-0.5">
                {alternativa.texto}
                {imagem ? <Imagens imagens={[imagem]} /> : null}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function alternativasDaQuestao(questao: QuestaoDaSessao): readonly { letra: string; texto: string }[] {
  return questao.alternativas ?? OPCOES_CERTO_ERRADO.map(([letra, texto]) => ({ letra, texto }));
}

function LetraDaAlternativa({
  letra,
  marcada = false,
  tom = "neutro",
}: {
  letra: string;
  marcada?: boolean;
  tom?: "neutro" | "certo" | "errado";
}) {
  const materia =
    tom === "certo"
      ? "border-ok bg-ok text-painel"
      : tom === "errado"
        ? "border-erro text-erro"
        : marcada
          ? "border-marca bg-marca text-painel"
          : "border-linha bg-fundo text-suave";

  return (
    <span
      aria-hidden="true"
      className={`grid size-7.5 shrink-0 place-items-center rounded-full border font-utilitaria text-[0.8125rem] font-semibold ${materia}`}
    >
      {letra}
    </span>
  );
}

function Imagens({ imagens }: { imagens: readonly ImagemDaSessao[] }) {
  if (imagens.length === 0) return null;
  return (
    <div className="mt-4 grid gap-4">
      {imagens.map((imagem) => (
        <Image
          key={`${imagem.posicao}-${imagem.url}`}
          src={imagem.url}
          alt={imagem.altText}
          width={1200}
          height={675}
          unoptimized
          className="h-auto max-h-[32rem] w-full rounded-xl border border-linha object-contain"
        />
      ))}
    </div>
  );
}

export function FeedbackDaResposta({
  estado,
  ultima,
  aoAvancar,
  hrefResumo,
  questao,
  respostaDada = null,
}: {
  estado: Extract<EstadoDaResposta, { status: "respondida" }>;
  ultima: boolean;
  aoAvancar: () => void;
  hrefResumo: string;
  questao?: QuestaoDaSessao;
  respostaDada?: string | null;
}) {
  const correta = estado.correta;
  const alternativas =
    questao === undefined
      ? OPCOES_CERTO_ERRADO.map(([letra, texto]) => ({ letra, texto }))
      : alternativasDaQuestao(questao);
  const gabarito = alternativas.find((alternativa) => alternativa.letra === estado.respostaCorreta) ?? null;
  const escolhida =
    respostaDada !== null && respostaDada !== estado.respostaCorreta
      ? (alternativas.find((alternativa) => alternativa.letra === respostaDada) ?? null)
      : null;

  return (
    <article className="mt-5">
      <header>
        <p
          className={`font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] ${correta ? "text-ok" : "text-erro"}`}
        >
          {correta ? "Resposta certa" : "Resposta para revisar"}
        </p>
        <h2 className="mt-3 max-w-[22ch] text-3xl font-semibold leading-[1.08] tracking-[-0.032em]">
          {correta ? "Seu raciocínio encontrou o caminho." : "Este é um ponto para entender melhor."}
        </h2>
        <p className="mt-3 max-w-[52ch] leading-relaxed text-suave">
          {correta
            ? "A resposta está registrada e este assunto volta na data certa da revisão."
            : "O erro já entrou no seu caderno e este tópico volta na próxima revisão."}
        </p>
        {estado.duplicada ? (
          <p className="mt-2 text-[0.8125rem] text-suave">
            Esta resposta já estava registrada; nada foi duplicado.
          </p>
        ) : null}
      </header>

      <section
        className="mt-5 rounded-2xl border border-linha bg-painel px-6 pb-6 pt-5 sm:px-8"
        aria-live="polite"
      >
        <p className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] text-suave">
          Alternativa correta
        </p>

        <div className="mt-3.5 grid gap-2">
          <div className="flex min-h-14 items-start gap-3.5 rounded-xl border border-ok/45 bg-marca-suave px-5 py-3.5 leading-[1.55]">
            <LetraDaAlternativa letra={estado.respostaCorreta} tom="certo" />
            <span className="min-w-0 flex-1 pt-0.5 font-medium">
              {gabarito ? gabarito.texto : `Alternativa ${estado.respostaCorreta}`}
            </span>
            <span className="shrink-0 self-center font-utilitaria text-[0.6875rem] uppercase tracking-[0.14em] text-ok">
              Gabarito
            </span>
          </div>

          {escolhida ? (
            <div className="flex min-h-14 items-start gap-3.5 rounded-xl border border-erro/45 bg-erro-fundo px-5 py-3.5 leading-[1.55]">
              <LetraDaAlternativa letra={escolhida.letra} tom="errado" />
              <span className="min-w-0 flex-1 pt-0.5">{escolhida.texto}</span>
              <span className="shrink-0 self-center font-utilitaria text-[0.6875rem] uppercase tracking-[0.14em] text-erro">
                Sua resposta
              </span>
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-linha pt-5">
          {questao?.fonteCitacao ? (
            <p className="font-utilitaria text-xs text-suave">
              {`${questao.fonteCitacao.banca} · ${questao.fonteCitacao.ano} · ${questao.fonteCitacao.orgao} · questão ${questao.fonteCitacao.numero}`}
            </p>
          ) : (
            <span />
          )}

          {ultima ? (
            <Link
              href={hrefResumo}
              className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-full bg-marca px-7 font-semibold text-painel no-underline transition-colors duration-150 hover:bg-marca-apoio"
            >
              Ver resumo da sessão
            </Link>
          ) : (
            <button
              type="button"
              onClick={aoAvancar}
              className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-marca px-7 font-semibold text-painel transition-colors duration-150 hover:bg-marca-apoio"
            >
              Próxima questão
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
            </button>
          )}
        </div>
      </section>
    </article>
  );
}

function formatarTempo(milissegundos: number): string {
  const segundos = Math.floor(milissegundos / 1000);
  const minutos = Math.floor(segundos / 60).toString().padStart(2, "0");
  const resto = (segundos % 60).toString().padStart(2, "0");
  return `${minutos}:${resto}`;
}
