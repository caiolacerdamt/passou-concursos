"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { PrecosPublicos } from "@/modules/pagamentos/preco";

import {
  enviarCheckout,
  type EstadoDaActionDoCheckout,
} from "./acoes";

const ESTADO_INICIAL: EstadoDaActionDoCheckout = { tipo: "inicial" };

export function FormularioCheckout({ precos }: { precos: PrecosPublicos }) {
  const [estado, action, pendente] = useActionState(
    enviarCheckout,
    ESTADO_INICIAL,
  );

  return (
    <form action={action} className="mt-8 space-y-6">
      <section aria-labelledby="preco-selecionado" className="rounded-lg border border-linha bg-fundo-suave p-5">
        <h2 id="preco-selecionado" className="font-semibold">Valores antes da escolha</h2>
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <p>{precos.parcelado.parcelas}x de {precos.parcelado.parcelaFormatada} no cartão</p>
          <p>{precos.aVista.totalFormatado} no Pix ou boleto</p>
        </div>
      </section>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm font-medium" htmlFor="checkout-email">
          E-mail
          <input
            id="checkout-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="mt-2 block w-full rounded-md border border-linha bg-fundo px-3 py-3 font-normal"
          />
        </label>
        <label className="block text-sm font-medium" htmlFor="checkout-nome">
          Nome completo
          <input
            id="checkout-nome"
            name="nomeCompleto"
            type="text"
            autoComplete="name"
            required
            className="mt-2 block w-full rounded-md border border-linha bg-fundo px-3 py-3 font-normal"
          />
        </label>
        <label className="block text-sm font-medium sm:col-span-2" htmlFor="checkout-cpf">
          CPF ou CNPJ para o provedor de pagamento
          <input
            id="checkout-cpf"
            name="cpfCnpj"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            required
            className="mt-2 block w-full rounded-md border border-linha bg-fundo px-3 py-3 font-normal"
          />
          <span className="mt-1 block text-xs font-normal text-suave">
            O dado é enviado ao Asaas para criar o pagador. Não solicitamos data de nascimento.
          </span>
        </label>
      </div>

      <fieldset>
        <legend className="text-sm font-semibold">Escolha o meio de pagamento</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="rounded-md border border-linha p-3 text-sm">
            <input className="mr-2" type="radio" name="meio" value="CREDIT_CARD" defaultChecked />
            Cartão em 12x
          </label>
          <label className="rounded-md border border-linha p-3 text-sm">
            <input className="mr-2" type="radio" name="meio" value="PIX" />
            Pix à vista
          </label>
          <label className="rounded-md border border-linha p-3 text-sm">
            <input className="mr-2" type="radio" name="meio" value="BOLETO" />
            Boleto à vista
          </label>
        </div>
      </fieldset>

      <div className="space-y-3 text-sm leading-6">
        <label className="flex items-start gap-3">
          <input className="mt-1" type="checkbox" name="maiorDeIdade" required />
          <span>Declaro que tenho 18 anos ou mais.</span>
        </label>
        <label className="flex items-start gap-3">
          <input className="mt-1" type="checkbox" name="aceitouTermos" required />
          <span>
            Li e aceito os <Link href="/termos" className="text-marca underline">termos de uso</Link>.
          </span>
        </label>
      </div>

      {estado.tipo === "erro" ? (
        <p className="rounded-md border border-erro bg-fundo-suave p-4 text-sm" role="alert">
          {estado.mensagem} Sua escolha continua no formulário para você revisar ou trocar o meio.
        </p>
      ) : null}
      {estado.tipo === "matricula_ativa" ? (
        <p className="rounded-md border border-aviso bg-fundo-suave p-4 text-sm" role="status">
          Já existe uma matrícula ativa para este e-mail. Não criamos outra cobrança.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pendente}
        className="rounded-md bg-marca px-5 py-3 font-medium text-fundo disabled:cursor-wait disabled:opacity-60"
      >
        {pendente ? "Preparando cobrança…" : "Continuar para pagamento"}
      </button>
    </form>
  );
}
