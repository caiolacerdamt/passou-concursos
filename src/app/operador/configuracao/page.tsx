import type {
  ConfiguracaoAdministrativa,
} from "@/modules/config/escrita";
import { consultarConfiguracoes } from "@/modules/operador";
import { Estado } from "@/modules/ui/estado";

import { salvarConfiguracao } from "./acoes";

export const dynamic = "force-dynamic";

type Configuracao = ConfiguracaoAdministrativa;
type EstadoDaConfiguracao = "salvo" | "entrada" | "erro" | undefined;

function estadoSeguro(valor: string | string[] | undefined): EstadoDaConfiguracao {
  const estado = Array.isArray(valor) ? valor[0] : valor;
  return ["salvo", "entrada", "erro"].includes(estado ?? "")
    ? (estado as Exclude<EstadoDaConfiguracao, undefined>)
    : undefined;
}

function valorJson(valor: unknown): string {
  const json = JSON.stringify(valor, null, 2);
  return json === undefined ? "null" : json;
}

function valorResumo(valor: unknown): string {
  if (typeof valor === "boolean") return valor ? "ligada" : "desligada";
  if (typeof valor === "string") return valor;
  return valorJson(valor).replace(/\s+/g, " ");
}

function dataLegivel(valor: string): string {
  return new Date(valor).toLocaleString("pt-BR");
}

function mensagemDoEstado(estado: EstadoDaConfiguracao) {
  switch (estado) {
    case "salvo":
      return <p className="rounded-lg border border-ok/30 bg-ok/10 px-4 py-3 text-sm text-ok" role="status">Configuração salva. A nova leitura usa este valor dentro da janela de cache.</p>;
    case "entrada":
      return <p className="rounded-lg border border-aviso/30 bg-aviso/10 px-4 py-3 text-sm text-aviso" role="alert">O valor precisa ser um JSON válido e o motivo não pode ficar vazio.</p>;
    case "erro":
      return <Estado tipo="erro" />;
    default:
      return null;
  }
}

function HistoricoDaChave({ configuracao }: { configuracao: Configuracao }) {
  if (configuracao.historico.length === 0) {
    return <p className="mt-4 rounded-lg bg-fundo-suave px-4 py-3 text-sm leading-6 text-suave">Nenhuma alteração registrada. O valor atual vem do default do catálogo.</p>;
  }

  return (
    <div className="mt-4 grid gap-3" aria-label={`Histórico de ${configuracao.chave}`}>
      {configuracao.historico.map((linha, indice) => {
        const anterior = indice === 0 ? configuracao.padrao : configuracao.historico[indice - 1].valor;
        return (
          <div key={linha.id} className="rounded-lg bg-fundo-suave p-4 text-sm">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="font-utilitaria text-[0.68rem] uppercase tracking-[0.14em] text-suave">Antes</p>
                <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words font-utilitaria text-xs leading-5 text-texto">{valorJson(anterior)}</pre>
              </div>
              <div>
                <p className="font-utilitaria text-[0.68rem] uppercase tracking-[0.14em] text-marca">Depois</p>
                <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words font-utilitaria text-xs leading-5 text-texto">{valorJson(linha.valor)}</pre>
              </div>
            </div>
            <dl className="mt-4 grid gap-2 border-t border-linha pt-3 text-xs sm:grid-cols-3">
              <div><dt className="font-semibold">Autor</dt><dd className="mt-1 break-all font-utilitaria text-suave">{linha.autorId}</dd></div>
              <div><dt className="font-semibold">Data</dt><dd className="mt-1 text-suave">{dataLegivel(linha.alteradoEm)}</dd></div>
              <div><dt className="font-semibold">Motivo</dt><dd className="mt-1 text-suave">{linha.motivo ?? "motivo não registrado"}</dd></div>
            </dl>
          </div>
        );
      })}
    </div>
  );
}

