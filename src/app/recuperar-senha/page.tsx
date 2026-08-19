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
      <h1 className="text-2xl font-semibold">Definir uma nova senha</h1>

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
            className="rounded-md bg-marca px-4 py-2 font-medium text-fundo"
          >
            Enviar o link
          </button>
        </form>
      )}
    </Shell>
  );
}
