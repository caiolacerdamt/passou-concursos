import { Estado } from "@/modules/ui/estado";

import type {
  DadosMapaPrioridade,
  DadosRaioX,
  FaixaDominio,
  LinhaMapaPrioridade,
  LinhaRaioX,
} from "./index";

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

function dataDaRevisao(data: string): string {
  return new Date(`${data}T00:00:00Z`).toLocaleDateString("pt-BR");
}

const DOMINIO_EM_TEXTO: Record<FaixaDominio, string> = {
  nao_iniciado: "Não iniciado",
  fraco: "Fraco",
  em_desenvolvimento: "Em desenvolvimento",
  forte: "Forte",
  dominado: "Dominado",
};

const NIVEL_EM_TEXTO: Record<LinhaMapaPrioridade["nivel"], string> = {
  maior_atencao: "Maior atenção",
  acompanhar: "Acompanhar",
  rotacao: "Rotação",
  sem_projecao: "Sem projeção",
};

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

function sinalDaLinha(
  titulo: string,
  valor: string,
  classe: string,
  ariaLabel: string,
) {
  return (
    <div className={`border-t-2 pt-2 ${classe}`} aria-label={ariaLabel}>
      <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-suave">
        {titulo}
      </dt>
      <dd className="mt-1 text-sm font-medium">{valor}</dd>
    </div>
  );
}

function LinhaDoMapa({ linha }: { linha: LinhaMapaPrioridade }) {
  const peso =
    linha.peso === null ? "Sem projeção" : pesoEmPercentual(linha.peso);
  const dominio =
    linha.score === null
      ? DOMINIO_EM_TEXTO[linha.dominio]
      : `${DOMINIO_EM_TEXTO[linha.dominio]} · ${pesoEmPercentual(linha.score)}`;
  const cobertura =
    linha.cobertura === "coberto"
      ? `Coberto · ${linha.nRespostas} ${linha.nRespostas === 1 ? "resposta" : "respostas"}`
      : "Não iniciado";
  const revisao =
    linha.revisao === "sem_agenda"
      ? "Sem agenda de revisão"
      : `${linha.revisao === "devida" ? "Devida" : "Em dia"} · ${dataDaRevisao(linha.due!)}`;

  return (
    <li className="rounded-xl border border-linha bg-fundo px-4 py-4 sm:px-5" data-prioridade={linha.nivel}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-suave">
            Sinal {linha.ordem}
          </p>
          <h3 className="mt-1 font-semibold">{linha.topico}</h3>
        </div>
        <span className="shrink-0 rounded-full border border-linha px-2.5 py-1 text-xs font-semibold text-marca">
          {NIVEL_EM_TEXTO[linha.nivel]}
        </span>
      </div>

      <dl className="mt-4 grid gap-3 border-t border-linha pt-3 sm:grid-cols-2 lg:grid-cols-4">
        {sinalDaLinha("Peso da banca", peso, "border-marca", "Peso da banca")}
        {sinalDaLinha("Domínio", dominio, "border-aviso", "Faixa de domínio")}
        {sinalDaLinha("Cobertura", cobertura, "border-suave", "Cobertura observada")}
        {sinalDaLinha("Revisão", revisao, "border-erro", "Estado da revisão")}
      </dl>

      <p className="mt-4 border-t border-linha pt-3 text-sm leading-6 text-suave">
        {linha.motivo}
      </p>
    </li>
  );
}

function MapaDePrioridade({ mapa }: { mapa: DadosMapaPrioridade | null }) {
  if (mapa === null) {
    return <Estado tipo="degradado" oQueCaiu="Mapa de Prioridade" />;
  }

  return (
    <section aria-labelledby="titulo-mapa" className="border-t border-linha pt-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-marca">
          Sua atenção
        </p>
        <h2 id="titulo-mapa" className="mt-1 text-2xl font-semibold tracking-tight">
          Mapa de Prioridade
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-suave">
          Não é outro plano: este mapa cruza o peso da banca, seu domínio, a
          cobertura do edital e a revisão. Ele explica os sinais; o plano do dia
          continua sendo a fonte da sequência de estudo.
        </p>
      </div>

      <ul
        aria-label="Legenda do Mapa de Prioridade"
        className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-linha bg-painel px-4 py-4 text-xs font-semibold text-suave sm:grid-cols-4"
      >
        <li className="border-t-2 border-marca pt-2">Peso da banca</li>
        <li className="border-t-2 border-aviso pt-2">Faixa de domínio</li>
        <li className="border-t-2 border-suave pt-2">Cobertura observada</li>
        <li className="border-t-2 border-erro pt-2">Revisão e data</li>
      </ul>

      {mapa.linhas.length === 0 ? (
        <Estado
          tipo="vazio"
          titulo="Ainda não há tópicos para cruzar"
          acao="Quando o programa e as leituras pessoais estiverem disponíveis, este mapa mostrará o que merece sua atenção."
        />
      ) : (
        <ol className="mt-4 grid gap-3">
          {mapa.linhas.map((linha) => (
            <LinhaDoMapa key={linha.topicoId} linha={linha} />
          ))}
        </ol>
      )}
    </section>
  );
}

export function RaioXTela({
  dados,
  mapa,
}: {
  dados: DadosRaioX;
  /** Omitido nas chamadas antigas; `null` significa falha pessoal nomeada. */
  mapa?: DadosMapaPrioridade | null;
}) {
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

      {mapa !== undefined && <MapaDePrioridade mapa={mapa} />}
    </div>
  );
}
