import Link from "next/link";

/**
 * Chrome da landing: a barra fixa e o rodapé.
 *
 * A barra é um desvio declarado da gramática *chaptered editorial*, que pede
 * página sem chrome fixa. O dono pediu "algo mais convencional"; barra fixa com
 * marca, três links e uma ação é o que isso significa para ele.
 *
 * Ela é **opaca**, nunca de vidro: sobre as duas seções escuras uma barra
 * translúcida fica ilegível, e isso foi defeito pego na verificação.
 */
export function Barra() {
  return (
    <header className="barra">
      <a className="barra__marca" href="#topo">
        <span className="barra__selo" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
            <path
              d="M6 12.5l4 4L18 8"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        Passou Concursos
      </a>

      <nav className="barra__nav" aria-label="Seções da página">
        <a href="#metodo">Método</a>
        <a href="#hoje">O que existe hoje</a>
        <a href="#oferta">Preço</a>
      </nav>

      <a className="botao botao--pequeno" href="#oferta">
        Ver a oferta
      </a>

      {/* Uma barra de progresso só, a nossa. A do motor fica desligada: duas
          empilhadas foi um defeito real da verificação. */}
      <div className="barra__progresso" aria-hidden="true" />
    </header>
  );
}

export function Rodape() {
  return (
    <footer className="rodape">
      <div className="faixa rodape__grade">
        <p className="rodape__marca">Passou Concursos</p>
        <p className="rodape__linha">
          Preparação para concursos da carreira bancária. Questões extraídas de provas
          oficiais, com banca, ano e número na etiqueta.
        </p>
        <nav className="rodape__elos" aria-label="Links legais">
          <Link href="/termos">Termos de uso</Link>
          <Link href="/privacidade">Política de privacidade</Link>
          <Link href="/entrar">Entrar</Link>
        </nav>
      </div>
    </footer>
  );
}
