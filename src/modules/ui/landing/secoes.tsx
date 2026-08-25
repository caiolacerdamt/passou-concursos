import Image from "next/image";
import Link from "next/link";

import type { PrecosPublicos } from "@/modules/pagamentos/preco";

import { BotaoDiscreto, BotaoPrincipal, Faixa } from "./estrutura";
import { IconeTraco, IconeVisto } from "./marca";

export function Heroi() {
  return (
    <section className="px-5 pb-0 pt-16 sm:px-8 sm:pt-24">
      <div className="mx-auto w-full max-w-lp">
        <h1 className="max-w-[16ch] text-display text-balance sm:text-display-lg">
          Você não precisa estudar tudo. Precisa estudar o que cai.
        </h1>

        <p className="mt-8 max-w-[52ch] text-subtitulo text-tinta-suave">
          A gente lê as provas oficiais do Banco do Brasil e mede quanto cada assunto
          apareceu. Essa medida entra no peso do seu plano de hoje — no lugar do seu
          palpite.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <BotaoPrincipal href="/checkout">Ver a oferta</BotaoPrincipal>
          <BotaoDiscreto href="#metodo">Como funciona</BotaoDiscreto>
        </div>
      </div>

      {/*
        A arte tem alpha de verdade — `scripts/design/recortar-fundo.mjs` come o
        fundo por flood fill a partir das bordas. Foi o que permitiu abandonar o
        `mix-blend-darken` que disfarçava o retângulo: o blend só funcionava
        contra uma cor chapada, e comeria as peças claras deste estilo (camisa,
        tênis) junto com o fundo.
      */}
      {/*
        Duas camadas para o movimento: a de fora desloca com o scroll, a de
        dentro faz a entrada. Empilhar as duas no mesmo elemento faria uma
        animação de `y` cancelar a outra.
      */}
      <div data-parallax className="mx-auto mt-6 w-full max-w-lp sm:mt-10">
        <Image
          data-arte-heroi
          src="/arte/prova-lida.png"
          alt=""
          width={1536}
          height={1024}
          priority
          sizes="(max-width: 68rem) 100vw, 68rem"
          className="h-auto w-full"
        />
      </div>
    </section>
  );
}

const METODO = [
  {
    titulo: "A frequência é medida, não é opinião",
    texto:
      "Só questão vinda de prova real entra na conta de quanto um assunto cai. Questão inédita nunca entra nessa medida — é isso que faz o número significar alguma coisa.",
  },
  {
    titulo: "O plano do dia sai de regra, não de IA",
    texto:
      "Quem decide o que você estuda hoje é o seu próprio histórico rodando numa regra. A IA escreve a frase que explica o plano, e só isso.",
  },
  {
    titulo: "A revisão volta antes de você esquecer",
    texto:
      "Cada resposta reajusta quando aquele assunto precisa reaparecer. Errou, volta antes; acertou com folga, volta depois.",
  },
  {
    titulo: "A alternativa certa é a do gabarito oficial",
    texto:
      "A IA não decide resposta. A alternativa vem do gabarito da banca e é conferida por código antes de existir para você.",
  },
];

export function Metodo() {
  return (
    <Faixa id="metodo" rotulo="titulo-metodo" fundo="alto">
      <h2 id="titulo-metodo" className="max-w-[18ch] text-titulo text-balance">
        Quatro decisões que mudam o resultado
      </h2>

      <dl className="mt-14">
        {METODO.map((item, indice) => (
          <div
            key={item.titulo}
            className={`grid gap-x-12 gap-y-3 py-9 sm:grid-cols-[minmax(0,20rem)_1fr] ${
              indice > 0 ? "border-t border-risco" : ""
            }`}
          >
            <dt className="text-subtitulo font-medium text-verde">{item.titulo}</dt>
            <dd className="max-w-[62ch] text-corpo text-tinta-suave">{item.texto}</dd>
          </div>
        ))}
      </dl>
    </Faixa>
  );
}

export function Evidencias() {
  return (
    <Faixa id="evidencias" rotulo="titulo-evidencias">
      {/*
        Duas colunas com o título fixo à esquerda: a seção é uma afirmação forte
        seguida da justificativa, e empilhar as duas deixaria metade da largura
        vazia num monitor grande.
      */}
      <div className="grid gap-x-12 gap-y-8 sm:grid-cols-[minmax(0,22rem)_1fr]">
        <h2 id="titulo-evidencias" className="text-titulo text-balance">
          Esta página não promete aprovação
        </h2>

        <div className="max-w-[58ch] space-y-5 text-corpo text-tinta-suave">
          <p>
            Promete método com evidência. Responder questão e revisar espaçado são duas
            das técnicas mais bem estudadas que existem — e são as duas que este produto
            automatiza.
          </p>
          <p>
            A meta-análise de <span className="text-tinta">Donoghue e Hattie</span> reúne
            242 estudos e coloca as duas entre as mais eficazes. A revisão de{" "}
            <span className="text-tinta">Rowland</span> compara resolver questões com
            reler o conteúdo, e a diferença não é pequena.
          </p>
          <p>
            <a
              href="https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7889502/"
              rel="noreferrer"
              className="text-verde-texto underline underline-offset-4 hover:text-verde"
            >
              Consultar a fonte sobre prática de recuperação
            </a>
          </p>
        </div>
      </div>
    </Faixa>
  );
}

