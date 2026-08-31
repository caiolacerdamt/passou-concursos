"use client";

import { useState } from "react";
import Link from "next/link";

import { Estado } from "@/modules/ui/estado";

import type {
  DadosRaioX,
  FaixaDominio,
  LinhaMateriaRaioX,
  TopicoDaMateria,
  TendenciaRaioX,
} from "./index";
import type { DadosMapaPorMateria, LinhaMateriaMapa } from "./mapa-por-materia";

/*
 * A tela do Raio-X abre pela **matéria** e só desce ao tópico quando o aluno
 * pede.
 *
 * O motivo é de leitura, não de gosto: o edital tem 86 tópicos, e 86 cartões
 * empilhados não são uma leitura — são uma lista que ninguém termina. A
 * matéria é a unidade que o aluno usa para decidir o que estudar hoje; o
 * tópico é o detalhe que ele consulta depois de decidir.
 *
 * É componente de cliente porque abrir e fechar é estado local. Nada de dado
 * pessoal é lido aqui: o servidor entrega o DTO pronto.
 */

function percentual(fracao: number, casas = 1): string {
  return `${(fracao * 100).toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })}%`;
}

function inteiroPercentual(fracao: number): string {
  return `${Math.round(fracao * 100).toLocaleString("pt-BR")}%`;
}

const TENDENCIA_EM_TEXTO: Record<TendenciaRaioX, string> = {
  subindo: "Subindo",
  estavel: "Estável",
  caindo: "Caindo",
};

/**
 * Cor da tendência.
 *
 * `caindo` usa o token de aviso e não o de erro: um assunto que cai menos não
 * é uma falha do aluno nem do sistema, é informação.
 */
const TENDENCIA_EM_COR: Record<TendenciaRaioX, string> = {
  subindo: "text-ok",
  estavel: "text-suave",
  caindo: "text-aviso",
};

const DOMINIO_EM_TEXTO: Record<FaixaDominio, string> = {
  nao_iniciado: "Não iniciado",
  fraco: "Fraco",
  em_desenvolvimento: "Em desenvolvimento",
  forte: "Forte",
  dominado: "Dominado",
};

const NIVEL_EM_TEXTO: Record<LinhaMateriaMapa["nivel"], string> = {
  maior_atencao: "Maior atenção",
  acompanhar: "Acompanhar",
  rotacao: "Rotação",
  sem_projecao: "Sem projeção",
};

const NIVEL_EM_ESTILO: Record<LinhaMateriaMapa["nivel"], string> = {
  maior_atencao: "bg-conquista-fundo text-conquista",
  acompanhar: "bg-marca-suave text-marca",
  rotacao: "bg-fundo-suave text-suave",
  sem_projecao: "bg-fundo-suave text-suave",
};

function dataDaProva(data: string | null): string {
  if (!data) return "Data da prova ainda não definida";
  return `Prova em ${new Date(`${data}T00:00:00Z`).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
  })}`;
}

/** A barra é sempre relativa ao maior peso da tela, nunca a 100%. */
function largura(fracao: number, teto: number): string {
  if (teto <= 0) return "0%";
  return `${Math.min(100, Math.max(0, (fracao / teto) * 100)).toFixed(1)}%`;
}

function Chevron({ aberto }: { aberto: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`size-[1.125rem] shrink-0 transition-transform duration-150 ${
        aberto ? "rotate-180" : ""
      }`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9.5 12 15.5l6-6" />
    </svg>
  );
}

/* ============================================================ CABEÇALHO == */

