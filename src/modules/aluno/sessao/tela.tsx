"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";

import type { EstadoDaResposta } from "@/app/app/sessao/acoes";
import { responderQuestao } from "@/app/app/sessao/acoes";
import type { ItemDaSessao, ImagemDaSessao, QuestaoDaSessao, SessaoDaTela } from "@/modules/aluno/sessao";
import type { Contexto } from "@/modules/aluno/tentativas";

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
  const [indice, setIndice] = useState(0);
  const [placar, setPlacar] = useState<PlacarLocal>({ respondidas: 0, acertos: 0, erros: [] });
  const item = sessao.itens[indice];

  function registrarNoPlacar(correta: boolean) {
    setPlacar((atual) => ({
      respondidas: atual.respondidas + 1,
      acertos: atual.acertos + (correta ? 1 : 0),
      erros: correta ? atual.erros : [...atual.erros, indice],
    }));
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
          href="/app"
          className="inline-flex min-h-12 items-center rounded-full bg-marca px-6 font-semibold text-painel transition-colors duration-150 hover:bg-marca-apoio"
        >
          Voltar ao plano
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-leitura">
      <CabecalhoDaSessao contexto={sessao.contexto} />
      <TrilhaDaSessao
        total={sessao.itens.length}
        posicao={indice}
        respondidas={placar.respondidas}
        erros={placar.erros}
      />
      <QuestaoAtual
        key={item.id}
        sessaoId={sessao.id}
        item={item}
        posicao={indice + 1}
        total={sessao.itens.length}
        aoRegistrar={registrarNoPlacar}
        aoAvancar={() => setIndice((valor) => valor + 1)}
      />
    </div>
  );
}

function CabecalhoDaSessao({ contexto }: { contexto: Contexto }) {
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
        href="/app"
        className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-linha px-4 text-[0.8125rem] font-semibold text-suave no-underline transition-colors duration-150 hover:border-marca/50 hover:text-marca"
      >
        Pausar e sair
      </Link>
    </header>
  );
}

/**
 * A trilha substitui o "QUESTÃO 1 / 10" solto: a mesma informação, mas com o
 * quanto falta visível de relance. Cada segmento é uma questão desta sessão —
 * feito, errado, atual, pendente.
 */
