import { consultarFilaRevisao } from "@/modules/operador";
import type { FonteCitacao } from "@/modules/acervo/contrato";
import { Estado } from "@/modules/ui/estado";

import { corrigirQuestao, decidirFila } from "./acoes";

export const dynamic = "force-dynamic";

type EstadoDaFila = "decidido" | "corrigido" | "entrada" | "erro" | undefined;

function estadoSeguro(valor: string | string[] | undefined): EstadoDaFila {
  const estado = Array.isArray(valor) ? valor[0] : valor;
  return ["decidido", "corrigido", "entrada", "erro"].includes(estado ?? "")
    ? (estado as Exclude<EstadoDaFila, undefined>)
    : undefined;
}

function provenienciaTexto(proveniencia: FonteCitacao | null): string {
  if (!proveniencia) return "Proveniência pendente de conferência";
  return `${proveniencia.banca} · ${proveniencia.ano} · ${proveniencia.orgao} · ${proveniencia.cargo} · questão ${proveniencia.numero}`;
}

function origemTexto(origem: "real" | "gerada_ia"): string {
  return origem === "real" ? "questão de prova oficial" : "questão inédita — revisão total";
}

function mensagemDoEstado(estado: EstadoDaFila) {
  switch (estado) {
    case "decidido":
      return <p className="rounded-lg border border-ok/30 bg-ok/10 px-4 py-3 text-sm text-ok" role="status">Decisão registrada. O lote inteiro foi processado.</p>;
    case "corrigido":
      return <p className="rounded-lg border border-ok/30 bg-ok/10 px-4 py-3 text-sm text-ok" role="status">Correção registrada como uma nova versão em revisão.</p>;
    case "entrada":
      return <p className="rounded-lg border border-aviso/30 bg-aviso/10 px-4 py-3 text-sm text-aviso" role="alert">Confira os itens selecionados e o motivo antes de tentar de novo.</p>;
    case "erro":
      return <Estado tipo="erro" />;
    default:
      return null;
  }
}

function Alternativas({
  alternativas,
}: {
  alternativas: readonly { letra: string; texto: string }[] | null;
}) {
  if (!alternativas) return null;
  return (
    <ol className="mt-4 grid gap-2" aria-label="Alternativas">
      {alternativas.map((alternativa) => (
        <li key={alternativa.letra} className="rounded-md border border-linha bg-fundo px-3 py-2 text-sm leading-6">
          <span className="mr-2 font-utilitaria font-semibold text-marca">{alternativa.letra}</span>
          {alternativa.texto}
        </li>
      ))}
    </ol>
  );
}

function CartaoDaFila({
  revisao,
}: {
  revisao: Awaited<ReturnType<typeof consultarFilaRevisao>>[number];
}) {
  const { questao } = revisao;
  return (
    <article className="rounded-card border border-linha bg-painel p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em]">
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-linha bg-fundo px-3 py-2 normal-case tracking-normal">
            <input type="checkbox" name="revisoes" value={revisao.id} className="h-4 w-4 accent-marca" />
            <span>Selecionar</span>
          </label>
          <span className="rounded-md bg-aviso/10 px-2.5 py-1.5 text-aviso">prioridade {revisao.prioridade}</span>
          <span className="rounded-md bg-marca/10 px-2.5 py-1.5 text-marca">{questao.tipoQuestao === "certo_errado" ? "certo ou errado" : "múltipla escolha"}</span>
        </div>
        <p className="font-utilitaria text-xs text-suave">fila #{revisao.id} · v{revisao.questaoVersao}</p>
      </div>

      <div className="mt-6">
        <p className="font-utilitaria text-xs uppercase tracking-[0.14em] text-marca">{origemTexto(questao.origem)}</p>
        <p className="mt-3 text-base leading-7">{questao.enunciado}</p>
        <Alternativas alternativas={questao.alternativas} />
      </div>

      <dl className="mt-6 grid gap-3 border-t border-linha pt-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-texto">Gabarito</dt>
          <dd className="mt-1 text-suave">{questao.respostaCorreta ?? "não informado"}{questao.anulada ? " · anulada" : ""}</dd>
        </div>
        <div>
          <dt className="font-semibold text-texto">Proveniência</dt>
          <dd className="mt-1 text-suave">{provenienciaTexto(questao.proveniencia)}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="font-semibold text-texto">Por que entrou na fila</dt>
          <dd className="mt-1 text-suave">{revisao.motivo}</dd>
        </div>
      </dl>
    </article>
  );
}

