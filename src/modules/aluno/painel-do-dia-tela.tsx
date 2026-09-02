import Link from "next/link";

import type {
  DadosGamificacao,
  DimensaoDoAnel,
  MissaoDoDia,
} from "./gamificacao";
import type { ContagemDaProva, PainelDoDia } from "./painel-do-dia";
import {
  NOMES_DAS_CAUSAS,
  type DiaDaSemanaDoProgresso,
  type LinhaCaderno,
  type RelatorioSemanal,
} from "./progresso";
import { TrajetoriaEmUmaLinha } from "./trajetoria-tela";

const TENDENCIA_EM_TEXTO = {
  subindo: "Subindo",
  estavel: "Estável",
  caindo: "Caindo",
  sem_base: "Sem base",
} as const;

const MISSAO_EM_TEXTO: Record<MissaoDoDia["tipo"], string> = {
  concluir_piso: "Concluir o mínimo de hoje",
  responder_questoes: "Responder questões hoje",
  sem_plano: "Sem plano hoje; a missão volta no próximo dia da sua agenda",
};

const ESTADO_DA_MISSAO_EM_TEXTO: Record<MissaoDoDia["estado"], string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  indisponivel: "Indisponível",
};

/**
 * Perímetro do anel de 17,5 de raio, arredondado.
 *
 * O SVG desenha o progresso como `stroke-dashoffset` sobre esse total. Fica
 * como constante porque o raio e o número precisam concordar: mudar um sem o
 * outro faz o anel fechar cedo ou nunca fechar, e nada avisa.
 */
const PERIMETRO_DO_ANEL = 110;

function dataCurta(data: string): string {
  const valor = new Date(`${data}T00:00:00Z`);
  if (Number.isNaN(valor.getTime())) return data;
  return valor.toLocaleDateString("pt-BR", { timeZone: "UTC", dateStyle: "long" });
}

function diaDaSemanaCurto(data: string): string {
  const valor = new Date(`${data}T00:00:00Z`);
  if (Number.isNaN(valor.getTime())) return "";
  const nome = valor.toLocaleDateString("pt-BR", { timeZone: "UTC", weekday: "short" });
  return nome.replace(".", "").slice(0, 3);
}

function percentualOpcional(valor: number | null): string {
  if (valor === null) return "Sem base";
  return `${Math.round(valor * 100).toLocaleString("pt-BR")}%`;
}

/* ======================================================== O CARTÃO DO DIA == */

type EstadoDoCartao = "pendente" | "em_andamento" | "concluido";

/**
 * O estado sai do fato, não de um enum novo: a missão já diz se o dia fechou,
 * e o anel já diz se ele começou. Inventar um terceiro estado aqui seria
 * inventar número.
 */
function estadoDoCartao(dados: DadosGamificacao): EstadoDoCartao {
  if (dados.missao?.estado === "concluida") return "concluido";
  if (dados.sequencia?.estado === "cumprido") return "concluido";

  const dimensoes = [dados.anel.estudo, dados.anel.questoes, dados.anel.revisao];
  const comecou = dimensoes.some((dimensao) => dimensao.progresso > 0);
  return comecou ? "em_andamento" : "pendente";
}

const MATERIA_DO_CARTAO: Record<
  EstadoDoCartao,
  { caixa: string; rotulo: string; titulo: string; divisor: string }
> = {
  pendente: {
    caixa: "border-linha bg-painel",
    rotulo: "text-suave",
    titulo: "O dia ainda não começou",
    divisor: "border-linha",
  },
  em_andamento: {
    caixa: "border-marca/40 bg-painel",
    rotulo: "text-marca",
    titulo: "Você está no meio do dia",
    divisor: "border-linha",
  },
  concluido: {
    caixa: "border-marca/35 bg-marca-suave",
    rotulo: "text-marca",
    titulo: "Dia cumprido",
    divisor: "border-marca/25",
  },
};

