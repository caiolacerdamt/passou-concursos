import Link from "next/link";

import { clienteDaSessao } from "@/lib/db/sessao";
import { ConviteDeMatricula } from "@/modules/conta/convite-de-matricula";
import {
  consultarResumoDoTrial,
  temAlgoAContar,
  type ResumoDoTrial,
} from "@/modules/conta/resumo-do-trial";
import { teveTrialEncerrado } from "@/modules/conta/trial-encerrado";
import { Shell } from "@/modules/ui/shell";

export const dynamic = "force-dynamic";

/**
 * Onde para quem tem conta e não tem matrícula (PAG-01), em **dois estados**
 * (AD-133 · item 5 do TRIAL-2).
 *
 * (a) Nunca teve matrícula, ou pagou e venceu: o aviso de sempre, agora
 *     apontando o checkout — antes ele não apontava lugar nenhum.
 * (b) Teve trial e ele acabou: o que o aluno construiu, em número, e a frase
 *     que importa — **nada disso foi apagado**.
 *
 * O estado (b) é possível porque a RLS de `tentativas`, `dominio_topico`,
 * `caderno_erros` e `revisao_agenda` é por `user_id`, não por matrícula: o
 * aluno continua lendo o próprio histórico com o acervo fechado. **Números,
 * nunca conteúdo** — nenhum enunciado, alternativa ou explicação entra aqui,
 * porque acervo é o que fechou no dia 7.
 */
export default async function Assinar() {
  const supabase = await clienteDaSessao();

  const trialEncerrado = await teveTrialEncerrado(supabase);
  const resumo = trialEncerrado ? await consultarResumoDoTrial(supabase) : null;

  return (
    <Shell
      acoes={
        <Link href="/entrar" className="text-marca underline">
          Entrar
        </Link>
      }
    >
      {temAlgoAContar(resumo) ? (
        <FimDoTrial resumo={resumo} />
      ) : (
        <SemMatricula trialEncerrado={trialEncerrado} />
      )}
    </Shell>
  );
}

/**
 * O estado (a). Continua sem preço na tela — preço é da página de vendas e da
 * tabela de configuração, e um número digitado aqui viraria mentira na primeira
 * troca.
 */
function SemMatricula({ trialEncerrado }: { trialEncerrado: boolean }) {
  return (
    <section
      className="mx-auto max-w-2xl rounded-card border border-linha bg-painel p-6 shadow-card sm:p-9"
      aria-labelledby="titulo-matricula"
    >
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-marca">
        Acesso ao estudo
      </p>
      <h1
        id="titulo-matricula"
        className="mt-3 font-display text-4xl leading-tight tracking-tight sm:text-5xl"
      >
        {trialEncerrado ? "Seu teste grátis terminou" : "Sua matrícula não está ativa"}
      </h1>
      <p className="mt-5 text-lg leading-8 text-suave">
        {trialEncerrado
          ? "O acesso ao acervo fechou no fim dos sete dias. Seu histórico continua guardado na conta e volta inteiro com a matrícula."
          : "O conteúdo do Passou Concursos é liberado pela matrícula. A sua não está ativa no momento, então não há o que mostrar aqui."}
      </p>

      <Link
        href="/checkout"
        className="mt-7 inline-flex min-h-12 items-center rounded-full bg-marca px-6 font-semibold text-white transition hover:bg-marca-apoio"
      >
        Ver a matrícula
      </Link>

      <p className="mt-5 leading-7 text-suave">
        Se você acabou de pagar e chegou nesta tela, escreva para o suporte: a
        ativação é automática e algo saiu do lugar.
      </p>
    </section>
  );
}

/**
 * O estado (b). O argumento é o que ele construiu, e o número é dele.
 *
 * Sem contagem regressiva, sem desconto que aparece e some: a página não precisa
 * de urgência inventada porque o fato — sete dias de trabalho parados a um clique
 * de voltar — já é o argumento (invariante nº14).
 */
function FimDoTrial({ resumo }: { resumo: ResumoDoTrial }) {
  const percentual =
    resumo.questoesRespondidas > 0
      ? Math.round((resumo.acertos / resumo.questoesRespondidas) * 100)
      : 0;

  const numeros = [
    {
      valor: resumo.diasEstudados,
      rotulo: resumo.diasEstudados === 1 ? "dia de estudo" : "dias de estudo",
    },
    {
      valor: resumo.questoesRespondidas,
      rotulo: resumo.questoesRespondidas === 1 ? "questão respondida" : "questões respondidas",
      nota: `${percentual}% de acerto`,
    },
    {
      valor: resumo.assuntosFracos,
      rotulo: resumo.assuntosFracos === 1 ? "assunto mapeado como fraco" : "assuntos mapeados como fracos",
    },
    {
      valor: resumo.revisoesAgendadas,
      rotulo: resumo.revisoesAgendadas === 1 ? "revisão agendada" : "revisões agendadas",
    },
  ].filter((item) => item.valor > 0);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <section aria-labelledby="titulo-fim-do-trial">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-marca">
          Seus sete dias
        </p>
        <h1
          id="titulo-fim-do-trial"
          className="mt-3 max-w-[22ch] font-display text-4xl leading-tight tracking-tight sm:text-5xl"
        >
          Veja o que você construiu.
        </h1>
        <p className="mt-5 max-w-[58ch] text-lg leading-8 text-suave">
          Isto não é um resumo genérico do produto. É o que a sua conta produziu
          nestes dias, respondendo questão por questão.
        </p>

        <dl className="mt-8 grid gap-3 sm:grid-cols-2">
          {numeros.map((item) => (
            <div
              key={item.rotulo}
              className="rounded-2xl border border-linha bg-painel px-5 py-5"
            >
              <dt className="text-sm text-suave">{item.rotulo}</dt>
              <dd className="mt-1.5 flex items-baseline gap-2.5">
                <span className="font-utilitaria text-3xl font-semibold tracking-[-0.02em]">
                  {item.valor.toLocaleString("pt-BR")}
                </span>
                {item.nota ? (
                  <span className="text-sm text-suave">{item.nota}</span>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>

        {resumo.assuntosNoCaderno > 0 ? (
          <p className="mt-5 max-w-[58ch] leading-7 text-suave">
            Seu caderno de erros tem{" "}
            <strong className="font-semibold text-texto">
              {resumo.assuntosNoCaderno}{" "}
              {resumo.assuntosNoCaderno === 1 ? "assunto" : "assuntos"}
            </strong>{" "}
            esperando outra chance, com o motivo de cada erro registrado por você.
          </p>
        ) : null}
      </section>

      <ConviteDeMatricula
        titulo="Nada disso foi apagado. Volta exatamente de onde você parou."
        chamada="Ver a matrícula"
        tom="escuro"
      >
        <p>
          Suas respostas, o caderno de erros e a agenda de revisão continuam na sua
          conta. O que fechou foi o acesso ao acervo — e ele reabre no mesmo ponto,
          sem recomeço e sem teto diário.
        </p>
      </ConviteDeMatricula>

      <p className="text-sm text-suave">
        Se você acabou de pagar e chegou nesta tela, escreva para o suporte: a
        ativação é automática e algo saiu do lugar.
      </p>
    </div>
  );
}
