import { Bloco, Carregando } from "@/modules/ui/esqueleto";

/** O placar do bloco em cima e a lista de questões respondidas embaixo. */
export default function CarregandoResumo() {
  return (
    <Carregando rotulo="Carregando o resumo da sessão">
      <div className="space-y-8">
        <div aria-hidden="true" className="space-y-4 border-b border-linha pb-7">
          <Bloco className="h-3 w-32" />
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Bloco className="h-10 w-64" />
              <Bloco className="mt-2 h-4 w-40" />
            </div>
            <Bloco className="h-11 w-40 rounded-full" />
          </div>
        </div>

        <div aria-hidden="true" className="space-y-5">
          {Array.from({ length: 3 }, (_, indice) => (
            <div
              key={indice}
              className="space-y-5 rounded-card border border-linha bg-painel p-5 sm:p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Bloco className="h-3 w-24" />
                  <Bloco className="mt-2 h-3 w-56" />
                </div>
                <Bloco className="h-7 w-24 rounded-full" />
              </div>
              <Bloco className="h-4 w-full" />
              <div className="grid gap-3 sm:grid-cols-2">
                <Bloco className="h-20 w-full rounded-lg" />
                <Bloco className="h-20 w-full rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Carregando>
  );
}