function Anel({ nome, dimensao }: { nome: string; dimensao: DimensaoDoAnel }) {
  const fracao = Math.max(0, Math.min(1, dimensao.percentual));
  const resto = PERIMETRO_DO_ANEL - fracao * PERIMETRO_DO_ANEL;
  const pisoFracao = dimensao.meta === 0 ? 0 : Math.max(0, Math.min(1, dimensao.pisoMeta / dimensao.meta));
  const deslocamentoDoPiso = pisoFracao * PERIMETRO_DO_ANEL;
  const anguloDoPiso = (deslocamentoDoPiso / PERIMETRO_DO_ANEL) * 2 * Math.PI - Math.PI / 2;
  const xInterno = 22 + Math.cos(anguloDoPiso) * 14.5;
  const yInterno = 22 + Math.sin(anguloDoPiso) * 14.5;
  const xExterno = 22 + Math.cos(anguloDoPiso) * 20.5;
  const yExterno = 22 + Math.sin(anguloDoPiso) * 20.5;
  const mostraMarcacao = dimensao.pisoMeta > 0 && dimensao.pisoMeta < dimensao.meta;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 44 44" className="size-12" aria-hidden="true">
        <circle cx="22" cy="22" r="17.5" fill="none" stroke="currentColor" strokeWidth="5" className="text-linha" />
        <circle
          cx="22"
          cy="22"
          r="17.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={PERIMETRO_DO_ANEL}
          strokeDashoffset={resto}
          transform="rotate(-90 22 22)"
          className={dimensao.concluido ? "text-ok" : "text-marca"}
        />
        {mostraMarcacao ? (
          <line
            data-piso-marcacao="true"
            x1={xInterno}
            y1={yInterno}
            x2={xExterno}
            y2={yExterno}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="text-suave"
          />
        ) : null}
      </svg>
      <span className="text-xs text-suave">{nome}</span>
      <span className="-mt-1 font-utilitaria text-[0.8125rem] font-semibold">
        {dimensao.progresso}/{dimensao.meta}
      </span>
    </div>
  );
}

/**
 * A leitura de estado do dia, no alto da tela — onde antes ficava o bloco
 * "Estado atual". Blocos, questões e revisão contam separado; o anel fecha com
 * o mínimo do plano, não com volume.
 */
export function CartaoDoDia({ dados }: { dados: DadosGamificacao }) {
  const estado = estadoDoCartao(dados);
  const materia = MATERIA_DO_CARTAO[estado];

  return (
    <section
      aria-labelledby="titulo-seu-dia"
      className={`rounded-2xl border px-6 pb-6 pt-5 ${materia.caixa}`}
    >
      <p className={`font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] ${materia.rotulo}`}>
        Seu dia
      </p>

      <h2 id="titulo-seu-dia" className="mt-2 text-xl font-semibold">
        {materia.titulo}
      </h2>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <Anel nome="Blocos" dimensao={dados.anel.estudo} />
        <Anel nome="Questões" dimensao={dados.anel.questoes} />
        <Anel nome="Revisão" dimensao={dados.anel.revisao} />
      </div>

      <div className={`mt-5 border-t pt-4 ${materia.divisor}`}>
        {dados.missao ? (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[0.8125rem] text-suave">Missão de hoje</span>
              <span
                className={`rounded-lg px-2.5 py-1 text-[0.6875rem] font-semibold ${
                  dados.missao.estado === "concluida"
                    ? "bg-ok/15 text-ok"
                    : dados.missao.estado === "em_andamento"
                      ? "bg-marca-suave text-marca"
                      : "bg-fundo-suave text-suave"
                }`}
              >
                {ESTADO_DA_MISSAO_EM_TEXTO[dados.missao.estado]}
              </span>
            </div>
            <p className="mt-1.5 leading-6">
              {dados.missao.tipo === "concluir_piso" ? (
                <Link
                  href="#nivel-minimo"
                  className="font-semibold text-marca underline underline-offset-4"
                >
                  {MISSAO_EM_TEXTO[dados.missao.tipo]}
                </Link>
              ) : (
                MISSAO_EM_TEXTO[dados.missao.tipo]
              )}
            </p>
            <p className="mt-1 font-utilitaria text-xs text-suave">
              {dados.missao.progresso} de {dados.missao.meta}
            </p>
          </>
        ) : (
          <p className="text-[0.8125rem] leading-6 text-suave">
            {dados.pontos.dia} {dados.pontos.dia === 1 ? "ponto hoje" : "pontos hoje"}.{" "}
            <Link className="font-semibold text-marca underline" href="/app/progresso">
              Ver no Progresso
            </Link>
          </p>
        )}
      </div>
    </section>
  );
}

