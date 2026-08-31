import Link from "next/link";

import { descartarSessao } from "@/app/app/sessao/acoes";

import { NOMES_DAS_CAUSAS } from "../progresso";
import { nomeDoRotuloDoTopico, type RotuloDoTopico } from "../rotulo-do-topico";
import type { Contexto } from "../tentativas";
import type {
  DadosDaPratica,
  ErroDoCaderno,
  ResultadoDoItem,
  RevisaoForaDoPlano,
  SessaoAberta,
  SessaoDoHistorico,
} from "./pratica";

/**
 * A tela de prática (`/app/sessao`) — AD-115.
 *
 * Ela **não** lista bloco do plano. O plano já tem `/app` e `/app/plano`, e uma
 * terceira lista dos mesmos blocos era o que fazia esta rota parecer
 * redundante. O único vestígio do plano aqui é o link seco no cabeçalho.
 *
 * Também não tem cartão herói nem breu: o AD-111 dá esse tratamento ao próximo
 * bloco em `/app`, um por tela. Esta é tela de trabalho — cartão de painel,
 * divisor e linha com ação.
 */

const NOMES_DOS_CONTEXTOS: Record<Contexto, string> = {
  diagnostico: "Diagnóstico",
  plano: "Bloco do plano",
  treino: "Treino",
  simulado: "Simulado",
  revisao: "Revisão",
};

type Props = {
  dados: DadosDaPratica;
  rotulosDosTopicos: ReadonlyMap<string, RotuloDoTopico>;
  hoje: string;
};

/**
 * Quanto tempo a sessão está aberta, em palavras.
 *
 * Existe porque o rótulo "Em andamento" sozinho mente: uma sessão só encerra
 * quando **todo** item é respondido, e nada fecha a que foi abandonada. Sem a
 * idade na linha, a sessão largada semana passada lê como se o aluno tivesse
 * acabado de sair dela.
 */
export function idadeDaSessao(iniciadaEm: string, agora: Date = new Date()): string {
  const inicio = Date.parse(iniciadaEm);
  if (Number.isNaN(inicio)) return "aberta há algum tempo";

  const minutos = Math.floor((agora.getTime() - inicio) / 60_000);
  if (minutos < 1) return "aberta agora há pouco";
  if (minutos < 60) return `aberta há ${minutos} min`;

  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `aberta há ${horas} h`;

  const dias = Math.floor(horas / 24);
  return `aberta há ${dias} ${dias === 1 ? "dia" : "dias"}`;
}

/** A partir daqui a sessão deixou de ser "o que você está fazendo agora". */
const HORAS_ATE_ENVELHECER = 24;

function envelheceu(iniciadaEm: string, agora: Date = new Date()): boolean {
  const inicio = Date.parse(iniciadaEm);
  if (Number.isNaN(inicio)) return false;
  return agora.getTime() - inicio >= HORAS_ATE_ENVELHECER * 3_600_000;
}

