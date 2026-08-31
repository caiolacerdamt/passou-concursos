import Link from "next/link";

/**
 * Chrome da landing: a barra fixa e o rodapé.
 *
 * O dono pediu "algo mais convencional"; barra fixa com marca, três links e
 * uma ação é o que isso significa para ele.
 *
 * Ela **não existe sobre o herói**: a v2 abre em sangria de tela cheia e
 * chrome por cima disso é a marca registrada de template. Ela se materializa
 * quando o ato 1 termina, e quem decide isso é `assinatura.ts`, pela altura do
 * próprio herói — não por um número escrito à mão.
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

      {/* Os três destinos são atos que existem: o pico, a questão e o preço.
          `#hoje` apontava para a seção "o que você recebe", que a rodada v2
          removeu — âncora para um id inexistente rola para lugar nenhum e não
          dá erro em teste nenhum. */}
      <nav className="barra__nav" aria-label="Seções da página">
        <a href="#plano">O plano do dia</a>
        <a href="#questao">As questões</a>
        <a href="#oferta">Preço</a>
      </nav>

      <Link className="barra__entrar" href="/entrar">
        Entrar
      </Link>

      <a className="botao botao--pequeno" href="#oferta">
        Começar
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
          Preparação para concursos públicos. Questões extraídas de provas oficiais,
          com banca, ano e número na etiqueta.
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
