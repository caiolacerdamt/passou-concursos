import Link from "next/link";
import type { ReactNode } from "react";

import { Estado } from "@/modules/ui/estado";

import type { DadosGamificacao } from "./gamificacao";
import { GamificacaoNoProgresso } from "./painel-do-dia-tela";

import { CAUSAS_DO_CADERNO, NOMES_DAS_CAUSAS } from "./progresso";
import type {
  AssuntoDoCaderno,
  DadosProgresso,
  EstadoDaSequencia,
  MateriaDoHistorico,
  TendenciaProgresso,
} from "./progresso";

/** Quantos assuntos do caderno aparecem antes de o aluno pedir mais. */
export const ASSUNTOS_POR_PAGINA = 5;

const DOMINIO_EM_TEXTO = {
  nao_iniciado: "Não iniciado",
  fraco: "Fraco",
  em_desenvolvimento: "Em desenvolvimento",
  forte: "Forte",
  dominado: "Dominado",
} as const;

const TENDENCIA_EM_TEXTO: Record<TendenciaProgresso, string> = {
  subindo: "Subindo",
  estavel: "Estável",
  caindo: "Caindo",
  sem_base: "Sem base",
};

/** Cor é estado: só a direção da tendência pinta, e nunca o fundo. */
const TENDENCIA_EM_COR: Record<TendenciaProgresso, string> = {
  subindo: "text-ok",
  estavel: "text-suave",
  caindo: "text-erro",
  sem_base: "text-suave",
};

const DOMINIO_EM_COR = {
  nao_iniciado: "bg-fundo-suave text-suave",
  fraco: "bg-erro-fundo text-erro",
  em_desenvolvimento: "bg-conquista-fundo text-conquista",
  forte: "bg-marca-suave text-marca",
  dominado: "bg-marca-suave text-marca",
} as const;

function percentual(acertos: number, respostas: number): string {
  if (respostas <= 0) return "0%";
  return `${Math.round((acertos / respostas) * 100).toLocaleString("pt-BR")}%`;
}

function dataCurta(data: string): string {
  const valor = new Date(data);
  if (Number.isNaN(valor.getTime())) return data;
  return valor.toLocaleDateString("pt-BR", { dateStyle: "medium" });
}

/** O rótulo curto do dia na régua da semana ("qui", "sex"…). */
function diaCurto(data: string): string {
  const valor = new Date(`${data}T12:00:00`);
  if (Number.isNaN(valor.getTime())) return "";
  return valor
    .toLocaleDateString("pt-BR", { weekday: "short", timeZone: "America/Sao_Paulo" })
    .replace(".", "");
}

/**
 * A query que preserva os filtros de uma navegação para outra.
 *
 * `mostrar` entra aqui porque abrir mais um lote não pode perder o filtro, e
 * trocar o filtro não pode manter um lote grande de uma lista que encolheu.
 */
function queryDoCaderno(
  dados: DadosProgresso,
  extra: { mostrar?: number } = {},
): string {
  const params = new URLSearchParams();
  if (dados.filtros.materiaId) params.set("materia", dados.filtros.materiaId);
  if (dados.filtros.topicoId) params.set("topico", dados.filtros.topicoId);
  if (dados.filtros.causa) params.set("causa", dados.filtros.causa);
  if (extra.mostrar) params.set("mostrar", String(extra.mostrar));
  const query = params.toString();
  return query ? `?${query}` : "";
}

/* ════════════════════════════════════════════════════ SUA SEMANA (breu) ══ */

function fraseDaSequencia(estado: EstadoDaSequencia["estado"]): string {
  return {
    cumprido: "Você fez o essencial do dia. A sequência continua protegida.",
    piso_pendente: "Termine as revisões do piso e o dia de hoje fica cumprido.",
    fora_agenda: "Dias fora da sua agenda não interrompem seu ritmo.",
    folga: "A folga declarada não conta contra a sua sequência.",
    plano_indisponivel: "O plano de hoje ainda está sendo preparado.",
  }[estado];
}

/** A comparação com a janela anterior, dita em número quando existe número. */
function fraseDaSemana(dados: DadosProgresso): string {
  const { percentualAnterior } = dados.relatorioSemanal;
  if (percentualAnterior === null) {
    return "Ainda não há respostas na semana anterior para comparar. Fatos dos últimos 7 dias — sem estimar tempo de estudo.";
  }
  const anterior = Math.round(percentualAnterior * 100).toLocaleString("pt-BR");
  return `Na semana anterior você acertava ${anterior}%. Fatos dos últimos 7 dias — sem estimar tempo de estudo.`;
}