export function PraticaTela({ dados, rotulosDosTopicos, hoje }: Props) {
  const { sessaoAberta, revisoesForaDoPlano, caderno, historico } = dados;
  const vazia =
    sessaoAberta === null &&
    revisoesForaDoPlano.length === 0 &&
    caderno.length === 0 &&
    historico.length === 0;

  return (
    <div className="grid gap-5">
      <Cabecalho />

      {vazia ? (
        <PrimeiroDia />
      ) : (
        <>
          {sessaoAberta ? (
            <EmAndamento sessao={sessaoAberta} rotulosDosTopicos={rotulosDosTopicos} />
          ) : null}

          {sessaoAberta === null && revisoesForaDoPlano.length === 0 && caderno.length === 0 ? (
            <NadaPendente />
          ) : null}

          {revisoesForaDoPlano.length > 0 || caderno.length > 0 ? (
            <div className="grid gap-5 lg:grid-cols-2">
              {revisoesForaDoPlano.length > 0 ? (
                <Revisoes
                  revisoes={revisoesForaDoPlano}
                  rotulosDosTopicos={rotulosDosTopicos}
                  hoje={hoje}
                />
              ) : null}
              {caderno.length > 0 ? (
                <Caderno erros={caderno} rotulosDosTopicos={rotulosDosTopicos} />
              ) : null}
            </div>
          ) : null}

          {historico.length > 0 ? (
            <Historico
              sessoes={historico}
              rotulosDosTopicos={rotulosDosTopicos}
              hoje={hoje}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

function Cabecalho() {
  return (
    <header className="flex flex-col gap-5 border-b border-linha pb-4.5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] text-marca-apoio">
          Prática
        </p>
        <h1 className="mt-3 max-w-[20ch] text-[2.125rem] font-semibold leading-[1.1] tracking-[-0.03em]">
          Questões e revisões
        </h1>
        <p className="mt-3 max-w-[56ch] text-[1.0625rem] leading-relaxed text-suave">
          O que você pode praticar fora do plano de hoje: o que ficou pela metade, o que venceu na
          memória e o que você errou.
        </p>
      </div>
      <Link
        href="/app"
        className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-linha px-4 text-[0.8125rem] font-semibold text-texto no-underline transition-colors duration-150 hover:border-marca/50 hover:text-marca"
      >
        Plano de hoje
        <Seta />
      </Link>
    </header>
  );
}

/**
 * A sessão que ficou aberta. Recebe a marca de foco do plano
 * (`border-marca/40` + anel interno), não o breu: continuar o que estava no
 * meio é o mais urgente **desta** tela, e nada aqui disputa com o `/app`.
 */
function EmAndamento({
  sessao,
  rotulosDosTopicos,
}: {
  sessao: SessaoAberta;
  rotulosDosTopicos: ReadonlyMap<string, RotuloDoTopico>;
}) {
  const pendentes = sessao.nItens - sessao.nRespondidas;
  const antiga = envelheceu(sessao.iniciadaEm);

  return (
    <section
      aria-labelledby="sessao-em-andamento"
      className={`rounded-2xl border px-7 pb-6 pt-5 ${
        antiga
          ? "border-linha bg-painel"
          : "border-marca/40 bg-painel ring-1 ring-inset ring-marca/20"
      }`}
    >
      <p
        className={`font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] ${
          antiga ? "text-suave" : "text-marca"
        }`}
      >
        {antiga ? "Ficou aberta" : "Em andamento"}
      </p>

      <div className="mt-2.5 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <h2 id="sessao-em-andamento" className="text-[1.375rem] font-semibold">
            {antiga
              ? "Uma sessão de outro dia ficou pela metade"
              : "Você parou no meio de uma sessão"}
          </h2>
          <p className="mt-2 font-semibold tracking-[-0.015em]">
            {nomeDoTopico(sessao.topicoId, rotulosDosTopicos)}
          </p>
          <p className="mt-1 font-utilitaria text-[0.8125rem] text-suave">
            {NOMES_DOS_CONTEXTOS[sessao.contexto]} · {sessao.nRespondidas} de {sessao.nItens}{" "}
            respondidas · {pendentes} {pendentes === 1 ? "pendente" : "pendentes"} ·{" "}
            {idadeDaSessao(sessao.iniciadaEm)}
          </p>
          <Trilha resultados={sessao.resultados} />
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-2.5 sm:items-end">
          <Link
            href={`/app/sessao/${encodeURIComponent(sessao.id)}`}
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-marca px-7 font-semibold text-painel no-underline transition-colors duration-150 hover:bg-marca-apoio"
          >
            Retomar
            <Seta />
          </Link>
          {/*
            Descartar só aparece na sessão que envelheceu. Na de hoje seria
            oferecer desistência a quem acabou de sair para o café.
          */}
          {antiga ? (
            <form action={descartarSessao}>
              <input type="hidden" name="sessaoId" value={sessao.id} />
              <button
                type="submit"
                className="inline-flex min-h-10 w-full items-center justify-center rounded-full border border-linha px-4 text-[0.8125rem] font-semibold text-suave transition-colors duration-150 hover:border-marca/50 hover:text-marca"
              >
                Descartar
              </button>
            </form>
          ) : null}
        </div>
      </div>

      {antiga ? (
        <p className="mt-4 text-[0.8125rem] leading-6 text-suave">
          Descartar fecha a sessão sem apagar nada: as{" "}
          {sessao.nRespondidas === 1 ? "resposta que você já deu continua" : `${sessao.nRespondidas} respostas que você já deu continuam`}{" "}
          no seu histórico.
        </p>
      ) : null}
    </section>
  );
}

/**
 * A mesma trilha que a tela de resposta desenha (`tela.tsx`), aqui só como
 * leitura: reconhecer a peça é o que faz "Retomar" parecer continuar, e não
 * recomeçar. Sem botão — navegar por questão é lá dentro.
 */
function Trilha({ resultados }: { resultados: readonly ResultadoDoItem[] }) {
  const materia: Record<ResultadoDoItem, string> = {
    acerto: "bg-marca-viva",
    erro: "bg-erro",
    pendente: "bg-linha",
  };

  return (
    <div
      className="mt-3 grid max-w-[26rem] gap-1"
      style={{ gridTemplateColumns: `repeat(${Math.max(resultados.length, 1)}, minmax(0, 1fr))` }}
      role="img"
      aria-label={`${resultados.filter((item) => item !== "pendente").length} de ${resultados.length} questões respondidas`}
    >
      {resultados.map((resultado, indice) => (
        <span
          key={indice}
          className={`block h-1 w-full rounded-full ${materia[resultado]}`}
        />
      ))}
    </div>
  );
}

function Revisoes({
  revisoes,
  rotulosDosTopicos,
  hoje,
}: {
  revisoes: readonly RevisaoForaDoPlano[];
  rotulosDosTopicos: ReadonlyMap<string, RotuloDoTopico>;
  hoje: string;
}) {
  return (
    <section
      aria-labelledby="revisoes-fora-do-plano"
      className="flex min-w-0 flex-col rounded-2xl border border-linha bg-painel px-6 pb-6 pt-5"
    >
      <p className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] text-conquista">
        Memória
      </p>
      <h2 id="revisoes-fora-do-plano" className="mt-2.5 text-xl font-semibold">
        Venceram e ficaram de fora
      </h2>
      <p className="mt-2 text-sm leading-6 text-suave">
        Revisões que passaram da data e não couberam no plano de hoje. Puxar uma é opcional e não
        altera o mínimo.
      </p>

      <ul className="mt-4">
        {revisoes.map((revisao) => (
          <li
            key={`${revisao.topicoId}:${revisao.due}`}
            className="flex flex-wrap items-center justify-between gap-4 border-t border-linha px-1 py-3.5"
          >
            <div className="min-w-0">
              <p className="font-semibold">{nomeDoTopico(revisao.topicoId, rotulosDosTopicos)}</p>
              <p
                className={`mt-1 font-utilitaria text-[0.8125rem] ${
                  atrasoEmDias(revisao.due, hoje) >= 3 ? "text-erro" : "text-suave"
                }`}
              >
                {textoDoAtraso(revisao.due, hoje)}
              </p>
            </div>
            <Link
              href={`/app/sessao?revisao=${encodeURIComponent(revisao.topicoId)}`}
              className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-linha px-4 text-[0.8125rem] font-semibold text-texto no-underline transition-colors duration-150 hover:border-marca/50 hover:bg-painel hover:text-marca"
            >
              Revisar
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Caderno({
  erros,
  rotulosDosTopicos,
}: {
  erros: readonly ErroDoCaderno[];
  rotulosDosTopicos: ReadonlyMap<string, RotuloDoTopico>;
}) {
  return (
    <section
      aria-labelledby="caderno-de-erros"
      className="flex min-w-0 flex-col rounded-2xl border border-linha bg-painel px-6 pb-6 pt-5"
    >
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] text-aviso">
          Recuperar erro
        </p>
        <Link
          href="/app/progresso"
          className="shrink-0 text-[0.8125rem] font-semibold text-marca underline underline-offset-4"
        >
          Caderno completo
        </Link>
      </div>
      <h2 id="caderno-de-erros" className="mt-2.5 text-xl font-semibold">
        Erros que merecem outra chance
      </h2>
      <p className="mt-2 text-sm leading-6 text-suave">
        Refazer conta como recuperação, e a causa que você marcou é o que decide qual questão volta.
      </p>

      <ul className="mt-4">
        {erros.map((erro) => (
          <li
            key={`${erro.topicoId}:${erro.causa}`}
            className="flex flex-wrap items-center justify-between gap-4 border-t border-linha px-1 py-3.5"
          >
            <div className="min-w-0">
              <p className="font-semibold">{nomeDoTopico(erro.topicoId, rotulosDosTopicos)}</p>
              <p className="mt-1 text-[0.8125rem] text-suave">
                {NOMES_DAS_CAUSAS[erro.causa]} · {erro.nErros}{" "}
                {erro.nErros === 1 ? "erro" : "erros"}
              </p>
            </div>
            <Link
              href={`/app/sessao?refacao=1&topico=${encodeURIComponent(erro.topicoId)}&causa=${encodeURIComponent(erro.causa)}`}
              className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-linha px-4 text-[0.8125rem] font-semibold text-texto no-underline transition-colors duration-150 hover:border-marca/50 hover:bg-painel hover:text-marca"
            >
              Refazer
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Historico({
  sessoes,
  rotulosDosTopicos,
  hoje,
}: {
  sessoes: readonly SessaoDoHistorico[];
  rotulosDosTopicos: ReadonlyMap<string, RotuloDoTopico>;
  hoje: string;
}) {
  const grupos = agruparPorDia(sessoes, hoje);

  return (
    <section
      aria-labelledby="historico-de-sessoes"
      className="rounded-2xl border border-linha bg-painel px-7 pb-6 pt-5"
    >
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <p className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] text-suave">
            Histórico
          </p>
          <h2 id="historico-de-sessoes" className="mt-2.5 text-xl font-semibold">
            Suas sessões
          </h2>
        </div>
        <Link
          href="/app/progresso"
          className="shrink-0 text-[0.8125rem] font-semibold text-marca underline underline-offset-4"
        >
          Relatório no Progresso
        </Link>
      </div>

      {grupos.map((grupo) => (
        <div key={grupo.rotulo}>
          <p className="mt-5 font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] text-suave">
            {grupo.rotulo}
          </p>
          <ul className="mt-2">
            {grupo.sessoes.map((sessao) => (
              <li
                key={sessao.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-linha px-1 py-3.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{nomeDoTopico(sessao.topicoId, rotulosDosTopicos)}</p>
                  <p className="mt-1 text-[0.8125rem] text-suave">
                    {NOMES_DOS_CONTEXTOS[sessao.contexto]}
                  </p>
                </div>
                <p className="shrink-0 font-utilitaria text-[0.8125rem] text-suave">
                  {sessao.nQuestoes} {sessao.nQuestoes === 1 ? "questão" : "questões"} ·{" "}
                  {sessao.nAcertos} {sessao.nAcertos === 1 ? "acerto" : "acertos"}
                </p>
                <Link
                  href={`/app/sessao/${encodeURIComponent(sessao.id)}/resumo`}
                  className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-linha px-4 text-[0.8125rem] font-semibold text-texto no-underline transition-colors duration-150 hover:border-marca/50 hover:bg-painel hover:text-marca"
                >
                  Ver resumo
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

/**
 * Estar em dia é o estado normal de quem segue o plano — não é caso de erro, e
 * por isso ganha verde tênue e não a caixa cinza de vazio. Só aparece quando há
 * histórico: sem ele quem fala é o `PrimeiroDia`.
 */
function NadaPendente() {
  return (
    <section
      aria-labelledby="nada-pendente"
      className="grid gap-7 rounded-2xl border border-marca/30 bg-marca-suave px-7 py-7 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
    >
      <div>
        <p className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] text-marca">
          Nada pendente
        </p>
        <h2 id="nada-pendente" className="mt-2.5 max-w-[26ch] text-[1.375rem] font-semibold">
          Não há sessão aberta, revisão vencida nem erro na fila
        </h2>
        <p className="mt-2.5 max-w-[56ch] leading-relaxed text-suave">
          Nada aqui exige você agora. As revisões voltam sozinhas na data certa — você não precisa
          lembrar delas.
        </p>
      </div>
      <Link
        href="/app"
        className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border border-marca/40 px-6 text-sm font-semibold text-marca no-underline transition-colors duration-150 hover:bg-painel"
      >
        Ir para o plano de hoje
      </Link>
    </section>
  );
}

/** Sem sessão, sem revisão, sem erro e sem histórico: não há o que praticar ainda. */
function PrimeiroDia() {
  return (
    <section
      aria-labelledby="primeiro-dia"
      className="rounded-2xl border border-linha bg-painel px-7 py-7"
      data-estado="vazio"
    >
      <p className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] text-suave">
        Ainda sem prática
      </p>
      <h2 id="primeiro-dia" className="mt-2.5 max-w-[30ch] text-[1.375rem] font-semibold">
        Esta tela enche sozinha conforme você estuda
      </h2>
      <p className="mt-2.5 max-w-[56ch] leading-relaxed text-suave">
        Aqui ficam a sessão que você deixou pela metade, as revisões que vencerem e os erros que
        valem refazer. Comece pelo bloco de hoje.
      </p>
      <Link
        href="/app"
        className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-marca px-6 text-sm font-semibold text-painel no-underline transition-colors duration-150 hover:bg-marca-apoio"
      >
        Ir para o plano de hoje
        <Seta />
      </Link>
    </section>
  );
}

function Seta() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h13m0 0-4.6-4.6M18 12l-4.6 4.6" />
    </svg>
  );
}

function nomeDoTopico(
  topicoId: string | null,
  rotulosDosTopicos: ReadonlyMap<string, RotuloDoTopico>,
): string {
  if (topicoId === null) return "Assuntos misturados";
  return nomeDoRotuloDoTopico(rotulosDosTopicos.get(topicoId)) ?? "Tópico do ciclo";
}

/** Dias inteiros entre a data devida e hoje, no calendário do produto. */
export function atrasoEmDias(due: string, hoje: string): number {
  const devida = Date.parse(`${due}T12:00:00Z`);
  const referencia = Date.parse(`${hoje}T12:00:00Z`);
  if (Number.isNaN(devida) || Number.isNaN(referencia)) return 0;
  return Math.round((referencia - devida) / 86_400_000);
}

export function textoDoAtraso(due: string, hoje: string): string {
  const dias = atrasoEmDias(due, hoje);
  if (dias <= 0) return "Venceu hoje";
  return `Venceu há ${dias} ${dias === 1 ? "dia" : "dias"}`;
}

/**
 * Agrupa por dia do calendário, preservando a ordem que veio do banco. "Hoje" e
 * "Ontem" ganham nome porque é assim que o aluno se refere a eles; do
 * antepenúltimo em diante vira data por extenso.
 */
function agruparPorDia(
  sessoes: readonly SessaoDoHistorico[],
  hoje: string,
): Array<{ rotulo: string; sessoes: SessaoDoHistorico[] }> {
  const grupos: Array<{ rotulo: string; sessoes: SessaoDoHistorico[] }> = [];

  for (const sessao of sessoes) {
    const rotulo = rotuloDoDia(sessao.encerradaEm, hoje);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo !== undefined && ultimo.rotulo === rotulo) {
      ultimo.sessoes.push(sessao);
      continue;
    }
    grupos.push({ rotulo, sessoes: [sessao] });
  }

  return grupos;
}

function rotuloDoDia(encerradaEm: string, hoje: string): string {
  const valor = new Date(encerradaEm);
  if (Number.isNaN(valor.getTime())) return "Data indisponível";

  const dia = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
  }).format(valor);

  if (dia === hoje) return "Hoje";
  if (atrasoEmDias(dia, hoje) === 1) return "Ontem";

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "numeric",
    month: "long",
  }).format(valor);
}