function Cabecalho({ perfil, nQuestoes }: { perfil: NonNullable<DadosRaioX["perfil"]>; nQuestoes: number }) {
  return (
    <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,24.75rem)] lg:items-end">
      <div className="min-w-0 lg:pt-1.5">
        <p className="font-utilitaria text-xs font-semibold uppercase tracking-[0.16em] text-marca-apoio">
          Raio-X da banca
        </p>
        <h1 className="mt-3.5 max-w-[15ch] text-4xl font-semibold leading-[1.04] tracking-[-0.035em] sm:text-[2.75rem]">
          O que mais cai no seu concurso
        </h1>
        <p className="mt-3.5 max-w-[46ch] text-[1.0625rem] leading-relaxed text-suave">
          A leitura começa pela matéria. Abra uma para ver quais tópicos dela puxam o peso.
        </p>
      </div>

      <div className="rounded-2xl border border-linha bg-painel px-6 pb-6 pt-5">
        <p className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] text-suave">
          Base desta leitura
        </p>
        <p className="mt-2.5 text-xl font-semibold">
          {nQuestoes.toLocaleString("pt-BR")}{" "}
          {nQuestoes === 1 ? "questão real" : "questões reais"}
        </p>
        <p className="mt-2 text-sm leading-6 text-suave">
          {perfil.orgao} ·{" "}
          {perfil.banca === "indefinida" ? "banca ainda não definida" : perfil.banca}. Questão
          inédita nunca entra nesta conta.
        </p>
        <p className="mt-3.5 font-utilitaria text-[0.8125rem] text-suave">
          {dataDaProva(perfil.dataProva)}
        </p>
      </div>
    </section>
  );
}

/* ================================================== O CARTÃO DO MAIOR GANHO */

/**
 * A única superfície de conteúdo escura desta tela (AD-111: um cartão-herói por
 * tela, e um segundo é bug).
 *
 * Ele existe para o Raio-X não ser só leitura: a pergunta que o aluno traz ao
 * abrir esta tela é "por onde eu começo", e a resposta é o cruzamento de peso
 * com fraqueza. Sem o retrato pessoal (o mapa pode falhar sozinho) ele degrada
 * para o fato público — a matéria que mais cai — em vez de sumir.
 */
function MaiorGanho({
  materia,
  doMapa,
}: {
  materia: LinhaMateriaRaioX;
  doMapa: LinhaMateriaMapa | null;
}) {
  const naoIniciados = doMapa ? doMapa.nTopicos - doMapa.nTopicosCobertos : 0;
  const tresMaiores = materia.topicos.slice(0, 3);
  const somaDosTres = tresMaiores.reduce((total, topico) => total + topico.fatia, 0);

  return (
    <section
      aria-labelledby="titulo-maior-ganho"
      className="grid gap-8 rounded-[1.25rem] bg-breu px-9 py-8 text-breu-tinta sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
    >
      <div className="min-w-0">
        <p className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] text-breu-verde">
          {doMapa ? "Onde está seu maior ganho" : "A matéria que mais cai"}
        </p>
        <h2
          id="titulo-maior-ganho"
          className="mt-3.5 max-w-[20ch] text-[2.25rem] font-semibold leading-[1.06] tracking-[-0.035em]"
        >
          {materia.materia}
        </h2>
        <p className="mt-3.5 max-w-[54ch] leading-relaxed text-breu-suave">
          {doMapa
            ? doMapa.motivo
            : "É a maior fatia da prova nas provas reais lidas até aqui."}
          {tresMaiores.length === 3
            ? ` Três tópicos concentram ${percentual(somaDosTres)} sozinhos.`
            : ""}
        </p>
        <p className="mt-5 font-utilitaria text-[0.8125rem] text-breu-suave">
          {percentual(materia.fatia)} da prova
          {doMapa && doMapa.score !== null
            ? ` · seu domínio ${inteiroPercentual(doMapa.score)}`
            : ""}
          {naoIniciados > 0
            ? ` · ${naoIniciados} de ${doMapa!.nTopicos} tópicos ainda não iniciados`
            : ""}
        </p>
      </div>

      <div className="flex shrink-0 flex-col gap-2.5 sm:min-w-[13.5rem]">
        <Link
          href="#materias-por-peso"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-breu-verde px-6 text-[0.9375rem] font-semibold text-breu transition-colors duration-150 hover:bg-breu-tinta"
        >
          Ver os tópicos
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
        </Link>
      </div>
    </section>
  );
}

/* ===================================================== MATÉRIAS POR PESO == */

function TopicoDaLista({ topico, teto }: { topico: TopicoDaMateria; teto: number }) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-2 border-t border-linha py-2.5 sm:grid-cols-[minmax(0,1fr)_11.25rem_7.5rem_4.5rem]">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className="text-[0.9375rem]">{topico.topico}</span>
        {topico.amostraBaixa ? (
          <span className="rounded-lg bg-conquista-fundo px-2 py-0.5 text-[0.6875rem] font-semibold text-conquista">
            Poucas questões
          </span>
        ) : null}
      </div>

      <div
        className="order-last col-span-2 h-1 overflow-hidden rounded-full bg-linha sm:order-none sm:col-span-1"
        aria-hidden="true"
      >
        <div
          style={{ width: largura(topico.fatia, teto) }}
          className="h-full rounded-full bg-marca-viva"
        />
      </div>

      <span className="hidden font-utilitaria text-[0.8125rem] text-suave sm:block">
        {topico.nQuestoes}
      </span>

      <span className="text-right font-utilitaria text-[0.9375rem] font-semibold">
        {percentual(topico.fatia)}
      </span>
    </li>
  );
}

