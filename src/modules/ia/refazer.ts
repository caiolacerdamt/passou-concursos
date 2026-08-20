import { reportarErro } from "@/modules/observabilidade";

import {
  type ChamadaDeTarefa,
  type ResultadoDaTarefa,
  executarTarefa,
} from "./gateway";
import { TAREFA_DE_REFAZER } from "./tarefas";

/**
 * O mecanismo do IA-13: refazer **exatamente uma vez**, escalando de modelo e
 * de esforco.
 *
 * Quem o usa e a **SPEC 22** (verificacao quantitativa). Aqui mora so o
 * mecanismo, sem nenhuma regra sobre conta, formula ou gabarito — o chamador
 * entrega o conferidor e este arquivo nao sabe o que ele confere.
 *
 * Duas coisas que ele **nao** faz, e que sao o requisito:
 *
 * - **nunca uma terceira tentativa.** Nao ha laco aqui, e nao ha parametro para
 *   pedir mais uma. Reprovado duas vezes vai para a fila humana, que e decisao
 *   do chamador;
 * - **nao escolhe o modelo da segunda tentativa.** Ele so troca de *tarefa*
 *   (`verificacao_quantitativa` -> `reprocessamento_verificacao`); qual modelo e
 *   qual esforco essa outra tarefa usa e da matriz de configuracao, como
 *   qualquer outra (IA-02 AC1).
 */

/**
 * `true` = o resultado passou. Erro levantado aqui conta como **reprovado**,
 * nunca como aprovado: falha tecnica na conferencia (parametro invalido,
 * divisao por zero) e falha do cruzamento, nao um passe livre (IA-06 AC6).
 */
export type Conferidor = (
  resultado: ResultadoDaTarefa,
) => boolean | Promise<boolean>;

export type ResultadoDeRefazer = {
  aprovado: boolean;
  /** 1 ou 2. Nunca 3. */
  tentativas: number;
  /** A segunda tentativa aconteceu (outra tarefa, outro modelo, outro esforco). */
  escalou: boolean;
  /** O ultimo resultado obtido, aprovado ou nao. */
  resultado: ResultadoDaTarefa;
};

async function conferirSemExplodir(
  conferir: Conferidor,
  resultado: ResultadoDaTarefa,
  contexto: Record<string, unknown>,
): Promise<boolean> {
  try {
    return await conferir(resultado);
  } catch (erro) {
    reportarErro(erro, {
      modulo: "ia",
      motivo: "a conferencia falhou por erro tecnico; conta como reprovado",
      ...contexto,
    });
    return false;
  }
}

/**
 * Executa a tarefa e, se o conferidor reprovar, refaz **uma unica vez** na
 * tarefa de reprocessamento declarada em `TAREFA_DE_REFAZER`.
 *
 * Tarefa sem par de reprocessamento nao tem segunda tentativa — devolve
 * reprovado na primeira.
 */
export async function refazerUmaVez(
  chamada: ChamadaDeTarefa,
  conferir: Conferidor,
): Promise<ResultadoDeRefazer> {
  const primeira = await executarTarefa(chamada);

  if (await conferirSemExplodir(conferir, primeira, { tarefa: chamada.tarefa })) {
    return { aprovado: true, tentativas: 1, escalou: false, resultado: primeira };
  }

  const tarefaDeRefazer = TAREFA_DE_REFAZER[chamada.tarefa];
  if (tarefaDeRefazer === undefined) {
    return { aprovado: false, tentativas: 1, escalou: false, resultado: primeira };
  }

  const segunda = await executarTarefa({ ...chamada, tarefa: tarefaDeRefazer });

  const aprovado = await conferirSemExplodir(conferir, segunda, {
    tarefa: tarefaDeRefazer,
  });

  return { aprovado, tentativas: 2, escalou: true, resultado: segunda };
}
