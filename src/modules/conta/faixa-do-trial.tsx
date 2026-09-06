import Link from "next/link";

import { contextoDaMatricula } from "./contexto";

/**
 * A faixa de dias restantes, visível em toda tela do `/app` — **só no trial**
 * (AD-133 · item 2 do TRIAL-2).
 *
 * Sem contagem regressiva em segundos, sem vermelho, sem "últimas horas". O
 * invariante nº14 do `AGENTS.md` é explícito: nunca mentir para criar urgência.
 * A urgência aqui é verdadeira e não precisa de teatro — basta o número.
 *
 * Ela diz **duas** coisas, e a segunda veio do uso real: com teto 15 e bloco de
 * 10, o dia é gasto como 10 + 5 + recusa, ou seja, o aluno bate no teto no meio
 * do segundo bloco. Dizer só quantos dias faltam deixa esse corte chegar sem
 * aviso.
 *
 * Aluno pago não vê faixa nenhuma: `contextoDaMatricula` devolve `ehTrial:
 * false` e o componente não renderiza nada — nem um wrapper vazio, que já
 * empurraria o conteúdo alguns pixels para baixo.
 */
export async function FaixaDoTrial() {
  const contexto = await contextoDaMatricula();
  if (!contexto.ehTrial) return null;

  const dias = contexto.diasRestantes ?? 0;
  const restantes = contexto.questoesRestantesHoje;

  return (
    <div className="border-b border-linha bg-marca-suave/60">
      <div className="mx-auto flex w-full max-w-painel flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5 text-sm sm:px-6 lg:px-14">
        <p className="font-medium">
          Teste grátis —{" "}
          {dias === 0
            ? "último dia de acesso"
            : `${dias} ${dias === 1 ? "dia restante" : "dias restantes"}`}
        </p>

        {/* `null` é leitura falha, e não zero: nesse caso a faixa não inventa
            número, ela cala a segunda metade. */}
        {restantes === null ? null : (
          <p className="text-suave">
            {restantes === 0
              ? "As questões de hoje acabaram."
              : `${restantes} ${restantes === 1 ? "questão" : "questões"} ainda hoje.`}
          </p>
        )}

        <Link
          href="/checkout"
          className="ml-auto font-semibold text-marca underline underline-offset-2 hover:text-marca-apoio"
        >
          Fazer a matrícula
        </Link>
      </div>
    </div>
  );
}
