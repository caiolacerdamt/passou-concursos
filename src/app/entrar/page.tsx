import Link from "next/link";

import { Shell } from "@/modules/ui/shell";
import { CREDENCIAL_INVALIDA } from "@/modules/conta/mensagens";
import { caminhoInternoOuRaiz } from "@/modules/conta/rotas";

import { entrarComGoogle, entrarComSenha } from "./acoes";

/**
 * A tela de entrar (PAG-07 AC1, UI-03).
 *
 * Cada campo tem `<label htmlFor>` de verdade — `placeholder` nao e rotulo:
 * some quando o aluno comeca a digitar e leitor de tela nenhum promete le-lo.
 */
export default async function Entrar({
  searchParams,
}: PageProps<"/entrar">) {
  const parametros = await searchParams;
  const proximo = caminhoInternoOuRaiz(comoTexto(parametros.proximo) ?? "/app");
  const erro = comoTexto(parametros.erro);

  return (
    <Shell>
      <h1 className="text-2xl font-semibold">Entrar</h1>

      {erro ? (
        /*
         * Nao usa `<Estado tipo="erro">`: aquele componente e para falha do
         * sistema ("ja fomos avisados"). Credencial errada nao e defeito nosso,
         * e dizer "algo deu errado" faria o aluno recarregar em vez de corrigir
         * a senha. `role="alert"` porque a mensagem aparece depois do envio.
         */
        <p
          role="alert"
          className="mt-4 rounded-md border border-erro/40 bg-fundo-suave px-4 py-3 text-erro"
        >
          {erro === "credencial"
            ? CREDENCIAL_INVALIDA
            : "Não foi possível continuar com o Google agora. Tente entrar com e-mail e senha."}
        </p>
      ) : null}

      <form action={entrarComSenha} className="mt-6 flex flex-col gap-4">
        <input type="hidden" name="proximo" value={proximo} />

        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="font-medium">
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="w-full rounded-md border border-linha px-3 py-2"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="senha" className="font-medium">
            Senha
          </label>
          <input
            id="senha"
            name="senha"
            type="password"
            autoComplete="current-password"
            required
            className="w-full rounded-md border border-linha px-3 py-2"
          />
        </div>

        <button
          type="submit"
          className="rounded-md bg-marca px-4 py-2 font-medium text-fundo"
        >
          Entrar
        </button>
      </form>

      <form action={entrarComGoogle} className="mt-4">
        <input type="hidden" name="proximo" value={proximo} />
        <button
          type="submit"
          className="w-full rounded-md border border-linha px-4 py-2 font-medium"
        >
          Entrar com Google
        </button>
      </form>

      <p className="mt-6 text-sm text-suave">
        Esqueceu a senha?{" "}
        <Link href="/recuperar-senha" className="text-marca underline">
          Definir uma nova
        </Link>
      </p>
    </Shell>
  );
}

function comoTexto(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}
