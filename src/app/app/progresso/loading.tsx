import {
  Bloco,
  CabecalhoEsqueleto,
  CartaoEsqueleto,
  Carregando,
} from "@/modules/ui/esqueleto";

/** Cabeçalho, cartão da sequência, faixa de filtros e a tabela do histórico. */
export default function CarregandoProgresso() {
  return (
    <Carregando rotulo="Carregando seu progresso">
      <div className="space-y-8">
        <CabecalhoEsqueleto />
        <CartaoEsqueleto linhas={2} />

        <div aria-hidden="true" className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }, (_, indice) => (
            <Bloco key={indice} className="h-9 w-28 rounded-full" />
          ))}
        </div>

        <div
          aria-hidden="true"
          className="rounded-2xl border border-linha bg-painel px-6 pb-6 pt-5"
        >
          <Bloco className="h-3 w-40" />
          <div className="mt-4 grid gap-3">
            {Array.from({ length: 6 }, (_, indice) => (
              <Bloco key={indice} className="h-9 w-full" />
            ))}
          </div>
        </div>
      </div>
    </Carregando>
  );
}