const NO_AR = [
  "Plano do dia, montado a partir do seu histórico",
  "Sessão de questões de provas reais, com gabarito oficial",
  "Progresso e sequência de dias",
  "Sua conta e seus dados",
];

const FORA = [
  "Tutor de dúvidas com IA",
  "Tela própria do Raio-X — a medida pesa no plano, mas ainda não tem tela",
  "Diagnóstico adaptativo de entrada",
  "Gamificação além da sequência de dias",
];

export function Hoje() {
  return (
    <Faixa rotulo="titulo-hoje" fundo="recuo">
      <h2 id="titulo-hoje" className="max-w-[20ch] text-titulo text-balance">
        O que existe hoje, e o que ainda não
      </h2>

      <p className="mt-6 max-w-[62ch] text-corpo text-tinta-suave">
        O produto está sendo construído inteiro, mas nem tudo nasce ligado. Você compra o
        que está desta coluna para a esquerda.
      </p>

      <div className="mt-12 grid gap-x-12 gap-y-10 sm:grid-cols-2">
        <div>
          <h3 className="text-[0.8125rem] font-medium uppercase tracking-wider text-verde-texto">
            No ar nesta oferta
          </h3>
          <ul className="mt-5 space-y-4">
            {NO_AR.map((item) => (
              <li key={item} className="flex gap-3 text-corpo">
                <IconeVisto className="mt-1 size-4 shrink-0 text-verde" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-[0.8125rem] font-medium uppercase tracking-wider text-tinta-suave">
            Ainda não
          </h3>
          <ul className="mt-5 space-y-4">
            {FORA.map((item) => (
              <li key={item} className="flex gap-3 text-corpo text-tinta-suave">
                <IconeTraco className="mt-1 size-4 shrink-0 text-risco" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mt-12 max-w-[62ch] border-t border-risco pt-8 text-corpo text-tinta-suave">
        <span className="text-tinta">Ranking entre alunos não está nessa lista de espera.</span>{" "}
        Você disputa vaga com quem estuda ao seu lado; expor quem está atrás não ajuda
        ninguém a passar. A comparação aqui é sempre com você mesmo.
      </p>
    </Faixa>
  );
}

export function Precos({ precos }: { precos: PrecosPublicos }) {
  return (
    <Faixa id="precos" rotulo="titulo-precos" fundo="alto">
      <h2 id="titulo-precos" className="max-w-[18ch] text-titulo text-balance">
        Uma matrícula, dois jeitos de pagar
      </h2>

      <div className="mt-12 grid gap-x-12 gap-y-10 sm:grid-cols-2">
        <div>
          <p className="text-[0.8125rem] font-medium uppercase tracking-wider text-tinta-suave">
            No cartão
          </p>
          <p className="mt-3 text-titulo tabular-nums">
            {precos.parcelado.parcelas}x de até {precos.parcelado.parcelaFormatada}
          </p>
          <p className="mt-3 max-w-[42ch] text-[0.9375rem] leading-6 text-tinta-suave">
            Total de {precos.parcelado.totalFormatado}. A última parcela pode ter ajuste de
            centavos.
          </p>
        </div>

        <div className="sm:border-l sm:border-risco sm:pl-12">
          <p className="text-[0.8125rem] font-medium uppercase tracking-wider text-verde-texto">
            À vista, no Pix ou boleto
          </p>
          <p className="mt-3 text-titulo tabular-nums text-verde">
            {precos.aVista.totalFormatado}
          </p>
          <p className="mt-3 max-w-[42ch] text-[0.9375rem] leading-6 text-tinta-suave">
            O mesmo acesso de 12 meses, com o desconto aplicado.
          </p>
        </div>
      </div>

      <div className="mt-12 rounded-bloco bg-ouro-fundo p-7 sm:p-8">
        <h3 className="text-subtitulo font-medium text-ouro-texto">
          Garantia de {precos.garantiaDias} dias
        </h3>
        <p className="mt-3 max-w-[62ch] text-corpo text-tinta-suave">
          Contados em dias corridos a partir da confirmação do pagamento. Dentro da janela,
          você pede e recebe de volta — sem precisar justificar por que desistiu.
        </p>
      </div>

      {/*
        Legal antes do CTA, e não no rodapé: PAG-08 AC4 pede os dois links, e a
        ordem importa porque a próxima coisa que a pessoa faz é pagar.
      */}
      <p className="mt-10 max-w-[62ch] text-[0.9375rem] leading-6 text-tinta-suave">
        Antes de continuar, leia os{" "}
        <Link href="/termos" className="text-verde-texto underline underline-offset-4">
          Termos de uso
        </Link>{" "}
        e a{" "}
        <Link href="/privacidade" className="text-verde-texto underline underline-offset-4">
          Política de privacidade
        </Link>
        .
      </p>

      <BotaoPrincipal href="/checkout" className="mt-8">
        Conferir o checkout
      </BotaoPrincipal>
    </Faixa>
  );
}
