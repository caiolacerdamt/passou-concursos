import { expect, it } from "vitest";

import { inserirQuestao } from "./acervo";
import { criarUsuario } from "./conta";
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

  it("enfileira uma pendencia por motivo e eleva a prioridade sem duplicar", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const questao = await inserirQuestao(cliente);
      const primeira = await cliente.query<{ id: string }>(
        `select public.enfileirar_questao_revisao($1, $2, $3, $4, $5) as id`,
        [questao.id, questao.questao_versao, "baixa_confianca", 2, "primeira"],
      );
      const segunda = await cliente.query<{ id: string }>(
        `select public.enfileirar_questao_revisao($1, $2, $3, $4, $5) as id`,
        [questao.id, questao.questao_versao, "baixa_confianca", 8, null],
      );

      expect(segunda.rows[0].id).toBe(primeira.rows[0].id);
      const { rows } = await cliente.query(
        `select status::text, prioridade, observacao, decidido_por, decidida_em
           from public.questao_revisoes where id = $1`,
        [primeira.rows[0].id],
      );
      expect(rows[0]).toMatchObject({
        status: "pendente",
        prioridade: 8,
        observacao: "primeira",
        decidido_por: null,
        decidida_em: null,
      });
    });
  });

  it("registra aprovacao e rejeicao com operador e data, e fecha a pendencia", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const questao = await inserirQuestao(cliente);
      const operador = await criarUsuario(cliente);
      const { rows: criada } = await cliente.query<{ id: string }>(
        `select public.enfileirar_questao_revisao(
           $1::uuid, $2::integer, 'amostra_qa_real'::text, 1::smallint, null::text
         ) as id`,
        [questao.id, questao.questao_versao],
      );

      await cliente.query(
        `select public.registrar_decisao_questao_revisao($1, 'aprovada', $2, 'conferida')`,
        [criada[0].id, operador],
      );
      const { rows: aprovada } = await cliente.query(
        `select status::text, decidido_por, decidida_em, observacao
           from public.questao_revisoes where id = $1`,
        [criada[0].id],
      );
      expect(aprovada[0].status).toBe("aprovada");
      expect(aprovada[0].decidido_por).toBe(operador);
      expect(aprovada[0].decidida_em).not.toBeNull();
      expect(aprovada[0].observacao).toBe("conferida");

      await expect(
        cliente.query(
          `select public.registrar_decisao_questao_revisao($1, 'rejeitada', $2)`,
          [criada[0].id, operador],
        ),
      ).rejects.toThrow(/revisao_nao_esta_pendente/);
    });
  });
});