function LinhaDaMateria({
  materia,
  teto,
  aberta,
  aoAlternar,
}: {
  materia: LinhaMateriaRaioX;
  teto: number;
  aberta: boolean;
  aoAlternar: () => void;
}) {
  const painel = `materia-${materia.materiaId}`;
  const tetoDoTopico = materia.topicos[0]?.fatia ?? 0;
  const listados = materia.topicos.length;
  const restantes = materia.nTopicos - listados;

  return (
    <li className="border-t border-linha first:border-t-0">
      <button
        type="button"
        onClick={aoAlternar}
        aria-expanded={aberta}
        aria-controls={painel}
        className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-3 px-5 py-4 text-left transition-colors duration-150 hover:bg-fundo-suave sm:grid-cols-[minmax(0,1fr)_16.25rem_6rem_2rem] sm:px-7 sm:py-4.5 ${
          aberta ? "bg-fundo-suave" : ""
        }`}
      >
        <span className="min-w-0">
          <span className="block truncate text-[1.0625rem] font-semibold tracking-[-0.01em]">
            {materia.materia}
          </span>
          <span className="mt-1.5 block font-utilitaria text-[0.8125rem] text-suave">
            {materia.nTopicos} {materia.nTopicos === 1 ? "tópico" : "tópicos"} ·{" "}
            {materia.nQuestoes} {materia.nQuestoes === 1 ? "questão real" : "questões reais"}
          </span>
        </span>

        <span className="order-last col-span-2 block sm:order-none sm:col-span-1">
          <span className="block h-1.5 overflow-hidden rounded-full bg-linha" aria-hidden="true">
            <span
              style={{ width: largura(materia.fatia, teto) }}
              className={`block h-full rounded-full ${aberta ? "bg-marca" : "bg-marca-viva"}`}
            />
          </span>
          <span
            className={`mt-2 block text-[0.8125rem] ${
              materia.amostraBaixa ? "text-aviso" : TENDENCIA_EM_COR[materia.tendencia]
            }`}
          >
            {materia.amostraBaixa
              ? "Poucas questões reais"
              : TENDENCIA_EM_TEXTO[materia.tendencia]}
          </span>
        </span>

        <span
          className={`text-right font-utilitaria text-2xl font-semibold tracking-[-0.02em] ${
            aberta ? "text-marca" : ""
          }`}
        >
          {percentual(materia.fatia)}
        </span>

        <span className="hidden justify-self-end text-suave sm:block">
          <Chevron aberto={aberta} />
        </span>
      </button>

      {aberta ? (
        <div id={painel} className="border-t border-linha bg-fundo-suave px-5 pb-5 pt-1 sm:px-7">
          <div className="hidden grid-cols-[minmax(0,1fr)_11.25rem_7.5rem_4.5rem] gap-x-6 py-3 font-utilitaria text-[0.6875rem] uppercase tracking-[0.14em] text-suave sm:grid">
            <span>Tópico</span>
            <span>Dentro da matéria</span>
            <span>Questões reais</span>
            <span className="text-right">%</span>
          </div>

          <ul>
            {materia.topicos.map((topico) => (
              <TopicoDaLista key={topico.topicoId} topico={topico} teto={tetoDoTopico} />
            ))}
          </ul>

          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-4 border-t border-linha pt-3.5">
            <p className="text-sm text-suave">
              {restantes > 0
                ? `Mais ${restantes} ${restantes === 1 ? "tópico do edital ainda não tem" : "tópicos do edital ainda não têm"} questão real publicada.`
                : "Todos os tópicos desta matéria estão listados."}
            </p>
            <Link
              href={`/app/sessao?materia=${encodeURIComponent(materia.materiaId)}`}
              className="text-sm font-semibold text-marca underline underline-offset-4"
            >
              Praticar esta matéria
            </Link>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function MateriasPorPeso({ materias }: { materias: LinhaMateriaRaioX[] }) {
  const [aberta, setAberta] = useState<string | null>(
    materias[0]?.materiaId ?? null,
  );
  const teto = materias[0]?.fatia ?? 0;
  const nTopicos = materias.reduce((total, materia) => total + materia.nTopicos, 0);

  return (
    <section aria-labelledby="titulo-materias" id="materias-por-peso" className="scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-linha pb-4.5">
        <div>
          <p className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] text-suave">
            Leitura do edital
          </p>
          <h2
            id="titulo-materias"
            className="mt-3 text-[2.125rem] font-semibold leading-[1.1] tracking-[-0.03em]"
          >
            O peso de cada matéria
          </h2>
        </div>
        <p className="font-utilitaria text-[0.8125rem] text-suave">
          {materias.length} {materias.length === 1 ? "matéria" : "matérias"} · {nTopicos}{" "}
          {nTopicos === 1 ? "tópico" : "tópicos"}
        </p>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-linha bg-painel">
        <div className="hidden grid-cols-[minmax(0,1fr)_16.25rem_6rem_2rem] gap-x-6 px-7 py-3 font-utilitaria text-[0.6875rem] uppercase tracking-[0.14em] text-suave sm:grid">
          <span>Matéria</span>
          <span>Peso na prova</span>
          <span className="text-right">%</span>
          <span />
        </div>

        <ul>
          {materias.map((materia) => (
            <LinhaDaMateria
              key={materia.materiaId}
              materia={materia}
              teto={teto}
              aberta={aberta === materia.materiaId}
              aoAlternar={() =>
                setAberta((atual) => (atual === materia.materiaId ? null : materia.materiaId))
              }
            />
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ================================================= MAPA DE PRIORIDADE == */

function LinhaDoMapa({
  linha,
  teto,
  aberta,
  aoAlternar,
}: {
  linha: LinhaMateriaMapa;
  teto: number;
  aberta: boolean;
  aoAlternar: () => void;
}) {
  const painel = `prioridade-${linha.materiaId}`;
  const dominio =
    linha.score === null
      ? DOMINIO_EM_TEXTO[linha.dominio]
      : `${DOMINIO_EM_TEXTO[linha.dominio]} · ${inteiroPercentual(linha.score)}`;
  const revisao =
    linha.nRevisoesDevidas > 0
      ? `${linha.nRevisoesDevidas} ${linha.nRevisoesDevidas === 1 ? "devida" : "devidas"}`
      : linha.revisao === "em_dia"
        ? "Em dia"
        : "Sem agenda";

  return (
    <li className="border-t border-linha first:border-t-0" data-prioridade={linha.nivel}>
      <button
        type="button"
        onClick={aoAlternar}
        aria-expanded={aberta}
        aria-controls={painel}
        className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5 gap-y-3.5 px-5 py-4 text-left transition-colors duration-150 hover:bg-fundo-suave sm:px-7 lg:grid-cols-[minmax(0,1fr)_9.375rem_9.375rem_6.875rem_8.125rem_2rem] ${
          aberta ? "bg-fundo-suave" : ""
        }`}
      >
        <span className="min-w-0">
          <span className="block truncate font-semibold tracking-[-0.01em]">{linha.materia}</span>
          <span
            className={`mt-1.5 inline-block rounded-lg px-2.5 py-1 text-[0.6875rem] font-semibold ${NIVEL_EM_ESTILO[linha.nivel]}`}
          >
            {NIVEL_EM_TEXTO[linha.nivel]}
          </span>
        </span>

        <span className="order-last col-span-2 block lg:order-none lg:col-span-1">
          <span className="block h-1 overflow-hidden rounded-full bg-linha" aria-hidden="true">
            <span
              style={{ width: largura(linha.fatia, teto) }}
              className="block h-full rounded-full bg-marca"
            />
          </span>
          <span className="mt-2 block font-utilitaria text-[0.8125rem] text-suave">
            {percentual(linha.fatia)} da prova
          </span>
        </span>

        <span className="order-last col-span-2 block lg:order-none lg:col-span-1">
          <span className="block h-1 overflow-hidden rounded-full bg-linha" aria-hidden="true">
            <span
              style={{ width: linha.score === null ? "0%" : inteiroPercentual(linha.score) }}
              className={`block h-full rounded-full ${
                linha.score === null || linha.score < 0.5
                  ? "bg-conquista"
                  : linha.score < 0.7
                    ? "bg-marca-viva"
                    : "bg-ok"
              }`}
            />
          </span>
          <span className="mt-2 block text-[0.8125rem] text-suave">{dominio}</span>
        </span>

        <span className="text-sm text-suave">
          {linha.nTopicosCobertos} de {linha.nTopicos}
        </span>

        <span
          className={`text-sm ${linha.nRevisoesDevidas > 0 ? "text-erro" : "text-suave"}`}
        >
          {revisao}
        </span>

        <span className="hidden justify-self-end text-suave lg:block">
          <Chevron aberto={aberta} />
        </span>
      </button>

      {aberta ? (
        <div id={painel} className="border-t border-linha bg-fundo-suave px-5 pb-5 pt-4 sm:px-7">
          <p className="max-w-[74ch] text-[0.9375rem] leading-6 text-suave">{linha.motivo}</p>

          <ul className="mt-3.5">
            {linha.topicos.map((topico) => (
              <li
                key={topico.topicoId}
                className="grid gap-x-5 gap-y-1 border-t border-linha py-2.5 sm:grid-cols-[minmax(0,1fr)_9.375rem_10.625rem_11.875rem]"
              >
                <span className="text-[0.9375rem]">{topico.topico}</span>
                <span className="font-utilitaria text-[0.8125rem] text-suave">
                  {topico.peso === null ? "Sem projeção" : `${percentual(topico.peso)} bruto`}
                </span>
                <span className="text-sm text-suave">
                  {topico.score === null
                    ? DOMINIO_EM_TEXTO[topico.dominio]
                    : `${DOMINIO_EM_TEXTO[topico.dominio]} · ${inteiroPercentual(topico.score)}`}
                </span>
                <span
                  className={`text-sm ${topico.revisao === "devida" ? "text-erro" : "text-suave"}`}
                >
                  {topico.revisao === "sem_agenda"
                    ? "Sem agenda de revisão"
                    : `Revisão ${topico.revisao === "devida" ? "devida" : "em dia"} · ${new Date(
                        `${topico.due!}T00:00:00Z`,
                      ).toLocaleDateString("pt-BR", { timeZone: "UTC" })}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  );
}

/**
 * O mesmo mapa como imagem.
 *
 * Direita = a banca cobra muito. Baixo = o aluno domina pouco. O quadrante de
 * baixo à direita é onde o estudo rende mais — e é o único pintado, porque
 * destacar os quatro seria não destacar nenhum.
 */
function GraficoDoMapa({ linhas }: { linhas: LinhaMateriaMapa[] }) {
  const teto = Math.max(0.32, ...linhas.map((linha) => linha.fatia));
  const x = (fatia: number) => 64 + (fatia / teto) * 640;
  const y = (score: number | null) => 444 - (score ?? 0) * 420;
  const raio = (nTopicos: number) => Math.min(13, Math.max(6, 5 + nTopicos * 0.5));

  return (
    <div className="mt-4 rounded-2xl border border-linha bg-painel px-6 pb-5 pt-5 sm:px-7">
      <p className="max-w-[74ch] text-[0.9375rem] leading-6 text-suave">
        Quanto mais à direita, mais a banca cobra. Quanto mais abaixo, menos você domina. O canto
        de baixo à direita é onde o estudo rende mais hoje.
      </p>

      <svg viewBox="0 0 760 500" className="mt-4 block w-full" role="img" aria-hidden="true">
        <rect x="314" y="213" width="390" height="231" className="fill-conquista-fundo" />
        <line x1="314" y1="24" x2="314" y2="444" strokeDasharray="4 5" className="stroke-linha" />
        <line x1="64" y1="213" x2="704" y2="213" strokeDasharray="4 5" className="stroke-linha" />
        <line x1="64" y1="444" x2="704" y2="444" strokeWidth="1.5" className="stroke-linha" />
        <line x1="64" y1="24" x2="64" y2="444" strokeWidth="1.5" className="stroke-linha" />

        <text x="330" y="436" fontSize="11" letterSpacing="1.5" className="fill-conquista">
          MAIOR GANHO AGORA
        </text>
        <text x="330" y="42" fontSize="11" letterSpacing="1.5" className="fill-suave">
          SEU PONTO FORTE
        </text>
        <text x="76" y="42" fontSize="11" letterSpacing="1.5" className="fill-suave">
          MANUTENÇÃO
        </text>
        <text x="76" y="436" fontSize="11" letterSpacing="1.5" className="fill-suave">
          PODE ESPERAR
        </text>

        <text x="64" y="466" fontSize="11" className="fill-suave">
          0%
        </text>
        <text x="656" y="466" fontSize="11" className="fill-suave">
          {percentual(teto, 0)}
        </text>
        <text x="64" y="488" fontSize="13" className="fill-texto">
          Peso na prova
        </text>

        <text x="30" y="448" fontSize="11" className="fill-suave">
          0%
        </text>
        <text x="18" y="28" fontSize="11" className="fill-suave">
          100%
        </text>
        <text
          x="14"
          y="250"
          fontSize="13"
          transform="rotate(-90 14 250)"
          textAnchor="middle"
          className="fill-texto"
        >
          Seu domínio
        </text>

        {linhas.map((linha, indice) => {
          const cx = x(linha.fatia);
          const semBase = linha.score === null;
          // O rótulo vira para a esquerda perto da borda direita, senão sai do
          // desenho na matéria que mais cai — justo a mais importante.
          const paraEsquerda = cx > 520;
          return (
            <g key={linha.materiaId}>
              <circle
                cx={cx}
                cy={y(linha.score)}
                r={raio(linha.nTopicos)}
                className={
                  semBase
                    ? "fill-linha stroke-suave"
                    : indice === 0
                      ? "fill-marca"
                      : "fill-marca-viva"
                }
                strokeWidth={semBase ? 1.2 : 0}
              />
              <text
                x={cx + (paraEsquerda ? -(raio(linha.nTopicos) + 8) : raio(linha.nTopicos) + 8)}
                y={y(linha.score) + 5}
                fontSize="14"
                fontWeight={semBase ? 400 : 600}
                textAnchor={paraEsquerda ? "end" : "start"}
                className={semBase ? "fill-suave" : "fill-texto"}
              >
                {linha.materia}
              </text>
            </g>
          );
        })}
      </svg>

      <ul className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-linha pt-3.5 text-[0.8125rem] text-suave">
        <li className="flex items-center gap-2">
          <span className="size-3 rounded-full bg-marca-viva" aria-hidden="true" />O tamanho do
          círculo é o número de tópicos da matéria
        </li>
        <li className="flex items-center gap-2">
          <span className="size-3 rounded-full border border-suave bg-linha" aria-hidden="true" />
          Cinza: você ainda não respondeu nada da matéria
        </li>
      </ul>
    </div>
  );
}

function Aba({
  ativa,
  aoClicar,
  children,
}: {
  ativa: boolean;
  aoClicar: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={ativa}
      onClick={aoClicar}
      className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-4.5 text-sm font-semibold transition-colors duration-150 ${
        ativa
          ? "border-marca bg-marca-suave text-marca"
          : "border-linha bg-painel text-suave hover:border-marca/40 hover:text-marca"
      }`}
    >
      {children}
    </button>
  );
}

function MapaDePrioridade({ mapa }: { mapa: DadosMapaPorMateria | null }) {
  const [aba, setAba] = useState<"tabela" | "grafico">("tabela");
  const [aberta, setAberta] = useState<string | null>(null);

  if (mapa === null) {
    return (
      <section className="border-t border-linha pt-6">
        <Estado tipo="degradado" oQueCaiu="Mapa de Prioridade" />
      </section>
    );
  }

  const teto = Math.max(0, ...mapa.linhas.map((linha) => linha.fatia));

  return (
    <section aria-labelledby="titulo-mapa" className="border-t border-linha pt-8">
      <div className="border-b border-linha pb-4.5">
        <p className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] text-marca">
          Sua atenção
        </p>
        <h2
          id="titulo-mapa"
          className="mt-3 text-[2.125rem] font-semibold leading-[1.1] tracking-[-0.03em]"
        >
          Mapa de Prioridade
        </h2>
        <p className="mt-3 max-w-[66ch] text-[1.0625rem] leading-relaxed text-suave">
          O peso da banca é metade da história. Aqui ele encontra o seu domínio, a parte do edital
          que você já tocou e as revisões vencidas. O plano do dia continua sendo quem decide a
          ordem do estudo.
        </p>
      </div>

      {mapa.linhas.length === 0 ? (
        <div className="mt-5">
          <Estado
            tipo="vazio"
            titulo="Ainda não há matérias para cruzar"
            acao="Quando o programa do edital e suas primeiras respostas existirem, este mapa mostra o que merece sua atenção."
          />
        </div>
      ) : (
        <>
          <div role="tablist" aria-label="Visualização do Mapa de Prioridade" className="mt-5 flex gap-2">
            <Aba ativa={aba === "tabela"} aoClicar={() => setAba("tabela")}>
              <svg
                viewBox="0 0 24 24"
                className="size-[1.0625rem]"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M4 6.5h16M4 12h16M4 17.5h16" />
              </svg>
              Tabela
            </Aba>
            <Aba ativa={aba === "grafico"} aoClicar={() => setAba("grafico")}>
              <svg
                viewBox="0 0 24 24"
                className="size-[1.0625rem]"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 4.5v15h15.5" />
                <circle cx="10" cy="14" r="2.2" />
                <circle cx="16.5" cy="8.5" r="2.2" />
              </svg>
              Gráfico
            </Aba>
          </div>

          {aba === "grafico" ? (
            <GraficoDoMapa linhas={mapa.linhas} />
          ) : (
            <div className="mt-4 overflow-hidden rounded-2xl border border-linha bg-painel">
              <div className="hidden grid-cols-[minmax(0,1fr)_9.375rem_9.375rem_6.875rem_8.125rem_2rem] gap-x-5 px-7 py-3 font-utilitaria text-[0.6875rem] uppercase tracking-[0.14em] text-suave lg:grid">
                <span>Matéria</span>
                <span>Peso da banca</span>
                <span>Seu domínio</span>
                <span>Cobertura</span>
                <span>Revisão</span>
                <span />
              </div>

              <ul>
                {mapa.linhas.map((linha) => (
                  <LinhaDoMapa
                    key={linha.materiaId}
                    linha={linha}
                    teto={teto}
                    aberta={aberta === linha.materiaId}
                    aoAlternar={() =>
                      setAberta((atual) =>
                        atual === linha.materiaId ? null : linha.materiaId,
                      )
                    }
                  />
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <p className="mt-4.5 max-w-[78ch] text-sm leading-6 text-suave">
        O peso vem só de prova real, com ano recente valendo mais. Matéria com poucas questões
        aparece marcada e não vira prioridade por coincidência.
      </p>
    </section>
  );
}

/* ============================================================== A TELA == */

export function RaioXTela({
  dados,
  mapa,
}: {
  dados: DadosRaioX;
  /** Omitido nas chamadas antigas; `null` significa falha pessoal nomeada. */
  mapa?: DadosMapaPorMateria | null;
}) {
  if (!dados.perfil) {
    return (
      <Estado
        tipo="vazio"
        titulo="Seu perfil de concurso ainda não está configurado"
        acao="Quando o edital estiver cadastrado, o Raio-X mostrará as matérias que mais aparecem nas provas reais."
      />
    );
  }

  if (dados.materias.length === 0) {
    return (
      <div className="space-y-10">
        <Cabecalho perfil={dados.perfil} nQuestoes={0} />
        <Estado
          tipo="vazio"
          titulo="O programa ainda não tem questões publicadas"
          acao="O Raio-X aparece assim que houver questões reais publicadas para os tópicos do edital."
        />
      </div>
    );
  }

  const nQuestoes = dados.materias.reduce(
    (total, materia) => total + materia.nQuestoes,
    0,
  );
  const primeiraDoMapa = mapa?.linhas[0] ?? null;
  const destaque =
    dados.materias.find((materia) => materia.materiaId === primeiraDoMapa?.materiaId) ??
    dados.materias[0];

  return (
    <div className="space-y-10">
      <Cabecalho perfil={dados.perfil} nQuestoes={nQuestoes} />
      <MaiorGanho
        materia={destaque}
        doMapa={destaque.materiaId === primeiraDoMapa?.materiaId ? primeiraDoMapa : null}
      />
      <MateriasPorPeso materias={dados.materias} />
      {mapa !== undefined ? <MapaDePrioridade mapa={mapa} /> : null}
    </div>
  );
}
