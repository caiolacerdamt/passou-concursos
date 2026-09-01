import { CabecalhoEsqueleto, CartaoEsqueleto, Carregando } from "@/modules/ui/esqueleto";

/** Cabeçalho e as duas colunas de pendência: revisões vencidas e caderno. */
export default function CarregandoPratica() {
  return (
    <Carregando rotulo="Carregando questões e revisões">
      <div className="grid gap-5">
        <CabecalhoEsqueleto />
        <CartaoEsqueleto linhas={2} />
        <div className="grid gap-5 lg:grid-cols-2">
          <CartaoEsqueleto linhas={4} />
          <CartaoEsqueleto linhas={4} />
        </div>
      </div>
    </Carregando>
  );
}
