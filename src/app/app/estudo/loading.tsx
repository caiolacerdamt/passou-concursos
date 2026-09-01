import { Bloco, CartaoEsqueleto, Carregando } from "@/modules/ui/esqueleto";

/** Volta ao plano, cabeçalho do bloco em duas colunas, recursos e o botão. */
export default function CarregandoEstudo() {
  return (
    <Carregando rotulo="Carregando o estudo do bloco">
      <div className="space-y-6">
        <Bloco className="h-4 w-32" />

        <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,24.75rem)]">
          <CartaoEsqueleto linhas={3} />
          <CartaoEsqueleto linhas={2} />
        </section>

        <div aria-hidden="true" className="grid gap-3">
          {Array.from({ length: 3 }, (_, indice) => (
            <Bloco key={indice} className="h-16 w-full rounded-xl" />
          ))}
        </div>

        <Bloco className="h-12 w-56 rounded-full" />
      </div>
    </Carregando>
  );
}
