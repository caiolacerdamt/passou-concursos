import { expect, it } from "vitest";

import {
  EXCECOES_DO_APAGAMENTO,
  TABELAS_GRUPO_1,
} from "@/modules/lgpd/grupo-1";

import { comTransacaoRevertida } from "./conexao";
import { descreveComBanco } from "./setup";

/**
 * O inventario do grupo 1 contra o banco de verdade (contrato nº 9).
 *
 * A direcao do teste e o que importa. Ele nao pergunta "as tabelas da lista
 * existem?" — pergunta "o banco tem alguma tabela com `user_id` que a lista nao
 * conhece?". A primeira pergunta passa para sempre; a segunda **falha no dia**
 * em que a SPEC 12, 13 ou 14 criar uma tabela de aluno e esquecer de registra-la.
 */
descreveComBanco("inventario do grupo 1", () => {
  it("nenhuma tabela com user_id ficou fora da lista", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows } = await cliente.query<{ tabela: string }>(
        `select c.relname as tabela
           from pg_attribute a
           join pg_class c     on c.oid = a.attrelid
           join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public'
            and a.attname = 'user_id'
            and a.attnum > 0
            and not a.attisdropped
            -- Tabela e tabela particionada. A particao em si fica de
            -- fora: apagar pela tabela-pai ja alcanca todas, e listar particao
            -- faria a lista mudar todo mes.
            and c.relkind in ('r', 'p')
            and not c.relispartition
          order by 1`,
      );

      const noBanco = rows.map((l) => l.tabela);
      const conhecidas = new Set<string>([
        ...TABELAS_GRUPO_1,
        ...EXCECOES_DO_APAGAMENTO.map((e) => e.tabela),
      ]);

      expect(noBanco.filter((t) => !conhecidas.has(t))).toEqual([]);
    });
  });

  it("a lista nao inventa tabela que nao existe", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows } = await cliente.query<{ tabela: string }>(
        `select c.relname as tabela
           from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relname = any($1)`,
        [[...TABELAS_GRUPO_1]],
      );

      expect(rows.map((l) => l.tabela).sort()).toEqual([...TABELAS_GRUPO_1].sort());
    });
  });

  it("toda excecao ao apagamento tem motivo escrito", () => {
    // Excecao sem motivo e como excecao nao declarada: ninguem consegue
    // auditar depois se ela ainda vale.
    for (const excecao of EXCECOES_DO_APAGAMENTO) {
      expect(excecao.motivo.length).toBeGreaterThan(20);
    }
  });
});
