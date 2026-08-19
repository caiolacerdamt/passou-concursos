import Link from "next/link";

import { Shell } from "@/modules/ui/shell";

/**
 * Marco publico. A pagina de vendas de verdade e da SPEC 12 (PAG-08) — aqui so
 * existe o que a SPEC 07 precisa: uma pagina que funciona sem login e leva ao
 * login. Ela SHALL NOT prometer funcionalidade que ainda nao existe.
 */
export default function Home() {
  return (
    <Shell
      acoes={
        <Link href="/entrar" className="text-marca underline">
          Entrar
        </Link>
      }
    >
      <h1 className="text-2xl font-semibold sm:text-3xl">Passou Concursos</h1>
      <p className="mt-3 text-suave">
        Preparação para concursos da carreira bancária: questões reais com
        proveniência, explicação conferida e plano diário com revisão espaçada.
      </p>
      <p className="mt-6">
        <Link
          href="/entrar"
          className="inline-block rounded-md bg-marca px-4 py-2 font-medium text-fundo"
        >
          Entrar na minha conta
        </Link>
      </p>
    </Shell>
  );
}
