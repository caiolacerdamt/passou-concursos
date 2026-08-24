import Link from "next/link";

import type {
  DadosGamificacao,
  DimensaoDoAnel,
  MissaoDoDia,
  SequenciaVigente,
} from "./gamificacao";
import type { ContagemDaProva, PainelDoDia } from "./painel-do-dia";
import { NOMES_DAS_CAUSAS, type LinhaCaderno, type RelatorioSemanal } from "./progresso";

const TENDENCIA_EM_TEXTO = {
  subindo: "Subindo",
  estavel: "Estável",
  caindo: "Caindo",
  sem_base: "Sem base",
} as const;

const MISSAO_EM_TEXTO: Record<MissaoDoDia["tipo"], string> = {
  concluir_piso: "Concluir o essencial de hoje",
  responder_questoes: "Responder questões hoje",
  sem_plano: "Sem plano hoje; a missão volta no próximo dia da sua agenda",
};

const ESTADO_DA_MISSAO_EM_TEXTO: Record<MissaoDoDia["estado"], string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  indisponivel: "Indisponível",
};

const ESTADO_DA_SEQUENCIA_EM_TEXTO: Record<SequenciaVigente["estado"], string> = {
  cumprido: "Dia cumprido",
  piso_pendente: "Essencial de hoje pendente",
  fora_agenda: "Hoje está fora da sua agenda",
  folga: "Folga declarada",
  plano_indisponivel: "Plano em preparação",
};

function dataCurta(data: string): string {
  const valor = new Date(`${data}T00:00:00Z`);
  if (Number.isNaN(valor.getTime())) return data;
  return valor.toLocaleDateString("pt-BR", { timeZone: "UTC", dateStyle: "medium" });
}

function percentualOpcional(valor: number | null): string {
  if (valor === null) return "Sem base";
  return `${Math.round(valor * 100).toLocaleString("pt-BR")}%`;
}

function textoDaContagem(contagem: ContagemDaProva): string {
  if (contagem.estado === "indefinida") return "Data da prova ainda não definida";
  if (contagem.estado === "hoje") return "A prova é hoje";
  if (contagem.estado === "passada") return "A data da prova já passou";
  const dias = contagem.dias ?? 0;
  return `${dias.toLocaleString("pt-BR")} ${dias === 1 ? "dia" : "dias"} para a prova`;
}

function detalheDaContagem(contagem: ContagemDaProva): string {
  if (contagem.dataProva === null) {
    return "Assim que a data oficial entrar no seu concurso, a contagem aparece aqui.";
  }
  return `Data registrada: ${dataCurta(contagem.dataProva)}.`;
}

function ContagemDaProvaCartao({ contagem }: { contagem: ContagemDaProva }) {
  return (
    <section
      aria-labelledby="titulo-contagem-da-prova"
      className="rounded-card border border-linha bg-painel p-5 shadow-card sm:p-6"
    >
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-marca">Contagem da prova</p>
      <h2 id="titulo-contagem-da-prova" className="mt-2 text-2xl font-semibold">
        {textoDaContagem(contagem)}
      </h2>
      <p className="mt-2 max-w-2xl leading-7 text-suave">{detalheDaContagem(contagem)}</p>
    </section>
  );
}

function Dimensao({ nome, dimensao }: { nome: string; dimensao: DimensaoDoAnel }) {
  return (
    <div className="rounded-xl border border-linha bg-fundo p-3">
      <p className="text-sm text-suave">{nome}</p>
      <p className="mt-1 text-2xl font-semibold">
        {dimensao.progresso}
        <span className="text-base font-normal text-suave"> / {dimensao.meta}</span>
      </p>
      <p className="mt-1 text-xs text-suave">
        {dimensao.concluido ? "Fechado hoje" : `${Math.round(dimensao.percentual * 100)}% do anel`}
      </p>
    </div>
  );
}

function Missao({ missao }: { missao: MissaoDoDia }) {
  return (
    <div className="mt-4 rounded-xl border border-linha bg-fundo p-3">
      <p className="text-sm font-semibold">Missão de hoje</p>
      <p className="mt-1 text-suave">{MISSAO_EM_TEXTO[missao.tipo]}</p>
      <p className="mt-1 text-sm text-suave">
        {missao.progresso} de {missao.meta} · {ESTADO_DA_MISSAO_EM_TEXTO[missao.estado]}
      </p>
    </div>
  );
}

function GamificacaoDoDia({ dados }: { dados: DadosGamificacao }) {
  const conquistas = dados.conquistas.filter((conquista) => conquista.desbloqueada).length;

  return (
    <section
      aria-labelledby="titulo-anel-do-dia"
      className="rounded-card border border-linha bg-painel p-5 shadow-card sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-evolucao">Seu dia</p>
          <h2 id="titulo-anel-do-dia" className="mt-2 text-2xl font-semibold">Anel de hoje</h2>
          <p className="mt-2 max-w-2xl leading-7 text-suave">
            Estudo, questões e revisão contam separado. O anel fecha com o essencial do plano, não com volume.
          </p>
        </div>
        <span className="rounded-full bg-fundo-suave px-3 py-1 text-sm font-semibold text-evolucao">
          {dados.pontos.dia} {dados.pontos.dia === 1 ? "ponto hoje" : "pontos hoje"}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Dimensao nome="Estudo" dimensao={dados.anel.estudo} />
        <Dimensao nome="Questões" dimensao={dados.anel.questoes} />
        <Dimensao nome="Revisão" dimensao={dados.anel.revisao} />
      </div>

      {dados.missao ? <Missao missao={dados.missao} /> : null}

      <p className="mt-4 text-sm text-suave">
        {dados.sequencia
          ? `${dados.sequencia.sequencia} ${dados.sequencia.sequencia === 1 ? "dia" : "dias"} de sequência · ${ESTADO_DA_SEQUENCIA_EM_TEXTO[dados.sequencia.estado]}`
          : "Sua sequência começa no primeiro dia cumprido."}
        {" · "}
        {conquistas} de {dados.conquistas.length}{" "}
        {dados.conquistas.length === 1 ? "conquista" : "conquistas"} ·{" "}
        <Link className="font-semibold text-marca underline" href="/app/progresso">
          ver no Progresso
        </Link>
      </p>
    </section>
  );
}

