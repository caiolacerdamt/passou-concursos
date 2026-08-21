import type { ExplicacaoGerada } from "@/modules/ia";
import type { ClienteSql } from "@/modules/ia";

export type ExplicacaoParaGravar = {
  questaoId: string;
  questaoVersao: number;
  explicacaoVersao?: number;
  chaveDedup: string;
  resultado: ExplicacaoGerada;
  baseReferenciaId: string | null;
};

export type ResultadoDaGravacao = {
  inserida: boolean;
  id: string | null;
};

/**
 * A chave é a mesma do registro em `ia_geracoes`. O conflito é tratado pelo
 * banco para que duas execuções simultâneas não dupliquem a explicação.
 */
export async function gravarExplicacaoAprovada(
  cliente: ClienteSql,
  entrada: ExplicacaoParaGravar,
): Promise<ResultadoDaGravacao> {
  const { rows } = await cliente.query(
    `insert into public.explicacoes
       (questao_id, questao_versao, explicacao_versao, vigente, status,
        texto, alternativa_correta, fontes_citadas, base_referencia_id, chave_dedup)
     values ($1, $2, $3, true, 'aprovada', $4, $5, $6::jsonb, $7, $8)
     on conflict (chave_dedup) do nothing
     returning id`,
    [
      entrada.questaoId,
      entrada.questaoVersao,
      entrada.explicacaoVersao ?? 1,
      entrada.resultado.texto,
      entrada.resultado.alternativa_correta,
      JSON.stringify(entrada.resultado.fontes_citadas),
      entrada.baseReferenciaId,
      entrada.chaveDedup,
    ],
  );

  return {
    inserida: rows.length > 0,
    id: rows[0]?.id === undefined ? null : String(rows[0].id),
  };
}

/**
 * Guarda apenas uma saída que já passou pelo schema, mas falhou na conferência
 * semântica. Ela fica fora de vigência e sem citações conferidas; o motivo
 * detalhado vai para `questao_revisoes`, não para o conteúdo servido ao aluno.
 */
export async function gravarExplicacaoRejeitada(
  cliente: ClienteSql,
  entrada: ExplicacaoParaGravar,
): Promise<ResultadoDaGravacao> {
  const { rows } = await cliente.query(
    `insert into public.explicacoes
       (questao_id, questao_versao, explicacao_versao, vigente, status,
        texto, alternativa_correta, fontes_citadas, base_referencia_id, chave_dedup)
     values ($1, $2, $3, false, 'rejeitada', $4, $5, '[]'::jsonb, $6, $7)
     on conflict (chave_dedup) do nothing
     returning id`,
    [
      entrada.questaoId,
      entrada.questaoVersao,
      entrada.explicacaoVersao ?? 1,
      entrada.resultado.texto,
      entrada.resultado.alternativa_correta,
      entrada.baseReferenciaId,
      entrada.chaveDedup,
    ],
  );

  return {
    inserida: rows.length > 0,
    id: rows[0]?.id === undefined ? null : String(rows[0].id),
  };
}

