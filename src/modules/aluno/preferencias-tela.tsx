import { NIVEIS_DECLARADOS, type MotivoOnboarding, type PerfilEstudo } from "./onboarding";

const DIAS = [
  [0, "Domingo"],
  [1, "Segunda"],
  [2, "Terça"],
  [3, "Quarta"],
  [4, "Quinta"],
  [5, "Sexta"],
  [6, "Sábado"],
] as const;

type AcaoDePreferencias = (formulario: FormData) => Promise<never>;

export function PreferenciasTela({
  acao,
  perfil,
  erro,
  motivo,
  resultado,
}: {
  acao: AcaoDePreferencias;
  perfil: PerfilEstudo;
  erro?: string;
  motivo?: string;
  resultado?: string;
}) {
  const diasSelecionados = new Set(perfil.diasEstudo);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 max-w-xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-marca">
          Seu ritmo, sempre ajustável
        </p>
        <h1 className="mt-3 font-display text-4xl leading-tight tracking-tight sm:text-5xl">
          Preferências de estudo
        </h1>
        <p className="mt-4 text-lg leading-8 text-suave">
          Ajuste o tempo, a agenda e o ponto de partida para o plano continuar cabendo na sua rotina.
        </p>
      </div>

      {resultado === "salvo" ? (
        <p
          role="status"
          className="mb-5 rounded-card border border-marca/30 bg-marca-suave px-4 py-3 text-marca shadow-sm"
        >
          Preferências salvas. Recalculamos o que vale para hoje e para os próximos dias.
        </p>
      ) : null}

      {erro ? (
        <p
          role="alert"
          className="mb-5 rounded-card border border-erro/40 bg-painel px-4 py-3 text-erro shadow-sm"
        >
          {mensagemDoErro(erro, motivo)}
        </p>
      ) : null}

      <form action={acao} className="space-y-6 rounded-card border border-linha bg-painel p-5 shadow-card sm:p-8">
        <aside
          role="note"
          aria-label="Efeito das mudanças"
          className="rounded-xl border border-marca/20 bg-marca-suave px-4 py-3 text-sm leading-6 text-suave"
        >
          <strong className="font-semibold text-texto">O que muda:</strong> o plano de hoje será recalculado
          agora. O novo tempo e a nova agenda valem a partir do próximo dia; se hoje sair da sua agenda,
          nenhum plano será gerado para hoje e a tela Hoje mostrará que ele está em preparação.
        </aside>

        <section aria-labelledby="meta-preferencias-titulo">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-suave">01 · Meta</p>
          <h2 id="meta-preferencias-titulo" className="mt-1 text-xl font-semibold">
            O que você quer preparar?
          </h2>
          <label htmlFor="concursoAlvo" className="mt-4 block font-medium">
            Concurso-alvo
            <input
              id="concursoAlvo"
              name="concursoAlvo"
              type="text"
              defaultValue={perfil.concursoAlvo}
              required
              maxLength={160}
              className={campoBase()}
            />
          </label>
        </section>

        <section aria-labelledby="tempo-preferencias-titulo" className="border-t border-linha pt-6">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-suave">02 · Ritmo</p>
          <h2 id="tempo-preferencias-titulo" className="mt-1 text-xl font-semibold">
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
              defaultValue={perfil.minutosPorDia}
              required
              className={campoBase()}
            />
          </label>
        </section>

        <section aria-labelledby="agenda-preferencias-titulo" className="border-t border-linha pt-6">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-suave">03 · Agenda</p>
          <h2 id="agenda-preferencias-titulo" className="mt-1 text-xl font-semibold">
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
                  <input
                    type="checkbox"
                    name="diasEstudo"
                    value={valor}
                    defaultChecked={diasSelecionados.has(valor)}
                  />
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
              defaultValue={horarioParaInput(perfil.horarioEstudo)}
              required
              className={campoBase()}
            />
          </label>
        </section>

        <section aria-labelledby="nivel-preferencias-titulo" className="border-t border-linha pt-6">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-suave">04 · Ponto de partida</p>
          <h2 id="nivel-preferencias-titulo" className="mt-1 text-xl font-semibold">
            Como você se considera hoje?
          </h2>
          <label htmlFor="nivelDeclarado" className="mt-4 block font-medium">
            Seu nível
            <select
              id="nivelDeclarado"
              name="nivelDeclarado"
              defaultValue={perfil.nivelDeclarado}
              className={campoBase()}
            >
              {NIVEIS_DECLARADOS.map((nivel) => (
                <option key={nivel} value={nivel}>
                  {rotuloDoNivel(nivel)}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-3 text-sm leading-6 text-suave">
            O diagnóstico adaptativo continua opcional. Você pode ajustar seu nível sem fazer uma prova longa.
          </p>
        </section>

        <button
          type="submit"
          className="min-h-11 w-full rounded-full bg-marca px-4 py-3 font-semibold text-white transition hover:bg-marca-apoio"
        >
          Salvar preferências
        </button>
      </form>
    </div>
  );
}

function campoBase() {
  return "mt-2 w-full rounded-xl border border-linha bg-painel px-3 py-3 text-base";
}

function horarioParaInput(horario: string): string {
  const partes = /^(\d{2}:\d{2})/.exec(horario);
  return partes?.[1] ?? horario;
}

function rotuloDoNivel(nivel: (typeof NIVEIS_DECLARADOS)[number]): string {
  return {
    iniciante: "Estou começando",
    intermediario: "Já tenho alguma base",
    avancado: "Já estudo há algum tempo",
  }[nivel];
}

function mensagemDoErro(erro: string, motivo?: string): string {
  if (erro === "plano") {
    return "Salvamos suas preferências, mas o plano ainda está sendo preparado. Tente recarregar em instantes.";
  }
  if (erro === "salvar") {
    return "Não conseguimos salvar suas preferências agora. Tente novamente.";
  }

  const mensagens: Partial<Record<MotivoOnboarding, string>> = {
    concurso_obrigatorio: "Informe qual concurso você quer preparar.",
    concurso_invalido: "O nome do concurso é muito longo.",
    minutos_invalidos: "Informe entre 1 e 1.440 minutos por dia.",
    agenda_obrigatoria: "Escolha pelo menos um dia para estudar.",
    dia_invalido: "A agenda contém um dia inválido.",
    horario_invalido: "Escolha um horário válido para estudar.",
    nivel_invalido: "Escolha um nível válido.",
  };

  return mensagens[motivo as MotivoOnboarding] ?? "Confira suas preferências e tente novamente.";
}