function EditorDeCorrecao({
  revisao,
}: {
  revisao: Awaited<ReturnType<typeof consultarFilaRevisao>>[number];
}) {
  const questao = revisao.questao;
  return (
    <details className="rounded-card border border-linha bg-painel shadow-card">
      <summary className="cursor-pointer list-none px-5 py-4 font-semibold sm:px-6">
        <span className="mr-3 text-marca">＋</span>
        Corrigir esta questão — cria uma nova versão
      </summary>
      <form action={corrigirQuestao} className="space-y-5 border-t border-linha px-5 py-5 sm:px-6">
        <input type="hidden" name="questaoId" value={revisao.questaoId} />
        <input type="hidden" name="questaoVersao" value={revisao.questaoVersao} />

        <div className="rounded-lg bg-fundo-suave px-4 py-3 text-sm leading-6 text-suave">
          A versão atual fica congelada. A correção abaixo será criada como <strong>versão {revisao.questaoVersao + 1}</strong> e voltará para revisão.
        </div>

        <label className="grid gap-2 text-sm font-semibold" htmlFor={`enunciado-${revisao.id}`}>
          Enunciado
          <textarea id={`enunciado-${revisao.id}`} name="enunciado" defaultValue={questao.enunciado} rows={5} className="min-h-32 rounded-lg border border-linha bg-fundo px-3 py-2 font-normal leading-6" />
        </label>

        {questao.alternativas ? (
          <label className="grid gap-2 text-sm font-semibold" htmlFor={`alternativas-${revisao.id}`}>
            Alternativas em JSON
            <textarea id={`alternativas-${revisao.id}`} name="alternativas" defaultValue={JSON.stringify(questao.alternativas, null, 2)} rows={7} className="min-h-40 rounded-lg border border-linha bg-fundo px-3 py-2 font-utilitaria text-xs font-normal leading-6" />
          </label>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold" htmlFor={`gabarito-${revisao.id}`}>
            Gabarito
            <input id={`gabarito-${revisao.id}`} name="respostaCorreta" defaultValue={questao.respostaCorreta ?? ""} className="min-h-11 rounded-lg border border-linha bg-fundo px-3 py-2 font-normal uppercase" />
          </label>
          <label className="grid gap-2 text-sm font-semibold" htmlFor={`anulada-${revisao.id}`}>
            Estado da anulação
            <select id={`anulada-${revisao.id}`} name="anulada" defaultValue={questao.anulada ? "true" : "false"} className="min-h-11 rounded-lg border border-linha bg-fundo px-3 py-2 font-normal">
              <option value="false">Não anulada</option>
              <option value="true">Anulada</option>
            </select>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold" htmlFor={`tipo-mudanca-${revisao.id}`}>
            Tipo da mudança
            <select id={`tipo-mudanca-${revisao.id}`} name="mudancaTipo" defaultValue="substantiva" className="min-h-11 rounded-lg border border-linha bg-fundo px-3 py-2 font-normal">
              <option value="substantiva">Substantiva — revisar conteúdo</option>
              <option value="cosmetica">Cosmética — texto/forma</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold" htmlFor={`motivo-correcao-${revisao.id}`}>
            Motivo da correção
            <input id={`motivo-correcao-${revisao.id}`} name="motivo" required minLength={1} className="min-h-11 rounded-lg border border-linha bg-fundo px-3 py-2 font-normal" placeholder="O que foi conferido?" />
          </label>
        </div>

        <button type="submit" className="min-h-11 rounded-lg bg-texto px-4 py-3 text-sm font-semibold text-fundo transition hover:bg-marca">
          Criar nova versão em revisão
        </button>
      </form>
    </details>
  );
}

export default async function FilaDeRevisao({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string | string[] }>;
}) {
  const fila = await consultarFilaRevisao();
  const parametros = await searchParams;
  const estado = estadoSeguro(parametros.estado);

  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <p className="font-utilitaria text-xs font-semibold uppercase tracking-[0.2em] text-marca">01 / acervo</p>
        <h1 className="mt-3 font-display text-4xl leading-tight tracking-tight sm:text-5xl">Fila de revisão</h1>
        <p className="mt-4 text-lg leading-8 text-suave">Leia a questão no contexto da fonte, selecione um lote e deixe o motivo da decisão para a próxima conferência.</p>
      </header>

      {mensagemDoEstado(estado)}

      {fila.length === 0 ? (
        <Estado tipo="vazio" titulo="A fila está limpa" acao="Não há decisões pendentes neste momento. Quando uma questão precisar de revisão, ela aparecerá aqui com a sua proveniência." />
      ) : (
        <>
          <section aria-labelledby="titulo-lote" className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-linha pb-3">
              <div>
                <p className="font-utilitaria text-xs uppercase tracking-[0.16em] text-suave">decisão em lote</p>
                <h2 id="titulo-lote" className="mt-1 text-2xl font-semibold">{fila.length} {fila.length === 1 ? "item pendente" : "itens pendentes"}</h2>
              </div>
              <p className="text-sm text-suave">Até 50 itens por decisão atômica.</p>
            </div>

            <form action={decidirFila} className="space-y-4">
              <div className="grid gap-4">
                {fila.map((revisao) => <CartaoDaFila key={revisao.id} revisao={revisao} />)}
              </div>
              <div className="rounded-card border border-marca/30 bg-marca/5 p-5 sm:p-6">
                <label className="grid gap-2 text-sm font-semibold" htmlFor="motivo-lote">
                  Motivo da decisão
                  <textarea id="motivo-lote" name="motivo" required minLength={1} rows={3} className="min-h-24 rounded-lg border border-linha bg-painel px-3 py-2 font-normal leading-6" placeholder="Ex.: conferido com o gabarito oficial da prova." />
                </label>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button type="submit" name="decisao" value="aprovada" className="min-h-11 rounded-lg bg-ok px-4 py-3 text-sm font-semibold text-white transition hover:brightness-95">
                    Aprovar selecionadas
                  </button>
                  <button type="submit" name="decisao" value="rejeitada" className="min-h-11 rounded-lg border border-erro/40 bg-painel px-4 py-3 text-sm font-semibold text-erro transition hover:bg-erro/5">
                    Rejeitar selecionadas
                  </button>
                </div>
              </div>
            </form>
          </section>

          <section aria-labelledby="titulo-correcoes" className="space-y-4">
            <div className="border-b border-linha pb-3">
              <p className="font-utilitaria text-xs uppercase tracking-[0.16em] text-suave">versão controlada</p>
              <h2 id="titulo-correcoes" className="mt-1 text-2xl font-semibold">Corrigir sem apagar histórico</h2>
            </div>
            <div className="grid gap-3">
              {fila.map((revisao) => <EditorDeCorrecao key={`${revisao.id}-editor`} revisao={revisao} />)}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
