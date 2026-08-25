"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";

import type { EstadoDaResposta } from "@/app/app/sessao/acoes";
import { responderQuestao } from "@/app/app/sessao/acoes";
import type { ItemDaSessao, ImagemDaSessao, QuestaoDaSessao, SessaoDaTela } from "@/modules/aluno/sessao";

const CAUSAS = [
  ["nao_sabia_conteudo", "Não sabia o conteúdo"],
  ["errei_a_conta", "Errei a conta"],
  ["entendi_errado_enunciado", "Entendi errado o enunciado"],
  ["confundi_conceitos", "Confundi conceitos"],
  ["fiquei_na_duvida", "Fiquei na dúvida"],
  ["chutei", "Chutei"],
  ["nao_sei_dizer", "Não sei dizer"],
] as const;

const OPCOES_CERTO_ERRADO = [
  ["C", "Certo"],
  ["E", "Errado"],
] as const;

const ESTADO_INICIAL: EstadoDaResposta = { status: "inicial" };

export function SessaoTela({ sessao }: { sessao: SessaoDaTela }) {
  const [indice, setIndice] = useState(0);
  const item = sessao.itens[indice];

  if (item === undefined) {
    return (
      <div className="space-y-4">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-evolucao">Sessão salva</p>
        <h1 className="font-display text-4xl leading-tight">Você chegou ao fim deste bloco.</h1>
        <Link href="/app" className="inline-flex min-h-11 items-center rounded-full bg-marca px-5 py-3 font-semibold text-white">
          Voltar ao plano
        </Link>
      </div>
    );
  }

  return (
    <QuestaoAtual
      key={item.id}
      sessaoId={sessao.id}
      item={item}
      posicao={indice + 1}
      total={sessao.itens.length}
      aoAvancar={() => setIndice((valor) => valor + 1)}
    />
  );
}

function QuestaoAtual({
  sessaoId,
  item,
  posicao,
  total,
  aoAvancar,
}: {
  sessaoId: string;
  item: ItemDaSessao;
  posicao: number;
  total: number;
  aoAvancar: () => void;
}) {
  const [estado, action, pendente] = useActionState(responderQuestao, ESTADO_INICIAL);
  const [inicio] = useState(() => Date.now());
  const [decorridoMs, setDecorridoMs] = useState(0);
  const [marcouChute, setMarcouChute] = useState(false);
  const respondida = estado.status === "respondida" && estado.itemId === item.id;
  const pedindoCausa = estado.status === "causa_necessaria" && estado.itemId === item.id;

  useEffect(() => {
    const relogio = window.setInterval(() => setDecorridoMs(Date.now() - inicio), 1000);
    return () => window.clearInterval(relogio);
  }, [inicio]);

  if (respondida) {
    return (
      <FeedbackDaResposta
        estado={estado}
        ultima={posicao === total}
        aoAvancar={aoAvancar}
      />
    );
  }

  return (
    <article className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-linha pb-5">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-marca">Sessão de questões</p>
          <p className="mt-2 font-utilitaria text-xs text-suave">QUESTÃO {posicao} / {total}</p>
        </div>
        <p className="font-utilitaria text-xs text-suave" aria-label="Tempo decorrido">
          {formatarTempo(decorridoMs)}
        </p>
      </header>

      {estado.status === "erro" && estado.itemId === item.id ? (
        <p role="alert" className="rounded-card border border-erro/40 bg-painel px-4 py-3 text-erro shadow-sm">
          {estado.mensagem}
        </p>
      ) : null}

      <div className="space-y-6">
        <Proveniencia questao={item.questao} />
        <div className="space-y-5">
          <h1 className="text-xl font-semibold leading-8 sm:text-2xl">{item.questao.enunciado}</h1>
          <Imagens imagens={item.questao.imagens.filter((imagem) => imagem.posicao === "enunciado")} />
        </div>
      </div>

      <form action={action} className="space-y-6">
        <input type="hidden" name="sessaoId" value={sessaoId} />
        <input type="hidden" name="itemId" value={item.id} />
        <input type="hidden" name="tempoMs" value={decorridoMs} />

        {pedindoCausa ? (
          <div className="rounded-card border border-aviso/40 bg-painel p-5 shadow-card" role="alert">
            <p className="font-semibold text-aviso">Antes de seguir, registre o que aconteceu.</p>
            <p className="mt-2 text-sm leading-6 text-suave">{estado.mensagem}</p>
            <label htmlFor={`causa-${item.id}`} className="mt-4 block font-medium">
              O que explica este erro?
              <select
                id={`causa-${item.id}`}
                name="causaErro"
                required
                defaultValue=""
                className="mt-2 block w-full rounded-lg border border-linha bg-painel px-3 py-3"
              >
                <option value="" disabled>Escolha uma opção</option>
                {CAUSAS.map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
              </select>
            </label>
            <input type="hidden" name="respostaDada" value={estado.respostaDada} />
            <input type="hidden" name="marcouChute" value={String(estado.marcouChute)} />
          </div>
        ) : (
          <Alternativas questao={item.questao} />
        )}

        {!pedindoCausa ? (
          <label className="flex items-start gap-3 text-sm leading-6 text-suave">
            <input
              type="checkbox"
              name="marcouChute"
              value="true"
              checked={marcouChute}
              onChange={(evento) => setMarcouChute(evento.target.checked)}
              className="mt-1"
            />
            <span>Marcar como chute — mesmo um acerto assim merece revisão.</span>
          </label>
        ) : null}

        <button
          type="submit"
          disabled={pendente}
          className="min-h-11 w-full rounded-full bg-marca px-4 py-3 font-semibold text-white transition hover:bg-marca-apoio disabled:cursor-wait disabled:opacity-60"
        >
          {pendente ? "Registrando…" : pedindoCausa ? "Enviar causa e continuar" : "Responder"}
        </button>
      </form>
    </article>
  );
}

function Proveniencia({ questao }: { questao: QuestaoDaSessao }) {
  const fonte = questao.fonteCitacao;
  return (
    <div className="rounded-lg border border-linha bg-fundo-suave px-4 py-3 text-sm leading-6 text-suave">
      <p className="font-semibold text-texto">De onde veio esta questão</p>
      <p>
        {fonte
          ? `${fonte.banca} · ${fonte.ano} · ${fonte.orgao} · ${fonte.cargo} · questão ${fonte.numero}`
          : questao.origem === "gerada_ia" ? "Questão inédita do acervo" : "Fonte em revisão"}
      </p>
    </div>
  );
}

function Alternativas({ questao }: { questao: QuestaoDaSessao }) {
  const alternativas = questao.alternativas ?? OPCOES_CERTO_ERRADO.map(([letra, texto]) => ({ letra, texto }));
  const imagens = new Map(questao.imagens.map((imagem) => [imagem.posicao, imagem]));

  return (
    <fieldset className="space-y-3">
      <legend className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-suave">
        Escolha uma alternativa
      </legend>
      {alternativas.map((alternativa) => {
        const imagem = imagens.get(`alternativa_${alternativa.letra}` as ImagemDaSessao["posicao"]);
        return (
          <label
            key={alternativa.letra}
          className="flex cursor-pointer items-start gap-3 rounded-card border border-linha bg-painel p-4 text-base leading-7 shadow-card transition hover:border-marca has-[:checked]:border-marca has-[:checked]:bg-marca-suave"
          >
            <input
              type="radio"
              name="respostaDada"
              value={alternativa.letra}
              required
              className="mt-2 shrink-0"
            />
            <span className="min-w-0 flex-1">
              <span className="font-semibold">{alternativa.letra})</span>{" "}{alternativa.texto}
              {imagem ? <Imagens imagens={[imagem]} /> : null}
            </span>
          </label>
        );
      })}
    </fieldset>
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
          className="h-auto max-h-[32rem] w-full rounded-lg border border-linha object-contain"
        />
      ))}
    </div>
  );
}

