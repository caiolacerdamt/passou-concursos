import type { SupabaseClient } from "@supabase/supabase-js";

import { clienteDeServico } from "@/lib/db/servidor";

import {
  CAUSAS_DO_TREINO,
  CONTEXTOS,
  type CausaDoTreino,
  type Contexto,
  type EntradaTentativa,
  LETRAS_POR_TIPO,
  type ResultadoTentativa,
  TentativaRecusada,
  type TipoQuestao,
} from "./contrato";

/**
 * Grava uma resposta como linha permanente do log (ALUNO-01, ALUNO-03).
 *
 * A ordem das operacoes e a regra, nao detalhe:
 *
 *   1. valida **em memoria** — nenhuma ida ao banco. E o que cumpre "recusar
 *      antes do INSERT" do ALUNO-03 AC1: a tela recebe um motivo nomeado, nao
 *      uma mensagem de erro do Postgres;
 *   2. o resto (dedup, snapshot e INSERT) roda dentro de
 *      `public.registrar_tentativa`, que e uma funcao SQL so — atomica por
 *      construcao. Sem ela, um INSERT que falhasse depois do dedup deixaria o
 *      item marcado como respondido para sempre.
 *
 * Os `CHECK` da tabela repetem a validacao de propósito: sao a rede embaixo do
 * modulo, para o caso de alguem gravar por outro caminho.
 */
export async function registrarTentativa(
  entrada: EntradaTentativa,
  cliente: SupabaseClient = clienteDeServico(),
): Promise<ResultadoTentativa> {
  validar(entrada);

  const { data, error } = await cliente.rpc("registrar_tentativa", {
    p_user_id: entrada.userId,
    p_sessao_item_id: entrada.sessaoItemId,
    p_contexto: entrada.contexto,
    p_resposta: entrada.respostaDada,
    p_tempo_ms: entrada.tempoMs ?? null,
    p_marcou_chute: entrada.marcouChute ?? false,
    p_causa: entrada.causaErro ?? null,
  });

  if (error) {
    // A funcao SQL levanta as recusas com prefixo nomeado justamente para que a
    // tela receba um motivo, e nao o texto de um erro de banco.
    if (error.message.includes("causa_obrigatoria")) {
      throw new TentativaRecusada(
        "causa_obrigatoria",
        "Diga por que errou antes de seguir. 'Nao sei dizer' vale como resposta.",
      );
    }
    if (error.message.includes("item_inexistente")) {
      throw new TentativaRecusada(
        "item_inexistente",
        "Esta questao nao faz parte de uma sessao sua.",
      );
    }
    throw new Error(
      `registrar_tentativa falhou: ${JSON.stringify({
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      })}`,
      { cause: error },
    );
  }

  const linha = (Array.isArray(data) ? data[0] : data) as
    | {
        tentativa_id: string;
        respondida_em: string;
        correta: boolean;
        duplicada: boolean;
      }
    | undefined;

  if (!linha) {
    // A funcao SQL sempre devolve uma linha ou levanta excecao. Chegar aqui e
    // defeito nosso, e vale gritar em vez de estourar com `undefined` adiante.
    throw new Error(
      "registrar_tentativa nao devolveu linha nenhuma — estado inesperado do banco.",
    );
  }

  return {
    tentativaId: linha.tentativa_id,
    respondidaEm: linha.respondida_em,
    correta: linha.correta,
    duplicada: linha.duplicada,
  };
}

/**
 * As recusas que acontecem antes de qualquer ida ao banco.
 *
 * O que **nao** e validado aqui: se a resposta esta certa. O gabarito e do banco
 * (invariante nº4) e o modulo nao o conhece — se conhecesse, existiria um
 * segundo lugar dizendo qual e a alternativa correta.
 */
export function validar(entrada: EntradaTentativa): void {
  if (!(CONTEXTOS as readonly string[]).includes(entrada.contexto)) {
    throw new TentativaRecusada(
      "contexto_invalido",
      `Contexto '${entrada.contexto}' nao existe.`,
    );
  }

  const causa = entrada.causaErro ?? null;
  if (causa !== null && !(CAUSAS_DO_TREINO as readonly string[]).includes(causa)) {
    // Pega `faltou_tempo` em particular: essa causa e declarada na revisao
    // pos-prova, em `tentativa_causa_simulado`, e nunca no fato (ALUNO-04 AC3).
    throw new TentativaRecusada(
      "causa_invalida",
      `Causa '${causa}' nao pode ser declarada no proprio registro da resposta.`,
    );
  }
}

/** Contextos em que errar obriga a declarar a causa antes de avancar. */
const PEDE_CAUSA: readonly Contexto[] = ["treino", "plano", "revisao"];

/**
 * Checagem **otimista** da tela, antes de mandar a resposta ao servidor.
 *
 * Precisa do tipo da questao e de se a resposta esta certa — dois dados que a
 * tela pode ter em maos, mas que `registrarTentativa` **nao** tem: o gabarito e
 * do banco (invariante nº4), e "errou no treino" so se sabe depois de comparar.
 *
 * Por isso ela e conveniencia, e nao a garantia: quem obriga a causa antes do
 * INSERT e a propria `public.registrar_tentativa`, que levanta
 * `causa_obrigatoria` no instante seguinte a calcular se acertou. Chamar esta
 * funcao poupa uma ida ao servidor; nao chamar nao abre buraco nenhum.
 *
 * Uma excecao a registrar: em `revisao` este gate e a **unica** exigencia. O
 * CHECK da tabela e a funcao SQL so cobram a causa em `treino` e `plano` — mas
 * nenhum dos dois a proibe em `revisao`, entao a coluna aceita e a tela sabe
 * renderizar o passo. Ampliar o alcance so aqui evita migracao; quando o SQL
 * for mexido, o lugar de alinhar e a lista abaixo.
 */
export function validarResposta(
  entrada: EntradaTentativa,
  contexto: { tipoQuestao: TipoQuestao; acertou: boolean },
): void {
  validar(entrada);

  const letras = LETRAS_POR_TIPO[contexto.tipoQuestao] as readonly string[];
  if (!letras.includes(entrada.respostaDada)) {
    throw new TentativaRecusada(
      "resposta_invalida",
      `Resposta '${entrada.respostaDada}' nao existe numa questao ${contexto.tipoQuestao}.`,
    );
  }

  const causa = entrada.causaErro ?? null;

  // ALUNO-03 AC1: errou, tem de dizer por que **antes** de avancar.
  // `revisao` entra porque o piso do dia e feito so de blocos de revisao: sem
  // ele, quem cumpre o minimo nunca declara causa e o caderno de erros nasce
  // vazio. `simulado` fica de fora de proposito — prova curta cronometrada nao
  // para a cada erro.
  if (PEDE_CAUSA.includes(entrada.contexto) && !contexto.acertou && causa === null) {
    throw new TentativaRecusada(
      "causa_obrigatoria",
      "Diga por que errou antes de seguir. 'Nao sei dizer' vale como resposta.",
    );
  }

  if (causa !== null && contexto.acertou) {
    throw new TentativaRecusada(
      "causa_so_com_erro",
      "Resposta certa nao tem causa de erro.",
    );
  }
}

export type { CausaDoTreino };
