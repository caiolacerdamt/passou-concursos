"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";

import { enviarEventoDoFunilNoNavegador } from "@/modules/analytics/navegador";
import type { PrecosPublicos } from "@/modules/pagamentos/preco";

import {
  enviarCheckout,
  type EstadoDaActionDoCheckout,
} from "./acoes";

const ESTADO_INICIAL: EstadoDaActionDoCheckout = { tipo: "inicial" };
const MEIO_PADRAO = "CREDIT_CARD";

/**
 * A área de decisão do checkout: o formulário e o resumo, lado a lado.
 *
 * Os dois moram no mesmo componente porque compartilham **um** estado — o meio
 * de pagamento escolhido. É ele que decide o total, e o total é a informação
 * que o aluno confere antes de clicar. Um resumo que mostra `R$ 197,00` quando
 * o Pix está marcado não é resumo, é ruído.
 *
 * O mesmo estado escolhe o rótulo do botão. "Continuar" não diz o que vem
 * depois; "Gerar o Pix" diz, e o aluno que escolheu boleto não é surpreendido
 * por uma tela de cartão.
 */
export type EconomiaAVista = {
  /** Já formatado em reais: `formatarBRL` é servidor, e o cliente não o alcança. */
  formatada: string;
  percentual: number;
};

export function DecisaoDoCheckout({
  precos,
  economia,
}: {
  precos: PrecosPublicos;
  economia: EconomiaAVista;
}) {
  const [estado, action, pendente] = useActionState(
    enviarCheckout,
    ESTADO_INICIAL,
  );

  /*
   * `useActionState` reseta o formulário quando a action retorna sem redirect,
   * e é por isso que a frase "sua escolha continua no formulário" precisa de
   * ajuda para ser verdade.
   *
   * O meio de pagamento não precisa de nenhuma: ele é estado do React, que
   * sobrevive ao reset porque o componente não desmonta. Já o e-mail é um campo
   * não controlado — o DOM dele volta vazio, e quem o devolve é o `email` que a
   * action carrega de propósito no estado de erro.
   */
  const [meio, definirMeio] = useState<string>(MEIO_PADRAO);
  const emailAnterior = estado.tipo === "inicial" ? undefined : estado.email;

  const descontoPercentual = economia.percentual;

  const opcoes = [
    {
      id: "CREDIT_CARD",
      titulo: "Cartão de crédito",
      nota: `Em até ${precos.parcelado.parcelas}x sem juros. Acesso liberado na aprovação.`,
      valor: `${precos.parcelado.parcelas}x ${precos.parcelado.parcelaFormatada}`,
      acao: "Ir para o pagamento no cartão",
    },
    {
      id: "PIX",
      titulo: "Pix à vista",
      nota: `Liberação em minutos. ${descontoPercentual}% de desconto.`,
      valor: precos.aVista.totalFormatado,
      acao: "Gerar o Pix",
    },
    {
      id: "BOLETO",
      titulo: "Boleto à vista",
      nota: `Compensa em até 3 dias úteis. ${descontoPercentual}% de desconto.`,
      valor: precos.aVista.totalFormatado,
      acao: "Gerar o boleto",
    },
  ];

  const escolhida = opcoes.find((opcao) => opcao.id === meio) ?? opcoes[0];
  const aVista = escolhida.id !== "CREDIT_CARD";

  return (
    <div className="mt-10 grid items-start gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:gap-8">
      <form action={action} className="flex flex-col gap-5">
        <Bloco numero={1} titulo="Seus dados">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="E-mail" dica="É por aqui que sua conta é criada.">
              <input
                name="email"
                type="email"
                autoComplete="email"
                defaultValue={emailAnterior}
                required
              />
            </Campo>

            <Campo rotulo="Nome completo">
              <input name="nomeCompleto" type="text" autoComplete="name" required />
            </Campo>

            <div className="sm:col-span-2">
              <Campo
                rotulo="CPF ou CNPJ"
                dica="Exigido pelo provedor de pagamento para criar o pagador. Não solicitamos data de nascimento."
              >
                <input
                  name="cpfCnpj"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  required
                  className="font-utilitaria"
                />
              </Campo>
            </div>
          </div>
        </Bloco>

        <Bloco numero={2} titulo="Como quer pagar">
          <fieldset className="flex flex-col gap-3">
            <legend className="sr-only">Escolha o meio de pagamento</legend>

            {opcoes.map((opcao) => {
              const marcada = opcao.id === escolhida.id;

              return (
                <label
                  key={opcao.id}
                  className={`flex cursor-pointer items-center gap-3.5 rounded-2xl p-4 transition ${
                    marcada
                      ? "bg-verde-tenue shadow-[inset_0_0_0_1.5px_var(--color-verde-vivo)]"
                      : "bg-papel shadow-[inset_0_0_0_1px_var(--color-risco)] hover:shadow-[inset_0_0_0_1px_var(--color-tinta-suave)]"
                  }`}
                >
                  <input
                    type="radio"
                    name="meio"
                    value={opcao.id}
                    checked={marcada}
                    onChange={() => {
                      definirMeio(opcao.id);
                      enviarEventoDoFunilNoNavegador("meio_escolhido");
                    }}
                    className="size-[1.125rem] shrink-0"
                  />
                  <span className="min-w-0 grow">
                    <span className="block font-medium">{opcao.titulo}</span>
                    <span className="mt-0.5 block text-sm text-tinta-suave">
                      {opcao.nota}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 text-right font-utilitaria text-[0.8125rem] tabular-nums ${
                      marcada ? "text-verde" : "text-tinta-suave"
                    }`}
                  >
                    {opcao.valor}
                  </span>
                </label>
              );
            })}
          </fieldset>
        </Bloco>

        <Bloco numero={3} titulo="Confirmação">
          <div className="flex flex-col gap-3.5 text-[0.9375rem] leading-relaxed">
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" name="maiorDeIdade" required className="mt-0.5 size-[1.125rem] shrink-0" />
              <span>Declaro que tenho 18 anos ou mais.</span>
            </label>
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" name="aceitouTermos" required className="mt-0.5 size-[1.125rem] shrink-0" />
              <span>
                Li e aceito os{" "}
                <Link href="/termos" className="text-verde-texto underline hover:text-verde">
                  termos de uso
                </Link>
                .
              </span>
            </label>
          </div>

          {estado.tipo === "erro" ? (
            <p
              role="alert"
              className="mt-5 rounded-xl border border-erro/35 bg-erro-fundo px-4 py-3.5 text-[0.9375rem] leading-relaxed text-erro"
            >
              {estado.mensagem} Sua escolha continua no formulário para você
              revisar ou trocar o meio.
            </p>
          ) : null}
          {estado.tipo === "matricula_ativa" ? (
            <p
              role="status"
              className="mt-5 rounded-xl bg-ouro-fundo px-4 py-3.5 text-[0.9375rem] leading-relaxed text-ouro-texto"
            >
              Já existe uma matrícula ativa para este e-mail. Não criamos outra
              cobrança.
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pendente}
            className="mt-6 flex min-h-15 w-full items-center justify-center gap-2.5 rounded-2xl bg-verde text-lg font-semibold text-papel-alto transition hover:bg-verde-texto disabled:cursor-wait disabled:opacity-60"
          >
            {pendente ? "Preparando cobrança…" : escolhida.acao}
            {pendente ? null : (
              <svg viewBox="0 0 20 20" className="size-[1.125rem]" fill="none" aria-hidden="true">
                <path
                  d="M4 10h11M11 6l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
          <p className="mt-3 text-center text-[0.8125rem] text-tinta-suave">
            Você ainda revisa tudo na tela do Asaas antes de pagar.
          </p>
        </Bloco>
      </form>

      {/*
       * O resumo é o único cartão em breu da tela — `DESIGN.md` raciona o
       * escuro, e ele vale mais aqui do que em qualquer outro bloco: é o número
       * que o aluno confere antes de clicar.
       *
       * `order-first` no celular não é estética: empilhado na ordem do DOM, o
       * total caía **abaixo** do botão de pagar, e o aluno clicava sem nunca ter
       * visto quanto ia pagar. No desktop a coluna é fixa e o problema não
       * existe, então a ordem volta ao natural.
       */}
      <aside className="order-first flex flex-col gap-4 lg:order-none lg:sticky lg:top-6">
        <section
          aria-labelledby="resumo-do-pedido"
          className="rounded-bloco bg-breu p-7 text-breu-tinta"
        >
          <h2
            id="resumo-do-pedido"
            className="font-utilitaria text-[0.6875rem] tracking-[0.16em] text-breu-suave uppercase"
          >
            Seu pedido
          </h2>

          <p className="mt-5 text-[1.375rem] font-medium tracking-[-0.018em]">
            Passou Concursos · anual
          </p>
          <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-breu-suave">
            12 meses de acesso a partir da confirmação do pagamento.
          </p>

          <ul className="mt-6 flex flex-col gap-2.5">
            {[
              "Banco de questões de provas oficiais, com banca, ano e número",
              "Plano diário com revisão espaçada",
              "Raio-X da banca com frequência real",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-[0.9375rem] leading-snug text-breu-suave">
                <svg viewBox="0 0 16 16" className="mt-0.5 size-3.5 shrink-0 text-breu-verde" fill="none" aria-hidden="true">
                  <path
                    d="M3 8.5l3.2 3.2L13 5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-7 border-t border-breu-linha pt-6">
            <p className="flex items-baseline justify-between gap-4 text-[0.9375rem] text-breu-suave">
              <span>Matrícula anual</span>
              <span className="font-utilitaria tabular-nums">
                {precos.parcelado.totalFormatado}
              </span>
            </p>

            {aVista ? (
              <p className="mt-2.5 flex items-baseline justify-between gap-4 text-[0.9375rem] text-breu-verde">
                <span>Desconto à vista ({descontoPercentual}%)</span>
                <span className="font-utilitaria tabular-nums">
                  − {economia.formatada}
                </span>
              </p>
            ) : null}

            <p className="mt-5 flex items-end justify-between gap-4">
              <span className="font-medium">Total</span>
              <span aria-live="polite" className="text-4xl leading-none font-medium tracking-[-0.03em] tabular-nums">
                {aVista
                  ? precos.aVista.totalFormatado
                  : precos.parcelado.totalFormatado}
              </span>
            </p>
            <p className="mt-2 text-right text-sm text-breu-suave">
              {aVista
                ? "pagamento único"
                : `${precos.parcelado.parcelas}x de ${precos.parcelado.parcelaFormatada} sem juros`}
            </p>
          </div>
        </section>

        <section className="rounded-[1.5rem] bg-ouro-fundo px-6 py-5">
          <h2 className="flex items-center gap-2 text-[1.0625rem] font-medium text-ouro-texto">
            <svg viewBox="0 0 20 20" className="size-[1.125rem] shrink-0" fill="none" aria-hidden="true">
              <path
                d="M10 2.5l6 2.4v4.6c0 3.6-2.5 6.6-6 7.9-3.5-1.3-6-4.3-6-7.9V4.9l6-2.4z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <path
                d="M7.3 10.2l1.9 1.9 3.6-3.9"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Garantia de {precos.garantiaDias} dias
          </h2>
          <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-tinta-suave">
            Estude com tudo aberto por {precos.garantiaDias} dias corridos após a
            confirmação do pagamento. Se concluir que não é para você, pede pela
            conta e o valor volta integral.
          </p>
        </section>
      </aside>
    </div>
  );
}

/** Um passo do formulário: número, título e o que ele pede. */
function Bloco({
  numero,
  titulo,
  children,
}: {
  numero: number;
  titulo: string;
  children: React.ReactNode;
}) {
  const id = useId();

  return (
    <section aria-labelledby={id} className="rounded-bloco bg-papel-alto p-6 shadow-lp sm:p-8">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="grid size-6.5 shrink-0 place-items-center rounded-pill bg-verde-tenue font-utilitaria text-xs text-verde"
        >
          {numero}
        </span>
        <h2 id={id} className="text-[1.1875rem] font-medium tracking-[-0.014em]">
          {titulo}
        </h2>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

/**
 * Rótulo, campo e dica.
 *
 * O `<label>` envolve o campo em vez de apontar por `htmlFor` — é o que
 * dispensa um `id` inventado por chamada e mantém o nome acessível garantido
 * (UI-03 AC2) mesmo quando a tela esquece de passar um.
 */
function Campo({
  rotulo,
  dica,
  children,
}: {
  rotulo: string;
  dica?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[0.9375rem] font-medium">{rotulo}</span>
      {children}
      {dica ? (
        <span className="text-[0.8125rem] leading-snug font-normal text-tinta-suave">
          {dica}
        </span>
      ) : null}
    </label>
  );
}
