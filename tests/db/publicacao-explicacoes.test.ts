import { expect, it } from "vitest";

import { inserirQuestao } from "./acervo";
import { comTransacaoRevertida } from "./conexao";
import { descreveComBanco } from "./setup";

descreveComBanco("SPEC 10 — schema da fila, base e explicacoes", () => {
  it("cria as tres tabelas com RLS e sem privilegio do navegador", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows: grants } = await cliente.query<{ table_name: string }>(
        `select table_name
           from information_schema.role_table_grants
          where table_schema = 'public'
            and table_name in ('questao_revisoes', 'base_referencia', 'explicacoes')
            and grantee in ('anon', 'authenticated')`,
      );
      expect(grants).toEqual([]);

      const { rows: rls } = await cliente.query<{
        relname: string;
        relrowsecurity: boolean;
      }>(
        `select c.relname, c.relrowsecurity
           from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public'
            and c.relname in ('questao_revisoes', 'base_referencia', 'explicacoes')
          order by c.relname`,
      );
      expect(rls).toEqual([
        { relname: "base_referencia", relrowsecurity: true },
        { relname: "explicacoes", relrowsecurity: true },
        { relname: "questao_revisoes", relrowsecurity: true },
      ]);
    });
  });

  it("explicacao e revisao referenciam questao e versao, sem user_id", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows } = await cliente.query<{
        table_name: string;
        column_name: string;
      }>(
        `select table_name, column_name
           from information_schema.columns
          where table_schema = 'public'
            and table_name in ('questao_revisoes', 'base_referencia', 'explicacoes')
            and column_name in ('questao_id', 'questao_versao', 'user_id')
          order by table_name, column_name`,
      );
      expect(rows).toEqual([
        { table_name: "explicacoes", column_name: "questao_id" },
        { table_name: "explicacoes", column_name: "questao_versao" },
        { table_name: "questao_revisoes", column_name: "questao_id" },
        { table_name: "questao_revisoes", column_name: "questao_versao" },
      ]);
    });
  });

  it("recusa explicacao para par de questao-versao inexistente", async () => {
    await comTransacaoRevertida(async (cliente) => {
      await expect(
        cliente.query(
          `insert into public.explicacoes
             (questao_id, questao_versao, texto, alternativa_correta, chave_dedup)
           values (gen_random_uuid(), 1, 'texto', 'A', 'explicacao:inexistente')`,
        ),
      ).rejects.toThrow(/explicacoes_questao_fk|foreign key/i);
    });
  });

  it("exige fonte quando explicacao fica aprovada", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const questao = await inserirQuestao(cliente);
      await expect(
        cliente.query(
          `insert into public.explicacoes
             (questao_id, questao_versao, status, texto, alternativa_correta, chave_dedup)
           values ($1, $2, 'aprovada', 'texto', 'A', 'explicacao:sem-fonte')`,
          [questao.id, questao.questao_versao],
        ),
      ).rejects.toThrow(/explicacoes_aprovada_tem_fonte/);
    });
  });
});
