import type { ReactNode } from "react";

/**
 * O mapa da navegação do aluno e o traço dos ícones.
 *
 * Mora fora do componente porque três superfícies leem a mesma lista — a barra
 * expandida, o rail fechado e a barra do celular — e uma rota que existisse só
 * em duas delas seria um item inalcançável em silêncio.
 *
 * Os ícones são desenhados aqui e não importados de uma biblioteca: um traço
 * só (1,6 em grade de 24, ponta arredondada) é o que faz o conjunto parecer
 * deste produto. O do Raio-X carrega a régua horizontal que a landing usa na
 * varredura do herói — mesmo gesto, reduzido a ícone.
 */
export type ItemDaNavegacao = {
  href: string;
  nome: string;
  /**
   * O rótulo da aba do celular. Numa aba de ~55px "Questões e revisões" só
   * cabe truncado, e truncado ele não diz nada. A barra lateral continua
   * usando `nome`; só o celular lê `nomeCurto ?? nome`.
   */
  nomeCurto?: string;
  descricao: string;
  icone: ReactNode;
};

function Traco({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const ITENS_DE_ESTUDO: ItemDaNavegacao[] = [
  {
    href: "/app",
    nome: "Hoje",
    nomeCurto: "Hoje",
    descricao: "O que estudar agora",
    icone: (
      <Traco>
        <circle cx="12" cy="12" r="7.8" />
        <path d="M12 4.2a7.8 7.8 0 0 1 6.8 4" strokeWidth="2.8" />
        <circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none" />
      </Traco>
    ),
  },
  {
    href: "/app/plano",
    nome: "Plano",
    nomeCurto: "Plano",
    descricao: "Ciclo do edital",
    icone: (
      <Traco>
        <rect x="4" y="4.5" width="16" height="4.6" rx="2.3" />
        <rect x="4" y="13.4" width="10.5" height="4.6" rx="2.3" />
        <path d="M17.8 15.7h2.2" />
      </Traco>
    ),
  },
  {
    href: "/app/raio-x",
    nome: "Raio-X",
    nomeCurto: "Raio-X",
    descricao: "O que mais cai",
    icone: (
      <Traco>
        <path d="M4.6 19.4h14.8" />
        <path d="M7.4 19.4v-3.6M11.6 19.4v-8.2M15.8 19.4v-5.4M20 19.4V7" />
        <path d="M3.4 9.2h4.8" opacity="0.55" />
      </Traco>
    ),
  },
  {
    href: "/app/sessao",
    nome: "Questões e revisões",
    nomeCurto: "Questões",
    descricao: "Praticar e consolidar",
    icone: (
      <Traco>
        <rect x="4.2" y="4.2" width="15.6" height="15.6" rx="4.4" />
        <path d="m8.6 12.3 2.4 2.4 4.4-4.9" />
      </Traco>
    ),
  },
];

export const ITENS_DE_ACOMPANHAMENTO: ItemDaNavegacao[] = [
  {
    href: "/app/progresso",
    nome: "Progresso",
    nomeCurto: "Progresso",
    descricao: "Seu histórico de estudo",
    icone: (
      <Traco>
        <path d="M4 18.6V5.4" />
        <path d="m4.8 16.4 4.6-4.6 3.2 3.2 6-6.4" />
        <circle cx="18.6" cy="8.6" r="1.9" fill="currentColor" stroke="none" />
      </Traco>
    ),
  },
];

export const ITENS_DE_CONTA: ItemDaNavegacao[] = [
  {
    href: "/app/preferencias",
    nome: "Preferências de estudo",
    descricao: "Tempo, dias e nível",
    icone: (
      <Traco>
        <path d="M5 6.5h4m4 0h6M5 12h7m4 0h3M5 17.5h2m4 0h8" />
        <circle cx="11" cy="6.5" r="2" />
        <circle cx="13" cy="12" r="2" />
        <circle cx="8" cy="17.5" r="2" />
      </Traco>
    ),
  },
  {
    href: "/app/conta",
    nome: "Conta",
    descricao: "Privacidade e acesso",
    icone: (
      <Traco>
        <circle cx="12" cy="9.2" r="3.4" />
        <path d="M5.6 19.4a6.6 6.6 0 0 1 12.8 0" />
      </Traco>
    ),
  },
  {
    href: "/app/reembolso",
    nome: "Reembolso",
    descricao: "Garantia do pagamento",
    icone: (
      <Traco>
        <path d="M4.4 12a7.6 7.6 0 1 0 2.5-5.6" />
        <path d="M4.2 5.2v3.6h3.6" />
        <path d="M12 9.4v5.2M10.2 11h2.6a1.3 1.3 0 0 1 0 2.6h-1.5" />
      </Traco>
    ),
  },
];

export const TODOS_OS_ITENS: ItemDaNavegacao[] = [
  ...ITENS_DE_ESTUDO,
  ...ITENS_DE_ACOMPANHAMENTO,
  ...ITENS_DE_CONTA,
];

/** O mesmo traço do item `/app/conta` — a aba da folha reusa a identidade dele. */
export const IconeDeConta = (
  <Traco>
    <circle cx="12" cy="9.2" r="3.4" />
    <path d="M5.6 19.4a6.6 6.6 0 0 1 12.8 0" />
  </Traco>
);

export const IconeDeSair = (
  <Traco>
    <path d="M13.4 7.2V5.8a1.6 1.6 0 0 0-1.6-1.6H6.6A1.6 1.6 0 0 0 5 5.8v12.4a1.6 1.6 0 0 0 1.6 1.6h5.2a1.6 1.6 0 0 0 1.6-1.6v-1.4" />
    <path d="M10 12h9.4m0 0-2.8-2.8M19.4 12l-2.8 2.8" />
  </Traco>
);

export const IconeDeMarca = (
  <svg
    viewBox="0 0 24 24"
    className="size-4"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m6 12.6 4 4L18 7.8" />
  </svg>
);
