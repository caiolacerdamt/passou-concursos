import Link from "next/link";
import Image from "next/image";
import type { CSSProperties } from "react";

import { type PrecosPublicos, formatarBRL } from "@/modules/pagamentos/preco";

import { MARCOS_DA_REVISAO } from "./plano-do-dia";

/* ==========================================================================
   Os atos da landing. O quarto — "o dia se monta" — mora em
   `dia.tsx`, porque é lá que vive o movimento assinatura.

   Todos são server components: o motor de scroll só lê o DOM que eles
   produzem. O par `data-sc-act` + `data-sc-span` declara o ato; o resto dos
   `data-sc-*` são cues, revelações, trilhos e entradas.

   Fora o clipe do herói e a fotografia do post da comunidade, os atos são
   construídos em DOM e CSS. Os exemplos de plano e questão são demonstrações
   da experiência; preço e garantia continuam vindo da configuração pública.
   ========================================================================== */

/* ================================================================ ATO 1 ==
   O corredor. `scrub`: o clipe avança quadro a quadro sob a rolagem.

   O clipe é a viagem inteira em 121 quadros — paredes de prova empilhada, a
   câmera avançando e subindo, e a chegada por cima do ombro de alguém que
   estuda. Ele termina numa **folha em branco**, e a folha é branca de
   propósito: o que se escreve nela é DOM, não pixel. Número desenhado dentro
   de vídeo congela, borra, não é selecionável e vira mentira na próxima prova
   ingerida; em DOM ele vem da consulta e continua verdadeiro.

   `data-sc-clip-map="travel"` amarra o clipe à viagem FIXADA, e não à vida
   visível inteira do palco. Com o mapeamento padrão a viagem só chegava a 64%
   quando o palco soltava: o último terço do filme rodava durante a saída, com
   a copy já apagada — a pessoa via o corredor terminar sozinho num quadro sem
   texto. Amarrado à viagem, o filme fecha exatamente quando o ato solta, e o
   `span` maior dá a ele mais rolagem para acontecer.

   `data-sc-src`, e não `src`, é deliberado: o motor busca o clipe como Blob
   para conseguir buscar quadro sem depender de range HTTP, e pula a busca
   inteira em movimento reduzido. O pôster é segurador de quadro vivo — o iOS
   mantém em branco um vídeo mudo que foi buscado mas nunca tocado, então
   esconder o pôster só porque os metadados chegaram pisca palco vazio.

   **Sem véu.** O gradiente claro que levantava o creme atrás da coluna de
   texto cobria metade do quadro e lia como painel colado sobre o vídeo. O
   corredor já é bege claro e o texto é tinta cheia, então o contraste vem do
   par escuro-sobre-creme, sem camada nenhuma no meio.  */
