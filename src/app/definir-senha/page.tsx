import { redirect } from "next/navigation";

import { clienteDaSessao } from "@/lib/db/sessao";
import { MINIMO_DE_CARACTERES, problemaDaSenha } from "@/modules/conta/senha";
import { Shell } from "@/modules/ui/shell";

import { definirSenha } from "./acoes";

/**
 * Onde o link do e-mail termina (PAG-07).
 *
 * Nao e rota publica: quem chega sem sessao de recuperacao ja foi barrado pelo
 * `proxy.ts`. A checagem abaixo e a segunda porta, para o caso de a sessao
 * expirar entre o proxy e a renderizacao.
 */
export default async function DefinirSenha({
  searchParams,
}: PageProps<"/definir-senha">) {
  const supabase = await clienteDaSessao();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/recuperar-senha?erro=expirado");

  const parametros = await searchParams;
  const erro = parametros.erro !== undefined;

  return (
    <Shell>
      <h1 className="text-2xl font-semibold">Defina sua senha</h1>

      {erro ? (
        <p role="alert" className="mt-4 rounded-md border border-erro/40 bg-fundo-suave px-4 py-3 text-erro">
          {problemaDaSenha("")}
        </p>
      ) : null}

      <form action={definirSenha} className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="senha" className="font-medium">
            Nova senha
          </label>
          <input
            id="senha"
            name="senha"
            type="password"
            autoComplete="new-password"
            minLength={MINIMO_DE_CARACTERES}
            required
            aria-describedby="regra-da-senha"
            className="w-full rounded-md border border-linha px-3 py-2"
          />
          <p id="regra-da-senha" className="text-sm text-suave">
            Ao menos {MINIMO_DE_CARACTERES} caracteres.
          </p>
        </div>
        <button type="submit" className="rounded-md bg-marca px-4 py-2 font-medium text-fundo">
          Salvar e entrar
        </button>
      </form>
    </Shell>
  );
}
