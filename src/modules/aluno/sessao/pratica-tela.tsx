import Link from "next/link";

import { descartarSessao } from "@/app/app/sessao/acoes";

import { NOMES_DAS_CAUSAS } from "../progresso";
import { nomeDoRotuloDoTopico, type RotuloDoTopico } from "../rotulo-do-topico";
import type { Contexto } from "../tentativas";
import { ListaComTeto } from "./lista-com-teto";
import {
  SESSOES_NO_HISTORICO,
  type DadosDaPratica,
  type ErroDoCaderno,
  type ResultadoDoItem,
  type RevisaoForaDoPlano,
  type SessaoAberta,
  type SessaoDoHistorico,
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
  const { sessaoAberta, revisoesForaDoPlano, totalDeRevisoes, caderno, totalNoCaderno, historico } =
    dados;
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
                  total={totalDeRevisoes}
                  rotulosDosTopicos={rotulosDosTopicos}
                  hoje={hoje}
                />
              ) : null}
              {caderno.length > 0 ? (
                <Caderno
                  erros={caderno}
                  total={totalNoCaderno}
                  rotulosDosTopicos={rotulosDosTopicos}
                />
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
 * A sessão que ficou aberta — o único cartão desta tela com fundo tingido
 * (AD-117).
 *
 * Antes os dois estados usavam o mesmo `bg-painel` dos blocos comuns e só a
 * borda mudava, o que some a um braço de distância. Agora o fundo carrega o
 * estado: **verde tênue** enquanto a sessão é de hoje ("isto está andando") e
 * **ouro tênue** depois de envelhecer ("isto esfriou e espera uma decisão").
 * Vermelho fica de fora de propósito — sessão parada não é erro.
 *
 * Continua sem breu: o AD-111 reserva esse tratamento ao próximo bloco em
 * `/app`, um por tela.
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
        antiga ? "border-ouro/45 bg-conquista-fundo" : "border-marca/30 bg-marca-suave"
      }`}
    >
      <p
        className={`font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] ${
          antiga ? "text-conquista" : "text-marca"
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
          {/*
            `bg-linha` é calibrado contra o papel branco do painel: sobre fundo
            tingido ele quase desaparece. A tinta a 20% escurece o suficiente
            nos dois fundos sem virar mais um token.
          */}
          <Trilha
            resultados={sessao.resultados}
            tomPendente={antiga ? "bg-conquista/25" : "bg-marca/20"}
          />
        </div>

        <Link
          href={`/app/sessao/${encodeURIComponent(sessao.id)}`}
          className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-marca px-7 font-semibold text-painel no-underline transition-colors duration-150 hover:bg-marca-apoio"
        >
          Retomar
          <Seta />
        </Link>
      </div>

      {/*
        Descartar só aparece na sessão que envelheceu — na de hoje seria oferecer
        desistência a quem acabou de sair para o café — e aparece **como link
        dentro da frase que já explicava o que ele faz**, não como segunda
        pílula. Duas pílulas de alturas e corpos diferentes empilhadas no canto
        liam como dois botões brigando; aqui a explicação e a ação são a mesma
        linha, no vocabulário de link que o resto da tela já usa.
      */}
      {antiga ? (
        <form action={descartarSessao} className="mt-4 border-t border-ouro/30 pt-3.5">
          <input type="hidden" name="sessaoId" value={sessao.id} />
          <p className="text-[0.8125rem] leading-6 text-suave">
            Não vai voltar a esta?{" "}
            <button
              type="submit"
              className="font-semibold text-suave underline underline-offset-2 transition-colors duration-150 hover:text-marca"
            >
              Descartar a sessão
            </button>{" "}
            — fecha sem apagar nada: as{" "}
            {sessao.nRespondidas === 1
              ? "resposta que você já deu continua"
              : `${sessao.nRespondidas} respostas que você já deu continuam`}{" "}
            no seu histórico.
          </p>
        </form>
      ) : null}
    </section>
  );
}

