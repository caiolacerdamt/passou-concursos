import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";

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
   Herói. `flow` com título cinético e a cena em movimento contínuo. Sem
   fixação: a primeira tela não deve segurar ninguém, deve deixar passar.

   **Uma imagem só, não duas.** A rodada anterior compunha o herói com dois
   recortes sobrepostos (`leo-pilha` + `bia-medido`) posicionados em absoluto.
   Funcionava no desktop e desmontava no celular: os dois recortes brigavam
   pela mesma faixa estreita e cada um saía cortado por uma borda diferente.
   `heroi-medida.png` é a mesma cena desenhada de uma vez — papel solto à
   esquerda, folhas de pé no meio, barras verdes à direita — então ela não tem
   como desalinhar, porque não há duas peças para alinhar.

   O movimento é de três origens somadas, e nenhuma delas depende da outra:
     · `--sc-p` da seção  → a cena sobe e cresce enquanto a página desce;
     · relógio do CSS     → flutuação lenta e a varredura que atravessa a cena;
     · ponteiro           → `data-sc-tilt`, que só existe em mouse.
   Assim há movimento no primeiro quadro, antes de qualquer rolagem — que é o
   que faz a página parecer viva na entrada.

   A cena entra com `priority`: é o que a primeira tela mostra, e carregar
   preguiçoso o que já está em vista é o caminho mais curto para um salto de
   layout.                                                                 */
