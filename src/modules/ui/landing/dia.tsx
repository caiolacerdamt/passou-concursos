import {
  PLANOS,
  TEMPO_PADRAO,
  planoDe,
  totalDeQuestoes,
  type PlanoDoDia,
} from "./plano-do-dia";

/* ============================================================== ATO 4 ==
   O PICO. `pin` com span 2.8 — o maior da página depois do herói, e o
   silêncio deliberado do ato 3 vem logo antes dele.

   Substituiu o pico antigo (os 86 chips que desabavam em gráfico). Aquele
   mostrava o *acervo*; este mostra a *máquina*, que é o que a página v2
   precisa provar: o plano do dia se escrevendo sozinho, bloco a bloco,
   enquanto a pessoa rola.

   **O movimento assinatura mora aqui.** O dial — 30 min / 1 h / 2 h — é a
   única coisa da página que responde a algo que não é rolagem, e mexer nele
   refaz a folha inteira na frente do visitante: bloco entra, bloco sai, a
   contagem muda, o anel se resegmenta e a fila de revisão do ato 6 se
   reordena. Isso vive em `assinatura.ts`, lendo `--sc-p`. O motor
   (`scrollcraft.js`) não é tocado.

   **Três radios nativos, não três botões com `role`.** O grupo de rádio do
   navegador já traz navegação por seta, `Home`/`End`, um único ponto de
   tabulação e o anel de foco do `globals.css`. Reescrever isso à mão é a
   forma mais comum de um controle bonito virar um controle que o teclado não
   alcança, e o `PLANO.md` pede explicitamente teclado e foco visível.

   **O servidor renderiza o plano padrão.** Sem isso a folha nasceria vazia
   para quem chega sem JS, para o rastreador e para o teste unitário — e
   `assinatura.ts` estaria sozinho como fonte da lista. Ele reconstrói a
   partir do MESMO módulo (`plano-do-dia.ts`), então servidor e clique nunca
   podem discordar.

   Todos os números aqui são **placeholder** e moram num arquivo só. Nada
   nesta seção fala com o banco nesta rodada.
   ========================================================================== */

/**
 * Em que fração de `--sc-p` o bloco `i` de um plano de `n` blocos se escreve.
 *
 * Exportada porque `assinatura.ts` reconstrói a lista quando o dial muda e
 * precisa da MESMA conta: duas cópias divergiriam no primeiro ajuste de ritmo,
 * e o sintoma seria um bloco que entra fora de hora só depois de clicar.
 */
export function entradaDoBloco(indice: number, total: number): number {
  return -0.12 + (indice / total) * 0.58;
}

/** Cabe no `<li>` e em `assinatura.ts`: os dois desenham o mesmo bloco. */
function BlocoDoDia({ plano, indice }: { plano: PlanoDoDia; indice: number }) {
  const bloco = { ...plano.blocos[indice], em: entradaDoBloco(indice, plano.blocos.length) };

  return (
    <li
      className={`bloco${bloco.revisao ? " bloco--revisao" : ""}`}
      /* `--em` é a fração de `--sc-p` em que este bloco se escreve. A conta é a
         mesma aqui e em `assinatura.ts`; os blocos se distribuem numa janela
         que termina bem antes do fim do ato, para o plano inteiro ficar
         legível e parado antes de o palco soltar.

         **O primeiro é negativo, e isso é a saudação.** Um ato fixado fica
         visível uma tela inteira antes de `--sc-p` sair de 0: com `--em`
         positivo em todos, essa tela é uma folha em branco, que lê como
         esqueleto de carregamento e não como plano se escrevendo. Com o
         primeiro em -0,12 o bloco 1 já está lá no primeiro quadro e o que a
         rolagem faz é acrescentar, que é o que a seção promete. Mesma ideia do
         terceiro valor 0 nas cues. */
      style={{ "--em": bloco.em.toFixed(3) } as React.CSSProperties}
    >
      <p className="bloco__k">{bloco.acao}</p>
      <p className="bloco__t">{bloco.topico}</p>
      <p className="bloco__m">{bloco.descricao}</p>
      <p className="bloco__n">
        {bloco.questoes} <span>questões</span>
      </p>
    </li>
  );
}

