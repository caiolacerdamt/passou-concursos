import Image from "next/image";
import Link from "next/link";

import { type FrequenciaReal, inteiroEmPtBr } from "@/modules/acervo";
import { type PrecosPublicos, formatarBRL } from "@/modules/pagamentos/preco";

/* ==========================================================================
   As seis seções que não são o pico. A quarta mora em `pico.tsx`.

   Todas são server components: o motor de scroll só lê o DOM que elas
   produzem, exatamente como a rodada anterior fazia com o GSAP. O que cada
   seção declara para o motor é o par `data-sc-act` + `data-sc-span`; o resto
   dos `data-sc-*` são cues, revelações e entradas.
   ========================================================================== */

/* ============================================================== SEÇÃO 1 ==
   Herói. `flow` com título cinético e paralaxe na arte. Sem fixação: a
   primeira tela não deve segurar ninguém, deve deixar passar.

   A arte tem peso igual ao do texto — é metade da composição, não um enfeite
   ao lado dela. As duas imagens do herói entram com `priority`: são o que a
   primeira tela mostra, e carregar preguiçoso o que já está em vista é o
   caminho mais curto para um salto de layout.                             */
export function Heroi() {
  return (
    <section className="secao secao--heroi" data-sc-act="flow" aria-labelledby="t1">
      <div className="faixa">
        <div className="heroi">
          <div className="heroi__texto">
            <p className="rotulo" data-sc-in>
              Banco do Brasil · 28 provas oficiais lidas
            </p>
            <h1 id="t1" className="display" data-sc-in data-sc-kinetic="lines">
              Estude o que cai. Não o edital inteiro.
            </h1>
            <p className="lede" data-sc-in>
              A gente leu as provas oficiais e contou quanto cada assunto apareceu. Essa
              medida entra no peso do seu plano de hoje, no lugar do seu palpite.
            </p>
            <div className="heroi__acoes" data-sc-in>
              <a className="botao botao--grande" href="#oferta">
                Ver a oferta
              </a>
              <a className="botao botao--grande botao--vazado" href="#metodo">
                Como funciona
              </a>
            </div>
            <p className="micro" data-sc-in>
              Garantia de 7 dias · sem ranking entre alunos · questões com banca, ano e
              número
            </p>
          </div>

          <div className="heroi__arte">
            <Image
              className="arte arte--tras"
              src="/arte/leo-pilha.png"
              alt=""
              width={1024}
              height={1024}
              priority
              sizes="(max-width: 899px) 60vw, 30vw"
              data-sc-parallax="0.7"
            />
            <Image
              className="arte arte--frente"
              src="/arte/bia-medido.png"
              alt=""
              width={1024}
              height={1024}
              priority
              sizes="(max-width: 899px) 70vw, 38vw"
              data-sc-parallax="1.3"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================== SEÇÃO 2 ==
   O problema. `pin`: a arte segura enquanto as falas se substituem.

   Cada fala é um BLOCO empilhado na mesma célula do grid, não um parágrafo
   solto com margem. Parágrafo solto colide assim que um título quebra numa
   linha a mais — foi um defeito real, e é esta estrutura que o impede de
   voltar.                                                                 */
export function Problema() {
  return (
    <section
      className="secao secao--problema"
      data-sc-act="pin"
      data-sc-span="2.6"
      aria-labelledby="t2"
    >
      <div data-sc-stage className="palco">
        <div className="faixa palco__grade">
          <figure className="palco__arte">
            <Image
              src="/arte/a2-leo-noite.png"
              width={1024}
              height={1024}
              loading="lazy"
              sizes="(max-width: 899px) 80vw, 45vw"
              alt="Um homem sentado no chão ao pé de uma torre gigante de provas e livros que se curva sobre ele"
            />
          </figure>

          <div className="falas">
            {/* Terceiro valor 0 = saudação: o palco fica visível cerca de uma
                tela antes de o progresso sair de 0, então a primeira fala tem
                que já estar lá. Sem isso o leitor encara palco vazio. */}
            <div className="fala" data-sc-cue="0 0.36 0">
              <h2 id="t2" className="titulo titulo--claro">
                O edital mente por omissão.
              </h2>
              <p className="lede lede--clara">
                Ele lista tudo com a mesma cara. Cada tópico do mesmo tamanho, na mesma
                fonte, na mesma ordem.
              </p>
            </div>
            <div className="fala" data-sc-cue="0.32 0.68">
              <p className="titulo titulo--claro">Como se caíssem igual.</p>
              <p className="lede lede--clara">
                Não caem. Nunca caíram. E não é trabalho do edital te contar qual é qual.
              </p>
            </div>
            <div className="fala" data-sc-cue="0.64 1 0.12 0.02">
              <p className="titulo titulo--claro">Aí você estuda o que dá.</p>
              <p className="lede lede--clara">
                Na ordem que der. E no dia da prova descobre onde estava o peso.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================== SEÇÃO 3 ==
   Alguém contou. Seção alta de propósito: o número precisa de curso de scroll
   para chegar e assentar. `reveal` grande mais contador em pt-BR.         */
export function Medida({ frequencia }: { frequencia: FrequenciaReal }) {
  return (
    <section className="secao secao--medida" data-sc-act="flow" aria-labelledby="t3">
      <div className="faixa">
        <div className="medida__grade">
          <div>
            <p className="rotulo" data-sc-in>
              Então alguém sentou e contou
            </p>
            {/* O `padding-block` do `.medida` no CSS não é folga estética: o
                `clip-path` do reveal corta a caixa, e a caixa de um numerão com
                line-height 1 é mais curta que os glifos. Sem ele o wipe decepa
                o topo dos algarismos. */}
            <div className="medida" data-sc-reveal="up" data-sc-reveal-at="0.08 0.4">
              <p className="numerao">
                <span className="sc-nums" data-conta={frequencia.totalQuestoes}>
                  {inteiroEmPtBr(frequencia.totalQuestoes)}
                </span>
              </p>
              <h2 id="t3" className="titulo titulo--gigante">
                questões de prova real, contadas uma a uma.
              </h2>
            </div>
          </div>
          <figure
            className="medida__arte"
            data-sc-reveal="left"
            data-sc-reveal-at="0.16 0.52"
          >
            <Image
              src="/arte/a3-dani-uma-folha.png"
              width={1024}
              height={1024}
              loading="lazy"
              sizes="(max-width: 899px) 90vw, 34vw"
              alt="Uma mulher puxando uma única folha de uma nuvem de papéis idênticos"
            />
          </figure>
        </div>

        <div className="medida__pe">
          <p className="lede" data-sc-in>
            De {frequencia.totalProvas} provas oficiais do Banco do Brasil, entre{" "}
            {frequencia.primeiroAno} e {frequencia.ultimoAno}. Cada uma com banca, ano,
            órgão, cargo e número na etiqueta.
          </p>
          <p className="lede lede--fraca" data-sc-in>
            Questão inédita não entra nessa conta. É isso, e só isso, que faz o número
            significar alguma coisa.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ============================================================== SEÇÃO 5 ==
   O método. Três cartões com entrada escalonada e inclinação ao ponteiro.
   Copy curta de propósito: a seção anterior gastou o fôlego do leitor.    */
const PILARES = [
  {
    chave: "01",
    titulo: "A alternativa certa",
    texto:
      "Vem do gabarito oficial da banca e é conferida por código. A IA não escolhe resposta.",
  },
  {
    chave: "02",
    titulo: "A hora da revisão",
    texto:
      "Errou, volta antes. Acertou com folga, volta depois. Escolher isso cansado é o que estraga o estudo.",
  },
  {
    chave: "03",
    titulo: "O plano do dia",
    texto:
      "Sai do seu histórico rodando numa regra, com a frequência medida no peso. A IA só escreve a frase.",
  },
];

export function Metodo() {
  return (
    <section
      className="secao secao--metodo"
      id="metodo"
      data-sc-act="flow"
      aria-labelledby="t5"
    >
      <div className="faixa">
        <h2 id="t5" className="titulo titulo--gigante" data-sc-in>
          Três coisas que a IA <em className="realce">não</em> decide aqui
        </h2>

        {/* `data-sc-stagger` sozinho não revela nada: o motor só observa
            `[data-sc-in]` e lê o stagger DESSE elemento. Sem o `data-sc-in` os
            filhos ficam em `opacity: 0` para sempre — defeito já pago uma vez. */}
        <div className="pilares" data-sc-in data-sc-stagger="90">
          {PILARES.map((pilar) => (
            <article className="cartao" data-sc-tilt="6" key={pilar.chave}>
              <p className="cartao__k">{pilar.chave}</p>
              <h3 className="cartao__t">{pilar.titulo}</h3>
              <p className="cartao__p">{pilar.texto}</p>
            </article>
          ))}
        </div>

        <div className="evidencia">
          <div className="evidencia__texto" data-sc-in>
            <h3 className="titulo">Isto não é opinião nossa.</h3>
            <p className="lede">
              A meta-análise de <em>Donoghue e Hattie</em> reúne{" "}
              <span
                className="sc-nums"
                data-sc-count="0 242"
                data-sc-count-at="0.2 0.6"
              >
                242
              </span>{" "}
              estudos e coloca responder questão e revisar espaçado entre as técnicas
              mais eficazes que existem.
            </p>
            <p>
              <a
                className="elo"
                href="https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7889502/"
                rel="noreferrer"
              >
                Consultar a fonte sobre prática de recuperação
              </a>
            </p>
          </div>
          <figure
            className="evidencia__arte"
            data-sc-reveal="left"
            data-sc-reveal-at="0.3 0.68"
          >
            <Image
              src="/arte/a5-marcos-carimbo.png"
              width={1024}
              height={1024}
              loading="lazy"
              sizes="(max-width: 899px) 90vw, 38vw"
              alt="Um homem carimbando uma folha de gabarito atrás de um balcão"
            />
          </figure>
        </div>
      </div>
    </section>
  );
}

/* ============================================================== SEÇÃO 6 ==
   Hoje × ainda não. Dois cartões que entram de bordas opostas e se inclinam
   sob o ponteiro. Ele lê o que NÃO existe antes de ver o preço, que é a ordem
   honesta (AD-076).                                                        */
const NO_AR = [
  "Plano do dia, montado a partir do seu histórico",
  "Sessão de questões de prova real, com gabarito oficial conferido",
  "Progresso e sequência de dias",
  "Sua conta e seus dados, com exclusão a pedido",
];

const AINDA_NAO = [
  "Tutor de dúvidas com IA",
  "Tela própria do Raio-X — a medida já pesa no plano, mas ainda não tem tela",
  "Diagnóstico adaptativo de entrada",
  "Gamificação além da sequência de dias",
];

export function Hoje() {
  return (
    <section
      className="secao secao--hoje"
      id="hoje"
      data-sc-act="flow"
      aria-labelledby="t6"
    >
      <div className="faixa">
        <div className="hoje__cabeca">
          <div>
            <h2 id="t6" className="titulo titulo--gigante" data-sc-in>
              O que existe hoje, e o que ainda não
            </h2>
            <p className="lede" data-sc-in>
              O produto está sendo construído inteiro, mas nem tudo nasce ligado. Você
              compra o cartão da esquerda.
            </p>
          </div>
          <figure
            className="hoje__arte"
            data-sc-reveal="up"
            data-sc-reveal-at="0.06 0.4"
          >
            <Image
              src="/arte/a6-rafa-listas.png"
              width={1024}
              height={1024}
              loading="lazy"
              sizes="(max-width: 899px) 90vw, 30vw"
              alt="Uma mulher entre dois painéis: o da esquerda, verde, tem quatro marcas de visto; o da direita está vazio"
            />
          </figure>
        </div>

        {/* Uma cue por bloco, e não uma no invólucro inteiro: a régua compara a
            cor do texto contra o pixel mais escuro do bloco, e um invólucro que
            contém o preenchimento do botão reprova no celular. */}
        <div className="razonetes">
          <div className="razonete" data-sc-reveal="right" data-sc-reveal-at="0.12 0.5">
            <div className="cartao cartao--alto cartao--dentro" data-sc-tilt="7">
              <p className="rotulo">No ar nesta oferta</p>
              <ul className="lista lista--dentro">
                {NO_AR.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="razonete" data-sc-reveal="left" data-sc-reveal-at="0.12 0.5">
            <div className="cartao cartao--alto cartao--fora" data-sc-tilt="7">
              <p className="rotulo rotulo--cinza">Ainda não</p>
              <ul className="lista lista--fora">
                {AINDA_NAO.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <p className="nota" data-sc-in>
          <strong>Ranking entre alunos não está nessa lista de espera.</strong> Você
          disputa vaga com quem estuda ao seu lado; expor quem está atrás não ajuda
          ninguém a passar. A comparação aqui é sempre com você mesmo.
        </p>
      </div>
    </section>
  );
}

/* ============================================================== SEÇÃO 7 ==
   O fecho. `flow`, não `pin`.

   Foi ato fixado numa rodada anterior e o palco de 100vh não comportava
   título gigante + arte + dois cartões de preço + garantia + legal + CTA:
   sobrava rolagem aninhada dentro do palco, e o texto legal acabava medido
   contra o rodapé escuro. Conteúdo que não cabe numa tela não é ato fixado —
   é seção.                                                                 */
function BeneficiosDoPlano({ garantiaDias }: { garantiaDias: number }) {
  return (
    <ul className="lista lista--dentro lista--miuda">
      <li>12 meses de acesso</li>
      <li>Plano do dia montado do seu histórico</li>
      <li>Questões de prova real com gabarito oficial</li>
      <li>Garantia de {garantiaDias} dias</li>
    </ul>
  );
}

export function Oferta({ precos }: { precos: PrecosPublicos }) {
  /*
   * O selo é **calculado**, nunca escrito à mão: preço e desconto moram na
   * tabela de configuração (INFRA-11) e mudam sem deploy. Um "Economize R$
   * 19,70" digitado na copy viraria mentira no dia em que o desconto mudasse.
   */
  const economia = formatarBRL(
    precos.parcelado.totalCentavos - precos.aVista.totalCentavos,
  );

  return (
    <section
      className="secao secao--oferta"
      id="oferta"
      data-sc-act="flow"
      aria-labelledby="t7"
    >
      <div className="faixa fecho">
        <div className="fecho__cabeca">
          <div className="fecho__texto">
            <h2
              id="t7"
              className="titulo titulo--gigante"
              data-sc-in
              data-sc-kinetic="lines"
            >
              Esta página não promete aprovação.
            </h2>
            <p className="lede" data-sc-in>
              Promete método com evidência, acervo com proveniência e um plano que sai do
              seu histórico. O resto é você, todo santo dia.
            </p>
          </div>
          <figure
            className="fecho__arte"
            data-sc-reveal="left"
            data-sc-reveal-at="0.08 0.4"
          >
            <Image
              src="/arte/a7-bia-degrau.png"
              width={1024}
              height={1024}
              loading="lazy"
              sizes="(max-width: 899px) 90vw, 34vw"
              alt="Uma mulher subindo o segundo de cinco degraus verdes"
            />
          </figure>
        </div>

        <div className="oferta">
          <p className="rotulo" data-sc-in>
            Uma matrícula, dois jeitos de pagar
          </p>

          <div className="precos" data-sc-in data-sc-stagger="110">
            <article className="cartao cartao--preco" data-sc-tilt="5">
              <p className="preco__k">No cartão</p>
              <p className="preco__v">
                {precos.parcelado.parcelas}x de até{" "}
                <strong>{precos.parcelado.parcelaFormatada}</strong>
              </p>
              <p className="preco__n">
                Total de {precos.parcelado.totalFormatado}. A última parcela pode ter
                ajuste de centavos.
              </p>
              <BeneficiosDoPlano garantiaDias={precos.garantiaDias} />
            </article>

            <article
              className="cartao cartao--preco cartao--destaque"
              data-sc-tilt="5"
            >
              <p className="selo">Economize {economia}</p>
              <p className="preco__k">À vista, no Pix ou boleto</p>
              <p className="preco__v preco__v--verde">
                <strong>{precos.aVista.totalFormatado}</strong>
              </p>
              <p className="preco__n">
                O mesmo acesso de 12 meses, com o desconto aplicado.
              </p>
              <BeneficiosDoPlano garantiaDias={precos.garantiaDias} />
            </article>
          </div>

          <div className="garantia" data-sc-in>
            <h3 className="garantia__t">Garantia de {precos.garantiaDias} dias</h3>
            <p className="garantia__p">
              Contados em dias corridos a partir da confirmação do pagamento. Dentro da
              janela você pede e recebe de volta, sem precisar justificar por que
              desistiu.
            </p>
          </div>

          {/* AC4 de PAG-09: os dois links legais aparecem ANTES do botão que
              leva ao pagamento. A ordem é contrato, não diagramação. */}
          <div className="fecho__acao" data-sc-in>
            <p className="legal">
              Antes de continuar, leia os <Link className="elo" href="/termos">Termos de uso</Link>{" "}
              e a{" "}
              <Link className="elo" href="/privacidade">
                Política de privacidade
              </Link>
              .
            </p>
            <Link className="botao botao--grande" href="/checkout">
              Conferir o checkout
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
