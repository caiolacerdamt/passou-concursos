/**
 * Marca e icones da landing.
 *
 * Desenhados aqui, em SVG, e nao puxados de biblioteca nem trocados por emoji:
 * sao cinco formas, e uma dependencia inteira para isso custaria mais peso do
 * que valor. Todos compartilham traco de 1.75 e `currentColor`, que e o que faz
 * o conjunto parecer um conjunto.
 */

export function Marca({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <svg viewBox="0 0 32 32" aria-hidden className="size-8 shrink-0">
        <rect width="32" height="32" rx="9" fill="var(--color-verde)" />
        {/*
          O traco sobe antes de virar visto: a marca e sobre progresso que vira
          aprovacao, nao sobre um checkbox.
        */}
        <path
          d="M8 17.5l4.5 4.5L24 10.5"
          fill="none"
          stroke="var(--color-papel-alto)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-[0.9375rem] font-medium tracking-tight">Passou Concursos</span>
    </span>
  );
}

type PropsDeIcone = { className?: string };

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function IconeVisto({ className }: PropsDeIcone) {
  return (
    <svg {...base} aria-hidden className={className}>
      <path d="M4 12.5l5 5L20 6.5" />
    </svg>
  );
}

export function IconeTraco({ className }: PropsDeIcone) {
  return (
    <svg {...base} aria-hidden className={className}>
      <path d="M5 12h14" />
    </svg>
  );
}

export function IconeSeta({ className }: PropsDeIcone) {
  return (
    <svg {...base} aria-hidden className={className}>
      <path d="M5 12h13M12.5 5.5L19 12l-6.5 6.5" />
    </svg>
  );
}
