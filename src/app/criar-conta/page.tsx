import Link from "next/link";

import { isFlagOn } from "@/modules/config";
import { CampoDeSenha } from "@/modules/ui/campo-de-senha";
import { MolduraDeAcesso } from "@/modules/ui/moldura-de-acesso";

import { criarContaComGoogle, criarContaComSenha } from "./acoes";

/**
 * A conta gratuita — 7 dias, sem cartão (AD-133).
 *
 * Mesma moldura, mesma ordem e os mesmos componentes de `/entrar`: Google
 * primeiro, porque é o caminho de um clique, e `<label htmlFor>` de verdade em
 * cada campo — `placeholder` não é rótulo, some quando a pessoa digita e leitor
 * de tela nenhum promete lê-lo.
 *
 * Com a flag desligada esta tela **não mostra formulário**. Recusar no envio
 * seria pedir para o visitante digitar e-mail e senha para descobrir que a
 * porta está fechada; a ação continua conferindo a flag de qualquer forma,
 * porque tela não é tranca.
 */
export default async function CriarConta({
  searchParams,
}: PageProps<"/criar-conta">) {
  const parametros = await searchParams;
  const ligado = await isFlagOn("flag.m8.trial_gratuito");
  const enviado = parametros.enviado !== undefined;
  const erro = comoTexto(parametros.erro);

  if (!ligado) {
    return (
      <MolduraDeAcesso
        titulo="A matrícula é por aqui."
        lede="Acesso de 12 meses ao acervo com proveniência, plano diário e revisão espaçada."
      >
        <h1 className="text-4xl leading-[1.08] font-medium tracking-[-0.032em]">
          Criar conta
        </h1>
        <p className="mt-3 leading-relaxed text-tinta-suave">
          O teste grátis não está aberto no momento. Para começar hoje, a porta é
          a matrícula.
        </p>

        <Link
          href="/checkout"
          className="mt-8 flex min-h-14 w-full items-center justify-center rounded-pill bg-verde text-[1.0625rem] font-medium text-papel-alto no-underline transition hover:bg-verde-texto"
        >
          Ver a matrícula
        </Link>

        <p className="mt-6 text-center text-[0.9375rem] text-tinta-suave">
          Já tem conta?{" "}
          <Link href="/entrar" className="font-medium text-verde-texto underline hover:text-verde">
            Entrar
          </Link>
        </p>
      </MolduraDeAcesso>
    );
  }

  return (
    <MolduraDeAcesso
      titulo="Sete dias para ver o método funcionando."
      lede="Sem cartão. Plano do dia, questões reais com explicação e revisão espaçada desde a primeira sessão."
    >
      {enviado ? <Confirmacao /> : <Cadastro erro={erro} />}
    </MolduraDeAcesso>
  );
}

function Cadastro({ erro }: { erro: string | undefined }) {
  return (
    <>
      <h1 className="text-4xl leading-[1.08] font-medium tracking-[-0.032em]">
        Criar conta
      </h1>
      <p className="mt-3 leading-relaxed text-tinta-suave">
        Já tem conta?{" "}
        <Link href="/entrar" className="font-medium text-verde-texto underline hover:text-verde">
          Entrar
        </Link>
        .
      </p>

      {erro ? <Aviso texto={mensagemDoErro(erro)} /> : null}

      <form action={criarContaComGoogle} className="mt-7">
        <button
          type="submit"
          className="flex min-h-13 w-full items-center justify-center gap-2.5 rounded-pill bg-papel-alto font-medium text-tinta shadow-[inset_0_0_0_1px_var(--color-risco)] transition hover:shadow-[inset_0_0_0_1px_var(--color-tinta-suave)]"
        >
          <LogoDoGoogle />
          Continuar com Google
        </button>
      </form>

      <div className="my-6 flex items-center gap-4">
        <span aria-hidden="true" className="h-px grow bg-risco" />
        <span className="font-utilitaria text-[0.6875rem] tracking-[0.16em] text-tinta-suave uppercase">
          ou com e-mail
        </span>
        <span aria-hidden="true" className="h-px grow bg-risco" />
      </div>

      <form action={criarContaComSenha} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-[0.9375rem] font-medium">
            E-mail
          </label>
          <input id="email" name="email" type="email" autoComplete="email" required />
        </div>

        <CampoDeSenha autoComplete="new-password" />

        <button
          type="submit"
          className="mt-1 min-h-14 w-full rounded-pill bg-verde text-[1.0625rem] font-medium text-papel-alto transition hover:bg-verde-texto"
        >
          Começar os 7 dias
        </button>
      </form>

      <p className="mt-6 text-[0.8125rem] leading-relaxed text-tinta-suave">
        Ao criar a conta você aceita os{" "}
        <Link href="/termos" className="underline hover:text-tinta">
          termos de uso
        </Link>{" "}
        e a{" "}
        <Link href="/privacidade" className="underline hover:text-tinta">
          política de privacidade
        </Link>
        . Sem cartão, sem cobrança automática no fim do teste.
      </p>
    </>
  );
}

/**
 * O e-mail saiu. A frase não promete que a conta existe: dizer "enviamos para
 * este e-mail" quando ele já estava cadastrado entregaria quem tem conta aqui
 * para quem só tem uma lista de e-mails.
 */
function Confirmacao() {
  return (
    <>
      <h1 className="text-4xl leading-[1.08] font-medium tracking-[-0.032em] text-balance">
        Confirme seu e-mail
      </h1>
      <p className="mt-4 leading-relaxed text-tinta-suave">
        Se este endereço puder receber uma conta, o link de confirmação chega em
        instantes. Ele abre o produto direto no plano de hoje.
      </p>
      <p className="mt-4 leading-relaxed text-tinta-suave">
        Não achou? Veja a caixa de spam antes de tentar de novo — reenviar cria
        um link novo e invalida o anterior.
      </p>

      <p className="mt-8 text-center text-[0.9375rem] text-tinta-suave">
        Já confirmou?{" "}
        <Link href="/entrar" className="font-medium text-verde-texto underline hover:text-verde">
          Entrar
        </Link>
      </p>
    </>
  );
}

function Aviso({ texto }: { texto: string }) {
  return (
    <p
      role="alert"
      className="mt-6 flex items-start gap-2.5 rounded-xl border border-erro/35 bg-erro-fundo px-4 py-3.5 text-[0.9375rem] leading-relaxed text-erro"
    >
      <svg viewBox="0 0 20 20" className="mt-0.5 size-[1.125rem] shrink-0" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="7.4" stroke="currentColor" strokeWidth="1.6" />
        <path d="M10 6.3v4.4M10 13.4v.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      {texto}
    </p>
  );
}

function mensagemDoErro(erro: string): string {
  if (erro === "desligado") {
    return "O teste grátis não está disponível no momento. A matrícula continua aberta.";
  }
  if (erro === "dominio") {
    return "Use um e-mail pessoal ou de trabalho. Endereços descartáveis não são aceitos no teste.";
  }
  if (erro === "provedor") {
    return "Não foi possível continuar com o Google agora. Tente criar a conta com e-mail e senha.";
  }
  return "Não foi possível criar a conta agora. Confira o e-mail e tente novamente.";
}

/**
 * O G do Google nas quatro cores oficiais. As cores são literais e não tokens:
 * são a marca de outra empresa, e as diretrizes do provedor exigem o logo como
 * ele é. Nenhuma delas pinta interface nossa.
 */
function LogoDoGoogle() {
  return (
    <svg viewBox="0 0 18 18" className="size-[1.125rem]" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

function comoTexto(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}
