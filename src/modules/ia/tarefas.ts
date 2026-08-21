/**
 * A **lista fechada** de tarefas de IA do produto (IA-02 AC2).
 *
 * Toda chamada de IA passa pelo gateway, e o gateway so conhece estas. Tarefa
 * nova nao se inventa no lugar de uso: entra aqui, ganha linha na matriz de
 * configuracao, e so entao existe.
 *
 * **Embeddings nao estao aqui de proposito** — sao chamada direta ao Cohere e
 * SHALL NOT passar pelo gateway (AD-005/AD-073).
 *
 * Duas chamadas de IA existem em outros modulos e **ainda nao estao nesta
 * lista**, cada uma travando o Design da sua spec: o pre-diagnostico de questao
 * suspeita (SPEC 29) e a extracao do programa do edital (SPEC 27). Acrescentar
 * qualquer uma exige AD nova, nao um `push` neste array.
 */
export const TAREFAS = [
  "extracao_pdf",
  "explicacao",
  "verificacao_quantitativa",
  "classificacao_topico",
  "plano_inicial",
  "frase_do_plano",
  "tutor",
  "rascunho_inedita",
  "reprocessamento_verificacao",
] as const;

export type Tarefa = (typeof TAREFAS)[number];

export function existeTarefa(nome: string): nome is Tarefa {
  return (TAREFAS as readonly string[]).includes(nome);
}

/**
 * A versao do prompt de cada tarefa (IA-02 AC4/AC8).
 *
 * Entra na chave de dedup: **mudar o prompt e mudar a versao**, e so assim a
 * fabrica regera o que ja tinha gerado. Quem editar o texto de um prompt sem
 * subir este numero deixa o produto servindo o resultado antigo para sempre.
 *
 * E `string`, nao `number`, porque a versao aparece em texto na auditoria e em
 * chave de dedup — e um rotulo, nao uma conta.
 */
export const VERSAO_DO_PROMPT: Record<Tarefa, string> = {
  // v3: o texto-base vira campo proprio (`textos_base` + `texto_base_id`) e
  // quem junta e o nosso codigo. A v2 mandava o modelo repetir o texto dentro
  // de cada questao, e isso fez o filtro de conteudo do provedor cortar a
  // geracao de uma pagina de Lingua Inglesa da Prova C do BB 2021 — sempre no
  // mesmo lugar, reenviar nao adiantava. Medido na SPEC 09.
  extracao_pdf: "3",
  explicacao: "1",
  verificacao_quantitativa: "1",
  classificacao_topico: "1",
  plano_inicial: "1",
  frase_do_plano: "1",
  tutor: "1",
  rascunho_inedita: "1",
  reprocessamento_verificacao: "1",
};

/**
 * Qual tarefa refaz qual (IA-13). Hoje so a verificacao quantitativa escala:
 * `verificacao_quantitativa` reprovada refaz **uma unica vez** em
 * `reprocessamento_verificacao`, que na matriz aponta outro modelo e outro
 * esforco. Tarefa fora deste mapa nao tem segunda tentativa.
 */
export const TAREFA_DE_REFAZER: Partial<Record<Tarefa, Tarefa>> = {
  verificacao_quantitativa: "reprocessamento_verificacao",
};
