import { Bloco, CartaoEsqueleto, Carregando } from "@/modules/ui/esqueleto";

/**
 * O esqueleto de Hoje — e o de toda rota de `/app/*` que não tenha o seu.
 *
 * Um `loading.tsx` aqui envolve `page.tsx` e todos os segmentos abaixo, o que
 * cobre de saída `conta`, `preferencias` e `reembolso`: telas de formulário,
 * que não ganham nada com esqueleto próprio.
 *
 * A forma copia a de Hoje: título à esquerda, cartão do dia à direita, o
 * "Próximo bloco" em fundo cheio e as duas colunas de nível embaixo.
 */
export default function CarregandoHoje() {
  return (
    <Carregando rotulo="Carregando o plano de hoje">
      <div className="space-y-10">
        <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,24.75rem)] lg:items-end">
          <div className="min-w-0 lg:pt-1.5">
            <Bloco className="h-2.5 w-24" />
            <Bloco className="mt-3.5 h-11 w-4/5 max-w-[19rem]" />
            <Bloco className="mt-3.5 h-4 w-full max-w-[26rem]" />
          </div>
          <CartaoEsqueleto linhas={2} />
        </section>

        <div className="grid gap-5">
          <div className="flex flex-col gap-5 border-b border-linha pb-4.5 sm:flex-row sm:items-end sm:justify-between">
            <Bloco className="h-8 w-56" />
            <div className="shrink-0 sm:min-w-[13rem]">
              <Bloco className="h-3 w-full" />
              <Bloco className="mt-2.5 h-1 w-full rounded-full" />
            </div>
          </div>

          <Bloco className="h-32 w-full rounded-2xl" />

          <section className="grid gap-5 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
            <CartaoEsqueleto linhas={3} />
            <CartaoEsqueleto linhas={5} />
          </section>
        </div>
      </div>
    </Carregando>
  );
}