/**
 * Sete colunas com a mesma régua, do mais antigo ao dia de hoje.
 *
 * A altura sai do dia mais cheio da própria janela, e não de um teto fixo:
 * quem responde 4 por dia precisa enxergar a diferença entre 4 e 1 tanto
 * quanto quem responde 40. Dia sem resposta vira um traço, não um buraco —
 * ele é um fato (`porDia`, AD-112), não ausência de dado.
 */
function ReguaDaSemana({ dados }: { dados: DadosProgresso }) {
  const dias = dados.relatorioSemanal.porDia;
  const teto = Math.max(...dias.map((dia) => dia.questoes), 1);

  return (
    <ol className="mt-7 grid grid-cols-7 items-end gap-2 sm:gap-3.5" aria-label="Questões por dia">
      {dias.map((dia, indice) => {
        const hoje = indice === dias.length - 1;
        const altura = dia.questoes === 0 ? 3 : Math.max(Math.round((dia.questoes / teto) * 96), 8);
        const acerto = dia.questoes === 0 ? 0 : Math.round((dia.acertos / dia.questoes) * 100);
        return (
          <li key={dia.data} className="flex flex-col items-center gap-2">
            <span
              className={`font-utilitaria text-[0.6875rem] ${dia.questoes === 0 ? "text-breu-suave" : "text-breu-tinta"}`}
            >
              {dia.questoes}
            </span>
            <span
              style={{ height: `${altura}px` }}
              className={`flex w-full flex-col justify-end overflow-hidden rounded bg-breu-linha ${
                hoje ? "outline outline-1 outline-offset-2 outline-breu-verde" : ""
              }`}
              role="img"
              aria-label={`${dia.data}: ${dia.questoes} respondidas, ${dia.acertos} certas`}
            >
              <span style={{ height: `${acerto}%` }} className="bg-breu-verde" />
            </span>
            <span
              className={`font-utilitaria text-[0.6875rem] ${hoje ? "font-semibold text-breu-tinta" : "text-breu-suave"}`}
            >
              {hoje ? "hoje" : diaCurto(dia.data)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * O único cartão breu desta tela — a cota que o AD-111 raciona.
 *
 * Junta o que eram dois cartões: o da sequência e o relatório semanal. Os
 * dois respondiam "como eu estou indo", e separados obrigavam o aluno a
 * costurar a resposta sozinho. O grid de quatro cartões de métrica do
 * relatório sai junto: é o "grid automático de 3–4 cards" que o anti-slop
 * proíbe, e vira uma linha de fatos.
 */
function SuaSemana({ dados }: { dados: DadosProgresso }) {
  const relatorio = dados.relatorioSemanal;
  const sequencia = dados.sequencia;

  return (
    <section
      aria-labelledby="titulo-semana"
      className="rounded-2xl bg-breu px-6 pb-7 pt-6 text-breu-tinta sm:px-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <p className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] text-breu-verde">
            Últimos 7 dias
          </p>
          <h2
            id="titulo-semana"
            className="mt-3 text-[1.5rem] font-semibold leading-tight tracking-[-0.022em] sm:text-[1.875rem]"
          >
            {relatorio.questoesRespondidas === 0
              ? "Nenhuma questão nesta semana"
              : `${relatorio.questoesRespondidas} ${relatorio.questoesRespondidas === 1 ? "questão" : "questões"}, ${percentual(relatorio.acertos, relatorio.questoesRespondidas)} de acerto`}
          </h2>
          <p className="mt-2.5 max-w-[52ch] leading-relaxed text-breu-suave">
            {fraseDaSemana(dados)}
          </p>
        </div>

        {relatorio.tendencia === "sem_base" ? null : (
          <span className="shrink-0 rounded-lg border border-breu-linha bg-breu-alto px-3 py-1.5 text-[0.78125rem] font-semibold text-breu-verde">
            {TENDENCIA_EM_TEXTO[relatorio.tendencia]}
          </span>
        )}
      </div>

      <ReguaDaSemana dados={dados} />

      <p className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[0.78125rem] text-breu-suave">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="size-2.5 rounded-sm bg-breu-verde" />
          acertos
        </span>
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="size-2.5 rounded-sm bg-breu-linha" />
          respondidas
        </span>
        <span>
          {relatorio.topicosTocados} {relatorio.topicosTocados === 1 ? "assunto tocado" : "assuntos tocados"}
        </span>
        <span>
          {relatorio.revisoesConcluidas} {relatorio.revisoesConcluidas === 1 ? "revisão concluída" : "revisões concluídas"}
        </span>
      </p>

      {sequencia ? (
        <div className="mt-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3 border-t border-breu-linha pt-5">
          <p className="max-w-[58ch] leading-relaxed text-breu-suave">
            <strong className="font-utilitaria text-[1.0625rem] font-semibold text-breu-tinta">
              {sequencia.sequencia} {sequencia.sequencia === 1 ? "dia" : "dias"} de sequência.
            </strong>{" "}
            {fraseDaSequencia(sequencia.estado)}
          </p>
          <Link
            href="/app"
            className="shrink-0 border-b border-breu-linha pb-0.5 font-semibold text-breu-verde"
          >
            Ir para o plano de hoje
          </Link>
        </div>
      ) : null}
    </section>
  );
}

/* ═════════════════════════════════════════════ PROGRESSO POR ASSUNTO ══ */

function LinhaDaMateria({ materia }: { materia: MateriaDoHistorico }) {
  const taxa = materia.nRespostas === 0 ? 0 : materia.nAcertos / materia.nRespostas;

  return (
    <li className="border-t border-linha first:border-t-0">
      <details className="group">
        <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-3 px-5 py-4 transition-colors duration-150 hover:bg-fundo-suave sm:grid-cols-[minmax(0,1fr)_15rem_5.5rem_2rem] sm:px-7">
          <span className="min-w-0">
            <span className="block truncate text-[1.0625rem] font-semibold tracking-[-0.01em]">
              {materia.materia}
            </span>
            <span className="mt-1.5 block font-utilitaria text-[0.8125rem] text-suave">
              {materia.nTopicos} {materia.nTopicos === 1 ? "assunto praticado" : "assuntos praticados"} ·{" "}
              {materia.nRespostas} {materia.nRespostas === 1 ? "resposta" : "respostas"}
            </span>
          </span>

          <span className="order-last col-span-2 block sm:order-none sm:col-span-1">
            <span className="block h-1.5 overflow-hidden rounded-full bg-linha" aria-hidden="true">
              <span
                style={{ width: `${Math.round(taxa * 100)}%` }}
                className="block h-full rounded-full bg-marca-viva group-open:bg-marca"
              />
            </span>
            <span className={`mt-2 block text-[0.8125rem] ${TENDENCIA_EM_COR[materia.tendencia]}`}>
              Tendência: {TENDENCIA_EM_TEXTO[materia.tendencia]}
            </span>
          </span>

          <span className="text-right font-utilitaria text-2xl font-semibold tracking-[-0.02em] group-open:text-marca">
            {percentual(materia.nAcertos, materia.nRespostas)}
          </span>

          <span aria-hidden="true" className="hidden justify-self-end text-suave sm:block">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-transform duration-150 group-open:rotate-180"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </span>
        </summary>

        <div className="border-t border-linha bg-fundo-suave px-5 pb-5 pt-1 sm:px-7">
          <div className="hidden grid-cols-[minmax(0,1fr)_10rem_8rem_4.5rem] gap-x-6 py-3 font-utilitaria text-[0.6875rem] uppercase tracking-[0.14em] text-suave sm:grid">
            <span>Assunto</span>
            <span>Domínio</span>
            <span>Respostas certas</span>
            <span className="text-right">%</span>
          </div>
          <ul>
            {materia.topicos.map((topico) => (
              <li
                key={topico.topicoId}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-2 border-t border-linha py-3 sm:grid-cols-[minmax(0,1fr)_10rem_8rem_4.5rem]"
              >
                <span className="min-w-0 truncate text-[0.9375rem]">{topico.topico}</span>
                <span className="order-last col-span-2 sm:order-none sm:col-span-1">
                  <span
                    className={`inline-block rounded-lg px-2.5 py-0.5 text-[0.6875rem] font-semibold ${DOMINIO_EM_COR[topico.dominio]}`}
                  >
                    {DOMINIO_EM_TEXTO[topico.dominio]}
                  </span>
                </span>
                <span className="hidden font-utilitaria text-[0.8125rem] text-suave sm:block">
                  {topico.nAcertos} de {topico.nRespostas}
                </span>
                <span className="text-right font-utilitaria text-[0.9375rem] font-semibold">
                  {percentual(topico.nAcertos, topico.nRespostas)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </details>
    </li>
  );
}

function Historico({ dados }: { dados: DadosProgresso }) {
  const materias = dados.historicoPorMateria;
  const nTopicos = dados.historico.length;

  return (
    <section aria-labelledby="titulo-historico">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] text-marca-apoio">
            O que você já construiu
          </p>
          <h2 id="titulo-historico" className="mt-2.5 text-[1.375rem] font-semibold">
            Progresso por assunto
          </h2>
        </div>
        {materias.length === 0 ? null : (
          <p className="text-sm text-suave">
            {materias.length} {materias.length === 1 ? "matéria" : "matérias"} ·{" "}
            {nTopicos} {nTopicos === 1 ? "assunto" : "assuntos"}
          </p>
        )}
      </div>

      {materias.length === 0 ? (
        <Estado
          tipo="vazio"
          titulo={
            dados.estadoInicial
              ? "Seu histórico começa com a primeira questão"
              : "Ainda não há progresso por assunto"
          }
          acao={
            <>
              Responda uma questão no{" "}
              <Link className="font-semibold text-marca underline" href="/app">
                plano do dia
              </Link>{" "}
              e volte para acompanhar sua evolução.
            </>
          }
        />
      ) : (
        <ul
          className="mt-4 overflow-hidden rounded-2xl border border-linha bg-painel"
          aria-label="Progresso por matéria"
        >
          {materias.map((materia) => (
            <LinhaDaMateria key={materia.materiaId} materia={materia} />
          ))}
        </ul>
      )}
    </section>
  );
}

/* ══════════════════════════════════════════════════ CADERNO DE ERROS ══ */

/**
 * Os três filtros num formulário GET.
 *
 * As opções nascem do universo inteiro (`dados.topicos`, `dados.materias`), e
 * não do resultado já filtrado — era isso que fazia a lista de assuntos ficar
 * com o único assunto escolhido. O assunto vai em `<optgroup>` por matéria
 * porque o mesmo nome de tópico é permitido em matérias diferentes: sem o
 * agrupamento, duas opções "Geral" são indistinguíveis.
 */
function FiltrosDoCaderno({ dados }: { dados: DadosProgresso }) {
  const materiasComTopico = dados.materias.filter((materia) =>
    dados.topicos.some((topico) => topico.materiaId === materia.id),
  );
  const temFiltro = Boolean(
    dados.filtros.causa || dados.filtros.topicoId || dados.filtros.materiaId,
  );

  return (
    <form
      method="get"
      action="/app/progresso"
      className="mt-5 flex flex-wrap items-end gap-3 rounded-xl border border-linha bg-painel p-4 sm:px-5"
    >
      <label className="grid min-w-[13rem] flex-1 gap-1.5" htmlFor="materia">
        <span className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.14em] text-suave">
          Matéria
        </span>
        <select
          id="materia"
          name="materia"
          defaultValue={dados.filtros.materiaId ?? ""}
          className="min-h-11 rounded-lg border border-linha px-3 text-[0.9375rem] text-texto"
        >
          <option value="">Todas as matérias</option>
          {materiasComTopico.map((materia) => (
            <option key={materia.id} value={materia.id}>
              {materia.nome}
            </option>
          ))}
        </select>
      </label>

      <label className="grid min-w-[13rem] flex-1 gap-1.5" htmlFor="topico">
        <span className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.14em] text-suave">
          Assunto
        </span>
        <select
          id="topico"
          name="topico"
          defaultValue={dados.filtros.topicoId ?? ""}
          className="min-h-11 rounded-lg border border-linha px-3 text-[0.9375rem] text-texto"
        >
          <option value="">Todos os assuntos</option>
          {materiasComTopico.map((materia) => (
            <optgroup key={materia.id} label={materia.nome}>
              {dados.topicos
                .filter((topico) => topico.materiaId === materia.id)
                .map((topico) => (
                  <option key={topico.id} value={topico.id}>
                    {topico.nome}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>

      <label className="grid min-w-[13rem] flex-1 gap-1.5" htmlFor="causa">
        <span className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.14em] text-suave">
          Por que errei
        </span>
        <select
          id="causa"
          name="causa"
          defaultValue={dados.filtros.causa ?? ""}
          className="min-h-11 rounded-lg border border-linha px-3 text-[0.9375rem] text-texto"
        >
          <option value="">Todas as causas</option>
          {CAUSAS_DO_CADERNO.map((causa) => (
            <option key={causa} value={causa}>
              {NOMES_DAS_CAUSAS[causa]}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          className="min-h-11 rounded-full bg-marca px-5 text-sm font-semibold text-white transition hover:bg-marca-apoio"
        >
          Filtrar
        </button>
        {temFiltro ? (
          <Link
            href="/app/progresso"
            className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-marca"
          >
            Limpar
          </Link>
        ) : null}
      </div>
    </form>
  );
}

/**
 * Um cartão por ASSUNTO, com as causas dentro.
 *
 * A projeção tem grão `(tópico, causa)` e a tela antiga desenhava um cartão
 * por linha: quatro "Interpretação" seguidos, cada um com o próprio botão. A
 * ação principal passa a valer o assunto inteiro; cada causa continua sendo
 * um caminho próprio, agora do tamanho do que ela é.
 */
function AssuntoComErros({ assunto }: { assunto: AssuntoDoCaderno }) {
  const refazer = (causa: string) =>
    `/app/sessao?refacao=1&topico=${encodeURIComponent(assunto.topicoId)}&causa=${encodeURIComponent(causa)}`;

  return (
    <li className="rounded-2xl border border-linha bg-painel px-5 pb-6 pt-5 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <p className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.12em] text-suave">
            {assunto.materia}
          </p>
          <h3 className="mt-1.5 text-[1.1875rem] font-semibold tracking-[-0.01em]">
            {assunto.topico}
          </h3>
          <p className="mt-1.5 text-sm text-suave">
            Último erro em {dataCurta(assunto.ultimoErroEm)}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-x-3.5 gap-y-3">
          <p className="flex items-baseline gap-2">
            <span className="font-utilitaria text-3xl font-semibold tracking-[-0.02em] text-erro">
              {assunto.nErros}
            </span>
            <span className="text-sm text-suave">
              {assunto.nErros === 1 ? "erro" : "erros"}
            </span>
          </p>
          <Link
            href={refazer("todas")}
            className="inline-flex min-h-11 items-center rounded-full bg-marca px-5 text-sm font-semibold text-white transition hover:bg-marca-apoio"
          >
            {assunto.nErros === 1 ? "Refazer o erro" : `Refazer os ${assunto.nErros}`}
          </Link>
        </div>
      </div>

      <div className="mt-5 border-t border-linha pt-4">
        <p className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.14em] text-suave">
          Por que errei
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {assunto.causas.map((causa) => (
            <li key={causa.causa}>
              <Link
                href={refazer(causa.causa)}
                className="inline-flex min-h-10 items-center gap-2.5 rounded-lg border border-linha px-3.5 text-sm transition hover:bg-fundo-suave"
              >
                {NOMES_DAS_CAUSAS[causa.causa]}
                <span className="font-utilitaria font-semibold text-erro">{causa.nErros}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}

function Caderno({ dados, mostrar }: { dados: DadosProgresso; mostrar: number }) {
  const filtrado = Boolean(
    dados.filtros.causa || dados.filtros.topicoId || dados.filtros.materiaId,
  );
  const assuntos = dados.cadernoPorAssunto;
  const visiveis = assuntos.slice(0, mostrar);
  const restantes = assuntos.length - visiveis.length;
  const totalDeErros = assuntos.reduce((soma, assunto) => soma + assunto.nErros, 0);

  return (
    <section aria-labelledby="titulo-caderno">
      <div className="max-w-[58ch]">
        <p className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] text-aviso">
          Aprender com o erro
        </p>
        <h2 id="titulo-caderno" className="mt-2.5 text-[1.375rem] font-semibold">
          Caderno de erros
        </h2>
        <p className="mt-2 leading-7 text-suave">
          {assuntos.length === 0
            ? "Refaça um assunto inteiro, ou só as questões de uma causa."
            : `${totalDeErros} ${totalDeErros === 1 ? "erro registrado" : "erros registrados"} em ${assuntos.length} ${assuntos.length === 1 ? "assunto" : "assuntos"}. Refaça um assunto inteiro, ou só as questões de uma causa.`}
        </p>
      </div>

      <FiltrosDoCaderno dados={dados} />

      {assuntos.length === 0 ? (
        <Estado
          tipo="vazio"
          titulo={filtrado ? "Nenhum erro com esses filtros" : "Seu caderno ainda está vazio"}
          acao={
            filtrado ? (
              <>
                Nenhum erro registrado combina com essa busca.{" "}
                <Link className="font-semibold text-marca underline" href="/app/progresso">
                  Limpe os filtros
                </Link>{" "}
                para ver o caderno inteiro.
              </>
            ) : (
              "Quando você errar uma questão, a tela pergunta o motivo — e é esse motivo que monta o caderno."
            )
          }
        />
      ) : (
        <>
          <ul className="mt-4 grid gap-3" aria-label="Caderno de erros por assunto">
            {visiveis.map((assunto) => (
              <AssuntoComErros key={assunto.topicoId} assunto={assunto} />
            ))}
          </ul>

          {restantes > 0 || dados.cadernoTruncado ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-linha pt-4">
              <p className="text-sm text-suave">
                Mostrando {visiveis.length} de {assuntos.length}{" "}
                {assuntos.length === 1 ? "assunto" : "assuntos"} com erro registrado.
                {dados.cadernoTruncado
                  ? " Há mais erros do que esta consulta traz de uma vez."
                  : ""}
              </p>
              {restantes > 0 ? (
                <Link
                  href={`/app/progresso${queryDoCaderno(dados, { mostrar: mostrar + ASSUNTOS_POR_PAGINA })}`}
                  className="inline-flex min-h-11 items-center rounded-full border border-linha bg-painel px-5 text-sm font-semibold text-marca transition hover:bg-fundo-suave"
                >
                  Mostrar mais {Math.min(restantes, ASSUNTOS_POR_PAGINA)}
                </Link>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════ A TELA ══ */

/**
 * O aluno que nunca respondeu não recebe cinco caixas vazias empilhadas.
 *
 * Era o que a tela fazia: sequência sem sequência, relatório de zeros,
 * histórico vazio, caderno vazio — quatro formas de dizer a mesma coisa. Uma
 * tela só, com o único caminho que existe daqui.
 */
function PrimeiroDia() {
  return (
    <section className="rounded-2xl bg-breu px-6 pb-8 pt-7 text-breu-tinta sm:px-9">
      <p className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] text-breu-verde">
        Seu progresso
      </p>
      <h1 className="mt-3.5 max-w-[24ch] text-[2rem] font-semibold leading-[1.12] tracking-[-0.025em]">
        Esta tela começa a existir na sua primeira questão.
      </h1>
      <p className="mt-3.5 max-w-[56ch] text-[1.0625rem] leading-relaxed text-breu-suave">
        Cada resposta registra o assunto, o acerto e — quando você erra — o motivo. É disso que
        nascem a sua sequência, o histórico por matéria e o caderno de erros.
      </p>
      <Link
        href="/app"
        className="mt-6 inline-flex min-h-12 items-center rounded-full bg-breu-tinta px-6 font-semibold text-breu transition hover:opacity-90"
      >
        Começar o plano de hoje
      </Link>
    </section>
  );
}

export function ProgressoTela({
  dados,
  gamificacao = null,
  trajetoria = null,
  mostrar = ASSUNTOS_POR_PAGINA,
}: {
  dados: DadosProgresso;
  gamificacao?: DadosGamificacao | null;
  /** A cobertura do edital, montada pela rota — entra entre a semana e os pontos. */
  trajetoria?: ReactNode;
  mostrar?: number;
}) {
  if (dados.estadoInicial) {
    return <PrimeiroDia />;
  }

  return (
    <div className="space-y-8">
      <header className="max-w-[40ch]">
        <p className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] text-marca-apoio">
          Seu progresso
        </p>
        <h1 className="mt-3.5 text-[2rem] font-semibold leading-[1.1] tracking-[-0.025em] sm:text-[2.5rem]">
          Veja a evolução sem se comparar com ninguém.
        </h1>
        <p className="mt-3.5 max-w-[54ch] text-[1.0625rem] leading-relaxed text-suave">
          O essencial cumprido, os assuntos praticados e os erros que merecem outra chance.
        </p>
      </header>

      <SuaSemana dados={dados} />
      {trajetoria}
      {gamificacao ? <GamificacaoNoProgresso dados={gamificacao} /> : null}
      <Historico dados={dados} />
      <Caderno dados={dados} mostrar={mostrar} />
    </div>
  );
}
