import type { ReactNode } from "react";

import { NIVEIS_DECLARADOS } from "./onboarding";

const DIAS = [
  [0, "Domingo"],
  [1, "Segunda"],
  [2, "Terça"],
  [3, "Quarta"],
  [4, "Quinta"],
  [5, "Sexta"],
  [6, "Sábado"],
] as const;

function campoBase() {
  return "mt-2 w-full rounded-xl border border-linha bg-painel px-3 py-3 text-base";
}

export function OnboardingTela({
  acao,
  erro,
}: {
  acao: (formulario: FormData) => Promise<never>;
  erro?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 max-w-xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-marca">
          Comece pelo que é real
        </p>
        <h1 className="mt-3 font-display text-4xl leading-tight tracking-tight sm:text-5xl">
          Um plano que cabe na sua rotina.
        </h1>
        <p className="mt-4 text-lg leading-8 text-suave">
          Conte como você estuda hoje. O diagnóstico pode esperar: seu nível declarado já é suficiente
          para começar.
        </p>
      </div>

      {erro ? (
        <p
          role="alert"
          className="mb-5 rounded-card border border-erro/40 bg-painel px-4 py-3 text-erro shadow-sm"
        >
          {mensagemDoErro(erro)}
        </p>
      ) : null}

      <form action={acao} className="space-y-6 rounded-card border border-linha bg-painel p-5 shadow-card sm:p-8">
        <section aria-labelledby="meta-titulo">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-suave">01 · Meta</p>
          <h2 id="meta-titulo" className="mt-1 text-xl font-semibold">
            O que você quer preparar?
          </h2>
          <label htmlFor="concursoAlvo" className="mt-4 block font-medium">
            Concurso-alvo
            <input
              id="concursoAlvo"
              name="concursoAlvo"
              type="text"
              defaultValue="Banco do Brasil"
              required
              maxLength={160}
              className={campoBase()}
            />
          </label>
        </section>

        <section aria-labelledby="tempo-titulo" className="border-t border-linha pt-6">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-suave">02 · Ritmo</p>
          <h2 id="tempo-titulo" className="mt-1 text-xl font-semibold">
            Quanto cabe no seu dia?
          </h2>
          <label htmlFor="minutosPorDia" className="mt-4 block font-medium">
            Minutos por dia
            <input
              id="minutosPorDia"
              name="minutosPorDia"
              type="number"
              min={1}
              max={1440}
              defaultValue={60}
              required
              className={campoBase()}
            />
          </label>
        </section>

        <section aria-labelledby="agenda-titulo" className="border-t border-linha pt-6">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-suave">03 · Agenda</p>
          <h2 id="agenda-titulo" className="mt-1 text-xl font-semibold">
            Em quais dias você costuma estudar?
          </h2>
          <fieldset className="mt-4">
            <legend className="sr-only">Dias de estudo</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {DIAS.map(([valor, nome]) => (
                <label
                  key={valor}
                  className="flex cursor-pointer items-center gap-2 rounded-xl border border-linha bg-fundo px-3 py-2.5 text-sm has-[:checked]:border-marca has-[:checked]:bg-marca-suave"
                >
                  <input type="checkbox" name="diasEstudo" value={valor} defaultChecked={valor >= 1 && valor <= 5} />
                  <span>{nome}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label htmlFor="horarioEstudo" className="mt-4 block font-medium">
            Horário habitual
            <input
              id="horarioEstudo"
              name="horarioEstudo"
              type="time"
              defaultValue="20:00"
              required
              className={campoBase()}
            />
          </label>
        </section>

        <section aria-labelledby="nivel-titulo" className="border-t border-linha pt-6">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-suave">04 · Ponto de partida</p>
          <h2 id="nivel-titulo" className="mt-1 text-xl font-semibold">
            Como você se considera hoje?
          </h2>
          <label htmlFor="nivelDeclarado" className="mt-4 block font-medium">
            Seu nível
            <select id="nivelDeclarado" name="nivelDeclarado" defaultValue="iniciante" className={campoBase()}>
              {NIVEIS_DECLARADOS.map((nivel) => (
                <option key={nivel} value={nivel}>
                  {rotuloDoNivel(nivel)}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-3 text-sm leading-6 text-suave">
            O diagnóstico adaptativo é opcional e entra depois. Você não precisa fazer uma prova longa para
            começar.
          </p>
        </section>

        <button
          type="submit"
          className="min-h-11 w-full rounded-full bg-marca px-4 py-3 font-semibold text-white transition hover:bg-marca-apoio"
        >
          Montar meu plano de hoje
        </button>
      </form>
    </div>
  );
}

function rotuloDoNivel(nivel: (typeof NIVEIS_DECLARADOS)[number]): string {
  return {
    iniciante: "Estou começando",
    intermediario: "Já tenho alguma base",
    avancado: "Já estudo há algum tempo",
  }[nivel];
}

function mensagemDoErro(erro: string): ReactNode {
  if (erro === "plano") return "Salvamos seu perfil, mas o plano ainda está sendo preparado. Tente recarregar em instantes.";
  if (erro === "salvar") return "Não conseguimos salvar suas preferências agora. Tente novamente.";
  return "Confira os dados do seu ponto de partida e tente novamente.";
}