export function Heroi() {
  return (
    <section
      className="secao secao--heroi"
      data-sc-act="scrub"
      data-sc-span="3.4"
      data-sc-dwell="0.2"
      data-sc-clip-map="travel"
      aria-labelledby="t1"
    >
      <div data-sc-stage className="palco palco--heroi">
        <div className="heroi__quadro">
          {/* eslint-disable-next-line @next/next/no-img-element -- o pôster é
              segurador de quadro do motor: ele precisa da classe
              `sc-stage__poster` e de ficar sob o mesmo `object-fit` do vídeo,
              e `next/image` embrulha a tag num span que quebra os dois. */}
          <img
            className="sc-stage__poster heroi__pintura"
            src="/video/heroi-poster.webp"
            alt=""
            aria-hidden="true"
          />
          <video
            className="heroi__pintura"
            data-sc-scrub
            data-sc-src="/video/heroi.mp4"
            data-sc-src-mobile="/video/heroi-m.mp4"
            playsInline
            muted
            aria-hidden="true"
          />
        </div>

        {/* `0 1 0 0`: entra cheia no primeiro quadro e NUNCA sai. Rampa de
            entrada 0 é a saudação — sem ela a headline nasce desbotada. Rampa
            de saída 0 é a correção desta rodada: a janela antiga apagava a
            copy antes de o ato acabar, então a última parte do herói era vídeo
            mudo sem título. A copy vive dentro do palco e sobe junto com ele
            na saída; quem tira a headline da tela é o palco, não uma opacidade. */}
        <div className="heroi__copy" data-sc-cue="0 1 0 0">
          <h1 id="t1" className="display">
            <span>Você não precisa decidir o que estudar.</span>
            <span>Só precisa estudar.</span>
          </h1>
          <p className="lede">
            Escolha seu concurso e receba um plano de estudos feito para a sua prova,
            atualizado pelo que mais cai, pelo seu desempenho e pelo que você ainda
            precisa dominar.
          </p>
          <div className="heroi__acoes">
            <a className="botao botao--grande" href="#oferta">
              Montar meu plano
            </a>
            <a className="botao botao--grande botao--vazado" href="#plano">
              Como funciona
            </a>
          </div>
          <p className="micro">
            Raio-X da prova · Plano diário personalizado · Acompanhamento do progresso
            · Comunidade
          </p>
        </div>

      </div>
    </section>
  );
}
/* ================================================================ ATO 2 ==
   A pergunta de terça. `pin` + trilho.

   Desconforto, e o desconforto é a lista. À direita o edital corre **sem
   fim**: os tópicos reais do acervo, duplicados e rolando em laço, desfocados
   nas duas bordas para que a lista não tenha começo nem fim visível. É a
   única coisa da página que se move sem a pessoa mandar, e é de propósito:
   o edital não espera você.

   À esquerda, três falas que se substituem na mesma célula do grid — bloco
   empilhado, nunca parágrafo com margem, porque parágrafo solto colide assim
   que um título quebra numa linha a mais. O trilho entre as duas colunas é
   CSS lendo `--sc-p`: nenhum JavaScript novo entra na página por causa dele.

   **O span é 2,8, e não 1,6.** Uma tela e meia é pouco para três falas se
   substituírem no mesmo lugar E o edital se reorganizar em prioridades ao
   lado: quem lia a fala 1 já pegava a fala 2 por cima. O movimento é o mesmo;
   o que mudou é o tempo que cada etapa tem. As rampas escritas em CSS a partir
   de `--sc-p` (`--escolhe`, `--organiza`, `--chega`) foram abertas junto, em
   `landing.css`: span maior com rampa curta continua sendo um estalo, só que
   mais espaçado.

   `aria-hidden` na lista: são os mesmos tópicos que o resto da página já
   nomeia em texto de verdade, e 172 itens de laço no leitor de tela seriam
   ruído puro. O argumento — "são muitos e todos parecem iguais" — está escrito
   na fala 1, que é texto de verdade. */
const ASSUNTOS_DA_DECISAO = [
  { materia: "Língua Portuguesa", topico: "Interpretação de textos", pick: 0.34 },
  { materia: "Matemática", topico: "Porcentagem", pick: 0.46 },
  { materia: "Informática", topico: "Segurança da informação", pick: 0.41 },
  { materia: "Raciocínio Lógico", topico: "Proposições", pick: 0.53 },
  { materia: "Direito Administrativo", topico: "Atos administrativos", pick: 0.37 },
  { materia: "Administração", topico: "Gestão de pessoas", pick: 0.5 },
  { materia: "Matemática", topico: "Probabilidade", pick: 0.44 },
  { materia: "Língua Portuguesa", topico: "Concordância", pick: 0.56 },
  { materia: "Informática", topico: "Redes", pick: 0.39 },
  { materia: "Conhecimentos Específicos", topico: "Gestão de processos", pick: 0.48 },
] as const;

const PRIORIDADES_DA_DECISAO = [
  { topico: "Interpretação de textos", nivel: "Alta prioridade", motivo: "↑ Cai muito" },
  {
    topico: "Porcentagem",
    nivel: "Alta prioridade",
    motivo: "↑ Seu desempenho baixo",
  },
  { topico: "Atos administrativos", nivel: "Média prioridade", motivo: "" },
  { topico: "Concordância", nivel: "Revisar depois", motivo: "" },
] as const;

