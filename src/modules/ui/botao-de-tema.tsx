"use client";

import { useState, useTransition } from "react";

import { alternarTema } from "@/app/app/acoes-do-tema";

import {
  ROTULO_DO_TEMA,
  type Tema,
  proximoTema,
  rotuloAcessivelDoTema,
} from "./tema";

/**
 * O ícone diz o estado **atual**, não o destino do clique.
 *
 * Num interruptor de dois estados o ícone do destino funciona ("clique na lua
 * para escurecer"). Aqui o ciclo tem três estados — `sistema` → `escuro` →
 * `claro` — e "auto" não tem sol nem lua: a partir de `claro` o destino é
 * `sistema`, e um sol ali mentiria. Como o requisito é o estado corrente ser
 * legível sem adivinhação, o ícone acompanha o rótulo (`Auto` / `Escuro` /
 * `Claro`) em vez de contradizê-lo.
 *
 * Mesmo traço do resto da navegação: 1,6 em grade de 24, ponta arredondada.
 */
function Traco({ children }: { children: React.ReactNode }) {
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

const ICONES: Record<Tema, React.ReactNode> = {
  claro: (
    <Traco>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 3.2v2M12 19v1.8M4.6 4.6l1.4 1.4M18 18l1.4 1.4M3.2 12h1.9M19 12h1.8M4.6 19.4 6 18M18 6l1.4-1.4" />
    </Traco>
  ),
  escuro: (
    <Traco>
      <path d="M20 14.4A8.2 8.2 0 0 1 9.6 4a8.4 8.4 0 1 0 10.4 10.4Z" />
    </Traco>
  ),
  /* Meio círculo cheio: o glifo de contraste. Nem sol nem lua — é o aparelho
     que decide, e é isso que o desenho tem de dizer. */
  sistema: (
    <Traco>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" stroke="none" />
    </Traco>
  ),
};

type Variante = "barra" | "rail" | "folha";

/**
 * O controle de tema do aluno (AD-149).
 *
 * **Fica no rodapé da navegação, e não em `/app/preferencias`.** Preferências é
 * o formulário do *estudo* — minutos, dias, horário, nível —, e tudo lá alimenta
 * `gera_plano_do_dia`. Cor não é declaração sobre estudo: ela mora junto de
 * "Conta" e "Sair", que é onde estão os controles da pessoa. E não é duplicado
 * em dois lugares: dois controles do mesmo estado é onde eles divergem.
 *
 * O estado é local e otimista porque o ícone tem de virar no clique e não no
 * round-trip — o mesmo que a barra já faz ao fechar. A gravação vai numa
 * transição: se ela falhar, o cookie da ação já respondeu por este aparelho.
 *
 * As três variantes existem porque a mesma peça aparece em três acabamentos: a
 * barra expandida (linha com rótulo), o rail fechado (só ícone, nome na peça
 * irmã em `left-full`) e a folha do celular. Um componente por acabamento
 * significaria três cópias do ciclo de estados.
 */
export function BotaoDeTema({
  temaInicial,
  variante,
}: {
  temaInicial: Tema;
  variante: Variante;
}) {
  const [tema, setTema] = useState(temaInicial);
  const [, iniciar] = useTransition();

  function alternar() {
    const proxima = proximoTema(tema);
    setTema(proxima);
    iniciar(() => {
      void alternarTema(proxima);
    });
  }

  const rotulo = rotuloAcessivelDoTema(tema);
  const icone = ICONES[tema];

  if (variante === "rail") {
    return (
      <button
        type="button"
        onClick={alternar}
        aria-label={rotulo}
        className="group relative grid size-11 place-items-center rounded-[13px] text-breu-suave transition-colors duration-150 hover:bg-breu-alto hover:text-breu-tinta"
      >
        {icone}
        <span className="pointer-events-none absolute left-full z-10 ml-1.5 hidden whitespace-nowrap rounded-[13px] bg-breu-alto px-4 py-2.5 text-sm text-breu-tinta shadow-[0_18px_36px_-20px_rgb(27_29_26/0.7)] group-hover:block group-focus-visible:block">
          Tema: {ROTULO_DO_TEMA[tema]}
        </span>
      </button>
    );
  }

  if (variante === "folha") {
    return (
      <button
        type="button"
        onClick={alternar}
        aria-label={rotulo}
        className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-[0.9375rem] text-texto"
      >
        {icone}
        <span className="min-w-0 flex-1 truncate text-left">Tema</span>
        <span className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.14em] text-suave">
          {ROTULO_DO_TEMA[tema]}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={rotulo}
      className="flex min-h-11 w-full items-center gap-3 rounded-[10px] py-2 pl-3.5 pr-3 text-left text-sm text-breu-suave transition-colors duration-150 hover:bg-breu-alto hover:text-breu-tinta"
    >
      {icone}
      <span className="min-w-0 flex-1 truncate">Tema</span>
      {/*
        O rótulo do estado, e não uma decoração: com três estados o ícone
        sozinho obriga o aluno a clicar para descobrir onde está.
      */}
      <span className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.14em]">
        {ROTULO_DO_TEMA[tema]}
      </span>
    </button>
  );
}
