/**
 * Props decorativos da landing.
 *
 * Desenhados em SVG e **não** gerados por IA, de propósito. São formas simples:
 * desenhá-las custa menos que gerar, ficam idênticas entre si para sempre — que
 * é o que uma série gerada nunca garante —, pesam alguns bytes e são
 * recoloridas pelos tokens em vez de terem a cor cozida no pixel.
 *
 * Seguem o mesmo tratamento da arte do estilo escolhido: bloco de cor chapado,
 * canto arredondado, **sem contorno**. Se um dia a arte ganhar contorno, estes
 * mudam junto.
 *
 * São decoração declarada: todos saem da árvore de acessibilidade.
 */

type PropsDeForma = { className?: string };

const svg = { viewBox: "0 0 48 48", fill: "none", "aria-hidden": true } as const;

export function FolhaDeProva({ className }: PropsDeForma) {
  return (
    <svg {...svg} className={className}>
      <rect x="8" y="4" width="32" height="40" rx="4" fill="var(--color-papel-alto)" />
      <rect x="14" y="12" width="9" height="9" rx="2.5" fill="var(--color-arte-azul)" />
      <rect x="27" y="13" width="7" height="7" rx="3.5" fill="var(--color-arte-amarelo)" />
      <rect x="14" y="26" width="20" height="3.5" rx="1.75" fill="var(--color-arte-coral)" />
      <rect x="14" y="34" width="13" height="3.5" rx="1.75" fill="var(--color-arte-verde)" />
    </svg>
  );
}

export function Lapis({ className }: PropsDeForma) {
  return (
    <svg {...svg} className={className}>
      <path d="M30 4l14 14-22 22-14 4 4-14z" fill="var(--color-arte-amarelo)" />
      <path d="M8 44l4-14 6 8z" fill="var(--color-tinta)" />
      <path d="M30 4l14 14-5 5-14-14z" fill="var(--color-arte-coral)" />
    </svg>
  );
}

export function Calendario({ className }: PropsDeForma) {
  return (
    <svg {...svg} className={className}>
      <rect x="5" y="9" width="38" height="34" rx="5" fill="var(--color-arte-azul)" />
      <rect x="5" y="9" width="38" height="10" rx="5" fill="var(--color-verde)" />
      <rect x="13" y="4" width="5" height="9" rx="2.5" fill="var(--color-tinta)" />
      <rect x="30" y="4" width="5" height="9" rx="2.5" fill="var(--color-tinta)" />
      {/* O dia marcado é o ponto da forma: um calendário sem hoje não diz nada. */}
      <rect x="19" y="26" width="10" height="10" rx="3" fill="var(--color-arte-amarelo)" />
    </svg>
  );
}

export function Ampulheta({ className }: PropsDeForma) {
  return (
    <svg {...svg} className={className}>
      <rect x="9" y="4" width="30" height="5" rx="2.5" fill="var(--color-tinta)" />
      <rect x="9" y="39" width="30" height="5" rx="2.5" fill="var(--color-tinta)" />
      <path d="M13 9h22l-11 15z" fill="var(--color-arte-coral)" />
      <path d="M24 24l11 15H13z" fill="var(--color-arte-amarelo)" />
    </svg>
  );
}

export function Grafico({ className }: PropsDeForma) {
  return (
    <svg {...svg} className={className}>
      <rect x="6" y="30" width="9" height="14" rx="3" fill="var(--color-arte-verde)" />
      <rect x="19" y="19" width="9" height="25" rx="3" fill="var(--color-arte-azul)" />
      <rect x="32" y="7" width="9" height="37" rx="3" fill="var(--color-arte-coral)" />
    </svg>
  );
}

export function Visto({ className }: PropsDeForma) {
  return (
    <svg {...svg} className={className}>
      <circle cx="24" cy="24" r="20" fill="var(--color-verde)" />
      <path
        d="M14 25l7 7 13-15"
        fill="none"
        stroke="var(--color-papel-alto)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Relogio({ className }: PropsDeForma) {
  return (
    <svg {...svg} className={className}>
      <circle cx="24" cy="24" r="20" fill="var(--color-arte-amarelo)" />
      <path
        d="M24 12v12l8 5"
        fill="none"
        stroke="var(--color-tinta)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Brilho({ className }: PropsDeForma) {
  return (
    <svg {...svg} className={className}>
      {/* Quatro pontas côncavas: a estrela de cinco pontas viraria "avaliação". */}
      <path
        d="M24 2c2 12 8 18 20 22-12 4-18 10-20 22-2-12-8-18-20-22 12-4 18-10 20-22z"
        fill="var(--color-arte-coral)"
      />
    </svg>
  );
}
