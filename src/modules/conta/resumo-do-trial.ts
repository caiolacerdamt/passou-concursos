import { faixaDeDominio } from "@/modules/raiox";
import { reportarErro } from "@/modules/observabilidade/reporte";

/**
 * O que o aluno construiu no trial, em número (AD-133 · item 5 do TRIAL-2).
 *
 * **Números, nunca conteúdo.** Nada aqui lê enunciado, alternativa ou
 * explicação: isso é acervo, e o acervo fechou no dia 7. O que sobrevive ao fim
 * do trial é o histórico do próprio aluno, e ele sobrevive porque a RLS de
 * `tentativas`, `dominio_topico`, `caderno_erros` e `revisao_agenda` é
 * `user_id = auth.uid()` — **nenhuma delas passa por `tem_matricula_ativa()`**.
 * Conferido policy por policy antes desta tela existir; se alguma passar a
 * depender da matrícula, a saída é uma RPC de leitura agregada, nunca afrouxar
 * a policy.
 *
 * Leitura que falha vira `null` no campo, e a tela cala aquela linha. Um zero
 * inventado diria ao aluno que ele não construiu nada — exatamente o oposto do
 * argumento desta página.
 */

export type ResumoDoTrial = {
  diasEstudados: number;
  questoesRespondidas: number;
  acertos: number;
  assuntosFracos: number;
  assuntosNoCaderno: number;
  revisoesAgendadas: number;
};

/** Teto duro da leitura de tentativas: o trial não produz mais que isso. */
const TETO_DE_TENTATIVAS = 2_000;

type Consulta = {
  select: (colunas: string, opcoes?: unknown) => Consulta;
  limit: (n: number) => Consulta;
  gte: (coluna: string, valor: string) => Consulta;
  then: <T>(fn: (r: { data: unknown; error: unknown; count: number | null }) => T) => Promise<T>;
};

type Leitor = { from: (tabela: string) => Consulta };

function diaEmSaoPaulo(instante: string): string | null {
  const data = new Date(instante);
  if (Number.isNaN(data.getTime())) return null;
  return data.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export async function consultarResumoDoTrial(
  cliente: unknown,
): Promise<ResumoDoTrial | null> {
  const supabase = cliente as Leitor;

  try {
    const [tentativas, dominio, caderno, revisoes] = await Promise.all([
      supabase
        .from("tentativas")
        .select("respondida_em, correta")
        .limit(TETO_DE_TENTATIVAS)
        .then((r) => r),
      supabase.from("dominio_topico").select("score, n_respostas").then((r) => r),
      supabase.from("caderno_erros").select("topico_id").then((r) => r),
      supabase.from("revisao_agenda").select("topico_id").then((r) => r),
    ]);

    const erro =
      tentativas.error ?? dominio.error ?? caderno.error ?? revisoes.error;
    if (erro) throw erro;

    const linhas = (tentativas.data ?? []) as {
      respondida_em: string;
      correta: boolean | null;
    }[];

    const dias = new Set(
      linhas.flatMap((linha) => {
        const dia = diaEmSaoPaulo(linha.respondida_em);
        return dia === null ? [] : [dia];
      }),
    );

    const projecoes = (dominio.data ?? []) as {
      score: number | string | null;
      n_respostas: number | null;
    }[];

    // "Fraco" é a mesma faixa que o Raio-X e o progresso usam. Uma segunda
    // definição aqui faria a tela do dia 7 contradizer a tela do dia 6.
    const assuntosFracos = projecoes.filter(
      (linha) =>
        faixaDeDominio(
          linha.score === null ? null : Number(linha.score),
          linha.n_respostas,
        ) === "fraco",
    ).length;

    return {
      diasEstudados: dias.size,
      questoesRespondidas: linhas.length,
      acertos: linhas.filter((linha) => linha.correta === true).length,
      assuntosFracos,
      assuntosNoCaderno: new Set(
        ((caderno.data ?? []) as { topico_id: string }[]).map((l) => l.topico_id),
      ).size,
      revisoesAgendadas: ((revisoes.data ?? []) as unknown[]).length,
    };
  } catch (erro) {
    reportarErro(erro, { modulo: "conta", operacao: "resumo_do_trial" });
    return null;
  }
}

/** O resumo só vira tela se houver o que contar. Zero em tudo não é argumento. */
export function temAlgoAContar(resumo: ResumoDoTrial | null): resumo is ResumoDoTrial {
  return resumo !== null && resumo.questoesRespondidas > 0;
}

/**
 * O dia de hoje, para a tela de recusa do teto (item 11 do TRIAL-2).
 *
 * É o mesmo corte de dia que `trial_questoes_restantes_hoje()` usa — meia-noite
 * em São Paulo. O corte é calculado aqui porque a leitura é do PostgREST e não
 * da função; se um dia divergirem, o sintoma é a tela dizer "15 hoje" enquanto
 * o banco conta 14, e é por isso que os dois cortes citam o mesmo fuso.
 */
export type DiaDoTrial = {
  respondidasHoje: number;
  acertosHoje: number;
  assuntosMapeados: number;
  revisoesAgendadas: number;
};

function inicioDoDiaEmSaoPaulo(agora: Date = new Date()): string {
  const dia = agora.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  // -03:00 é o deslocamento fixo do horário de Brasília; o país não tem mais
  // horário de verão desde 2019 (Decreto 9.772/2019).
  return new Date(`${dia}T00:00:00-03:00`).toISOString();
}

export async function consultarDiaDoTrial(
  cliente: unknown,
): Promise<DiaDoTrial | null> {
  const supabase = cliente as Leitor;

  try {
    const [hoje, dominio, revisoes] = await Promise.all([
      supabase
        .from("tentativas")
        .select("correta")
        .gte("respondida_em", inicioDoDiaEmSaoPaulo())
        .limit(TETO_DE_TENTATIVAS)
        .then((r) => r),
      supabase.from("dominio_topico").select("topico_id").then((r) => r),
      supabase.from("revisao_agenda").select("topico_id").then((r) => r),
    ]);

    const erro = hoje.error ?? dominio.error ?? revisoes.error;
    if (erro) throw erro;

    const linhas = (hoje.data ?? []) as { correta: boolean | null }[];

    return {
      respondidasHoje: linhas.length,
      acertosHoje: linhas.filter((linha) => linha.correta === true).length,
      assuntosMapeados: ((dominio.data ?? []) as unknown[]).length,
      revisoesAgendadas: ((revisoes.data ?? []) as unknown[]).length,
    };
  } catch (erro) {
    reportarErro(erro, { modulo: "conta", operacao: "dia_do_trial" });
    return null;
  }
}