function EditorDeConfiguracao({ configuracao }: { configuracao: Configuracao }) {
  const flag = configuracao.tipo === "flag";
  const id = configuracao.chave.replace(/[^a-zA-Z0-9]+/g, "-");

  return (
    <article id={configuracao.chave} className="rounded-card border border-linha bg-painel p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-utilitaria text-xs uppercase tracking-[0.15em] text-marca">{configuracao.tipo} · dono {configuracao.moduloDono}</p>
          <h2 className="mt-2 break-words font-utilitaria text-base font-semibold">{configuracao.chave}</h2>
        </div>
        <span className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${flag && configuracao.vigente.valor === true ? "bg-ok/10 text-ok" : "bg-fundo-suave text-suave"}`}>
          {flag ? (configuracao.vigente.valor === true ? "ligada" : "desligada") : "parâmetro"}
        </span>
      </div>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-suave">{configuracao.descricao}</p>

      <div className="mt-5 rounded-lg border border-marca/20 bg-marca/5 px-4 py-3 text-sm">
        <span className="font-semibold">Vigente agora:</span> <span className="font-utilitaria">{valorResumo(configuracao.vigente.valor)}</span>
        {configuracao.vigente.autorId ? <span className="text-suave"> · última mudança por <span className="font-utilitaria">{configuracao.vigente.autorId}</span></span> : <span className="text-suave"> · default do catálogo</span>}
      </div>

      <form action={salvarConfiguracao} className="mt-5 space-y-4 border-t border-linha pt-5">
        <input type="hidden" name="chave" value={configuracao.chave} />
        <label className="grid gap-2 text-sm font-semibold" htmlFor={`valor-${id}`}>
          {flag ? "Estado da flag" : "Novo valor em JSON"}
          {flag ? (
            <select id={`valor-${id}`} name="valor" defaultValue={configuracao.vigente.valor === true ? "true" : "false"} className="min-h-11 rounded-lg border border-linha bg-fundo px-3 py-2 font-normal">
              <option value="false">Desligada</option>
              <option value="true">Ligada</option>
            </select>
          ) : (
            <textarea id={`valor-${id}`} name="valor" required defaultValue={valorJson(configuracao.vigente.valor)} rows={4} className="min-h-28 rounded-lg border border-linha bg-fundo px-3 py-2 font-utilitaria text-xs font-normal leading-6" aria-describedby={`ajuda-${id}`} />
          )}
        </label>
        {!flag ? <p id={`ajuda-${id}`} className="-mt-2 text-xs leading-5 text-suave">Use JSON válido: número como <code>20</code>, texto como <code>&quot;questoes&quot;</code>, lista ou objeto entre chaves.</p> : null}
        <label className="grid gap-2 text-sm font-semibold" htmlFor={`motivo-${id}`}>
          Motivo da alteração
          <input id={`motivo-${id}`} name="motivo" required minLength={1} className="min-h-11 rounded-lg border border-linha bg-fundo px-3 py-2 font-normal" placeholder="O que foi decidido?" />
        </label>
        <button type="submit" className="min-h-11 rounded-lg bg-texto px-4 py-3 text-sm font-semibold text-fundo transition hover:bg-marca">Salvar nova configuração</button>
      </form>

      <details className="mt-6 border-t border-linha pt-4">
        <summary className="cursor-pointer font-semibold">Ver histórico ({configuracao.historico.length})</summary>
        <HistoricoDaChave configuracao={configuracao} />
      </details>
    </article>
  );
}

function gruposPorModulo(configuracoes: readonly Configuracao[]): ReadonlyMap<string, readonly Configuracao[]> {
  const grupos = new Map<string, Configuracao[]>();
  for (const configuracao of configuracoes) {
    const grupo = grupos.get(configuracao.moduloDono) ?? [];
    grupo.push(configuracao);
    grupos.set(configuracao.moduloDono, grupo);
  }
  return grupos;
}

export default async function Configuracao({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string | string[] }>;
}) {
  const configuracoes = await consultarConfiguracoes();
  const parametros = await searchParams;
  const estado = estadoSeguro(parametros.estado);
  const grupos = gruposPorModulo(configuracoes);

  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <p className="font-utilitaria text-xs font-semibold uppercase tracking-[0.2em] text-marca">03 / controle</p>
        <h1 className="mt-3 font-display text-4xl leading-tight tracking-tight sm:text-5xl">Configuração sem deploy</h1>
        <p className="mt-4 text-lg leading-8 text-suave">Flags e parâmetros moram no Postgres. Aqui você troca o valor com motivo explícito e deixa o antes e depois visíveis para a próxima conferência.</p>
      </header>

      {mensagemDoEstado(estado)}

      <div className="rounded-lg border border-aviso/30 bg-aviso/10 px-4 py-3 text-sm leading-6 text-aviso">
        Uma flag é global: ligada vale para todos, desligada vale para todos. Não há rollout percentual nem teste A/B nesta tela.
      </div>

      {[...grupos.entries()].map(([modulo, itens]) => (
        <section key={modulo} aria-labelledby={`modulo-${modulo}`} className="space-y-4">
          <div className="border-b border-linha pb-3">
            <p className="font-utilitaria text-xs uppercase tracking-[0.16em] text-suave">módulo</p>
            <h2 id={`modulo-${modulo}`} className="mt-1 text-2xl font-semibold">{modulo}</h2>
          </div>
          <div className="grid gap-4">{itens.map((configuracao) => <EditorDeConfiguracao key={configuracao.chave} configuracao={configuracao} />)}</div>
        </section>
      ))}
    </div>
  );
}
