import Link from "next/link";

import type { CoberturaDaMateria, Trajetoria } from "./trajetoria";

function porcentagem(fracao: number): number {
  return Math.round(fracao * 100);
}

function dataPorExtenso(data: string): string | null {
  const valor = new Date(`${data}T12:00:00`);
  if (Number.isNaN(valor.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(valor);
}

/**
 * A frase que responde a pergunta em uma linha.
 *
 * As três saídas são estados de verdade diferentes, não variações de texto:
 * sem prova cadastrada não há folga para calcular; sem base não há data; com
 * as duas, a folga é o que importa — chegar antes ou depois da prova.
 */
function fraseDaPrevisao(trajetoria: Trajetoria): string {
  const { previsao, contagem } = trajetoria;

  if (!previsao.confiavel || previsao.dataEstimada === null) {
    return "Ainda não dá para projetar o fim do edital — precisamos de mais alguns dias de estudo para saber o seu ritmo.";
  }

  const data = dataPorExtenso(previsao.dataEstimada);
  if (data === null) {
    return "Ainda não dá para projetar o fim do edital — precisamos de mais alguns dias de estudo para saber o seu ritmo.";
  }

  if (previsao.diasAntesDaProva === null) {
    return `No seu ritmo, o edital fecha por volta de ${data}. Cadastre a data da prova para saber se isso chega a tempo.`;
  }

  if (previsao.diasAntesDaProva >= 0) {
    const dias = previsao.diasAntesDaProva;
    return `No seu ritmo, o edital fecha por volta de ${data} — ${dias} ${dias === 1 ? "dia" : "dias"} antes da prova.`;
  }

  const atraso = Math.abs(previsao.diasAntesDaProva);
  return `No seu ritmo, o edital fecha por volta de ${data} — ${atraso} ${atraso === 1 ? "dia" : "dias"} depois da prova. ${
    contagem.dias === null ? "" : "Vale aumentar o bloco diário ou priorizar o que mais cai."
  }`.trim();
}

/**
 * Uma barra por matéria, na ordem do edital verticalizado.
 *
 * Duas faixas empilhadas no mesmo traço, e não uma só: tocado e dominado são
 * coisas diferentes, e uma barra única faria o aluno achar que "cobriu" o que
 * respondeu uma vez.
 */
function BarraDaMateria({ materia }: { materia: CoberturaDaMateria }) {
  const tocado = materia.nTopicos === 0 ? 0 : materia.nTocados / materia.nTopicos;
  const dominado = materia.nTopicos === 0 ? 0 : materia.nDominados / materia.nTopicos;

  return (
    <li className="grid gap-2">
      <div className="flex items-baseline justify-between gap-4">
        <p className="min-w-0 truncate font-medium">{materia.nome}</p>
        <p className="shrink-0 font-utilitaria text-[0.8125rem] text-suave">
          {materia.nTocados} de {materia.nTopicos}
        </p>
      </div>

      <div
        className="h-2 overflow-hidden rounded-full bg-linha"
        role="img"
        aria-label={`${materia.nome}: ${materia.nTocados} de ${materia.nTopicos} assuntos tocados, ${materia.nDominados} dominados`}
      >
        <div style={{ width: `${porcentagem(tocado)}%` }} className="h-full bg-marca-viva">
          <div
            style={{ width: materia.nTocados === 0 ? "0%" : `${porcentagem(dominado / tocado)}%` }}
            className="h-full bg-marca"
          />
        </div>
      </div>
    </li>
  );
}

export function TrajetoriaTela({ trajetoria }: { trajetoria: Trajetoria }) {
  const { total, porMateria } = trajetoria;

  if (total.nTopicos === 0) {
    return null;
  }

  // Barra zerada lê como falha. Quem nunca respondeu recebe o convite, não o
  // retrato de um vazio.
  if (total.nTocados === 0) {
    return (
      <section
        aria-labelledby="titulo-trajetoria"
        className="rounded-2xl border border-linha bg-painel px-7 pb-7 pt-6"
      >
        <p className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] text-marca-apoio">
          Cobertura do edital
        </p>
        <h2 id="titulo-trajetoria" className="mt-2.5 text-[1.375rem] font-semibold">
          Você ainda não tocou o edital.
        </h2>
        <p className="mt-2 max-w-[52ch] leading-7 text-suave">
          Seu primeiro bloco começa a preencher esta barra.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="titulo-trajetoria"
      className="rounded-2xl border border-linha bg-painel px-7 pb-7 pt-6"
    >
      <p className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] text-marca-apoio">
        Cobertura do edital
      </p>

      {/*
        Um número manda, os outros são texto. Quatro cartões de métrica em
        quatro caixas iguais não têm hierarquia — é o que a régua do DESIGN.md
        proíbe, e o cabeçalho do PlanoTela é o modelo seguido aqui.
      */}
      <h2 id="titulo-trajetoria" className="mt-2.5 text-[2.125rem] font-semibold leading-[1.1] tracking-[-0.03em]">
        {porcentagem(total.coberturaPonderada)}% do que mais cai
      </h2>
      <p className="mt-2 max-w-[52ch] leading-7 text-suave">
        {total.nTocados} de {total.nTopicos} assuntos tocados · {total.nDominados}{" "}
        {total.nDominados === 1 ? "dominado" : "dominados"}
      </p>
      <p className="mt-3 max-w-[52ch] leading-7 text-suave">{fraseDaPrevisao(trajetoria)}</p>

      {trajetoria.contagem.estado === "indefinida" ? (
        <p className="mt-3 text-sm">
          <Link href="/app/preferencias" className="font-semibold text-marca underline underline-offset-4">
            Cadastrar a data da prova
          </Link>
        </p>
      ) : null}

      <ol className="mt-6 grid gap-4 border-t border-linha pt-5">
        {porMateria.map((materia) => (
          <BarraDaMateria key={materia.materiaId} materia={materia} />
        ))}
      </ol>
    </section>
  );
}

/**
 * A linha de Hoje: uma frase, clicável, e nada mais. Hoje é a tela do próximo
 * bloco — não pode virar painel.
 */
export function TrajetoriaEmUmaLinha({ trajetoria }: { trajetoria: Trajetoria }) {
  if (trajetoria.total.nTopicos === 0 || trajetoria.total.nTocados === 0) return null;

  const cobertura = `${porcentagem(trajetoria.total.coberturaPonderada)}% do edital coberto`;
  const prazo =
    trajetoria.contagem.dias === null || trajetoria.contagem.estado !== "futura"
      ? null
      : `prova em ${trajetoria.contagem.dias} ${trajetoria.contagem.dias === 1 ? "dia" : "dias"}`;

  return (
    <Link
      href="/app/progresso"
      className="inline-flex min-h-11 items-center text-sm text-suave underline-offset-4 hover:underline"
    >
      {prazo === null ? cobertura : `${cobertura} · ${prazo}`}
    </Link>
  );
}
