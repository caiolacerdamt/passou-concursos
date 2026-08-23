import type { TaxonomiaDoOperador } from "@/modules/operador";
import { consultarTaxonomia } from "@/modules/operador";
import { Estado } from "@/modules/ui/estado";

import { decidirCandidato, editarTaxonomia } from "./acoes";

export const dynamic = "force-dynamic";

type EstadoDaTaxonomia = "decidido" | "editado" | "entrada" | "erro" | undefined;

function estadoSeguro(valor: string | string[] | undefined): EstadoDaTaxonomia {
  const estado = Array.isArray(valor) ? valor[0] : valor;
  return ["decidido", "editado", "entrada", "erro"].includes(estado ?? "")
    ? (estado as Exclude<EstadoDaTaxonomia, undefined>)
    : undefined;
}

function mensagemDoEstado(estado: EstadoDaTaxonomia) {
  switch (estado) {
    case "decidido":
      return <p className="rounded-lg border border-ok/30 bg-ok/10 px-4 py-3 text-sm text-ok" role="status">Candidato atualizado. A classificação futura já pode usar a decisão.</p>;
    case "editado":
      return <p className="rounded-lg border border-ok/30 bg-ok/10 px-4 py-3 text-sm text-ok" role="status">Taxonomia atualizada. O histórico das questões existentes continua congelado.</p>;
    case "entrada":
      return <p className="rounded-lg border border-aviso/30 bg-aviso/10 px-4 py-3 text-sm text-aviso" role="alert">Confira os campos e o motivo antes de tentar de novo.</p>;
    case "erro":
      return <Estado tipo="erro" />;
    default:
      return null;
  }
}

function nomeDaMateria(taxonomia: TaxonomiaDoOperador, materiaId: string | null): string {
  return taxonomia.materias.find((materia) => materia.id === materiaId)?.nome ?? "matéria ainda não escolhida";
}

function FormularioDeEdicao({
  tipo,
  id,
  nome,
  ordem,
  ativo,
  materiaId,
  materias,
}: {
  tipo: "materia" | "topico";
  id: string;
  nome: string;
  ordem: number;
  ativo: boolean;
  materiaId?: string;
  materias: TaxonomiaDoOperador["materias"];
}) {
  return (
    <form action={editarTaxonomia} className="mt-4 space-y-4 border-t border-linha pt-4">
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
        <label className="grid gap-2 text-sm font-semibold" htmlFor={`${tipo}-nome-${id}`}>
          Nome
          <input id={`${tipo}-nome-${id}`} name="nome" defaultValue={nome} required className="min-h-11 rounded-lg border border-linha bg-fundo px-3 py-2 font-normal" />
        </label>
        <label className="grid gap-2 text-sm font-semibold" htmlFor={`${tipo}-ordem-${id}`}>
          Ordem
          <input id={`${tipo}-ordem-${id}`} name="ordem" type="number" defaultValue={ordem} className="min-h-11 rounded-lg border border-linha bg-fundo px-3 py-2 font-normal" />
        </label>
      </div>

      {tipo === "topico" ? (
        <label className="grid gap-2 text-sm font-semibold" htmlFor={`topico-materia-${id}`}>
          Matéria
          <select id={`topico-materia-${id}`} name="materiaId" defaultValue={materiaId} className="min-h-11 rounded-lg border border-linha bg-fundo px-3 py-2 font-normal">
            {materias.map((materia) => <option key={materia.id} value={materia.id}>{materia.nome}</option>)}
          </select>
        </label>
      ) : null}

      <label className="grid gap-2 text-sm font-semibold" htmlFor={`${tipo}-ativo-${id}`}>
        Estado
        <select id={`${tipo}-ativo-${id}`} name="ativa" defaultValue={ativo ? "true" : "false"} className="min-h-11 rounded-lg border border-linha bg-fundo px-3 py-2 font-normal">
          <option value="true">Ativo</option>
          <option value="false">Desativado — ação explícita</option>
        </select>
      </label>

      <label className="grid gap-2 text-sm font-semibold" htmlFor={`${tipo}-motivo-${id}`}>
        Motivo da edição
        <input id={`${tipo}-motivo-${id}`} name="motivo" required className="min-h-11 rounded-lg border border-linha bg-fundo px-3 py-2 font-normal" placeholder="Por que este ajuste foi conferido?" />
      </label>
      <button type="submit" className="min-h-11 rounded-lg bg-texto px-4 py-3 text-sm font-semibold text-fundo transition hover:bg-marca">
        Salvar alteração
      </button>
    </form>
  );
}

