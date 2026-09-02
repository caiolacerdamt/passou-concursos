/**
 * As causas do caderno de erros e o nome de cada uma em PT-BR.
 *
 * Vivem num módulo próprio, e não dentro de `progresso.ts`, porque tela de
 * cliente precisa do rótulo: o resumo da sessão mostra a causa que o aluno
 * registrou, e `progresso.ts` carrega o cliente Supabase de serviço — importar
 * ele de um componente `"use client"` levaria código de servidor para o pacote
 * do navegador. Aqui não há dependência nenhuma, então os dois lados leem do
 * mesmo lugar em vez de copiar a lista.
 */
export const CAUSAS_DO_CADERNO = [
  "nao_sabia_conteudo",
  "errei_a_conta",
  "entendi_errado_enunciado",
  "confundi_conceitos",
  "fiquei_na_duvida",
  "chutei",
  "nao_sei_dizer",
  "faltou_tempo",
] as const;

export type CausaDoCaderno = (typeof CAUSAS_DO_CADERNO)[number];

/** Nome de cada causa em PT-BR; as telas do aluno leem daqui, sem copiar. */
export const NOMES_DAS_CAUSAS: Record<CausaDoCaderno, string> = {
  nao_sabia_conteudo: "Não sabia o conteúdo",
  errei_a_conta: "Errei a conta",
  entendi_errado_enunciado: "Entendi errado o enunciado",
  confundi_conceitos: "Confundi conceitos",
  fiquei_na_duvida: "Fiquei na dúvida",
  chutei: "Chutei",
  nao_sei_dizer: "Não sei dizer",
  faltou_tempo: "Faltou tempo",
};
