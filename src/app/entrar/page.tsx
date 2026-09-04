import Link from "next/link";

import { CampoDeSenha } from "@/modules/ui/campo-de-senha";
import { MolduraDeAcesso } from "@/modules/ui/moldura-de-acesso";
import { CREDENCIAL_INVALIDA } from "@/modules/conta/mensagens";
import { caminhoInternoOuRaiz } from "@/modules/conta/rotas";

import { entrarComGoogle, entrarComSenha } from "./acoes";

/**
 * A tela de entrar (PAG-07 AC1, UI-03).
 *
 * Cada campo tem `<label htmlFor>` de verdade — `placeholder` nao e rotulo:
 * some quando o aluno comeca a digitar e leitor de tela nenhum promete le-lo.
 *
 * O Google vem **antes** do formulário de propósito: é o caminho de um clique,
 * e enterrá-lo embaixo de dois campos é pedir para o aluno digitar uma senha
 * que ele não precisava lembrar.
 */
export default async function Entrar({
  searchParams,
}: PageProps<"/entrar">) {
  const parametros = await searchParams;
  const proximo = caminhoInternoOuRaiz(comoTexto(parametros.proximo) ?? "/app");
  const erro = comoTexto(parametros.erro);

  return (
    <MolduraDeAcesso
      titulo="O plano de hoje já está montado."
      lede="Entre e retome de onde parou. A revisão espaçada não perdeu a conta dos seus dias."
    >
      <h1 className="text-4xl leading-[1.08] font-medium tracking-[-0.032em]">
        Entrar
      </h1>
      <p className="mt-3 leading-relaxed text-tinta-suave">
        Ainda não tem conta?{" "}
        <Link href="/checkout" className="font-medium text-verde-texto underline hover:text-verde">
          Comece pela matrícula
        </Link>
        .
      </p>

      {erro ? (
        /*
         * Nao usa `<Estado tipo="erro">`: aquele componente e para falha do
         * sistema ("ja fomos avisados"). Credencial errada nao e defeito nosso,
         * e dizer "algo deu errado" faria o aluno recarregar em vez de corrigir
         * a senha. `role="alert"` porque a mensagem aparece depois do envio.
         *
         * O vermelho aqui é `--color-erro`, o par que **lê** (4.80:1). O par que
         * pinta (`#D94A4A`) reprova como texto sobre o papel — `DESIGN.md`.
         */
        <p
          role="alert"
          className="mt-6 flex items-start gap-2.5 rounded-xl border border-erro/35 bg-erro-fundo px-4 py-3.5 text-[0.9375rem] leading-relaxed text-erro"
        >
          <svg viewBox="0 0 20 20" className="mt-0.5 size-[1.125rem] shrink-0" fill="none" aria-hidden="true">
            <circle cx="10" cy="10" r="7.4" stroke="currentColor" strokeWidth="1.6" />
            <path d="M10 6.3v4.4M10 13.4v.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          {erro === "credencial"
            ? CREDENCIAL_INVALIDA
            : "Não foi possível continuar com o Google agora. Tente entrar com e-mail e senha."}
        </p>
      ) : null}

      <form action={entrarComGoogle} className="mt-7">
        <input type="hidden" name="proximo" value={proximo} />
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

      <form action={entrarComSenha} className="flex flex-col gap-5">
        <input type="hidden" name="proximo" value={proximo} />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-[0.9375rem] font-medium">
            E-mail
          </label>
          <input id="email" name="email" type="email" autoComplete="email" required />
        </div>

        <CampoDeSenha
          acessorio={
            <Link
              href="/recuperar-senha"
              className="text-sm text-verde-texto underline hover:text-verde"
            >
              Esqueci minha senha
            </Link>
          }
        />

        <button
          type="submit"
          className="mt-1 min-h-14 w-full rounded-pill bg-verde text-[1.0625rem] font-medium text-papel-alto transition hover:bg-verde-texto"
        >
          Entrar
        </button>
      </form>

      <p className="mt-8 flex items-center justify-center gap-1.5 text-[0.8125rem] text-tinta-suave">
        <svg viewBox="0 0 16 16" className="size-3.5 shrink-0" fill="none" aria-hidden="true">
          <rect x="3" y="7" width="10" height="6.5" rx="1.4" stroke="currentColor" strokeWidth="1.3" />
          <path d="M5.6 7V5.2a2.4 2.4 0 0 1 4.8 0V7" stroke="currentColor" strokeWidth="1.3" />
        </svg>
        Conexão criptografada. Não guardamos sua senha em texto.
      </p>
    </MolduraDeAcesso>
  );
}

/**
 * O G do Google nas quatro cores oficiais.
 *
 * As cores são literais e não tokens de propósito: são a marca de outra
 * empresa, e as diretrizes do provedor exigem o logo como ele é. Nenhuma delas
 * pinta interface nossa.
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
