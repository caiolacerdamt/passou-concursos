import { Estado } from "@/modules/ui/estado";

import type { DadosRaioX, LinhaRaioX } from "./index";

function pesoEmPercentual(peso: number): string {
  return `${(peso * 100).toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
  })}%`;
}

function tendenciaEmTexto(tendencia: LinhaRaioX["tendencia"]): string {
  return {
    subindo: "Subindo",
    estavel: "Estável",
    caindo: "Caindo",
  }[tendencia];
}

function dataDaProva(data: string | null): string {
  if (!data) return "Data da prova ainda não definida";
  return `Prova em ${new Date(`${data}T00:00:00Z`).toLocaleDateString("pt-BR")}`;
}

function LinhaDoRaioX({ linha }: { linha: LinhaRaioX }) {
  return (
    <li className="relative overflow-hidden rounded-xl border border-linha bg-fundo px-4 py-4 sm:px-5">
      <div
        className="absolute inset-x-0 top-0 h-1 bg-marca"
        style={{ width: `${Math.min(Math.max(linha.peso, 0), 1) * 100}%` }}
        aria-hidden="true"
      />

      <div className="flex items-start justify-between gap-4 pt-1">
        <div className="min-w-0">
          <h3 className="truncate font-semibold">{linha.topico}</h3>
          <p className="mt-1 text-sm text-suave">
            Tendência: {tendenciaEmTexto(linha.tendencia)}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-2xl font-semibold tracking-tight text-marca">
            {pesoEmPercentual(linha.peso)}
          </p>
          <p className="text-xs uppercase tracking-[0.12em] text-suave">peso</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-linha pt-3 text-sm text-suave">
        <span>
          {linha.nQuestoes} {linha.nQuestoes === 1 ? "questão real" : "questões reais"}
        </span>
        {linha.amostraBaixa && (
          <span className="font-medium text-aviso">Baseado em poucas questões</span>
        )}
      </div>
    </li>
  );
}

export function RaioXTela({ dados }: { dados: DadosRaioX }) {
  if (!dados.perfil) {
    return (
      <Estado
        tipo="vazio"
        titulo="Seu perfil de concurso ainda não está configurado"
        acao="Quando o edital estiver cadastrado, o Raio-X mostrará os tópicos que mais aparecem nas provas reais."
      />
    );
  }

  return (
    <div className="space-y-6">
      <header className="border-b border-linha pb-5">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-marca">
          Raio-X da banca
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          O que mais cai no seu concurso
        </h1>
        <p className="mt-3 text-suave">
          {dados.perfil.orgao} · {dados.perfil.banca === "indefinida" ? "Banca ainda não definida" : dados.perfil.banca}
        </p>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-suave">
          <span>{dataDaProva(dados.perfil.dataProva)}</span>
          <span>Formato: {dados.perfil.formato}</span>
        </div>
      </header>

      {dados.linhas.length === 0 ? (
        <Estado
          tipo="vazio"
          titulo="O programa ainda não tem questões publicadas"
          acao="O Raio-X aparece assim que houver questões reais publicadas para os tópicos do edital."
        />
      ) : (
        <section aria-labelledby="titulo-topicos">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-suave">
                Leitura do edital
              </p>
              <h2 id="titulo-topicos" className="mt-1 text-xl font-semibold">
                Tópicos por peso
              </h2>
            </div>
            <p className="text-sm text-suave">
              {dados.linhas.length} {dados.linhas.length === 1 ? "tópico" : "tópicos"}
            </p>
          </div>

          <ol className="mt-4 grid gap-3">
            {dados.linhas.map((linha) => (
              <LinhaDoRaioX key={linha.topicoId} linha={linha} />
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
