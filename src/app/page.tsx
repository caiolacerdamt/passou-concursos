import Link from "next/link";

import { EventoDoFunilNaEntrada } from "@/modules/analytics/entrada";
import { Shell } from "@/modules/ui/shell";
import { obterPrecosPublicos } from "@/modules/pagamentos/preco";

export const dynamic = "force-dynamic";

/**
 * Marco publico. A pagina de vendas de verdade e da SPEC 12 (PAG-08) — aqui so
 * existe o que a SPEC 07 precisa: uma pagina que funciona sem login e leva ao
 * login. Ela SHALL NOT prometer funcionalidade que ainda nao existe.
 */
export default async function Home() {
  const precos = await obterPrecosPublicos();

  return (
    <Shell
      acoes={
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/termos" className="text-marca underline">
            Termos
          </Link>
          <Link href="/privacidade" className="text-marca underline">
            Privacidade
          </Link>
          <Link href="/entrar" className="text-marca underline">
            Entrar
          </Link>
          <Link
            href="/checkout"
            className="rounded-md bg-marca px-3 py-2 font-medium text-fundo"
          >
            Ver oferta
          </Link>
        </div>
      }
    >
      <EventoDoFunilNaEntrada evento="pagina_vista" />
      <section aria-labelledby="titulo-oferta" className="py-4 sm:py-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-marca">
          Método para concursos bancários
        </p>
        <h1 id="titulo-oferta" className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Estude o que precisa ser lembrado, com um plano que acompanha seu histórico.
        </h1>
        <p className="mt-5 text-lg leading-8 text-suave">
          O Passou Concursos reúne questões reais de fontes oficiais, explicações
          conferidas e revisão espaçada para organizar o estudo da carreira bancária.
        </p>
      </section>

      <section aria-labelledby="titulo-precos" className="border-y border-linha py-6 sm:py-8">
        <h2 id="titulo-precos" className="text-xl font-semibold">
          Uma matrícula, dois formatos de pagamento
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <article className="rounded-lg border border-linha bg-fundo-suave p-5">
            <h3 className="font-semibold">Cartão de crédito</h3>
            <p className="mt-2 text-2xl font-semibold">
              {precos.parcelado.parcelas}x de até {precos.parcelado.parcelaFormatada}
            </p>
            <p className="mt-1 text-sm text-suave">
              Total de {precos.parcelado.totalFormatado}; a última parcela pode
              ter ajuste de centavos.
            </p>
          </article>
          <article className="rounded-lg border-2 border-marca p-5">
            <h3 className="font-semibold">À vista</h3>
            <p className="mt-2 text-2xl font-semibold">{precos.aVista.totalFormatado}</p>
            <p className="mt-1 text-sm text-suave">
              No Pix ou boleto, com o desconto configurado.
            </p>
          </article>
        </div>
        <p className="mt-5 text-sm text-suave">
          Garantia de {precos.garantiaDias} dias corridos a partir da confirmação
          do pagamento, conforme os termos da oferta.
        </p>
        <div className="mt-5 rounded-md border border-linha p-4 text-sm">
          <p className="leading-6 text-suave">
            Antes de continuar, leia os <Link href="/termos" className="text-marca underline">Termos de uso</Link>
            {" e a "}
            <Link href="/privacidade" className="text-marca underline">Política de privacidade</Link>.
          </p>
        </div>
        <Link
          href="/checkout"
          className="mt-4 inline-block rounded-md bg-marca px-5 py-3 font-medium text-fundo"
        >
          Conferir o checkout
        </Link>
      </section>

      <section aria-labelledby="titulo-metodo" className="py-6 sm:py-8">
        <h2 id="titulo-metodo" className="text-xl font-semibold">Como funciona o método</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-3">
          <article>
            <p className="text-sm font-semibold text-marca">01 · Questões reais</p>
            <h3 className="mt-2 font-semibold">Treino com origem identificada</h3>
            <p className="mt-2 text-sm leading-6 text-suave">
              A questão informa banca, ano e prova. O objetivo é treinar o tipo de
              decisão que aparece no exame.
            </p>
          </article>
          <article>
            <p className="text-sm font-semibold text-marca">02 · Revisão espaçada</p>
            <h3 className="mt-2 font-semibold">Retorno no intervalo adequado</h3>
            <p className="mt-2 text-sm leading-6 text-suave">
              O histórico de respostas ajuda a decidir quais assuntos precisam
              voltar ao plano e em que momento.
            </p>
          </article>
          <article>
            <p className="text-sm font-semibold text-marca">03 · Explicação conferida</p>
            <h3 className="mt-2 font-semibold">Entenda o motivo da resposta</h3>
            <p className="mt-2 text-sm leading-6 text-suave">
              O gabarito oficial continua sendo a fonte da alternativa correta;
              explicações passam por conferência antes de publicação.
            </p>
          </article>
        </div>
      </section>

      <section id="evidencias" aria-labelledby="titulo-evidencias" className="rounded-lg bg-fundo-suave p-5 sm:p-6">
        <h2 id="titulo-evidencias" className="text-xl font-semibold">O que embasa o método</h2>
        <p className="mt-3 leading-7 text-suave">
          A página não promete aprovação. Ela parte de estudos sobre prática de
          recuperação e revisão distribuída. A meta-análise de Donoghue e Hattie
          reúne 242 estudos e aponta essas duas técnicas entre as mais eficazes;
          a revisão de Rowland compara resolver questões com reler o conteúdo.
        </p>
        <p className="mt-4 text-sm">
          <a
            href="https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7889502/"
            className="text-marca underline"
            rel="noreferrer"
          >
            Consultar a fonte sobre prática de recuperação
          </a>
        </p>
      </section>

      <section aria-labelledby="titulo-estado" className="py-6 sm:py-8">
        <h2 id="titulo-estado" className="text-xl font-semibold">O que existe hoje</h2>
        <p className="mt-3 leading-7 text-suave">
          O lançamento é web responsivo e reúne conta, plano do dia, sessão de
          questões e progresso. Tutor, ranking, gamificação além da sequência e
          diagnóstico adaptativo não fazem parte desta oferta atual.
        </p>
      </section>

      <footer className="flex flex-wrap gap-x-5 gap-y-2 border-t border-linha py-6 text-sm">
        <Link href="/termos" className="text-marca underline">Termos de uso</Link>
        <Link href="/privacidade" className="text-marca underline">Privacidade</Link>
        <Link href="/checkout" className="text-marca underline">Checkout</Link>
      </footer>
    </Shell>
  );
}
