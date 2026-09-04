import Link from "next/link";

import { MolduraDeAcesso } from "@/modules/ui/moldura-de-acesso";
import { RECUPERACAO_ENVIADA } from "@/modules/conta/senha";

import { pedirRecuperacao } from "./acoes";

export default async function RecuperarSenha({
  searchParams,
}: PageProps<"/recuperar-senha">) {
  const parametros = await searchParams;
  const enviado = parametros.enviado !== undefined;

  return (
    <MolduraDeAcesso
      titulo="Senha esquecida não perde sequência."
      lede="Seu histórico, suas revisões e o Raio-X continuam intactos enquanto você redefine o acesso."
    >
      {enviado ? <Confirmacao /> : <Pedido />}
    </MolduraDeAcesso>
  );
}

/** O formulário: um campo só, porque é só isso que o Supabase precisa. */
function Pedido() {
  return (
    <>
      <p className="font-utilitaria text-[0.6875rem] tracking-[0.16em] text-tinta-suave uppercase">
        Acesso seguro
      </p>
      <h1 className="mt-3 text-4xl leading-[1.08] font-medium tracking-[-0.032em] text-balance">
        Definir uma nova senha
      </h1>
      <p className="mt-3 leading-relaxed text-tinta-suave">
        Informe o e-mail da sua matrícula e enviamos um link para você criar a
        nova senha.
      </p>

      <form action={pedirRecuperacao} className="mt-8 flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-[0.9375rem] font-medium">
            E-mail da sua conta
          </label>
          <input id="email" name="email" type="email" autoComplete="email" required />
        </div>

        <button
          type="submit"
          className="mt-1 min-h-14 w-full rounded-pill bg-verde text-[1.0625rem] font-medium text-papel-alto transition hover:bg-verde-texto"
        >
          Enviar o link
        </button>
      </form>

      <p className="mt-6 text-center text-[0.9375rem] text-tinta-suave">
        Lembrou a senha?{" "}
        <Link href="/entrar" className="font-medium text-verde-texto underline hover:text-verde">
          Voltar para o login
        </Link>
      </p>
    </>
  );
}

/**
 * A confirmação.
 *
 * O texto é o `RECUPERACAO_ENVIADA` e não uma frase nova: ele é redigido para
 * sair **igual** quando o e-mail existe e quando não existe, pelo mesmo motivo
 * que `acoes.ts` ignora o erro do provedor — reagir diferente transformaria o
 * formulário num verificador de quem tem conta aqui.
 */
function Confirmacao() {
  return (
    <>
      <span
        aria-hidden="true"
        className="grid size-14 place-items-center rounded-pill bg-verde-tenue text-verde"
      >
        <svg viewBox="0 0 28 28" className="size-6.5" fill="none">
          <rect x="3.5" y="6.5" width="21" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M4.5 8.5L14 15l9.5-6.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>

      <h1 className="mt-6 text-4xl leading-[1.08] font-medium tracking-[-0.032em] text-balance">
        Confira seu e-mail
      </h1>
      <p role="status" className="mt-4 leading-relaxed text-tinta-suave">
        {RECUPERACAO_ENVIADA}
      </p>

      <p className="mt-6 rounded-xl bg-ouro-fundo px-4 py-3.5 text-[0.9375rem] leading-relaxed text-ouro-texto">
        Não chegou em alguns minutos? Olhe o spam antes de pedir de novo — cada
        pedido novo invalida o link anterior.
      </p>

      <Link
        href="/recuperar-senha"
        className="mt-7 flex min-h-14 w-full items-center justify-center rounded-pill bg-papel-alto text-[1.0625rem] font-medium text-tinta no-underline shadow-[inset_0_0_0_1px_var(--color-risco)] transition hover:shadow-[inset_0_0_0_1px_var(--color-tinta-suave)]"
      >
        Usar outro e-mail
      </Link>

      <p className="mt-6 text-center text-[0.9375rem]">
        <Link href="/entrar" className="font-medium text-verde-texto underline hover:text-verde">
          Voltar para o login
        </Link>
      </p>
    </>
  );
}