function TrilhaDaSessao({
  total,
  posicao,
  respondidas,
  erros,
}: {
  total: number;
  posicao: number;
  respondidas: number;
  erros: readonly number[];
}) {
  return (
    <div className="mt-6.5">
      <div className="flex items-center justify-between gap-4">
        <p className="font-utilitaria text-[0.8125rem] text-suave">
          Questão <span className="font-semibold text-texto">{posicao + 1}</span> de {total}
        </p>
        {respondidas > 0 ? (
          <p className="font-utilitaria text-[0.8125rem] text-suave">
            {respondidas - erros.length} de {respondidas} nesta sessão
          </p>
        ) : null}
      </div>
      <div className="mt-2.5 grid gap-1" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }} aria-hidden="true">
        {Array.from({ length: total }, (_, indice) => (
          <span
            key={indice}
            className={`h-1 rounded-full ${
              erros.includes(indice)
                ? "bg-erro"
                : indice < posicao
                  ? "bg-marca-viva"
                  : indice === posicao
                    ? "bg-marca"
                    : "bg-linha"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function QuestaoAtual({
  sessaoId,
  item,
  posicao,
  total,
  aoRegistrar,
  aoAvancar,
}: {
  sessaoId: string;
  item: ItemDaSessao;
  posicao: number;
  total: number;
  aoRegistrar: (correta: boolean) => void;
  aoAvancar: () => void;
}) {
  const [estado, action, pendente] = useActionState(responderQuestao, ESTADO_INICIAL);
  const [inicio] = useState(() => Date.now());
  const [decorridoMs, setDecorridoMs] = useState(0);
  const [marcouChute, setMarcouChute] = useState(false);
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const contada = useRef(false);
  const respondida = estado.status === "respondida" && estado.itemId === item.id;
  const pedindoCausa = estado.status === "causa_necessaria" && estado.itemId === item.id;

  useEffect(() => {
    const relogio = window.setInterval(() => setDecorridoMs(Date.now() - inicio), 1000);
    return () => window.clearInterval(relogio);
  }, [inicio]);

  // O placar da sessão conta uma vez por questão: `duplicada` é duplo clique
  // no servidor, não uma segunda resposta.
  useEffect(() => {
    if (!respondida || contada.current) return;
    if (estado.status !== "respondida") return;
    contada.current = true;
    aoRegistrar(estado.correta);
  }, [respondida, estado, aoRegistrar]);

  if (respondida && estado.status === "respondida") {
    return (
      <FeedbackDaResposta
        estado={estado}
        ultima={posicao === total}
        aoAvancar={aoAvancar}
        questao={item.questao}
        respostaDada={escolhida}
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

        <h2 className="mt-5.5 max-w-[62ch] text-[1.1875rem] leading-[1.65] tracking-[-0.005em] sm:text-xl">
          {item.questao.enunciado}
        </h2>
        <Imagens imagens={item.questao.imagens.filter((imagem) => imagem.posicao === "enunciado")} />

        <form action={action} className="mt-6.5">
          <input type="hidden" name="sessaoId" value={sessaoId} />
          <input type="hidden" name="itemId" value={item.id} />
          <input type="hidden" name="tempoMs" value={decorridoMs} />

          {pedindoCausa ? (
            <CausaDoErro estado={estado} itemId={item.id} />
          ) : (
            <Alternativas
              questao={item.questao}
              escolhida={escolhida}
              aoEscolher={(letra) => setEscolhida(letra)}
            />
          )}

          <div className="mt-6.5 flex flex-wrap items-center justify-between gap-4 border-t border-linha pt-5">
            {pedindoCausa ? (
              <p className="max-w-[46ch] text-[0.8125rem] leading-6 text-suave">
                A causa fica no seu caderno de erros e orienta a próxima revisão.
              </p>
            ) : (
              <label className="flex max-w-[46ch] items-start gap-2.5 text-sm leading-6 text-suave">
                <input
                  type="checkbox"
                  name="marcouChute"
                  value="true"
                  checked={marcouChute}
                  onChange={(evento) => setMarcouChute(evento.target.checked)}
                  className="mt-1.5 size-4 shrink-0 accent-[var(--color-marca)]"
                />
                <span>Marcar como chute — mesmo acertando, isso volta na revisão.</span>
              </label>
            )}

            <button
              type="submit"
              disabled={pendente}
              className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-marca px-8 font-semibold text-painel transition-colors duration-150 hover:bg-marca-apoio disabled:cursor-wait disabled:opacity-60"
            >
              {pendente ? "Registrando…" : pedindoCausa ? "Registrar e continuar" : "Responder"}
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

/**
 * A causa não é um `<select>` escondido numa caixa de alerta: são sete opções
 * curtas, e vê-las todas é o que faz o aluno escolher a verdadeira em vez da
 * primeira.
 */
function CausaDoErro({
  estado,
  itemId,
}: {
  estado: Extract<EstadoDaResposta, { status: "causa_necessaria" }>;
  itemId: string;
}) {
  return (
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

      <input type="hidden" name="respostaDada" value={estado.respostaDada} />
      <input type="hidden" name="marcouChute" value={String(estado.marcouChute)} />
    </fieldset>
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
  const alternativas = questao.alternativas ?? OPCOES_CERTO_ERRADO.map(([letra, texto]) => ({ letra, texto }));
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
  questao,
  respostaDada = null,
}: {
  estado: Extract<EstadoDaResposta, { status: "respondida" }>;
  ultima: boolean;
  aoAvancar: () => void;
  questao?: QuestaoDaSessao;
  respostaDada?: string | null;
}) {
  const correta = estado.correta;
  const alternativas =
    questao?.alternativas ?? OPCOES_CERTO_ERRADO.map(([letra, texto]) => ({ letra, texto }));
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
              href="/app"
              className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-full bg-marca px-7 font-semibold text-painel no-underline transition-colors duration-150 hover:bg-marca-apoio"
            >
              Concluir e voltar ao plano
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
