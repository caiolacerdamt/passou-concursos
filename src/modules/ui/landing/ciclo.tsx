import { BotaoPrincipal, Faixa } from "./estrutura";
import { FolhaDeProva, Grafico, Lapis, Relogio, Visto } from "./props";

/**
 * A seção-assinatura: o ciclo de estudo como uma trilha, não como lista.
 *
 * É o equivalente à "jornada" do MindMarket — o lugar onde a página para de
 * afirmar e passa a mostrar como a coisa funciona. É também o alvo do scroll
 * animado: cada passo tem `data-passo`, que é por onde o GSAP pega.
 *
 * Cinco passos e não quatro nem seis porque o ciclo **fecha**: o quinto devolve
 * ao primeiro, e é isso que a seção precisa deixar claro.
 */
const PASSOS = [
  {
    Prop: FolhaDeProva,
    titulo: "Você responde",
    texto: "Uma questão que caiu numa prova de verdade, com banca e ano na etiqueta.",
  },
  {
    Prop: Lapis,
    titulo: "Erra, e diz por quê",
    texto: "Chute, confundi, não sabia. O motivo é seu, e é ele que ensina o plano.",
  },
  {
    Prop: Visto,
    titulo: "Vê o certo",
    texto: "Alternativa do gabarito oficial e explicação revisada antes de chegar em você.",
  },
  {
    Prop: Relogio,
    titulo: "O assunto some",
    texto: "E volta na hora em que você estava prestes a esquecer. Não antes, não depois.",
  },
  {
    Prop: Grafico,
    titulo: "Depois, acerta",
    texto: "E o intervalo estica. O que você já domina para de ocupar o seu dia.",
  },
];

export function Ciclo() {
  return (
    <Faixa id="ciclo" rotulo="titulo-ciclo">
      <h2 id="titulo-ciclo" className="max-w-[16ch] text-titulo text-balance">
        É um ciclo, e ele se fecha sozinho
      </h2>

      <p className="mt-6 max-w-[58ch] text-corpo text-tinta-suave">
        Você não monta nada. Responde, erra, entende e o assunto reaparece na hora certa —
        de novo, até parar de ser um problema.
      </p>

      <ol
        data-trilha
        className="relative mt-16 grid gap-y-12 sm:grid-cols-5 sm:gap-x-6"
      >
        {/*
          A linha vive atrás da trilha e só existe no desktop: no empilhamento
          do celular ela ligaria os passos pelo lugar errado. É `aria-hidden`
          porque a ordem já está no `<ol>`.
        */}
        <span
          data-linha
          aria-hidden
          className="absolute left-0 right-0 top-7 hidden border-t-2 border-dashed border-risco sm:block"
        />

        {PASSOS.map(({ Prop, titulo, texto }, indice) => (
          <li key={titulo} data-passo className="relative flex gap-5 sm:block">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-papel">
              <Prop className="size-8" />
            </span>

            <div className="sm:mt-6">
              <h3 className="text-subtitulo font-medium">
                <span className="mr-2 font-lp-mono text-[0.8125rem] text-tinta-suave tabular-nums">
                  {indice + 1}
                </span>
                {titulo}
              </h3>
              <p className="mt-2 max-w-[34ch] text-[0.9375rem] leading-6 text-tinta-suave">
                {texto}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </Faixa>
  );
}

/**
 * Faixa cheia de verde antes do preço.
 *
 * O MindMarket fecha numa banda amarela sólida; esta é a nossa. Serve para
 * quebrar a sequência de papel bege antes de pedir dinheiro — sem ela a página
 * chega no preço com a mesma temperatura da primeira dobra.
 */
export function Chamada() {
  return (
    <section aria-labelledby="titulo-chamada" className="px-5 py-6 sm:px-8">
      <div className="mx-auto w-full max-w-lp rounded-bloco bg-verde px-8 py-20 sm:px-16 sm:py-28">
        <h2
          id="titulo-chamada"
          className="max-w-[15ch] text-display text-balance text-papel-alto"
        >
          Você não tem tempo sobrando.
        </h2>

        <p className="mt-8 max-w-[48ch] text-subtitulo text-verde-tenue">
          Por isso o plano decide o que estudar, e você só executa. Todo dia, com o que
          sobrou do seu dia.
        </p>

        <div className="mt-10">
          <BotaoPrincipal href="/checkout" tom="claro">
            Começar agora
          </BotaoPrincipal>
        </div>
      </div>
    </section>
  );
}