export function PerguntaDeTerca() {
  const emLaco = [...ASSUNTOS_DA_DECISAO, ...ASSUNTOS_DA_DECISAO];

  return (
    <section
      className="secao secao--terca"
      data-sc-act="pin"
      data-sc-span="2.8"
      aria-labelledby="t2"
    >
      <div data-sc-stage className="palco palco--terca">
        <div className="faixa terca">
          <div className="palco__coluna">
            <div className="trilho" aria-hidden="true">
              <span className="trilho__haste" />
              <span className="trilho__ponto" />
              <span className="trilho__no" style={{ "--em": 0.04 } as CSSProperties} />
              <span className="trilho__no" style={{ "--em": 0.4 } as CSSProperties} />
              <span className="trilho__no" style={{ "--em": 0.76 } as CSSProperties} />
            </div>

            <div className="falas">
              {/* Terceiro valor 0 = saudação: o palco fica visível cerca de uma
                  tela antes de o progresso sair de 0, então a primeira fala tem
                  que já estar lá. Sem isso o leitor encara palco vazio. */}
              <div className="fala" data-sc-cue="0 0.38 0">
                <h2 id="t2" className="titulo titulo--claro">
                  Você sabe o que pode cair.
                  <span>A dúvida é: o que estudar hoje?</span>
                </h2>
              </div>

              <div className="fala" data-sc-cue="0.34 0.74">
                <ul className="escolhas">
                  <li>Sem um plano, você estuda o que lembra.</li>
                  <li>O que parece mais fácil.</li>
                  <li>Ou o que ficou para trás.</li>
                </ul>
              </div>

              {/* Rampa de saída 0, como no herói. Com 0,02 a fala apagava nos
                  dois últimos por cento do ato — e o ato fica em `p = 1` pela
                  tela inteira da saída, então a coluna esquerda passava vazia
                  ao lado da lista de prioridades. Quem tira o texto da tela é
                  o palco subindo, não uma opacidade. */}
              <div className="fala" data-sc-cue="0.7 1 0.14 0">
                <p className="titulo titulo--claro">
                  O problema é que nem todo tópico vale o mesmo.
                  <strong className="realce">Alguns aparecem muito mais na prova.</strong>
                </p>
              </div>
            </div>
          </div>

          <div className="edital" aria-hidden="true">
            <div className="edital__caos">
              <ul className="edital__trilho">
                {emLaco.map((t, i) => (
                  <li
                    className="edital__item"
                    key={`${t.topico}-${i}`}
                    style={{ "--pick": t.pick } as CSSProperties}
                  >
                    <span className="edital__m">{t.materia}</span>
                    <span className="edital__t">{t.topico}</span>
                  </li>
                ))}
              </ul>
            </div>

            <ol className="edital__ordem">
              {PRIORIDADES_DA_DECISAO.map((item, i) => (
                <li
                  className="prioridade"
                  key={item.topico}
                  style={{ "--ordem": i } as CSSProperties}
                >
                  <span className="prioridade__n">0{i + 1}</span>
                  <span className="prioridade__texto">
                    <strong>{item.topico}</strong>
                    <small>
                      {item.nivel}
                      {item.motivo ? ` · ${item.motivo}` : ""}
                    </small>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
/* ================================================================ ATO 3 ==
   Alguém contou. `flow` + contador. O respiro.

   É o silêncio antes do pico, e é proposital que pareça pouco: uma frase, um
   número enorme, nada mais se move. Dois atos vizinhos com o mesmo sentimento
   significam que um deles é enchimento — este existe justamente para o ato 4
   ter de onde subir.

   O contador é o nosso (`data-conta`, em `assinatura.ts`) e não o do motor: o
   `data-sc-count` separa milhar com vírgula, padrão inglês, e 1.395 em
   português leva ponto. */
export function AlguemContou() {
  return (
    <section className="secao secao--contou" data-sc-act="flow" aria-labelledby="t3">
      <div className="faixa contou">
        <p className="lede contou__frase" data-sc-in>
          A gente olha o histórico da sua banca e mostra quais assuntos aparecem mais.
        </p>

        {/* O `padding-block` do `.medida` no CSS não é folga estética: o
            `clip-path` do reveal corta a caixa, e a caixa de um numerão com
            line-height 1 é mais curta que os glifos. Sem ele o wipe decepa o
            topo dos algarismos. */}
        <div className="medida" data-sc-reveal="up" data-sc-reveal-at="0.1 0.42">
          <p className="numerao numerao--gigante">
            MILHARES
          </p>
        </div>

        <h2 id="t3" className="lede contou__pe" data-sc-in>
          de questões de provas oficiais analisadas.
          <span>
            A gente organiza cada uma por matéria, assunto, banca, ano e prova. {" "}
            <em>É daí que saem as prioridades do seu plano.</em>
          </span>
        </h2>
      </div>
    </section>
  );
}
// The footer is mounted by page.tsx after this final offer section.
/* ================================================================ ATO 5 ==
   A questão. `pin`.

   A tela trava num cartão de questão. As alternativas entram uma a uma
   conforme rola; uma é escolhida e o carimbo cai em cima dela. A explicação
   começa pela alternativa **errada**, não pelo gabarito — que é o argumento
   inteiro da seção.

   A questão é **exemplo, e está marcada como exemplo na própria etiqueta**.
   Publicar aqui um item com proveniência inventada seria exatamente o que a
   página promete não fazer duas linhas acima. Quando houver uma questão real
   liberada para vitrine, ela entra no lugar deste bloco e a etiqueta perde o
   "exemplo".

   O carimbo e o realce da alternativa escolhida são CSS lendo `--sc-p`: um
   `clamp` de números puros por elemento, sem JavaScript novo. */
const ALTERNATIVAS = [
  { letra: "A", texto: "R$ 1.200,00" },
  { letra: "B", texto: "R$ 1.260,00", escolhida: true },
  { letra: "C", texto: "R$ 1.276,00", correta: true },
  { letra: "D", texto: "R$ 1.320,00" },
  { letra: "E", texto: "R$ 1.440,00" },
];

export function AQuestao() {
  return (
    <section
      className="secao secao--questao"
      id="questao"
      data-sc-act="pin"
      data-sc-span="1.4"
      aria-labelledby="t5"
    >
      <div data-sc-stage className="palco palco--questao">
        <div className="faixa questao">
          <div className="questao__texto">
            {/* Terceiro valor 0 = saudação. Quarto valor 0 = o título e as
                explicações permanecem legíveis até o último quadro do ato. */}
            <h2 id="t5" className="titulo titulo--claro" data-sc-cue="0 1 0 0">
              Questões de provas reais
            </h2>
            <div className="questao__fala" data-sc-cue="0.06 1 0.16 0">
              <p className="lede lede--clara">
                Você pratica com questões que já apareceram em provas oficiais.
              </p>
            </div>
            <div className="questao__fala" data-sc-cue="0.6 1 0.22 0">
              <p className="lede lede--clara">
                Cada uma vem identificada por banca, ano, órgão, cargo e prova para
                você saber exatamente de onde ela veio.
              </p>
            </div>
          </div>

          {/* PLACEHOLDER — questão de exemplo. Ver a nota acima. */}
          <article className="cartaoq" data-sc-tilt="4">
            <p className="cartaoq__etiqueta">
              <span className="cartaoq__tag">exemplo</span>
              Matemática financeira · juros simples · 3 meses a 2% a.m.
            </p>
            <p className="cartaoq__enunciado">
              Um capital de R$ 1.200,00 é aplicado a juros simples de 2% ao mês.
              Qual o montante ao fim de 3 meses?
            </p>
            <ol className="alts">
              {ALTERNATIVAS.map((a, i) => (
                <li
                  key={a.letra}
                  className={`alt${a.escolhida ? " alt--escolhida" : ""}${
                    a.correta ? " alt--correta" : ""
                  }`}
                  /* Cada alternativa entra num degrau de `--sc-p`. A janela
                     acaba em 0,44 para sobrar rolagem em que as cinco estão na
                     tela juntas antes de o carimbo cair. */
                  style={{ "--em": (0.06 + i * 0.076).toFixed(3) } as CSSProperties}
                >
                  <span className="alt__l">{a.letra}</span>
                  <span className="alt__t">{a.texto}</span>
                  {/* O carimbo mora DENTRO da alternativa que ele carimba. Solto
                      no cartão ele teria que ser posicionado à mão contra a
                      segunda linha, e qualquer quebra de texto o desalinharia. */}
                  {a.escolhida ? (
                    <span className="carimbo" aria-hidden="true">
                      você marcou
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
            <p className="cartaoq__pe">
              A <strong>B</strong> soma 2% uma vez só. Juros simples somam 2% do
              capital em cada um dos 3 meses: R$ 1.200 + 3 × R$ 24,00.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
/* ================================================================ ATO 6 ==
   O que volta. A linha do tempo mostra o mesmo tópico atravessando os marcos
   de revisão; o cartão viajante e a etiqueta são dirigidos por `--sc-p`. */
/* ================================================================ ATO 6 ==
   A revisão volta. `pin` com span 2,6.

   **Era `flow`, e `flow` estava errado para o que esta seção faz.** Em `flow`
   o progresso começa a contar quando o topo da seção encosta na BORDA DE BAIXO
   da tela: o cartão já estava viajando enquanto o leitor ainda via um pedaço
   da seção anterior, e a viagem inteira cabia no pouco mais de uma tela de
   rolagem que uma seção de altura normal tem. Fixada, `--sc-p` só sai de 0
   quando a seção ocupa a tela inteira, e a viagem tem 1,6 tela de rolagem só
   para ela.

   O cartão viaja por uma pista de quatro colunas — o invólucro tem a largura
   de uma coluna e anda 300% dela — então ele PARA em cima de cada marco, em
   vez de deslizar de 0% a 100% e passar reto pelo último ponto, que era o que
   acontecia antes. Cada marco acende quando o cartão chega, e a linha se
   pinta atrás dele. O `--ordem` é o que cada marco usa para saber a própria
   vez; a conta mora no CSS, lendo `--viaja`. */
export function OQueVolta() {
  return (
    <section
      className="secao secao--volta"
      data-sc-act="pin"
      data-sc-span="2.6"
      aria-labelledby="t6"
    >
      {/* SEM `position` no palco: `.sc-stage`, que o motor injeta, é quem traz
          o `position: sticky`. Regra de autor com especificidade maior apaga o
          sticky e o ato deixa de fixar em silêncio. */}
      <div data-sc-stage className="palco palco--volta">
        <div className="faixa volta">
          <div className="volta__cabeca">
            <h2 id="t6" className="titulo titulo--gigante" data-sc-in>
              Estudou hoje? A gente te lembra de revisar.
            </h2>
            <p className="lede" data-sc-in>
              O que você estudou volta para o seu plano nos dias de revisão. Você
              abre, revisa e segue.
            </p>
          </div>

          <div className="timeline-revisao" data-sc-in>
            <ol className="timeline-revisao__marcos">
              {MARCOS_DA_REVISAO.map((m, i) => (
                <li
                  className="timeline-revisao__marco"
                  key={m.rotulo}
                  style={{ "--ordem": i } as CSSProperties}
                >
                  <span className="timeline-revisao__ponto" aria-hidden="true" />
                  <span className="timeline-revisao__quando">{m.rotulo}</span>
                  <strong>Juros simples</strong>
                  <small>{i === 0 ? "✓ Estudado" : "REVISAR"}</small>
                </li>
              ))}
            </ol>

            {/* Invólucro e cartão são dois elementos porque fazem duas coisas
                diferentes: o invólucro anda de coluna em coluna, o cartão fica
                parado dentro dele e só respira. Um elemento só teria que somar
                as duas transformações e a segunda apagaria a primeira. */}
            <div className="viajante" aria-hidden="true">
              <span className="viajante__cartao">
                <span className="viajante__k">Revisão</span>
                <span className="viajante__t">Juros simples</span>
                <span className="viajante__rabo" />
              </span>
            </div>

            <span className="timeline-revisao__aviso">Entrou no plano de hoje</span>
          </div>
        </div>
      </div>
    </section>
  );
}
export function EvidenciaDaRevisao() {
  return (
    <section
      className="secao secao--evidencia"
      data-sc-act="flow"
      aria-labelledby="t-evidencia"
    >
      <div className="faixa evidencia evidencia--grande">
        <p className="evidencia__n" data-sc-in>
          <span className="sc-nums" data-sc-count="0 242" data-sc-count-at="0.14 0.5">
            242
          </span>{" "}
          <small>estudos</small>
        </p>
        <div className="evidencia__texto" data-sc-in>
          <h2 id="t-evidencia" className="titulo">
            Não é achismo.
          </h2>
          <p className="lede">
            Esse é o tamanho da evidência por trás de técnicas como revisão espaçada e
            prática de recuperação.
          </p>
          <p className="evidencia__apoio">
            É essa lógica que ajuda a definir como o estudo é distribuído ao longo do
            tempo.
          </p>
          <p className="evidencia__fonte">
            <a
              className="elo"
              href="https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7889502/"
              rel="noreferrer"
            >
              Ver a meta-análise de Donoghue e Hattie
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
export function Comunidade() {
  return (
    <section
      className="secao secao--comunidade"
      data-sc-act="pin"
      data-sc-span="1.8"
      aria-labelledby="t-comunidade"
    >
      <div data-sc-stage className="palco palco--comunidade">
        <div className="faixa comunidade">
          <div className="comunidade__texto">
            <h2 id="t-comunidade" className="titulo titulo--gigante">
              Estudar fica melhor quando tem gente fazendo junto.
            </h2>
            <p className="lede">
              Compartilhe o que você estudou, acompanhe o progresso de outras pessoas
              e mantenha o ritmo com quem também está correndo atrás da aprovação.
            </p>
            <p className="comunidade__nota">
              Sem ranking entre alunos. Aqui o progresso aproxima, não vira placar.
            </p>
          </div>

          <div className="feed-comunidade" aria-label="Exemplo de publicação na comunidade">
            <article className="publicacao">
              <header className="publicacao__topo">
                <span className="publicacao__avatar" aria-hidden="true">
                  C
                </span>
                <span>
                  <strong>Camila</strong>
                  <small>agora</small>
                </span>
                <span className="publicacao__sequencia">7 dias de sequência</span>
              </header>

              <div className="publicacao__foto">
                <Image
                  src="/arte/comunidade-estudo.png"
                  alt="Caderno aberto com anotações de português em uma mesa de estudos"
                  width={1122}
                  height={1402}
                  sizes="(max-width: 899px) 82vw, 34vw"
                />
              </div>

              <p className="publicacao__legenda">
                Revisão de português concluída <span aria-hidden="true">✅</span>
              </p>

              <div className="publicacao__acoes" aria-hidden="true">
                <span>1 curtida</span>
                <span>1 comentário</span>
              </div>

              <div className="publicacao__comentario">
                <p>
                  <strong>Marina:</strong> Boa!! <span aria-hidden="true">👏</span>
                </p>
                <small>Curtido por Camila</small>
              </div>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ================================================================ ATO 9 ==
   Como funciona na prática. `pan`: os seis passos do ciclo de estudo correm
   de lado enquanto a página desce.

   O motor translada `[data-sc-pan]` por `-(excesso) * p`, e "excesso" é
   `scrollWidth - viewport`. Então o trilho precisa ser `width: max-content` e
   realmente mais largo que a tela — se couber na janela, o ato não anda.

   Em movimento reduzido `scrollcraft.css` transforma o palco numa região de
   rolagem horizontal de verdade, então os seis cartões continuam alcançáveis
   sem nenhum movimento. Nada precisa ser feito aqui para isso valer. */
const ETAPAS_DO_ESTUDO = [
  {
    rotulo: "1. ESTUDE",
    titulo: "Abra o que está no seu plano",
    texto: "Veja o que precisa avançar hoje e comece.",
  },
  {
    rotulo: "2. PRATIQUE",
    titulo: "Resolva questões",
    texto: "Aplique o que estudou em questões de prova.",
  },
  {
    rotulo: "3. REVISE",
    titulo: "Volte no que importa",
    texto: "As revisões entram no seu plano quando chegar a hora.",
  },
  {
    rotulo: "4. ACOMPANHE",
    titulo: "Veja seu progresso",
    texto: "O que você concluiu fica registrado e o plano continua dali.",
  },
  {
    rotulo: "5. COMPARTILHE",
    titulo: "Mostre que você fez",
    texto: "Compartilhe seu estudo e acompanhe quem também está na rotina.",
  },
  {
    rotulo: "6. REPITA",
    titulo: "Amanhã tem um novo plano",
    texto: "Você volta, abre e continua.",
  },
];

export function PorQueAguenta() {
  return (
    <section
      className="secao secao--aguenta"
      id="metodo"
      data-sc-act="pan"
      data-sc-span="4.2"
      aria-labelledby="t7"
    >
      <div data-sc-stage className="palco palco--aguenta">
        <div className="aguenta__cabeca faixa">
          <p className="aguenta__sopro">COMO FUNCIONA NA PRÁTICA</p>
          <h2 id="t7" className="titulo">
            Seu dia de estudo, do começo ao fim.
          </h2>
          <p className="aguenta__lede">
            Você entra, segue o plano e vai avançando. Sem precisar montar tudo de novo
            toda vez.
          </p>
        </div>

        <ul className="rail" data-sc-pan="0">
          {ETAPAS_DO_ESTUDO.map((g) => (
            <li className="rail__item" key={g.titulo}>
              <article
                className="cartao cartao--fato"
                data-sc-tilt="5"
                data-sc-spotlight
              >
                <div className="cartao__topo">
                  <p className="cartao__k">{g.rotulo}</p>
                </div>
                <h3 className="cartao__t">{g.titulo}</h3>
                <p className="cartao__p">{g.texto}</p>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ================================================================ ATO 8 ==
   O preço. `flow`, e não anima nada além da entrada.

   Foi ato fixado numa rodada anterior e o palco de 100vh não comportava dois
   cartões de preço + garantia + legal + CTA: sobrava rolagem aninhada dentro
   do palco, e o texto legal acabava medido contra o rodapé escuro. Conteúdo
   que não cabe numa tela não é ato fixado — é seção.

   Os quatro elementos que a spec exige — os dois preços, a garantia e os dois
   links legais **antes** do CTA — são contrato de PAG-09, guardado por
   `page.test.tsx`. Os valores vêm da tabela de configuração (INFRA-11), nunca
   escritos na copy. */
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
   * tabela de configuração e mudam sem deploy. Um "Economize R$ 19,70"
   * digitado na copy viraria mentira no dia em que o desconto mudasse.
   */
  const economia = formatarBRL(
    precos.parcelado.totalCentavos - precos.aVista.totalCentavos,
  );

  return (
    <section
      className="secao secao--oferta"
      id="oferta"
      data-sc-act="flow"
      aria-labelledby="t8"
    >
      <div className="faixa oferta">
        <h2 id="t8" className="titulo titulo--gigante" data-sc-in>
          Escolha como quer começar.
        </h2>
        <p className="oferta__subtitulo" data-sc-in>
          O acesso é o mesmo. Você escolhe a forma de pagamento.
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

          <article className="cartao cartao--preco cartao--destaque" data-sc-tilt="5">
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

        {/* AC4 de PAG-09: os dois links legais aparecem ANTES do botão que leva
            ao pagamento no DOM. O CSS reorganiza apenas a hierarquia visual para
            preço → decisão → garantia → legal, sem quebrar esse contrato. */}
        <div className="oferta__decisao" data-sc-in>
          <p className="legal oferta__legal">
            Antes de continuar, leia os{" "}
            <Link className="elo" href="/termos">
              Termos de uso
            </Link>{" "}
            e a{" "}
            <Link className="elo" href="/privacidade">
              Política de privacidade
            </Link>
            .
          </p>
          <Link className="botao oferta__cta" href="/checkout">
            Quero começar meu plano <span aria-hidden="true">→</span>
          </Link>
          <p className="oferta__microcopy">
            12 meses de acesso · {precos.garantiaDias} dias de garantia
          </p>
          <div className="garantia oferta__garantia">
            <h3 className="garantia__t">Garantia de {precos.garantiaDias} dias</h3>
            <p className="garantia__p">
              Contados em dias corridos a partir da confirmação do pagamento. Dentro
              da janela você pede e recebe de volta, sem precisar justificar por que
              desistiu.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
