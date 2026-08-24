import Link from "next/link";

import { Estado } from "@/modules/ui/estado";

import { CAUSAS_DO_CADERNO } from "./progresso";
import type {
  DadosProgresso,
  EstadoDaSequencia,
  TendenciaProgresso,
} from "./progresso";

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

const NOMES_DAS_CAUSAS: Record<(typeof CAUSAS_DO_CADERNO)[number], string> = {
  nao_sabia_conteudo: "Não sabia o conteúdo",
  errei_a_conta: "Errei a conta",
  entendi_errado_enunciado: "Entendi errado o enunciado",
  confundi_conceitos: "Confundi conceitos",
  fiquei_na_duvida: "Fiquei na dúvida",
  chutei: "Chutei",
  nao_sei_dizer: "Não sei dizer",
  faltou_tempo: "Faltou tempo",
};

function nomeDoEstado(estado: EstadoDaSequencia["estado"]): string {
  return {
    cumprido: "Piso concluído hoje",
    piso_pendente: "O piso de hoje ainda está pendente",
    fora_agenda: "Hoje está fora da sua agenda",
    folga: "Hoje é uma folga declarada",
    plano_indisponivel: "O plano de hoje ainda está sendo preparado",
  }[estado];
}

function explicacaoDoEstado(estado: EstadoDaSequencia["estado"]): string {
  return {
    cumprido: "Você fez o essencial do dia. A sequência continua protegida.",
    piso_pendente: "Quando terminar as revisões do piso, este dia fica cumprido.",
    fora_agenda: "Dias que não estão na sua agenda não interrompem seu ritmo.",
    folga: "A folga declarada não conta contra a sua sequência.",
    plano_indisponivel: "Isso não conta contra você. Tente recarregar mais tarde.",
  }[estado];
}

function percentual(acertos: number, respostas: number): string {
  if (respostas <= 0) return "0%";
  return `${Math.round((acertos / respostas) * 100).toLocaleString("pt-BR")}%`;
}

function percentualOpcional(valor: number | null): string {
  if (valor === null) return "Sem base";
  return `${Math.round(valor * 100).toLocaleString("pt-BR")}%`;
}

function dataCurta(data: string): string {
  const valor = new Date(data);
  if (Number.isNaN(valor.getTime())) return data;
  return valor.toLocaleDateString("pt-BR", { dateStyle: "medium" });
}

function queryDoFiltro(dados: DadosProgresso): string {
  const params = new URLSearchParams();
  if (dados.filtros.causa) params.set("causa", dados.filtros.causa);
  if (dados.filtros.topicoId) params.set("topico", dados.filtros.topicoId);
  const query = params.toString();
  return query ? `?${query}` : "";
}