/* ====================================================== ACOMPANHAMENTO == */

function textoDaContagem(contagem: ContagemDaProva): string {
  if (contagem.estado === "indefinida") return "Data da prova ainda não definida";
  if (contagem.estado === "hoje") return "A prova é hoje";
  if (contagem.estado === "passada") return "A data da prova já passou";
  const dias = contagem.dias ?? 0;
  return `${dias.toLocaleString("pt-BR")} ${dias === 1 ? "dia" : "dias"} para a prova`;
}

function ContagemDaProvaCartao({ contagem }: { contagem: ContagemDaProva }) {
  const contando = contagem.estado === "futura" && contagem.dias !== null;

  return (
    <section
      aria-labelledby="titulo-contagem-da-prova"
      className="flex flex-col rounded-2xl border border-linha bg-painel px-6 pb-6 pt-5"
    >
      <p className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] text-suave">
        Data da prova
      </p>

      {contando ? (
        <p className="mt-4 flex items-baseline gap-2.5">
          <span className="font-utilitaria text-6xl font-semibold leading-none tracking-[-0.045em]">
            {contagem.dias}
          </span>
          <span className="text-lg text-suave">{contagem.dias === 1 ? "dia" : "dias"}</span>
        </p>
      ) : (
        <h2 id="titulo-contagem-da-prova" className="mt-4 text-xl font-semibold leading-snug">
          {textoDaContagem(contagem)}
        </h2>
      )}

      {contando ? (
        <h2 id="titulo-contagem-da-prova" className="sr-only">
          {textoDaContagem(contagem)}
        </h2>
      ) : null}

      <p className="mt-3 text-sm leading-6 text-suave">
        {contagem.dataProva === null
          ? "Assim que a data oficial entrar no seu concurso, a contagem aparece aqui. Nada é estimado."
          : `Prova em ${dataCurta(contagem.dataProva)}.`}
      </p>

      {contagem.dataProva === null ? <CalendarioSemData /> : null}

      <Link
        href="/app/raio-x"
        className="mt-auto pt-6 text-sm font-semibold text-marca underline underline-offset-4"
      >
        Ver o Raio-X do que mais cai
      </Link>
    </section>
  );
}

function CalendarioSemData() {
  return (
    <div
      aria-hidden="true"
      className="flex min-h-24 flex-1 items-center justify-center py-4"
    >
      <style>{`
        @keyframes painel-calendario-flutua {
          0%, 100% {
            opacity: 0.55;
            transform: translate(0, 0);
          }
          25% {
            opacity: 0.85;
            transform: translate(18px, 0);
          }
          50% {
            opacity: 0.7;
            transform: translate(30px, 12px);
          }
          75% {
            opacity: 0.9;
            transform: translate(15px, 12px);
          }
        }

        .painel-calendario-flutua {
          animation: painel-calendario-flutua 5s ease-in-out infinite;
          transform-box: fill-box;
          transform-origin: center;
        }

        @media (prefers-reduced-motion: reduce) {
          .painel-calendario-flutua {
            animation: none;
          }
        }
      `}</style>
      <svg viewBox="0 0 112 64" className="h-16 w-40 text-linha" fill="none">
        <rect x="12" y="8" width="88" height="48" rx="7" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M12 22h88M28 4v8M84 4v8"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <g className="painel-calendario-flutua">
          <rect x="38" y="28" width="12" height="10" rx="2" fill="currentColor" className="text-suave" />
        </g>
      </svg>
    </div>
  );
}

function ColunaDoDia({ dia, ultimo, teto }: { dia: DiaDaSemanaDoProgresso; ultimo: boolean; teto: number }) {
  // Piso de 4px: um dia sem questão precisa continuar sendo uma coluna visível,
  // senão a semana ganha um buraco que lê como falha de carregamento.
  const altura = teto === 0 ? 4 : Math.max(4, Math.round((dia.questoes / teto) * 76));

  return (
    <div className="flex h-full flex-col items-center justify-end gap-2.5">
      <span className="font-utilitaria text-[0.6875rem] text-suave">
        {dia.questoes === 0 ? "–" : dia.questoes}
      </span>
      <div
        style={{ height: `${altura}px` }}
        className={`w-full rounded-lg ${
          dia.questoes === 0 ? "bg-linha" : ultimo ? "bg-marca" : "bg-marca-viva"
        }`}
      />
      <span
        className={`text-[0.6875rem] uppercase tracking-wide ${ultimo ? "font-semibold text-texto" : "text-suave"}`}
      >
        {diaDaSemanaCurto(dia.data)}
      </span>
    </div>
  );
}

