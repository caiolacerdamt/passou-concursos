"use client";

import { useState } from "react";

import { NIVEIS_DECLARADOS, type MotivoOnboarding, type NivelDeclarado, type PerfilEstudo } from "./onboarding";
import {
  DIAS_DA_SEMANA,
  MINUTOS_SUGERIDOS,
  cargaSemanal,
  contarMudancas,
  formatarDuracao,
  horarioCurto,
  proximoEstudo,
  type EstadoDasPreferencias,
} from "./preferencias-efeito";

/**
 * As preferências de estudo, com a consequência ao lado da escolha.
 *
 * O aviso "o que muda" continua inteiro no fim do painel — é ele que explica a
 * regra do motor. O que mudou é que agora existe, acima dele, o efeito EM
 * NÚMERO da escolha atual: minutos × dias marcados, o próximo dia de estudo, e
 * se hoje ainda entra. É conta do próprio formulário, não estimativa.
 *
 * Componente de cliente porque esse painel reage a cada clique. O `action`
 * continua sendo a mesma Server Action: nada é salvo aqui, e o `name` de cada
 * campo é exatamente o que `salvarPreferencias` já lia.
 */

type AcaoDePreferencias = (formulario: FormData) => Promise<never> | Promise<void>;

const ROTULO_DO_NIVEL: Record<NivelDeclarado, { titulo: string; dica: string }> = {
  iniciante: {
    titulo: "Estou começando",
    dica: "Pouco ou nenhum contato com o conteúdo da prova.",
  },
  intermediario: {
    titulo: "Já tenho alguma base",
    dica: "Estudei parte do edital, mas sem constância.",
  },
  avancado: {
    titulo: "Já estudo há algum tempo",
    dica: "Rotina firme e prova anterior nas costas.",
  },
};

