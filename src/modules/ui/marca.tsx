import Link from "next/link";

/**
 * A marca como link para a raiz.
 *
 * Nas telas de acesso e no checkout ela é o **único** elemento de navegação que
 * sobra: quem chegou ali chegou para entrar ou para pagar, e uma barra com três
 * destinos só oferece saída. Ver `MolduraDeAcesso`.
 *
 * Mora num arquivo próprio porque o selo tem geometria que não sai de token
 * nenhum — o quadrado é 8px de raio, e não `--radius-card`. Duplicar isso em
 * cada tela é como as duas metades divergem.
 */
export function Marca({ tom = "claro" }: { tom?: "claro" | "escuro" }) {
  const cor =
    tom === "escuro"
      ? "text-breu-tinta hover:text-breu-verde"
      : "text-tinta hover:text-verde";

  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-2.5 text-[1.0625rem] font-medium tracking-[-0.018em] no-underline transition-colors ${cor}`}
    >
      <span
        aria-hidden="true"
        className="grid size-7 shrink-0 place-items-center rounded-lg bg-verde text-papel-alto"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none">
          <path
            d="M6 12.5l4 4L18 8"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      Passou Concursos
    </Link>
  );
}
