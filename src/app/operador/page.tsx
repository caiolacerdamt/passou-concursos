import Link from "next/link";

const AREAS = [
  {
    href: "/operador/fila",
    marcador: "01 / acervo",
    titulo: "Fila de revisão",
    texto: "Veja o que aguarda uma decisão, confira a proveniência e publique apenas o que foi conferido.",
    acao: "Abrir fila",
  },
  {
    href: "/operador/taxonomia",
    marcador: "02 / mapa",
    titulo: "Taxonomia",
    texto: "Ajuste matérias e tópicos para que a próxima classificação siga o vocabulário certo.",
    acao: "Abrir taxonomia",
  },
  {
    href: "/operador/configuracao",
    marcador: "03 / controle",
    titulo: "Configuração",
    texto: "Troque flags e parâmetros com motivo explícito e veja a trilha de cada chave.",
    acao: "Abrir configuração",
  },
] as const;

/** A página inicial não consulta dados: o layout já garantiu o acesso. */
export default function OperadorInicio() {
  return (
    <div className="space-y-10">
      <section aria-labelledby="titulo-mesa" className="max-w-3xl">
        <p className="font-utilitaria text-xs font-semibold uppercase tracking-[0.2em] text-marca">
          ponto de partida
        </p>
        <h1 id="titulo-mesa" className="mt-3 font-display text-4xl leading-tight tracking-tight sm:text-6xl">
          O acervo passa por aqui.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-suave">
          Esta é a mesa para decidir, classificar e operar o produto. Cada ação deixa uma trilha para a próxima pessoa conferir.
        </p>
      </section>

      <section aria-labelledby="titulo-areas" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-linha pb-3">
          <div>
            <p className="font-utilitaria text-xs uppercase tracking-[0.16em] text-suave">atalhos de trabalho</p>
            <h2 id="titulo-areas" className="mt-1 text-2xl font-semibold">Escolha uma área</h2>
          </div>
          <p className="max-w-xs text-right text-sm text-suave">Acesso protegido por sessão e allowlist de operadores.</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {AREAS.map((area) => (
            <article key={area.href} className="flex min-h-64 flex-col rounded-card border border-linha bg-painel p-5 shadow-card transition hover:-translate-y-0.5 hover:border-marca/50 sm:p-6">
              <p className="font-utilitaria text-xs uppercase tracking-[0.16em] text-marca">{area.marcador}</p>
              <h3 className="mt-7 font-display text-3xl leading-tight">{area.titulo}</h3>
              <p className="mt-3 flex-1 text-sm leading-6 text-suave">{area.texto}</p>
              <Link href={area.href} className="mt-6 inline-flex min-h-11 items-center justify-between rounded-lg bg-texto px-4 py-3 text-sm font-semibold text-fundo transition hover:bg-marca">
                {area.acao}
                <span aria-hidden="true" className="ml-4 text-lg">→</span>
              </Link>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
