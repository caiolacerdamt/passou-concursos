import Link from "next/link";
import type { ReactNode } from "react";

/**
 * O convite para a matrícula. **Um componente, reusado por toda superfície
 * travada no trial** — AD-133.
 *
 * Doze convites escritos à mão viram doze textos ligeiramente diferentes, e o
 * aluno percebe a costura: cada tela parece de um produto diferente e nenhuma
 * parece decidida. Aqui a forma é uma só; o que muda é o argumento, e o
 * argumento é sempre **o número do próprio aluno**.
 *
 * Nada aqui inventa urgência (invariante nº14 do `AGENTS.md`): sem contagem em
 * segundos, sem vermelho, sem "última chance". O que convence é o que ele
 * construiu, não o relógio.
 */
export function ConviteDeMatricula({
  titulo,
  children,
  chamada = "Fazer a matrícula",
  destino = "/checkout",
  tom = "claro",
  etiqueta = "Teste grátis",
}: {
  titulo: string;
  /** O argumento em número. Sempre dado real do aluno, nunca estimativa. */
  children?: ReactNode;
  chamada?: string;
  destino?: string;
  /** `escuro` para quando o convite fecha uma seção clara e precisa de peso. */
  tom?: "claro" | "escuro";
  /**
   * A tarja de cima. O padrão serve às superfícies travadas no trial, que são
   * a maioria — mas quem teve **plano pago** e venceu nunca esteve num teste
   * grátis, e a tarja padrão contaria uma história falsa sobre o passado dele.
   * É a única coisa que varia; o resto da forma continua sendo uma só.
   */
  etiqueta?: string;
}) {
  const escuro = tom === "escuro";

  return (
    <section
      className={
        escuro
          ? "rounded-2xl bg-breu px-6 pb-7 pt-6 text-breu-tinta sm:px-8"
          : "rounded-2xl border border-linha bg-fundo-suave px-6 pb-7 pt-6 sm:px-8"
      }
    >
      <p
        className={`font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] ${
          escuro ? "text-breu-verde" : "text-marca-apoio"
        }`}
      >
        {etiqueta}
      </p>
      <h2 className="mt-3 max-w-[34ch] text-[1.375rem] font-semibold leading-[1.2] tracking-[-0.015em] sm:text-[1.5rem]">
        {titulo}
      </h2>
      {children ? (
        <div
          className={`mt-3 max-w-[58ch] leading-relaxed ${
            escuro ? "text-breu-suave" : "text-suave"
          }`}
        >
          {children}
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
        <Link
          href={destino}
          className={
            escuro
              ? "inline-flex min-h-12 items-center rounded-full bg-breu-tinta px-6 font-semibold text-breu transition hover:opacity-90"
              : "inline-flex min-h-12 items-center rounded-full bg-marca px-6 font-semibold text-fundo transition hover:bg-marca-apoio"
          }
        >
          {chamada}
        </Link>
        <p className={`text-sm ${escuro ? "text-breu-suave" : "text-suave"}`}>
          12 meses de acesso, sem teto diário.
        </p>
      </div>
    </section>
  );
}
