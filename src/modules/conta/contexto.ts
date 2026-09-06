import { clienteDaSessao } from "@/lib/db/sessao";
import { reportarErro } from "@/modules/observabilidade/reporte";

import { matriculaAtiva, type Matricula, type TipoDaMatricula } from "./matricula";

/**
 * O contexto de escopo da matrícula (AD-133).
 *
 * `tem_matricula_ativa()` continua sendo a única chave de **liberação**. O que
 * mora aqui é a pergunta de **escopo**: é trial? quantos dias faltam? quantas
 * questões ainda cabem hoje? Nenhuma dessas respostas abre ou fecha nada — elas
 * só decidem o que a tela diz.
 *
 * É **um** helper, e é de propósito: doze superfícies calculando "faltam N
 * dias" à mão viram doze arredondamentos ligeiramente diferentes, e o aluno vê
 * "2 dias" numa tela e "1 dia" na outra no mesmo minuto.
 */

export type ContextoDaMatricula = {
  matricula: Matricula | null;
  tipo: TipoDaMatricula | null;
  ehTrial: boolean;
  /** Dias inteiros até o fim, arredondando para cima. `null` fora do trial. */
  diasRestantes: number | null;
  /** Questões que ainda cabem hoje. `null` quando não há teto. */
  questoesRestantesHoje: number | null;
};

const UM_DIA_EM_MS = 24 * 60 * 60 * 1000;

/**
 * Quantos dias faltam, **arredondando para cima**: faltando 6h ainda é "1 dia".
 *
 * Arredondar para baixo diria "faltam 0 dias" para quem ainda tem a tarde
 * inteira de acesso — que é falso, e falso contra o aluno.
 */
export function diasAteOFim(fimEm: string, agora: Date = new Date()): number {
  const fim = Date.parse(fimEm);
  if (Number.isNaN(fim)) return 0;
  return Math.max(0, Math.ceil((fim - agora.getTime()) / UM_DIA_EM_MS));
}

type ClienteDeContexto = {
  rpc: (nome: string) => Promise<{ data: unknown; error: unknown }>;
};

/**
 * Lê o teto restante do dia. É o banco que conta — `trial_questoes_restantes_hoje()`
 * é a mesma conta de corte de dia que `registrar_tentativa` faz antes do INSERT.
 * Repeti-la em TypeScript garantiria divergência no primeiro fuso esquecido.
 *
 * Falha de leitura devolve `null`: a faixa some, o produto continua. Um número
 * errado aqui seria pior que número nenhum.
 */
async function lerRestanteDoDia(cliente: ClienteDeContexto): Promise<number | null> {
  try {
    const { data, error } = await cliente.rpc("trial_questoes_restantes_hoje");
    if (error) throw error;
    return typeof data === "number" ? data : null;
  } catch (erro) {
    reportarErro(erro, { modulo: "conta", operacao: "trial_questoes_restantes_hoje" });
    return null;
  }
}

export async function contextoDaMatricula(
  cliente?: unknown,
): Promise<ContextoDaMatricula> {
  const supabase = cliente ?? (await clienteDaSessao());

  const matricula = await matriculaAtiva(
    supabase as Parameters<typeof matriculaAtiva>[0],
  );

  if (matricula === null || matricula.tipo !== "trial") {
    return {
      matricula,
      tipo: matricula?.tipo ?? null,
      ehTrial: false,
      diasRestantes: null,
      questoesRestantesHoje: null,
    };
  }

  return {
    matricula,
    tipo: "trial",
    ehTrial: true,
    diasRestantes: diasAteOFim(matricula.fim_em),
    questoesRestantesHoje: await lerRestanteDoDia(supabase as ClienteDeContexto),
  };
}