function ResumoDaSemana({ relatorio }: { relatorio: RelatorioSemanal }) {
  const teto = relatorio.porDia.reduce((maior, dia) => Math.max(maior, dia.questoes), 0);

  return (
    <section
      aria-labelledby="titulo-resumo-da-semana"
      className="rounded-2xl border border-linha bg-painel px-7 pb-7 pt-6"
    >
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h2 id="titulo-resumo-da-semana" className="text-[1.375rem] font-semibold">
            Sua semana até aqui
          </h2>
        </div>
        {relatorio.tendencia !== "sem_base" ? (
          <span className="shrink-0 rounded-lg bg-marca-suave px-2.5 py-1.5 text-xs font-semibold text-marca">
            Tendência: {TENDENCIA_EM_TEXTO[relatorio.tendencia]}
          </span>
        ) : null}
      </div>

      {relatorio.porDia.length > 0 ? (
        <div className="mt-6 grid h-[118px] grid-cols-7 items-end gap-2.5" aria-hidden="true">
          {relatorio.porDia.map((dia, indice) => (
            <ColunaDoDia
              key={dia.data}
              dia={dia}
              ultimo={indice === relatorio.porDia.length - 1}
              teto={teto}
            />
          ))}
        </div>
      ) : null}

      <dl className="mt-6 grid grid-cols-2 gap-5 border-t border-linha pt-5 sm:grid-cols-4">
        <div>
          <dt className="text-xs text-suave">Questões</dt>
          <dd className="mt-1.5 font-utilitaria text-2xl font-semibold tracking-[-0.02em]">
            {relatorio.questoesRespondidas}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-suave">Acertos</dt>
          <dd className="mt-1.5 font-utilitaria text-2xl font-semibold tracking-[-0.02em]">
            {relatorio.acertos}{" "}
            <span className="text-[0.9375rem] font-medium text-marca-apoio">
              {percentualOpcional(relatorio.percentualAcertos)}
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-suave">Assuntos</dt>
          <dd className="mt-1.5 font-utilitaria text-2xl font-semibold tracking-[-0.02em]">
            {relatorio.topicosTocados}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-suave">Revisões</dt>
          <dd className="mt-1.5 font-utilitaria text-2xl font-semibold tracking-[-0.02em]">
            {relatorio.revisoesConcluidas}
          </dd>
        </div>
      </dl>

      <p className="mt-5 text-sm">
        <Link className="font-semibold text-marca underline underline-offset-4" href="/app/progresso">
          Ver o relatório completo no Progresso
        </Link>
      </p>
    </section>
  );
}