function ResumoDaSemana({ relatorio }: { relatorio: RelatorioSemanal }) {
  return (
    <section
      aria-labelledby="titulo-resumo-da-semana"
      className="rounded-card border border-linha bg-painel p-5 shadow-card sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-marca">Últimos 7 dias</p>
          <h2 id="titulo-resumo-da-semana" className="mt-2 text-2xl font-semibold">Sua semana até aqui</h2>
        </div>
        <span className="rounded-full bg-fundo-suave px-3 py-1 text-sm font-semibold text-evolucao">
          Tendência: {TENDENCIA_EM_TEXTO[relatorio.tendencia]}
        </span>
      </div>

      <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-linha bg-fundo p-3">
          <dt className="text-sm text-suave">Questões respondidas</dt>
          <dd className="mt-1 text-2xl font-semibold">{relatorio.questoesRespondidas}</dd>
        </div>
        <div className="rounded-xl border border-linha bg-fundo p-3">
          <dt className="text-sm text-suave">Acertos</dt>
          <dd className="mt-1 text-2xl font-semibold">
            {relatorio.acertos} · {percentualOpcional(relatorio.percentualAcertos)}
          </dd>
        </div>
        <div className="rounded-xl border border-linha bg-fundo p-3">
          <dt className="text-sm text-suave">Assuntos tocados</dt>
          <dd className="mt-1 text-2xl font-semibold">{relatorio.topicosTocados}</dd>
        </div>
        <div className="rounded-xl border border-linha bg-fundo p-3">
          <dt className="text-sm text-suave">Revisões concluídas</dt>
          <dd className="mt-1 text-2xl font-semibold">{relatorio.revisoesConcluidas}</dd>
        </div>
      </dl>

      <p className="mt-4 text-sm text-suave">
        <Link className="font-semibold text-marca underline" href="/app/progresso">
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
      className="rounded-card border border-linha bg-painel p-5 shadow-card sm:p-6"
    >
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-aviso">Recuperar erro</p>
      <h2 id="titulo-recuperacao" className="mt-2 text-2xl font-semibold">Erros que merecem outra chance</h2>
      <p className="mt-2 max-w-2xl leading-7 text-suave">
        Refazer um erro conta como recuperação e não substitui o plano de hoje.
      </p>

      <ul className="mt-4 grid gap-3" aria-label="Erros para refazer">
        {erros.map((linha) => (
          <li
            key={`${linha.topicoId}-${linha.causa}`}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-linha bg-fundo p-3"
          >
            <div className="min-w-0">
              <p className="font-semibold">{linha.topico}</p>
              <p className="mt-1 text-sm text-suave">
                {NOMES_DAS_CAUSAS[linha.causa]} · {linha.nErros} {linha.nErros === 1 ? "erro" : "erros"}
              </p>
            </div>
            <Link
              href={`/app/sessao?refacao=1&topico=${encodeURIComponent(linha.topicoId)}&causa=${encodeURIComponent(linha.causa)}`}
              className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-marca px-4 py-2 text-sm font-semibold text-white transition hover:bg-marca-apoio"
            >
              Refazer
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-sm text-suave">
        <Link className="font-semibold text-marca underline" href="/app/progresso">
          Ver o caderno de erros completo
        </Link>
      </p>
    </section>
  );
}

/**
 * Faixa integrada da superfície Hoje: contagem da prova, gamificação do dia,
 * leitura da semana e recuperação de erro. Cada peça só aparece quando existe
 * fato para mostrar; nada aqui inventa número.
 */
export function PainelDoDiaTela({ painel }: { painel: PainelDoDia }) {
  return (
    <div className="grid gap-4">
      <ContagemDaProvaCartao contagem={painel.contagem} />
      {painel.gamificacao ? <GamificacaoDoDia dados={painel.gamificacao} /> : null}
      {painel.relatorioSemanal ? <ResumoDaSemana relatorio={painel.relatorioSemanal} /> : null}
      {painel.recuperacao.length > 0 ? <Recuperacao erros={painel.recuperacao} /> : null}
      {painel.acompanhamentoIndisponivel ? (
        <p className="rounded-card border border-linha bg-painel p-4 text-sm text-suave shadow-card">
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
      className="rounded-card border border-linha bg-painel p-5 shadow-card sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-evolucao">Seu esforço reconhecido</p>
          <h2 id="titulo-gamificacao-progresso" className="mt-2 text-2xl font-semibold">Pontos e conquistas</h2>
          <p className="mt-2 max-w-2xl leading-7 text-suave">
            Ponto vem de estudo prioritário, conclusão, revisão no prazo e erro recuperado. Não existe ranking nem
            comparação.
          </p>
        </div>
        <span className="rounded-full bg-fundo-suave px-3 py-1 text-sm font-semibold text-evolucao">
          {dados.pontos.total} no total
        </span>
      </div>

      <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {discriminacao.map((linha) => (
          <div key={linha.rotulo} className="rounded-xl border border-linha bg-fundo p-3">
            <dt className="text-sm text-suave">{linha.rotulo}</dt>
            <dd className="mt-1 text-2xl font-semibold">{linha.valor}</dd>
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
