import { type TipoDe, getParam } from "@/modules/config";
import { reportarErro } from "@/modules/observabilidade";

import { type Tarefa, existeTarefa } from "./tarefas";

/**
 * A matriz de modelos, lida da configuracao (IA-02 AC1, AD-073).
 *
 * O tipo vem do **catalogo**, nao de uma copia escrita aqui: schema duplicado e
 * schema que diverge. Trocar o formato do perfil e mexer num lugar so.
 */
type Matriz = TipoDe<"param.m2.matriz_de_modelos">;

export type PerfilDeTarefa = Matriz[string];
export type DestinoDeIa = NonNullable<PerfilDeTarefa["fallback"]>;

/**
 * Nao ha perfil para esta tarefa na configuracao.
 *
 * **E parada, nunca um modelo adivinhado.** Um default em codigo aqui seria o
 * nome de um modelo em codigo, que e a proibicao do `AGENTS.md`; e cair num
 * modelo qualquer gastaria dinheiro em silencio com o modelo errado. O
 * chamador decide o que fazer com a parada — o job da frase, por exemplo,
 * deixa `frase = null` e o plano sai assim mesmo (invariante nº7).
 */
export class TarefaSemPerfil extends Error {
  readonly tarefa: string;

  constructor(tarefa: string, detalhe: string) {
    super(
      `nao ha perfil de IA para a tarefa "${tarefa}": ${detalhe}. ` +
        "A matriz vive em param.m2.matriz_de_modelos (ver docs/IA.md).",
    );
    this.name = "TarefaSemPerfil";
    this.tarefa = tarefa;
  }
}

/**
 * O perfil vigente de uma tarefa.
 *
 * Le a matriz inteira num round-trip so e recorta a tarefa pedida — e o mesmo
 * custo de ler uma linha, e permite conferir de uma vez se sobrou chave orfa.
 *
 * @throws {TarefaSemPerfil} quando a tarefa nao tem linha na matriz
 */
export async function perfilDaTarefa(tarefa: Tarefa): Promise<PerfilDeTarefa> {
  const matriz = await getParam("param.m2.matriz_de_modelos");

  avisarSobreTarefasDesconhecidas(matriz);

  const perfil = matriz[tarefa];
  if (perfil === undefined) {
    const detalhe =
      Object.keys(matriz).length === 0
        ? "a matriz esta vazia — nenhuma tarefa de IA foi provisionada"
        : "a matriz existe mas nao tem esta linha";
    throw new TarefaSemPerfil(tarefa, detalhe);
  }

  return perfil;
}

/**
 * O destino de fallback do perfil, ou `null` quando nao ha para onde ir.
 *
 * O fallback e um destino, nao um perfil inteiro: `batch` e `cache` sao decisao
 * da **tarefa**, nao do modelo, e nao mudam so porque o principal caiu.
 */
export function fallbackDe(perfil: PerfilDeTarefa): DestinoDeIa | null {
  return perfil.fallback;
}

/** O destino principal do perfil, na forma que o adapter consome. */
export function principalDe(perfil: PerfilDeTarefa): DestinoDeIa {
  return {
    modelo: perfil.modelo,
    versao: perfil.versao,
    esforco: perfil.esforco,
  };
}

/**
 * Chave na matriz que nao e tarefa conhecida (IA-02 AC2).
 *
 * Nao derruba nada: uma linha a mais na configuracao nao pode impedir as
 * outras de rodar. Mas tem que aparecer — chave orfa aqui e quase sempre erro
 * de digitacao, e erro de digitacao silencioso vira "a troca de modelo nao
 * pegou e ninguem sabe por que".
 */
function avisarSobreTarefasDesconhecidas(matriz: Matriz): void {
  const orfas = Object.keys(matriz).filter((chave) => !existeTarefa(chave));
  if (orfas.length === 0) return;

  reportarErro(
    new Error(
      `a matriz de modelos tem tarefa que nao existe na lista fechada: ${orfas.join(", ")}`,
    ),
    { modulo: "ia", motivo: "tarefa orfa na matriz de modelos" },
  );
}