function CartaoDeCandidato({
  candidato,
  taxonomia,
}: {
  candidato: TaxonomiaDoOperador["candidatos"][number];
  taxonomia: TaxonomiaDoOperador;
}) {
  return (
    <article className="rounded-card border border-aviso/30 bg-painel p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-utilitaria text-xs uppercase tracking-[0.15em] text-aviso">candidato a tópico</p>
          <h3 className="mt-2 font-display text-2xl">{candidato.nomeSugerido}</h3>
        </div>
        <span className="rounded-md bg-aviso/10 px-2.5 py-1.5 text-xs font-semibold text-aviso">
          {candidato.ocorrencias} {candidato.ocorrencias === 1 ? "ocorrência" : "ocorrências"}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-suave">
        {nomeDaMateria(taxonomia, candidato.materiaId)} · sugerido em {new Date(candidato.sugeridoEm).toLocaleDateString("pt-BR")}
      </p>

      <div className="mt-6 grid gap-4 border-t border-linha pt-5 lg:grid-cols-2">
        <form action={decidirCandidato} className="space-y-4 rounded-lg bg-fundo-suave p-4">
          <input type="hidden" name="candidatoId" value={candidato.id} />
          <input type="hidden" name="decisao" value="aprovado" />
          <p className="font-semibold">Aprovar e criar tópico</p>
          <label className="grid gap-2 text-sm font-semibold" htmlFor={`candidato-materia-${candidato.id}`}>
            Matéria
            <select id={`candidato-materia-${candidato.id}`} name="materiaId" defaultValue={candidato.materiaId ?? ""} required className="min-h-11 rounded-lg border border-linha bg-painel px-3 py-2 font-normal">
              <option value="" disabled>Escolha uma matéria</option>
              {taxonomia.materias.filter((materia) => materia.ativa).map((materia) => <option key={materia.id} value={materia.id}>{materia.nome}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold" htmlFor={`candidato-nome-${candidato.id}`}>
            Nome canônico
            <input id={`candidato-nome-${candidato.id}`} name="nome" defaultValue={candidato.nomeSugerido} required className="min-h-11 rounded-lg border border-linha bg-painel px-3 py-2 font-normal" />
          </label>
          <label className="grid gap-2 text-sm font-semibold" htmlFor={`candidato-motivo-aprovar-${candidato.id}`}>
            Motivo
            <input id={`candidato-motivo-aprovar-${candidato.id}`} name="motivo" required className="min-h-11 rounded-lg border border-linha bg-painel px-3 py-2 font-normal" placeholder="Por que este tópico entra?" />
          </label>
          <button type="submit" className="min-h-11 rounded-lg bg-ok px-4 py-3 text-sm font-semibold text-white transition hover:brightness-95">Aprovar candidato</button>
        </form>

        <form action={decidirCandidato} className="space-y-4 rounded-lg border border-linha bg-painel p-4">
          <input type="hidden" name="candidatoId" value={candidato.id} />
          <input type="hidden" name="decisao" value="rejeitado" />
          <p className="font-semibold">Rejeitar sugestão</p>
          <p className="text-sm leading-6 text-suave">A rejeição não cria tópico canônico. O motivo fica na trilha para evitar que a sugestão volte sem contexto.</p>
          <label className="grid gap-2 text-sm font-semibold" htmlFor={`candidato-motivo-rejeitar-${candidato.id}`}>
            Motivo
            <input id={`candidato-motivo-rejeitar-${candidato.id}`} name="motivo" required className="min-h-11 rounded-lg border border-linha bg-fundo px-3 py-2 font-normal" placeholder="Por que não entra?" />
          </label>
          <button type="submit" className="min-h-11 rounded-lg border border-erro/40 bg-fundo px-4 py-3 text-sm font-semibold text-erro transition hover:bg-erro/5">Rejeitar sugestão</button>
        </form>
      </div>
    </article>
  );
}

export default async function Taxonomia({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string | string[] }>;
}) {
  const taxonomia = await consultarTaxonomia();
  const parametros = await searchParams;
  const estado = estadoSeguro(parametros.estado);

  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <p className="font-utilitaria text-xs font-semibold uppercase tracking-[0.2em] text-marca">02 / mapa</p>
        <h1 className="mt-3 font-display text-4xl leading-tight tracking-tight sm:text-5xl">Taxonomia</h1>
        <p className="mt-4 text-lg leading-8 text-suave">A IA pode sugerir. Só a curadoria transforma uma sugestão em matéria e tópico que entram na classificação futura.</p>
      </header>

      {mensagemDoEstado(estado)}

      <section aria-labelledby="titulo-candidatos" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-linha pb-3">
          <div>
            <p className="font-utilitaria text-xs uppercase tracking-[0.16em] text-suave">aguardando decisão</p>
            <h2 id="titulo-candidatos" className="mt-1 text-2xl font-semibold">Candidatos a tópico</h2>
          </div>
          <p className="max-w-xs text-right text-sm text-suave">Aprovar cria o tópico; rejeitar apenas registra a decisão.</p>
        </div>
        {taxonomia.candidatos.length === 0 ? (
          <Estado tipo="vazio" titulo="Nenhum candidato pendente" acao="Quando a classificação encontrar um nome que ainda não existe, ele aparecerá aqui para uma decisão humana." />
        ) : (
          <div className="grid gap-4">{taxonomia.candidatos.map((candidato) => <CartaoDeCandidato key={candidato.id} candidato={candidato} taxonomia={taxonomia} />)}</div>
        )}
      </section>

      <section aria-labelledby="titulo-taxonomia" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-linha pb-3">
          <div>
            <p className="font-utilitaria text-xs uppercase tracking-[0.16em] text-suave">vocabulário canônico</p>
            <h2 id="titulo-taxonomia" className="mt-1 text-2xl font-semibold">Matérias e tópicos</h2>
          </div>
          <p className="max-w-xs text-right text-sm text-suave">Desativar é explícito e vale para classificações futuras.</p>
        </div>
        {taxonomia.materias.length === 0 ? (
          <Estado tipo="vazio" titulo="A taxonomia ainda está vazia" acao="Cadastre a matéria inicial pela preparação do acervo antes de classificar novas questões." />
        ) : (
          <div className="grid gap-4">
            {taxonomia.materias.map((materia) => (
              <article key={materia.id} className="rounded-card border border-linha bg-painel p-5 shadow-card sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-utilitaria text-xs uppercase tracking-[0.15em] text-marca">matéria · ordem {materia.ordem}</p>
                    <h3 className="mt-2 font-display text-2xl">{materia.nome}</h3>
                  </div>
                  <span className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${materia.ativa ? "bg-ok/10 text-ok" : "bg-fundo-suave text-suave"}`}>
                    {materia.ativa ? "ativa" : "desativada"}
                  </span>
                </div>
                <FormularioDeEdicao tipo="materia" id={materia.id} nome={materia.nome} ordem={materia.ordem} ativo={materia.ativa} materias={taxonomia.materias} />

                <div className="mt-7 border-t border-linha pt-5">
                  <h4 className="text-sm font-semibold">Tópicos desta matéria</h4>
                  {materia.topicos.length === 0 ? <p className="mt-3 text-sm text-suave">Nenhum tópico cadastrado.</p> : (
                    <div className="mt-3 grid gap-3">
                      {materia.topicos.map((topico) => (
                        <div key={topico.id} className="rounded-lg bg-fundo-suave p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-semibold">{topico.nome} <span className="font-utilitaria text-xs font-normal text-suave">· ordem {topico.ordem}</span></p>
                            <span className="text-xs font-semibold text-suave">{topico.ativo ? "ativo" : "desativado"}</span>
                          </div>
                          <FormularioDeEdicao tipo="topico" id={topico.id} nome={topico.nome} ordem={topico.ordem} ativo={topico.ativo} materiaId={materia.id} materias={taxonomia.materias} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