function Recuperacao({ erros }: { erros: readonly LinhaCaderno[] }) {
  return (
    <section
      aria-labelledby="titulo-recuperacao"
      className="rounded-2xl border border-linha bg-painel px-7 pb-7 pt-6"
    >
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <p className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] text-aviso">
            Recuperar erro
          </p>
          <h2 id="titulo-recuperacao" className="mt-2.5 text-[1.375rem] font-semibold">
            Erros que merecem outra chance
          </h2>
        </div>
        <Link
          href="/app/progresso"
          className="shrink-0 text-[0.8125rem] font-semibold text-marca underline underline-offset-4"
        >
          Caderno completo
        </Link>
      </div>
      <p className="mt-2 max-w-[62ch] text-sm leading-6 text-suave">
        Refazer um erro conta como recuperação e não substitui o plano de hoje.
      </p>

      <ul className="mt-5" aria-label="Erros para refazer">
        {erros.map((linha) => (
          <li
            key={`${linha.topicoId}-${linha.causa}`}
            className="flex flex-wrap items-center justify-between gap-4 border-t border-linha px-1 py-3.5"
          >
            <div className="min-w-0">
              <p className="font-semibold">{linha.topico}</p>
              <p className="mt-1 text-[0.8125rem] text-suave">
                {NOMES_DAS_CAUSAS[linha.causa]} · {linha.nErros} {linha.nErros === 1 ? "erro" : "erros"}
              </p>
            </div>
            <Link
              href={`/app/sessao?refacao=1&topico=${encodeURIComponent(linha.topicoId)}&causa=${encodeURIComponent(linha.causa)}`}
              className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-linha px-4 text-[0.8125rem] font-semibold text-texto transition-colors duration-150 hover:border-marca/50 hover:bg-painel hover:text-marca"
            >
              Refazer
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * O acompanhamento, abaixo do estudo de hoje: a semana ocupa a largura e a
 * contagem da prova fica ao lado, menor. Cada peça só aparece quando existe
 * fato para mostrar; nada aqui inventa número.
 */
export function AcompanhamentoDoDia({ painel }: { painel: PainelDoDia }) {
  return (
    <div className="grid gap-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.62fr)_minmax(0,1fr)]">
        {painel.relatorioSemanal ? <ResumoDaSemana relatorio={painel.relatorioSemanal} /> : null}
        <ContagemDaProvaCartao contagem={painel.contagem} />
      </div>

      {/*
        Uma linha só, clicável, e nada mais: Hoje é a tela do próximo bloco e
        não pode virar painel. O desenho inteiro da cobertura vive no Progresso.
      */}
      {painel.trajetoria ? <TrajetoriaEmUmaLinha trajetoria={painel.trajetoria} /> : null}

      {painel.recuperacao.length > 0 ? <Recuperacao erros={painel.recuperacao} /> : null}

      {painel.acompanhamentoIndisponivel ? (
        <p className="rounded-2xl border border-linha bg-painel px-6 py-5 text-sm leading-6 text-suave">
          Não foi possível carregar seu acompanhamento agora. Seu histórico continua registrado; tente recarregar em
          instantes.
        </p>
      ) : null}
    </div>
  );
}

/**
 * Recorte da gamificação que pertence ao Progresso: de onde vieram os pontos e
 * quais conquistas pessoais já foram desbloqueadas.
 */
export function GamificacaoNoProgresso({ dados }: { dados: DadosGamificacao }) {
  const discriminacao = [
    { rotulo: "Estudo prioritário", valor: dados.pontos.discriminacao.estudoPrioritario },
    { rotulo: "Conclusão de bloco", valor: dados.pontos.discriminacao.conclusao },
    { rotulo: "Revisão no prazo", valor: dados.pontos.discriminacao.revisaoNoPrazo },
    { rotulo: "Recuperação de erro", valor: dados.pontos.discriminacao.recuperacaoErro },
  ];

  return (
    <section
      aria-labelledby="titulo-gamificacao-progresso"
      className="rounded-2xl border border-linha bg-painel px-7 pb-7 pt-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] text-evolucao">
            Seu esforço reconhecido
          </p>
          <h2 id="titulo-gamificacao-progresso" className="mt-2.5 text-[1.375rem] font-semibold">
            Pontos e conquistas
          </h2>
          <p className="mt-2 max-w-2xl leading-7 text-suave">
            Ponto vem de estudo prioritário, conclusão, revisão no prazo e erro recuperado. Não existe ranking nem
            comparação.
          </p>
        </div>
        <span className="shrink-0 rounded-lg bg-marca-suave px-2.5 py-1.5 text-xs font-semibold text-marca">
          {dados.pontos.total} no total
        </span>
      </div>

      <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {discriminacao.map((linha) => (
          <div key={linha.rotulo} className="rounded-xl border border-linha bg-fundo p-3">
            <dt className="text-sm text-suave">{linha.rotulo}</dt>
            <dd className="mt-1 font-utilitaria text-2xl font-semibold">{linha.valor}</dd>
          </div>
        ))}
      </dl>

      <ul className="mt-5 grid gap-3 sm:grid-cols-2" aria-label="Conquistas pessoais">
        {dados.conquistas.map((conquista) => (
          <li key={conquista.id} className="rounded-xl border border-linha bg-fundo p-3">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold">{conquista.titulo}</h3>
              <span className="shrink-0 text-xs font-semibold text-suave">
                {conquista.desbloqueada ? "Desbloqueada" : "Ainda não"}
              </span>
            </div>
            <p className="mt-1 text-sm text-suave">{conquista.descricao}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
