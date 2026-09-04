"use client";

import { useId, useState } from "react";

/**
 * O campo de senha com o olho de mostrar/ocultar e o aviso de Caps Lock.
 *
 * É client component porque as duas coisas são estado de navegador e nada
 * mais: nenhuma delas atravessa a rede, nenhuma delas depende do servidor.
 *
 * **O aviso de Caps Lock existe por um motivo prático**, não decorativo: com a
 * senha mascarada, tecla travada é a causa número um de "minha senha não
 * funciona", e o produto responde a isso com `CREDENCIAL_INVALIDA`, que não
 * distingue os casos de propósito. Dizer antes do envio é a única chance de o
 * aluno consertar sozinho.
 *
 * O botão do olho é `type="button"`: sem isso ele envia o formulário, que é
 * exatamente o oposto de "só quero conferir o que digitei".
 */
export function CampoDeSenha({
  nome = "senha",
  rotulo = "Senha",
  autoComplete = "current-password",
  acessorio,
}: {
  nome?: string;
  rotulo?: string;
  autoComplete?: string;
  /** Canto direito do rótulo — no login é o link de recuperação. */
  acessorio?: React.ReactNode;
}) {
  const id = useId();
  const idDoAviso = `${id}-capslock`;
  const [visivel, definirVisivel] = useState(false);
  const [capsLock, definirCapsLock] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="text-[0.9375rem] font-medium">
          {rotulo}
        </label>
        {acessorio}
      </div>

      <div className="campo-com-acessorio relative flex">
        <input
          id={id}
          name={nome}
          type={visivel ? "text" : "password"}
          autoComplete={autoComplete}
          required
          aria-describedby={capsLock ? idDoAviso : undefined}
          onKeyUp={(evento) =>
            definirCapsLock(evento.getModifierState("CapsLock"))
          }
        />
        <button
          type="button"
          onClick={() => definirVisivel((atual) => !atual)}
          aria-label={visivel ? "Ocultar a senha" : "Mostrar a senha"}
          aria-pressed={visivel}
          className="absolute inset-y-1 right-1 grid w-11 place-items-center rounded-lg text-tinta-suave transition-colors hover:text-tinta"
        >
          <OlhoIcone cortado={visivel} />
        </button>
      </div>

      {capsLock ? (
        /*
         * `role="status"` e não `alert`: é informação útil, não um erro. Alerta
         * interrompe a leitura de tela no meio da digitação da senha.
         */
        <p
          id={idDoAviso}
          role="status"
          className="flex items-center gap-1.5 text-[0.8125rem] text-ouro-texto"
        >
          <svg viewBox="0 0 16 16" className="size-3.5 shrink-0" fill="none" aria-hidden="true">
            <path
              d="M8 2.5l4.5 4.5H10v3H6v-3H3.5L8 2.5z"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            <rect
              x="6"
              y="11.6"
              width="4"
              height="2"
              rx="0.6"
              stroke="currentColor"
              strokeWidth="1.4"
            />
          </svg>
          Caps Lock está ligado.
        </p>
      ) : null}
    </div>
  );
}

/** O olho aberto, e o mesmo olho riscado quando a senha está à mostra. */
function OlhoIcone({ cortado }: { cortado: boolean }) {
  return (
    <svg viewBox="0 0 22 22" className="size-5" fill="none" aria-hidden="true">
      <path
        d="M3 11s3-5.4 8-5.4S19 11 19 11s-3 5.4-8 5.4S3 11 3 11z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="11" cy="11" r="2.4" stroke="currentColor" strokeWidth="1.6" />
      {cortado ? (
        <path d="M4 4l14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      ) : null}
    </svg>
  );
}