/**
 * O anel do dia. Um arco por bloco, com folga entre eles: mudar o dial muda a
 * quantidade de arcos, que é o jeito mais direto de o anel *mostrar* que o dia
 * foi refeito em vez de só mudar de número.
 *
 * `pathLength="100"` normaliza o perímetro: o `dasharray` passa a ser escrito
 * em porcentagem do círculo e não em unidades do raio, então mudar o tamanho
 * do anel no CSS não desalinha nenhum arco.
 */
function AnelDoDia({ plano }: { plano: PlanoDoDia }) {
  const n = plano.blocos.length;
  const fatia = 100 / n;
  const arco = Math.max(fatia - 4, 4);

  return (
    <svg className="anel__svg" viewBox="0 0 120 120" aria-hidden="true">
      <circle className="anel__trilha" cx="60" cy="60" r="52" pathLength={100} />
      <g className="anel__arcos" data-anel-arcos>
        {plano.blocos.map((_, i) => (
          <circle
            key={i}
            className="anel__arco"
            cx="60"
            cy="60"
            r="52"
            pathLength={100}
            strokeDasharray={`${arco.toFixed(2)} ${(100 - arco).toFixed(2)}`}
            strokeDashoffset={(-i * fatia).toFixed(2)}
            style={{ "--em": entradaDoBloco(i, n).toFixed(3) } as React.CSSProperties}
          />
        ))}
      </g>
    </svg>
  );
}

export function DiaSeMonta() {
  const plano = planoDe(TEMPO_PADRAO);

  return (
    <section
      className="secao secao--dia"
      id="plano"
      data-sc-act="pin"
      data-sc-span="2.8"
      aria-labelledby="t4"
    >
      {/* SEM `position` aqui. `.sc-stage`, que o motor injeta, é quem traz o
          `position: sticky` que fixa o ato; qualquer regra de autor com
          especificidade maior o apaga e o ato deixa de fixar em silêncio. */}
      <div data-sc-stage className="palco palco--dia">
        <div className="faixa dia">
          <div className="dia__cabeca">
            <h2 id="t4" className="titulo">
              Seu dia hoje
            </h2>

            {/* O dial. `fieldset`/`legend` porque a pergunta É o rótulo do
                grupo: sem ela, o leitor de tela anuncia "30 min, botão de
                opção, 1 de 3" e nunca diz de que escolha se trata. */}
            <fieldset className="dial" data-dial>
              <legend className="dial__pergunta">Quanto tempo você tem hoje?</legend>
              <div className="dial__ops">
                {PLANOS.map((p) => (
                  <label className="dial__op" key={p.minutos}>
                    <input
                      type="radio"
                      name="tempo-do-dia"
                      value={p.minutos}
                      defaultChecked={p.minutos === TEMPO_PADRAO}
                    />
                    <span className="dial__rotulo">{p.rotulo}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="folha">
            {/* `aria-live="polite"`: mexer no dial reescreve esta lista, e uma
                mudança de conteúdo disparada por um controle precisa ser
                anunciada para quem não está vendo a folha se refazer. */}
            <ol className="plano" data-plano aria-live="polite">
              {plano.blocos.map((_, i) => (
                <BlocoDoDia key={i} plano={plano} indice={i} />
              ))}
            </ol>

            <aside className="anel">
              <AnelDoDia plano={plano} />
              <div className="anel__centro">
                <p className="anel__n" data-plano-total>
                  {totalDeQuestoes(plano)}
                </p>
                <p className="anel__l">questões</p>
              </div>
              <p className="anel__pe">
                <span data-plano-blocos>{plano.blocos.length}</span> blocos ·{" "}
                <span data-plano-minutos>{plano.minutos}</span> min
              </p>
              <p className="anel__explica">
                Você diz quanto tempo tem e a gente organiza o que cabe nele.
              </p>
            </aside>
          </div>

          <span className="dia__seta" aria-hidden="true">
            ↓
          </span>
        </div>
      </div>
    </section>
  );
}
