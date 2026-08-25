import {
  type FrequenciaReal,
  TOPO_DO_RAIOX,
  inteiroEmPtBr,
  percentualEmPtBr,
} from "@/modules/acervo";

/* ============================================================== SEÇÃO 4 ==
   O PICO. `pin` com span 4.6, o maior da página por larga margem.

   O movimento assinatura mora aqui: escrito em `assinatura.ts` e lido de
   `--sc-p`. O motor `scrollcraft.js` não é tocado.

   Os chips são DOM, não vídeo e não imagem: carregam nome de tópico e
   contagem reais, vindos do acervo. Em vídeo isso borraria, não seria
   selecionável, não seria lido por leitor de tela, e **congelaria** — na
   próxima prova ingerida o clipe estaria mentindo. Em DOM o número vem da
   consulta e continua verdadeiro.
   ========================================================================== */

/** A frase honesta do que os doze maiores somam, montada do dado, não da copy. */
function fraseDosTopicos(frequencia: FrequenciaReal): string {
  const nomes = frequencia.topicos
    .slice(0, TOPO_DO_RAIOX)
    .map((t) => `${t.topico} (${t.questoes})`)
    .join(", ");

  return (
    `Os ${TOPO_DO_RAIOX} tópicos mais cobrados nas ${frequencia.totalProvas} provas ` +
    `oficiais lidas: ${nomes}. Juntos somam ${inteiroEmPtBr(frequencia.topQuestoes)} ` +
    `das ${inteiroEmPtBr(frequencia.totalQuestoes)} questões, ou ` +
    `${percentualEmPtBr(frequencia.topPercentual)}%.`
  );
}

export function Pico({ frequencia }: { frequencia: FrequenciaReal }) {
  return (
    <section
      className="secao secao--pico"
      data-sc-act="pin"
      data-sc-span="4.6"
      aria-labelledby="t4"
    >
      <div data-sc-stage className="palco palco--pico">
        <div className="faixa falas falas--pico">
          <div className="fala" data-sc-cue="0 0.24 0">
            {/* O número é o argumento da seção, então ele vem do acervo e não
                da copy: escrito por extenso viraria mentira na primeira prova
                nova que entrasse com um tópico a mais. */}
            <h2 id="t4" className="titulo titulo--claro">
              {frequencia.totalTopicos} tópicos.
            </h2>
            <p className="lede lede--clara">
              Todos do mesmo tamanho. É isso que o edital te entrega.
            </p>
          </div>
          <div className="fala" data-sc-cue="0.2 0.56">
            <p className="titulo titulo--claro">Isto é o que a prova fez com eles.</p>
          </div>
          <div className="fala" data-sc-cue="0.5 0.88 0.14 0.14">
            <p className="titulo titulo--claro">A banca tem preferência. Está medida.</p>
            <p className="rotulo rotulo--claro">
              Frequência real · {inteiroEmPtBr(frequencia.totalQuestoes)} questões ·{" "}
              {frequencia.totalProvas} provas oficiais
            </p>
          </div>
          <div className="fala" data-sc-cue="0.82 1 0.14 0.02">
            <p className="titulo titulo--claro">
              Os {TOPO_DO_RAIOX} maiores carregam{" "}
              <em className="realce">{percentualEmPtBr(frequencia.topPercentual)}%</em> da
              prova.
            </p>
            <p className="lede lede--clara">
              {frequencia.caudaTopicos} tópicos, somados, dão{" "}
              {percentualEmPtBr(frequencia.caudaPercentual)}%. Você estudava os dois com o
              mesmo empenho.
            </p>
          </div>
        </div>

        {/* Preenchido por `assinatura.ts` depois da hidratação. Sem JS a lista
            continua legível no <noscript> abaixo, que é o que leitor de tela e
            rastreador pegam. */}
        <div className="raiox" id="raiox" aria-hidden="true" />

        <noscript>
          <div className="faixa raiox-texto">
            <p>{fraseDosTopicos(frequencia)}</p>
          </div>
        </noscript>
      </div>
    </section>
  );
}