/**
 * A mesma trilha que a tela de resposta desenha (`tela.tsx`), aqui só como
 * leitura: reconhecer a peça é o que faz "Retomar" parecer continuar, e não
 * recomeçar. Sem botão — navegar por questão é lá dentro.
 */
function Trilha({
  resultados,
  tomPendente = "bg-linha",
}: {
  resultados: readonly ResultadoDoItem[];
  /** O cinza da barra pendente muda com o fundo do cartão — ver `EmAndamento`. */
  tomPendente?: string;
}) {
  const materia: Record<ResultadoDoItem, string> = {
    acerto: "bg-marca-viva",
    erro: "bg-erro",
    pendente: tomPendente,
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
  total,
  rotulosDosTopicos,
  hoje,
}: {
  revisoes: readonly RevisaoForaDoPlano[];
  total: number;
  rotulosDosTopicos: ReadonlyMap<string, RotuloDoTopico>;
  hoje: string;
}) {
  return (
    <section
      aria-labelledby="revisoes-fora-do-plano"
      className="flex min-w-0 flex-col rounded-2xl border border-linha bg-painel px-6 pb-3 pt-5"
    >
      {/*
        O total no olho do bloco. Sem ele o corte mente: quatro linhas visíveis
        parecem quatro revisões na fila. Só entra acima do primeiro corte — em
        cima de três itens seria ruído.
      */}
      <p className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] text-conquista">
        Memória
        {total > 4 ? <span className="text-suave">{` · ${total}`}</span> : null}
      </p>
      <h2 id="revisoes-fora-do-plano" className="mt-2.5 text-xl font-semibold">
        Venceram e ficaram de fora
      </h2>
      <p className="mt-2 text-sm leading-6 text-suave">
        Revisões que passaram da data e não couberam no plano de hoje. Puxar uma é opcional e não
        altera o mínimo.
      </p>

      <ListaComTeto
        total={total}
        hrefDoResto="/app/progresso"
        rotuloDoResto={`Ver as ${total - revisoes.length} restantes no Progresso`}
        nomeDosItens="revisões"
        itens={revisoes.map((revisao) => (
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
      />
    </section>
  );
}

function Caderno({
  erros,
  total,
  rotulosDosTopicos,
}: {
  erros: readonly ErroDoCaderno[];
  total: number;
  rotulosDosTopicos: ReadonlyMap<string, RotuloDoTopico>;
}) {
  return (
    <section
      aria-labelledby="caderno-de-erros"
      className="flex min-w-0 flex-col rounded-2xl border border-linha bg-painel px-6 pb-3 pt-5"
    >
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] text-aviso">
          Recuperar erro
          {total > 4 ? <span className="text-suave">{` · ${total}`}</span> : null}
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

      <ListaComTeto
        total={total}
        hrefDoResto="/app/progresso"
        rotuloDoResto={`Ver os ${total - erros.length} restantes no Caderno completo`}
        nomeDosItens="erros"
        itens={erros.map((erro) => (
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
      />
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

      {/*
        O histórico não ganha "Mostrar mais": ele já nasce cortado em
        `SESSOES_NO_HISTORICO`, e um botão que abrisse mais não teria o que
        abrir. Quando o corte está valendo, a tela diz isso em vez de deixar o
        aluno achar que estudou só doze vezes na vida.
      */}
      {sessoes.length >= SESSOES_NO_HISTORICO ? (
        <p className="mt-4 border-t border-linha px-1 pt-3.5 text-[0.8125rem] leading-6 text-suave">
          Aqui ficam as suas {SESSOES_NO_HISTORICO} sessões mais recentes. O resto está no{" "}
          <Link href="/app/progresso" className="font-semibold text-marca underline underline-offset-2">
            relatório do Progresso
          </Link>
          .
        </p>
      ) : null}
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