export function Heroi({ frequencia }: { frequencia: FrequenciaReal }) {
  /* A fita é dado, não enfeite: nome de tópico e contagem reais do acervo. Uma
     lista fixa escrita na copy congelaria na próxima prova ingerida. */
  const fita = frequencia.topicos.slice(0, 14);

  return (
    <section className="secao secao--heroi" data-sc-act="flow" aria-labelledby="t1">
      <div className="faixa">
        <div className="heroi">
          <div className="heroi__texto">
            <p className="rotulo" data-sc-in>
              Banco do Brasil · {frequencia.totalProvas} provas oficiais lidas
            </p>
            {/* Sem `<em>` aqui dentro: `data-sc-kinetic` reconstrói o elemento a
                partir de `textContent`, então qualquer marcação interna some na
                hidratação. Ênfase no herói é tamanho, não cor. */}
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
            <div className="heroi__palco" data-sc-tilt="4">
              <Image
                className="heroi__cena"
                src="/arte/heroi-medida.png"
                alt=""
                width={1536}
                height={948}
                priority
                sizes="(max-width: 899px) 100vw, 52vw"
              />
              {/* A varredura é a medição acontecendo: uma faixa clara que
                  atravessa a cena da pilha até as barras. Desligada em
                  movimento reduzido. */}
              <span className="heroi__varredura" aria-hidden="true" />
            </div>
            <span className="heroi__chao" aria-hidden="true" />
          </div>
        </div>
      </div>

      {/*
        A fita é `aria-hidden` porque é a mesma informação que o pico entrega
        em texto de verdade, com rótulo e número: repetir isso no leitor de
        tela seria ruído, não acesso. A lista é duplicada para o laço fechar
        sem salto — a segunda cópia entra em `aria-hidden` de qualquer forma.
      */}
      <div className="fita" aria-hidden="true">
        <div className="fita__trilho">
          {[0, 1].map((copia) => (
            <ul className="fita__lista" key={copia}>
              {fita.map((topico) => (
                <li className="fita__item" key={topico.topico}>
                  <span className="fita__n">{topico.questoes}</span>
                  {topico.topico}
                </li>
              ))}
            </ul>
          ))}
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
   voltar.

   **A linha que percorre.** O trilho à esquerda das falas é o movimento da
   seção: uma haste que se preenche, um ponto que desce por ela e três nós que
   acendem quando o ponto passa. Tudo isso é CSS lendo `--sc-p` — o motor já
   publica o progresso do ato no elemento da seção, e propriedade customizada
   herda, então nenhum JavaScript novo entra na página por causa disto. O
   trilho não é enfeite: ele é a régua que diz ao leitor quanto falta e em qual
   dos três momentos ele está, que era exatamente o que a seção não dizia.

   A torre também anda: sobe e cresce com o mesmo `--sc-p`. Ela é grande de
   propósito — o contraste de escala entre a figura e a pilha é o argumento. */
export function Problema({ frequencia }: { frequencia: FrequenciaReal }) {
  /* Os dois extremos reais do acervo. "Um tópico vale trinta questões e outro
     vale nenhuma" seria retórica: estes dois números são consulta. */
  const maior = frequencia.topicos[0];
  const menor = frequencia.topicos[frequencia.topicos.length - 1];

  return (
    <section
      className="secao secao--problema"
      data-sc-act="pin"
      data-sc-span="3.2"
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
              sizes="(max-width: 899px) 62vw, 46vw"
              alt="Um homem sentado no chão ao pé de uma torre gigante de provas e livros que se curva sobre ele"
            />
          </figure>

          <div className="palco__coluna">
            <div className="trilho" aria-hidden="true">
              <span className="trilho__haste" />
              <span className="trilho__ponto" />
              <span className="trilho__no" style={{ "--em": 0.04 } as CSSProperties} />
              <span className="trilho__no" style={{ "--em": 0.42 } as CSSProperties} />
              <span className="trilho__no" style={{ "--em": 0.78 } as CSSProperties} />
            </div>

            <div className="falas">
              {/* Terceiro valor 0 = saudação: o palco fica visível cerca de uma
                  tela antes de o progresso sair de 0, então a primeira fala tem
                  que já estar lá. Sem isso o leitor encara palco vazio. */}
              <div className="fala" data-sc-cue="0 0.38 0">
                <p className="rotulo rotulo--claro">O que o edital entrega</p>
                <h2 id="t2" className="titulo titulo--claro">
                  O edital mente por omissão.
                </h2>
                <p className="lede lede--clara">
                  Ele lista {frequencia.totalTopicos} tópicos com a mesma cara: mesmo
                  tamanho, mesma fonte, mesma ordem. Como se caíssem igual.
                </p>
              </div>
              <div className="fala" data-sc-cue="0.36 0.74">
                <p className="rotulo rotulo--claro">O que a prova fez com eles</p>
                <p className="titulo titulo--claro">Não caem igual. Nunca caíram.</p>
                <p className="lede lede--clara">
                  <em>{maior.topico}</em> apareceu {maior.questoes} vezes nas provas
                  lidas. <em>{menor.topico}</em> apareceu{" "}
                  {menor.questoes === 1 ? "uma" : menor.questoes}. O edital não te conta
                  qual é qual, e não é trabalho dele contar.
                </p>
              </div>
              <div className="fala" data-sc-cue="0.72 1 0.12 0.02">
                <p className="rotulo rotulo--claro">O que sobra para você</p>
                <p className="titulo titulo--claro">Aí você estuda o que dá.</p>
                <p className="lede lede--clara">
                  Na ordem que der, no fôlego que der. E descobre onde estava o peso no
                  único dia em que não dá mais para corrigir.
                </p>
              </div>
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

        {/*
          A evidência era título, parágrafo e link soltos no chão da seção — a
          afirmação mais forte da página entregue com o menor peso visual dela.
          Agora é um bloco: painel elevado, o número grande de um lado, a frase
          e a fonte do outro, e a arte encostando na quina em vez de flutuar
          sozinha num vazio.

          O número é o argumento, então ele ganha o corpo de um numerão e conta
          na entrada. `242` é dado citado da meta-análise, não estimativa nossa:
          por isso pode virar contador — a proibição é inventar número, não
          animar número real.
        */}
        <aside className="evidencia">
          <div className="evidencia__painel" data-sc-in data-sc-stagger="80">
            <div className="evidencia__medida">
              <p className="rotulo">Isto não é opinião nossa</p>
              <p className="evidencia__n">
                <span
                  className="sc-nums"
                  data-sc-count="0 242"
                  data-sc-count-at="0.42 0.72"
                >
                  242
                </span>
              </p>
              <p className="evidencia__legenda">
                estudos reunidos numa meta-análise só
              </p>
            </div>

            <div className="evidencia__texto">
              <h3 className="titulo">
                Responder questão e revisar espaçado estão no topo da lista.
              </h3>
              <p className="lede">
                <em>Donoghue e Hattie</em> compararam as técnicas de estudo que a
                literatura já mediu de verdade. Essas duas ficaram entre as mais
                eficazes que existem. São exatamente as duas que este produto
                automatiza para você, todo dia, sem você precisar lembrar.
              </p>
              <p className="evidencia__fonte">
                <a
                  className="elo"
                  href="https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7889502/"
                  rel="noreferrer"
                >
                  Consultar a fonte sobre prática de recuperação
                </a>
              </p>
            </div>
          </div>

          <figure className="evidencia__arte figura" data-sc-parallax="0.45">
            <Image
              src="/arte/a5-marcos-carimbo.png"
              width={1024}
              height={1024}
              loading="lazy"
              sizes="(max-width: 899px) 70vw, 32vw"
              alt="Um homem carimbando uma folha de gabarito atrás de um balcão"
            />
          </figure>
        </aside>
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
          {/* Ver a nota em `.figura`, no CSS: estas três artes deixaram de
              "aparecer" por corte de `clip-path` e passaram a andar junto com a
              seção. Aparição é evento; movimento contínuo é presença. */}
          <figure className="hoje__arte figura" data-sc-parallax="0.4">
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
          <div className="razonete" style={{ "--lado": -1 } as CSSProperties}>
            <div className="cartao cartao--alto cartao--dentro" data-sc-tilt="7">
              <p className="rotulo">No ar nesta oferta</p>
              <ul className="lista lista--dentro">
                {NO_AR.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="razonete" style={{ "--lado": 1 } as CSSProperties}>
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
          <figure className="fecho__arte figura" data-sc-parallax="0.35">
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
