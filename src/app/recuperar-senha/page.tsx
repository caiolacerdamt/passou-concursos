import { Shell } from "@/modules/ui/shell";
import { RECUPERACAO_ENVIADA } from "@/modules/conta/senha";

import { pedirRecuperacao } from "./acoes";

export default async function RecuperarSenha({
  searchParams,
}: PageProps<"/recuperar-senha">) {
  const parametros = await searchParams;
  const enviado = parametros.enviado !== undefined;

  return (
    <Shell>
      <section className="mx-auto max-w-md rounded-card border border-linha bg-painel p-6 shadow-card sm:p-9" aria-labelledby="titulo-recuperacao">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-marca">Acesso seguro</p>
      <h1 id="titulo-recuperacao" className="mt-3 font-display text-4xl leading-tight tracking-tight">Definir uma nova senha</h1>

      {enviado ? (
        <p role="status" className="mt-4 rounded-md border border-linha bg-fundo-suave px-4 py-3">
          {RECUPERACAO_ENVIADA}
        </p>
      ) : (
        <form action={pedirRecuperacao} className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="font-medium">
              E-mail da sua conta
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
          <button
            type="submit"
            className="min-h-11 rounded-full bg-marca px-5 py-3 font-medium text-fundo transition hover:bg-marca-apoio"
          >
            Enviar o link
          </button>
        </form>
      )}
      </section>
    </Shell>
  );
}