function CartaoDaSequencia({ dados }: { dados: DadosProgresso }) {
  if (!dados.sequencia) {
    return (
      <section className="rounded-card border border-linha bg-painel p-5 shadow-card sm:p-6" aria-labelledby="titulo-sequencia">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-evolucao">Seu ritmo</p>
        <h2 id="titulo-sequencia" className="mt-2 text-2xl font-semibold">Seu ponto de partida</h2>
        <p className="mt-2 max-w-2xl leading-7 text-suave">
          Assim que você responder suas primeiras questões, seu histórico e sua sequência aparecem aqui.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-card border border-linha bg-painel p-5 shadow-card sm:p-6" aria-labelledby="titulo-sequencia">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-evolucao">Seu ritmo</p>
          <h2 id="titulo-sequencia" className="mt-2 text-2xl font-semibold">
            {dados.sequencia.sequencia} {dados.sequencia.sequencia === 1 ? "dia" : "dias"} de sequência
          </h2>
        </div>
        <span className="rounded-full bg-fundo-suave px-3 py-1 text-sm font-semibold text-evolucao">
          {nomeDoEstado(dados.sequencia.estado)}
        </span>
      </div>
      <p className="mt-3 max-w-2xl leading-7 text-suave">
        {explicacaoDoEstado(dados.sequencia.estado)}
      </p>
    </section>
  );
}

function RelatorioSemanal({ dados }: { dados: DadosProgresso }) {
  const relatorio = dados.relatorioSemanal;
  return (
    <section
      aria-labelledby="titulo-relatorio-semanal"
      className="rounded-card border border-linha bg-painel p-5 shadow-card sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-marca">Leitura da semana</p>
          <h2 id="titulo-relatorio-semanal" className="mt-2 text-2xl font-semibold">Relatório semanal</h2>
          <p className="mt-2 max-w-2xl leading-7 text-suave">
            Fatos dos últimos 7 dias, comparados com os 7 dias anteriores. Sem estimar tempo de estudo.
          </p>
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
          <dt className="text-sm text-suave">Tópicos tocados</dt>
          <dd className="mt-1 text-2xl font-semibold">{relatorio.topicosTocados}</dd>
        </div>
        <div className="rounded-xl border border-linha bg-fundo p-3">
          <dt className="text-sm text-suave">Revisões concluídas</dt>
          <dd className="mt-1 text-2xl font-semibold">{relatorio.revisoesConcluidas}</dd>
        </div>
      </dl>

      {relatorio.tendencia === "sem_base" ? (
        <p className="mt-4 text-sm text-suave">
          Ainda não há respostas nas duas janelas para comparar a tendência.
        </p>
      ) : null}
    </section>
  );
}

function Historico({ dados }: { dados: DadosProgresso }) {
  return (
    <section aria-labelledby="titulo-historico">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-marca">O que você já construiu</p>
          <h2 id="titulo-historico" className="mt-1 text-2xl font-semibold">Progresso por assunto</h2>
        </div>
        <p className="text-sm text-suave">
          {dados.historico.length} {dados.historico.length === 1 ? "assunto" : "assuntos"}
        </p>
      </div>

      {dados.historico.length === 0 ? (
        <Estado
          tipo="vazio"
          titulo={dados.estadoInicial ? "Seu histórico começa com a primeira questão" : "Ainda não há progresso por assunto"}
          acao={
            <>
              Responda uma questão no <Link className="font-semibold text-marca underline" href="/app">plano do dia</Link> e volte para acompanhar sua evolução.
            </>
          }
        />
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2" aria-label="Progresso por assunto">
          {dados.historico.map((linha) => (
            <li key={linha.topicoId} className="rounded-card border border-linha bg-painel p-4 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <h3 className="min-w-0 truncate font-semibold">{linha.topico}</h3>
                <span className="shrink-0 text-lg font-semibold text-marca">
                  {percentual(linha.nAcertos, linha.nRespostas)}
                </span>
              </div>
              <p className="mt-2 text-sm text-suave">
                {linha.nAcertos} de {linha.nRespostas} {linha.nRespostas === 1 ? "resposta" : "respostas"} certas
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full bg-fundo-suave px-3 py-1 text-marca">
                  Domínio: {DOMINIO_EM_TEXTO[linha.dominio]}
                </span>
                <span className="rounded-full bg-fundo-suave px-3 py-1 text-evolucao">
                  Tendência: {TENDENCIA_EM_TEXTO[linha.tendencia]}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FiltrosDoCaderno({ dados }: { dados: DadosProgresso }) {
  return (
    <form method="get" action="/app/progresso" className="mt-4 grid gap-4 rounded-card border border-linha bg-painel p-4 shadow-card sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <label className="grid gap-1 text-sm font-semibold" htmlFor="causa">
        Por que errei
        <select id="causa" name="causa" defaultValue={dados.filtros.causa ?? ""} className="mt-1 min-h-11 rounded-lg border border-linha bg-fundo px-3 font-normal text-texto">
          <option value="">Todas as causas</option>
          {CAUSAS_DO_CADERNO.map((causa) => (
            <option key={causa} value={causa}>{NOMES_DAS_CAUSAS[causa]}</option>
          ))}
        </select>
      </label>

      <label className="grid gap-1 text-sm font-semibold" htmlFor="topico">
        Assunto
        <select id="topico" name="topico" defaultValue={dados.filtros.topicoId ?? ""} className="mt-1 min-h-11 rounded-lg border border-linha bg-fundo px-3 font-normal text-texto">
          <option value="">Todos os assuntos</option>
          {dados.topicos.map((topico) => (
            <option key={topico.id} value={topico.id}>{topico.nome}</option>
          ))}
        </select>
      </label>

      <div className="flex flex-wrap gap-2">
        <button type="submit" className="min-h-11 rounded-full bg-marca px-5 py-2 text-sm font-semibold text-white transition hover:bg-marca-apoio">
          Filtrar
        </button>
        {queryDoFiltro(dados) ? (
          <Link href="/app/progresso" className="inline-flex min-h-11 items-center rounded-full border border-linha px-4 py-2 text-sm font-semibold text-marca hover:bg-fundo-suave">
            Limpar
          </Link>
        ) : null}
      </div>
    </form>
  );
}

function Caderno({ dados }: { dados: DadosProgresso }) {
  const filtrado = Boolean(dados.filtros.causa || dados.filtros.topicoId);
  return (
    <section aria-labelledby="titulo-caderno">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-aviso">Aprender com o erro</p>
        <h2 id="titulo-caderno" className="mt-1 text-2xl font-semibold">Caderno de erros</h2>
        <p className="mt-2 max-w-2xl leading-7 text-suave">
          Veja onde você tropeçou e filtre por causa e assunto ao mesmo tempo.
        </p>
      </div>
      <FiltrosDoCaderno dados={dados} />

      {dados.caderno.length === 0 ? (
        <Estado
          tipo="vazio"
          titulo={filtrado ? "Nenhum erro encontrado com esses filtros" : "Seu caderno ainda está vazio"}
          acao={filtrado ? "Experimente retirar um dos filtros para ampliar a busca." : "Quando uma questão tiver um erro registrado, ela aparecerá aqui com o motivo."}
        />
      ) : (
        <ul className="mt-4 grid gap-3" aria-label="Caderno de erros">
          {dados.caderno.map((linha) => (
            <li key={`${linha.topicoId}-${linha.causa}`} className="rounded-card border border-linha bg-painel p-4 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{linha.topico}</h3>
                  <p className="mt-1 text-sm text-suave">{NOMES_DAS_CAUSAS[linha.causa]}</p>
                </div>
                <span className="rounded-full bg-fundo-suave px-3 py-1 text-sm font-semibold text-aviso">
                  {linha.nErros} {linha.nErros === 1 ? "erro" : "erros"}
                </span>
              </div>
              <p className="mt-3 text-xs text-suave">Último registro: {dataCurta(linha.ultimoErroEm)}</p>
              <Link
                href={`/app/sessao?refacao=1&topico=${encodeURIComponent(linha.topicoId)}&causa=${encodeURIComponent(linha.causa)}`}
                className="mt-4 inline-flex min-h-11 items-center rounded-full bg-marca px-4 py-2 text-sm font-semibold text-white transition hover:bg-marca-apoio"
              >
                Refazer questões deste erro
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ProgressoTela({ dados }: { dados: DadosProgresso }) {
  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-marca">Seu progresso</p>
        <h1 className="mt-3 font-display text-4xl leading-tight tracking-tight sm:text-5xl">
          Veja a evolução sem se comparar com ninguém.
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-suave">
          O que importa aqui é o seu caminho: o essencial cumprido, os assuntos praticados e os erros que merecem outra chance.
        </p>
      </header>

      <CartaoDaSequencia dados={dados} />
      <RelatorioSemanal dados={dados} />
      <Historico dados={dados} />
      <Caderno dados={dados} />
    </div>
  );
}