export function FeedbackDaResposta({
  estado,
  ultima,
  aoAvancar,
}: {
  estado: Extract<EstadoDaResposta, { status: "respondida" }>;
  ultima: boolean;
  aoAvancar: () => void;
}) {
  return (
    <article className="space-y-6">
      <header className="border-b border-linha pb-5">
        <p className={`text-sm font-semibold uppercase tracking-[0.16em] ${estado.correta ? "text-ok" : "text-erro"}`}>
          {estado.correta ? "Resposta certa" : "Resposta para revisar"}
        </p>
        <h1 className="mt-3 font-display text-4xl leading-tight">
          {estado.correta ? "Seu raciocínio encontrou o caminho." : "Este é um ponto para entender melhor."}
        </h1>
        {estado.duplicada ? <p className="mt-3 text-sm text-suave">Esta resposta já estava registrada; nada foi duplicado.</p> : null}
      </header>

      <section className="rounded-card border border-linha bg-painel p-5 shadow-card sm:p-6" aria-live="polite">
        <p className="text-sm text-suave">Alternativa correta</p>
        <p className="mt-1 font-utilitaria text-2xl font-bold text-marca">{estado.respostaCorreta}</p>
      </section>

      {ultima ? (
        <Link href="/app" className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-marca px-4 py-3 font-semibold text-white">
          Concluir e voltar ao plano
        </Link>
      ) : (
        <button
          type="button"
          onClick={aoAvancar}
          className="min-h-11 w-full rounded-full border border-marca px-4 py-3 font-semibold text-marca transition hover:bg-marca hover:text-white"
        >
          Próxima questão
        </button>
      )}
    </article>
  );
}

function formatarTempo(milissegundos: number): string {
  const segundos = Math.floor(milissegundos / 1000);
  const minutos = Math.floor(segundos / 60).toString().padStart(2, "0");
  const resto = (segundos % 60).toString().padStart(2, "0");
  return `${minutos}:${resto}`;
}
