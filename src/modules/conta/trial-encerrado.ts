import { reportarErro } from "@/modules/observabilidade/reporte";

/**
 * A conta já teve um trial que acabou? (AD-133 · item 5 do TRIAL-2)
 *
 * É a pergunta que separa os dois estados do `/assinar`. Não pergunta se a
 * matrícula está ativa — `matriculaAtiva()` já respondeu isso e devolveu `null`
 * antes de esta tela existir. Pergunta se **existiu** uma linha de trial.
 *
 * A RLS de `matriculas` é por `user_id`, então a consulta continua sem filtro
 * de dono aqui: quem separa aluno de aluno é a policy, e repetir o filtro daria
 * a impressão de que ela é opcional.
 */

type Leitor = {
  from: (tabela: string) => {
    select: (colunas: string) => {
      eq: (
        coluna: string,
        valor: string,
      ) => {
        limit: (n: number) => Promise<{ data: unknown[] | null; error: unknown }>;
      };
    };
  };
};

export async function teveTrialEncerrado(cliente: unknown): Promise<boolean> {
  try {
    const { data, error } = await (cliente as Leitor)
      .from("matriculas")
      .select("id")
      .eq("tipo", "trial")
      .limit(1);

    if (error) throw error;
    return (data ?? []).length > 0;
  } catch (erro) {
    // Falha de leitura cai no estado genérico, que é o texto correto para quem
    // nunca teve nada. Errar para o lado do texto genérico é errar barato.
    reportarErro(erro, { modulo: "conta", operacao: "teve_trial_encerrado" });
    return false;
  }
}
