import type { RepositorioDeIa } from "./gateway";

/**
 * O `RepositorioDeIa` por cima de uma conexao `pg`.
 *
 * E o caminho dos **jobs** (AD-036): script de GitHub Actions so tem o
 * `DATABASE_URL`, nao o cliente do Supabase — e o `pg` e dependencia de
 * desenvolvimento, entao ele nao pode ser importado aqui. Por isso o tipo do
 * cliente e estrutural: qualquer coisa que saiba `query` serve, inclusive o
 * duplo do teste.
 */
export type ClienteSql = {
  query(
    texto: string,
    valores?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
};

export function repositorioPorPg(cliente: ClienteSql): RepositorioDeIa {
  return {
    async buscarPorChave(chave) {
      const { rows } = await cliente.query(
        `select resultado, modelo, usou_fallback
           from public.ia_geracoes where chave_dedup = $1`,
        [chave],
      );
      if (rows.length === 0) return null;

      return {
        resultado: rows[0].resultado,
        modelo: String(rows[0].modelo),
        usouFallback: Boolean(rows[0].usou_fallback),
      };
    },

    async gravar(registro) {
      // `do nothing` no conflito: duas execucoes simultaneas da fabrica podem
      // chegar aqui com a mesma chave. Quem chegou primeiro ja gravou o que
      // interessa, e derrubar a segunda so perderia o trabalho ja pago.
      await cliente.query(
        `insert into public.ia_geracoes
           (chave_dedup, tarefa, questao_id, questao_versao,
            modelo, modelo_versao, esforco, versao_prompt,
            batch, usou_fallback,
            tokens_entrada, tokens_cacheados, tokens_saida, custo_usd, resultado)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         on conflict (chave_dedup) do nothing`,
        [
          registro.chaveDedup,
          registro.tarefa,
          registro.questaoId,
          registro.questaoVersao,
          registro.modelo,
          registro.modeloVersao,
          registro.esforco,
          registro.versaoPrompt,
          registro.batch,
          registro.usouFallback,
          registro.tokensEntrada,
          registro.tokensCacheados,
          registro.tokensSaida,
          registro.custoUsd,
          registro.resultado === null ? null : JSON.stringify(registro.resultado),
        ],
      );
    },

    async gastoDoPeriodo(periodo) {
      // Faixa de data em vez de `to_char`, para o indice de `criada_em` valer.
      const { rows } = await cliente.query(
        `select coalesce(sum(custo_usd), 0)::float8 as gasto
           from public.ia_geracoes
          where criada_em >= to_timestamp($1 || '-01', 'YYYY-MM-DD')
            and criada_em <  to_timestamp($1 || '-01', 'YYYY-MM-DD') + interval '1 month'`,
        [periodo],
      );
      return Number(rows[0]?.gasto ?? 0);
    },

    async registrarAlerta(periodo, gasto, teto) {
      const { rows } = await cliente.query(
        `insert into public.ia_alerta_de_gasto (periodo, gasto_usd, teto_usd)
         values ($1, $2, $3)
         on conflict (periodo) do nothing
         returning periodo`,
        [periodo, gasto, teto],
      );
      // Zero linhas = ja havia alerta neste mes. E o banco dizendo "uma vez".
      return rows.length > 0;
    },
  };
}

/**
 * Leitor de configuracao para job: le `configuracoes_vigentes` pela mesma
 * conexao.
 *
 * Existe para o job usar a validacao, o default e as quedas do modulo de
 * configuracao (AD-085) em vez de reescrever a leitura em SQL solto — que e
 * como o default duplica e depois diverge.
 */
export function leitorDeConfigPorPg(cliente: ClienteSql) {
  return async (chaves: readonly string[]): Promise<Record<string, unknown>> => {
    const { rows } = await cliente.query(
      `select chave, valor from public.configuracoes_vigentes where chave = any($1)`,
      [[...chaves]],
    );
    return Object.fromEntries(rows.map((l) => [String(l.chave), l.valor]));
  };
}
