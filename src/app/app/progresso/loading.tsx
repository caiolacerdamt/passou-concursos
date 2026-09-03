import {
  Bloco,
  CabecalhoEsqueleto,
  CartaoEsqueleto,
  Carregando,
} from "@/modules/ui/esqueleto";

/**
 * Cabeçalho, o cartão breu da semana, cobertura, pontos, a lista de matérias
 * e o caderno — a mesma ordem e as mesmas alturas da tela real (AD-120).
 */
export default function CarregandoProgresso() {
  return (
    <Carregando rotulo="Carregando seu progresso">
      <div className="space-y-8">
        <CabecalhoEsqueleto />

        {/* Sua semana: o único cartão breu da tela. */}
        <div aria-hidden="true" className="rounded-2xl bg-breu px-6 pb-7 pt-6 sm:px-8">
          <Bloco className="h-2.5 w-28 bg-breu-linha" />
          <Bloco className="mt-3.5 h-7 w-3/5 bg-breu-linha" />
          <div className="mt-7 grid grid-cols-7 items-end gap-2 sm:gap-3.5">
            {["h-6", "h-22", "h-10", "h-3", "h-24", "h-8", "h-18"].map((altura, indice) => (
              <Bloco key={indice} className={`w-full bg-breu-linha ${altura}`} />
            ))}
          </div>
          <Bloco className="mt-6 h-3.5 w-2/5 bg-breu-linha" />
        </div>

        <CartaoEsqueleto linhas={3} />
        <CartaoEsqueleto linhas={4} />

        {/* Progresso por assunto: uma linha por matéria. */}
        <div aria-hidden="true">
          <Bloco className="h-2.5 w-32" />
          <Bloco className="mt-3 h-5 w-52" />
          <div className="mt-4 overflow-hidden rounded-2xl border border-linha bg-painel">
            {Array.from({ length: 4 }, (_, indice) => (
              <div
                key={indice}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-6 border-t border-linha px-5 py-5 first:border-t-0 sm:px-7"
              >
                <Bloco className="h-4 w-2/5" />
                <Bloco className="h-6 w-14" />
              </div>
            ))}
          </div>
        </div>

        {/* Caderno: os três filtros e os cartões por assunto. */}
        <div aria-hidden="true">
          <Bloco className="h-2.5 w-36" />
          <Bloco className="mt-3 h-5 w-44" />
          <div className="mt-5 flex flex-wrap gap-3 rounded-xl border border-linha bg-painel p-4">
            {Array.from({ length: 3 }, (_, indice) => (
              <Bloco key={indice} className="h-11 min-w-[13rem] flex-1" />
            ))}
          </div>
          <div className="mt-4 grid gap-3">
            {Array.from({ length: 3 }, (_, indice) => (
              <div key={indice} className="rounded-2xl border border-linha bg-painel px-5 pb-6 pt-5">
                <Bloco className="h-2.5 w-28" />
                <Bloco className="mt-3 h-5 w-2/5" />
                <div className="mt-5 flex flex-wrap gap-2 border-t border-linha pt-4">
                  {Array.from({ length: 3 }, (_, chip) => (
                    <Bloco key={chip} className="h-10 w-36 rounded-lg" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Carregando>
  );
}
