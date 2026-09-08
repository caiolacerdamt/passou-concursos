import { expect, it } from "vitest";

import { comTransacaoRevertida } from "./conexao";
import { descreveComBanco } from "./setup";

/**
 * A tabela de registro dos pedidos de exportacao contra o banco de verdade.
 *
 * O que importa aqui nao e o `create table` — e que ela nasca **fechada** e que
 * o esquecimento a alcance. Uma tabela que diz "esta pessoa existiu e pediu os
 * dados dela" e dado identificado como qualquer outro: se sobreviver ao
 * apagamento, o DADOS-04 esta quebrado por uma linha que ninguem lembra.
 */
descreveComBanco("registro dos pedidos de exportacao", () => {
  it("a tabela existe com as colunas do registro", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows } = await cliente.query<{ column_name: string }>(
        `select column_name
           from information_schema.columns
          where table_schema = 'public'
            and table_name = 'solicitacoes_exportacao'
          order by 1`,
      );

      expect(rows.map((l) => l.column_name)).toEqual([
        "criada_em",
        "id",
        "linhas_exportadas",
        "truncada",
        "user_id",
      ]);
    });
  });

  /**
   * `authenticated` nao escreve aqui. Se escrevesse, um cliente poderia inventar
   * o proprio historico de exercicio de direitos — que e exatamente o que este
   * registro existe para provar.
   */
  it("nasce com RLS ligada e fechada para anon e authenticated", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows: rls } = await cliente.query<{ relrowsecurity: boolean }>(
        `select c.relrowsecurity
           from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relname = 'solicitacoes_exportacao'`,
      );
      expect(rls[0]?.relrowsecurity).toBe(true);

      const { rows: privilegios } = await cliente.query<{ grantee: string }>(
        `select grantee
           from information_schema.role_table_grants
          where table_schema = 'public'
            and table_name = 'solicitacoes_exportacao'
            and grantee in ('anon', 'authenticated', 'public')`,
      );
      expect(privilegios).toEqual([]);
    });
  });

  /**
   * O direito de exportar e repetivel: cada exercicio vira uma linha, e o
   * historico e o que torna o registro auditavel. Um `unique` no `user_id`
   * transformaria o segundo pedido em erro.
   */
  it("aceita mais de um pedido do mesmo titular", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows } = await cliente.query<{ indexdef: string }>(
        `select indexdef from pg_indexes
          where schemaname = 'public' and tablename = 'solicitacoes_exportacao'`,
      );

      const unicoNoTitular = rows.filter(
        (l) => l.indexdef.includes("UNIQUE") && /\(user_id\)/.test(l.indexdef),
      );
      expect(unicoNoTitular).toEqual([]);
    });
  });

  /**
   * O sensor que importa: a rotina varre por `user_id` tabela a tabela, e o que
   * ela nao conhece ela nao apaga. O `on delete cascade` da FK so resolveria se
   * o apagamento passasse por `auth.users`, e ele nao passa.
   */
  it("o apagamento do DADOS-04 alcanca a tabela nova", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows } = await cliente.query<{ prosrc: string }>(
        `select prosrc from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = 'apagar_dados_do_usuario'`,
      );

      expect(rows[0]?.prosrc).toContain("delete from public.solicitacoes_exportacao");
    });
  });
});