export function PreferenciasTela({
  acao,
  perfil,
  erro,
  motivo,
  resultado,
  diaDeHoje,
}: {
  acao: AcaoDePreferencias;
  perfil: PerfilEstudo;
  erro?: string;
  motivo?: string;
  resultado?: string;
  /**
   * O dia da semana de hoje no fuso do produto, 0 a 6. Vem do servidor de
   * propósito — ver `proximoEstudo` em `preferencias-efeito`.
   */
  diaDeHoje: number;
}) {
  const salvo: EstadoDasPreferencias = {
    concursoAlvo: perfil.concursoAlvo,
    minutosPorDia: perfil.minutosPorDia,
    diasEstudo: perfil.diasEstudo,
    horarioEstudo: horarioCurto(perfil.horarioEstudo),
    nivelDeclarado: perfil.nivelDeclarado,
  };

  const [atual, setAtual] = useState<EstadoDasPreferencias>(salvo);
  const mudancas = contarMudancas(salvo, atual);
  const semana = cargaSemanal(atual.minutosPorDia, atual.diasEstudo);
  const proximo = proximoEstudo(atual.diasEstudo, diaDeHoje);
  const hojeNaAgenda = atual.diasEstudo.includes(diaDeHoje);

  function alternarDia(valor: number) {
    setAtual((anterior) => ({
      ...anterior,
      diasEstudo: anterior.diasEstudo.includes(valor)
        ? anterior.diasEstudo.filter((dia) => dia !== valor)
        : [...anterior.diasEstudo, valor],
    }));
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header>
        <p className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] text-marca-apoio">
          Preferências
        </p>
        <h1 className="mt-3 font-display text-4xl leading-[1.08] tracking-[-0.028em]">
          Seu ritmo
        </h1>
        <p className="mt-3.5 max-w-[50ch] text-corpo text-suave">
          Quanto tempo você tem, em quais dias, e de onde você está partindo. O plano
          se ajusta a isso.
        </p>
      </header>

      {resultado === "salvo" ? (
        <p
          role="status"
          className="mt-6 rounded-card border border-marca/30 bg-marca-suave px-4 py-3 text-sm leading-6 text-marca"
        >
          Preferências salvas. Recalculamos o que vale para hoje e para os próximos dias.
        </p>
      ) : null}

      {erro ? (
        <p
          role="alert"
          className="mt-6 rounded-card border border-erro/40 bg-erro-fundo px-4 py-3 text-sm leading-6 text-erro"
        >
          {mensagemDoErro(erro, motivo)}
        </p>
      ) : null}

      <form action={acao}>
        <div className="mt-9 grid gap-12 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
          <div>
            <Bloco numero="01" titulo="Para qual concurso" dica="O acervo e o Raio-X seguem a banca deste concurso.">
              <label htmlFor="concursoAlvo" className="sr-only">
                Concurso-alvo
              </label>
              <input
                id="concursoAlvo"
                name="concursoAlvo"
                type="text"
                required
                maxLength={160}
                value={atual.concursoAlvo}
                onChange={(evento) =>
                  setAtual((anterior) => ({ ...anterior, concursoAlvo: evento.target.value }))
                }
                className="mt-4 min-h-12 w-full max-w-[26rem] rounded-xl border border-linha bg-painel px-3.5 text-base"
              />
            </Bloco>

            <Bloco
              numero="02"
              titulo="Quanto tempo por dia"
              dica="Escolha o que você consegue cumprir num dia comum, não no melhor dia."
            >
              <div className="mt-4 flex flex-wrap gap-2">
                {MINUTOS_SUGERIDOS.map((minutos) => {
                  const ativo = atual.minutosPorDia === minutos;
                  return (
                    <button
                      key={minutos}
                      type="button"
                      aria-pressed={ativo}
                      onClick={() =>
                        setAtual((anterior) => ({ ...anterior, minutosPorDia: minutos }))
                      }
                      className={`min-h-11 rounded-xl border px-4 text-[0.90625rem] transition-colors ${
                        ativo
                          ? "border-marca bg-marca font-medium text-painel"
                          : "border-linha bg-painel text-texto hover:border-marca/40"
                      }`}
                    >
                      {formatarDuracao(minutos)}
                    </button>
                  );
                })}
              </div>

              <label htmlFor="minutosPorDia" className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                <span className="font-medium">Minutos por dia</span>
                <input
                  id="minutosPorDia"
                  name="minutosPorDia"
                  type="number"
                  min={1}
                  max={1440}
                  required
                  value={Number.isFinite(atual.minutosPorDia) ? atual.minutosPorDia : ""}
                  onChange={(evento) =>
                    setAtual((anterior) => ({
                      ...anterior,
                      minutosPorDia: Number(evento.target.value),
                    }))
                  }
                  className="min-h-11 w-24 rounded-xl border border-linha bg-painel px-3 text-center font-utilitaria text-base"
                />
                <span className="text-suave">
                  {atual.diasEstudo.length > 0
                    ? `${formatarDuracao(semana)} por semana, nos ${atual.diasEstudo.length} dias marcados`
                    : "marque ao menos um dia abaixo"}
                </span>
              </label>
            </Bloco>

            <Bloco
              numero="03"
              titulo="Em quais dias"
              dica="Dia fora da agenda não gera plano e não quebra sua sequência."
            >
              <fieldset className="mt-4">
                <legend className="sr-only">Dias de estudo</legend>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                  {DIAS_DA_SEMANA.map((dia) => {
                    const marcado = atual.diasEstudo.includes(dia.valor);
                    return (
                      <label
                        key={dia.valor}
                        className={`flex min-h-[4.25rem] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border text-sm transition-colors ${
                          marcado
                            ? "border-marca/35 bg-marca-suave font-semibold text-marca"
                            : "border-linha bg-painel text-suave hover:border-marca/30"
                        }`}
                      >
                        <input
                          type="checkbox"
                          name="diasEstudo"
                          value={dia.valor}
                          checked={marcado}
                          onChange={() => alternarDia(dia.valor)}
                          className="sr-only"
                        />
                        <span>{dia.curto}</span>
                        <span
                          aria-hidden="true"
                          className={`size-1.5 rounded-full ${marcado ? "bg-marca" : "bg-linha"}`}
                        />
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <div className="mt-4 flex flex-wrap items-center gap-4">
                <label htmlFor="horarioEstudo" className="flex items-center gap-3 text-sm font-medium">
                  Horário habitual
                  <input
                    id="horarioEstudo"
                    name="horarioEstudo"
                    type="time"
                    required
                    value={atual.horarioEstudo}
                    onChange={(evento) =>
                      setAtual((anterior) => ({ ...anterior, horarioEstudo: evento.target.value }))
                    }
                    className="min-h-12 rounded-xl border border-linha bg-painel px-3.5 font-utilitaria text-base"
                  />
                </label>
                <span className="max-w-[26ch] text-[0.8125rem] leading-6 text-suave">
                  Usamos esse horário só para lembrar você — nunca para travar o estudo.
                </span>
              </div>
            </Bloco>

            <Bloco
              numero="04"
              titulo="De onde você parte"
              dica="Serve de semente. O que manda depois são as suas respostas."
            >
              <fieldset className="mt-4">
                <legend className="sr-only">Seu nível</legend>
                <div className="grid gap-2">
                  {NIVEIS_DECLARADOS.map((nivel) => {
                    const marcado = atual.nivelDeclarado === nivel;
                    return (
                      <label
                        key={nivel}
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3.5 transition-colors ${
                          marcado
                            ? "border-marca/40 bg-marca-suave"
                            : "border-linha bg-painel hover:border-marca/30"
                        }`}
                      >
                        <input
                          type="radio"
                          name="nivelDeclarado"
                          value={nivel}
                          checked={marcado}
                          onChange={() =>
                            setAtual((anterior) => ({ ...anterior, nivelDeclarado: nivel }))
                          }
                          className="mt-1 size-4 shrink-0 accent-marca"
                        />
                        <span>
                          <span className="block text-[0.90625rem] font-medium">
                            {ROTULO_DO_NIVEL[nivel].titulo}
                          </span>
                          <span className="mt-1 block text-[0.8125rem] leading-6 text-suave">
                            {ROTULO_DO_NIVEL[nivel].dica}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <p className="mt-4 max-w-[46ch] text-[0.8125rem] leading-6 text-suave">
                O diagnóstico adaptativo continua opcional. Você pode ajustar seu nível sem
                fazer uma prova longa.
              </p>
            </Bloco>
          </div>

          <aside
            aria-label="Efeito das mudanças"
            className="rounded-2xl bg-breu px-6 pb-6 pt-6 text-breu-tinta lg:sticky lg:top-6"
          >
            <p className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] text-breu-verde">
              O que muda
            </p>
            <h2 className="mt-3 text-[1.25rem] font-semibold leading-snug tracking-[-0.016em]">
              O plano de hoje é refeito assim que você salvar.
            </h2>

            <dl className="mt-5">
              <Fato rotulo="Carga da semana">
                {atual.diasEstudo.length === 0 ? (
                  "Sem dia marcado, nenhum plano é gerado."
                ) : (
                  <>
                    {formatarDuracao(semana)}
                    <Diferenca
                      atual={semana}
                      anterior={cargaSemanal(salvo.minutosPorDia, salvo.diasEstudo)}
                    />
                  </>
                )}
              </Fato>

              <Fato rotulo={`Hoje, ${DIAS_DA_SEMANA[diaDeHoje].nome.toLowerCase()}`}>
                {hojeNaAgenda
                  ? "Está na sua agenda: o plano de hoje é recalculado agora."
                  : "Fora da sua agenda: nenhum plano será gerado para hoje."}
              </Fato>

              <Fato rotulo="Próximo estudo">
                {proximo === null
                  ? "Nenhum dia marcado."
                  : `${proximo.hoje ? "Hoje" : DIAS_DA_SEMANA[proximo.dia].nome}, ${atual.horarioEstudo}`}
              </Fato>
            </dl>

            <p className="mt-5 rounded-xl bg-breu-alto px-4 py-3.5 text-[0.8125rem] leading-6 text-breu-suave">
              <strong className="font-semibold text-breu-tinta">
                O novo tempo e a nova agenda valem a partir do próximo dia.
              </strong>{" "}
              Se hoje sair da sua agenda, nenhum plano será gerado para hoje e a tela Hoje
              mostrará que ele está em preparação.
            </p>
          </aside>
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-4 border-t border-linha pt-5">
          <p className="text-sm text-suave" aria-live="polite">
            {mudancas === 0 ? (
              "Tudo salvo."
            ) : (
              <>
                <strong className="font-medium text-texto">
                  {mudancas === 1 ? "1 mudança" : `${mudancas} mudanças`}
                </strong>{" "}
                ainda não salva{mudancas === 1 ? "" : "s"}.
              </>
            )}
          </p>
          <button
            type="submit"
            className="ml-auto flex min-h-11 items-center justify-center rounded-pill bg-marca px-7 font-semibold text-white transition hover:bg-marca-apoio"
          >
            Salvar preferências
          </button>
        </div>
      </form>
    </div>
  );
}

function Bloco({
  numero,
  titulo,
  dica,
  children,
}: {
  numero: string;
  titulo: string;
  dica: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid grid-cols-[2.125rem_minmax(0,1fr)] border-t border-linha py-7 first:border-t-0 first:pt-0">
      <p className="pt-1 font-utilitaria text-[0.6875rem] tracking-[0.14em] text-suave">
        {numero}
      </p>
      <div className="min-w-0">
        <h2 className="text-[1.1875rem] font-semibold tracking-[-0.014em]">{titulo}</h2>
        <p className="mt-1.5 max-w-[44ch] text-[0.84375rem] leading-6 text-suave">{dica}</p>
        {children}
      </div>
    </section>
  );
}

function Fato({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-breu-linha py-3.5 first:border-t-0 first:pt-0">
      <dt className="font-utilitaria text-[0.65625rem] uppercase tracking-[0.14em] text-breu-suave">
        {rotulo}
      </dt>
      <dd className="mt-1.5 text-[0.90625rem] leading-6">{children}</dd>
    </div>
  );
}

/** A diferença só aparece quando existe — "0 min a mais" não é informação. */
function Diferenca({ atual, anterior }: { atual: number; anterior: number }) {
  const delta = atual - anterior;
  if (delta === 0) return null;

  return (
    <span className="text-breu-verde">
      {" — "}
      {formatarDuracao(Math.abs(delta))} {delta > 0 ? "a mais" : "a menos"}
    </span>
  );
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
