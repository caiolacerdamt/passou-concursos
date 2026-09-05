import Link from "next/link";

import { clienteDaSessao } from "@/lib/db/sessao";

import { ConviteDeMatricula } from "./convite-de-matricula";
import { consultarDiaDoTrial } from "./resumo-do-trial";

/**
 * A recusa do teto diário, quando o aluno esgota as questões do dia
 * (AD-133 · item 11 do TRIAL-2).
 *
 * Era um `<Estado tipo="vazio">` sozinho no alto de uma tela em branco. A
 * mensagem estava certa; o momento é que merecia mais. **É a hora em que o
 * aluno quer continuar e não pode** — o melhor momento de conversão do dia
 * inteiro, e o único em que o argumento é o esforço que ele acabou de fazer.
 *
 * Do uso real: com teto 15 e bloco de 10, o dia é gasto como 10 + 5 + recusa,
 * então esta tela chega no meio do segundo bloco. Ela existe para esse corte
 * não parecer defeito.
 *
 * O convite reusa `ConviteDeMatricula` — não é um segundo convite escrito à mão.
 */
export async function RecusaDoTetoDiario() {
  const dia = await consultarDiaDoTrial(await clienteDaSessao());

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <section aria-labelledby="titulo-teto">
        <p className="font-utilitaria text-[0.6875rem] uppercase tracking-[0.16em] text-marca-apoio">
          Teste grátis
        </p>
        <h1
          id="titulo-teto"
          className="mt-3 max-w-[26ch] text-[2rem] font-semibold leading-[1.12] tracking-[-0.025em]"
        >
          Você fez as questões de hoje.
        </h1>

        {/* Leitura falha cala os números e mantém a tela: o aluno precisa
            entender por que parou, e isso não depende da contagem. */}
        {dia === null ? null : (
          <p className="mt-4 max-w-[56ch] text-[1.0625rem] leading-relaxed text-suave">
            Foram{" "}
            <strong className="font-semibold text-texto">
              {dia.respondidasHoje}{" "}
              {dia.respondidasHoje === 1 ? "questão" : "questões"}
            </strong>{" "}
            hoje, com {dia.acertosHoje}{" "}
            {dia.acertosHoje === 1 ? "acerto" : "acertos"}.
            {dia.assuntosMapeados > 0 || dia.revisoesAgendadas > 0
              ? " Isso não some no fim do dia:"
              : ""}
          </p>
        )}

        {dia !== null && (dia.assuntosMapeados > 0 || dia.revisoesAgendadas > 0) ? (
          <ul className="mt-4 grid gap-2.5 text-[1.0625rem] leading-relaxed">
            {dia.assuntosMapeados > 0 ? (
              <li className="rounded-xl border border-linha bg-painel px-4 py-3.5">
                <strong className="font-semibold">
                  {dia.assuntosMapeados}{" "}
                  {dia.assuntosMapeados === 1 ? "assunto" : "assuntos"}
                </strong>{" "}
                já mapeados pelo que você respondeu.
              </li>
            ) : null}
            {dia.revisoesAgendadas > 0 ? (
              <li className="rounded-xl border border-linha bg-painel px-4 py-3.5">
                <strong className="font-semibold">
                  {dia.revisoesAgendadas}{" "}
                  {dia.revisoesAgendadas === 1 ? "revisão agendada" : "revisões agendadas"}
                </strong>{" "}
                para os próximos dias, na data em que a memória precisa.
              </li>
            ) : null}
          </ul>
        ) : null}

        <p className="mt-5 leading-7 text-suave">
          O plano de amanhã já está montado a partir disso.{" "}
          <Link href="/app" className="font-semibold text-marca underline">
            Voltar ao plano
          </Link>
        </p>
      </section>

      <ConviteDeMatricula
        titulo="Quer continuar hoje?"
        chamada="Ver a matrícula"
        tom="escuro"
      >
        <p>
          O teste grátis tem um teto por dia. A matrícula não tem — você responde
          quanto quiser, hoje ainda, e tudo que já respondeu continua contando.
        </p>
      </ConviteDeMatricula>
    </div>
  );
}
