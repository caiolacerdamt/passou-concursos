import { expect, it } from "vitest";

import { comTransacaoRevertida } from "./conexao";
import { descreveComBanco } from "./setup";

/** Uma geracao valida, com o minimo que a tabela exige. */
function geracao(campos: Record<string, unknown> = {}) {
  return {
    chave_dedup: null,
    tarefa: "explicacao",
    questao_id: null,
    questao_versao: null,
    modelo: "modelo-de-teste",
    modelo_versao: "2026-01-01",
    esforco: "alto",
    versao_prompt: "1",
    ...campos,
  };
}

async function inserir(
  cliente: { query: (texto: string, valores: unknown[]) => Promise<unknown> },
  campos: Record<string, unknown> = {},
) {
  const linha = geracao(campos);
  return cliente.query(
    `insert into public.ia_geracoes
       (chave_dedup, tarefa, questao_id, questao_versao,
        modelo, modelo_versao, esforco, versao_prompt)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      linha.chave_dedup,
      linha.tarefa,
      linha.questao_id,
      linha.questao_versao,
      linha.modelo,
      linha.modelo_versao,
      linha.esforco,
      linha.versao_prompt,
    ],
  );
}

descreveComBanco("ia_geracoes — dedup, auditoria e gasto", () => {
  it("recusa a segunda linha com a mesma chave de dedup (IA-14)", async () => {
    await comTransacaoRevertida(async (cliente) => {
      await inserir(cliente, { chave_dedup: "explicacao:abc:1" });

      await expect(
        inserir(cliente, { chave_dedup: "explicacao:abc:1" }),
      ).rejects.toThrow(/ia_geracoes_chave_dedup_unica|duplicate key/i);
    });
  });

  it("deixa passar quantas linhas sem chave de dedup quiser", async () => {
    // A frase do plano nao se reaproveita: a idempotencia dela e `frase is
    // null` na propria `plano_dia`. Se a unicidade pegasse tambem o nulo, o
    // segundo aluno do dia nao conseguiria ter frase.
    await comTransacaoRevertida(async (cliente) => {
      await inserir(cliente, { tarefa: "frase_do_plano" });
      await inserir(cliente, { tarefa: "frase_do_plano" });

      // Filtra pelo modelo de mentira, e nao so pela tarefa: a tabela e
      // compartilhada e ja tem linha de verdade de `frase_do_plano` sem chave
      // de dedup — foi assim que este teste ficou vermelho na primeira chamada
      // real ao provedor. Contagem global num banco compartilhado nao mede o
      // que o teste inseriu.
      const { rows } = await cliente.query<{ n: string }>(
        `select count(*)::text as n from public.ia_geracoes
          where tarefa = 'frase_do_plano'
            and chave_dedup is null
            and modelo = 'modelo-de-teste'`,
      );
      expect(Number(rows[0].n)).toBe(2);
    });
  });

  it("guarda modelo, versao, esforco e versao do prompt (IA-02 AC4)", async () => {
    await comTransacaoRevertida(async (cliente) => {
      await inserir(cliente, {
        chave_dedup: "explicacao:xyz:1",
        modelo: "modelo-de-teste",
        modelo_versao: "2026-02-02",
        esforco: "maximo",
        versao_prompt: "7",
      });

      const { rows } = await cliente.query(
        `select modelo, modelo_versao, esforco, versao_prompt, usou_fallback, batch
           from public.ia_geracoes where chave_dedup = 'explicacao:xyz:1'`,
      );
      expect(rows[0]).toMatchObject({
        modelo: "modelo-de-teste",
        modelo_versao: "2026-02-02",
        esforco: "maximo",
        versao_prompt: "7",
        usou_fallback: false,
        batch: false,
      });
    });
  });

  it("recusa questao pela metade — id sem versao nao identifica nada", async () => {
    await comTransacaoRevertida(async (cliente) => {
      await expect(
        inserir(cliente, {
          questao_id: "00000000-0000-0000-0000-000000000001",
          questao_versao: null,
        }),
      ).rejects.toThrow(/ia_geracoes_questao_completa/);
    });
  });

  it("nao tem user_id: texto de aluno nao ganha copia aqui", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows } = await cliente.query<{ attname: string }>(
        `select a.attname from pg_attribute a
           join pg_class c on c.oid = a.attrelid
           join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relname = 'ia_geracoes'
            and a.attnum > 0 and not a.attisdropped`,
      );
      expect(rows.map((l) => l.attname)).not.toContain("user_id");
    });
  });
});

descreveComBanco("ia_alerta_de_gasto — uma vez por periodo (IA-12)", () => {
  it("recusa o segundo alerta do mesmo mes", async () => {
    await comTransacaoRevertida(async (cliente) => {
      await cliente.query(
        `insert into public.ia_alerta_de_gasto (periodo, gasto_usd, teto_usd)
         values ('2026-08', 61, 60)`,
      );

      await expect(
        cliente.query(
          `insert into public.ia_alerta_de_gasto (periodo, gasto_usd, teto_usd)
           values ('2026-08', 90, 60)`,
        ),
      ).rejects.toThrow(/duplicate key|ia_alerta_de_gasto_pkey/i);
    });
  });

  it("recusa periodo que nao seja um mes", async () => {
    await comTransacaoRevertida(async (cliente) => {
      await expect(
        cliente.query(
          `insert into public.ia_alerta_de_gasto (periodo, gasto_usd, teto_usd)
           values ('agosto', 61, 60)`,
        ),
      ).rejects.toThrow(/ia_alerta_periodo_mensal/);
    });
  });
});

descreveComBanco("privilegios das tabelas de IA", () => {
  it("anon e authenticated nao tem privilegio nenhum, e a RLS esta ligada", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows: concessoes } = await cliente.query<{
        grantee: string;
        table_name: string;
        privilege_type: string;
      }>(
        `select grantee, table_name, privilege_type
           from information_schema.role_table_grants
          where table_schema = 'public'
            and table_name in ('ia_geracoes', 'ia_alerta_de_gasto')
            and grantee in ('anon', 'authenticated')`,
      );
      expect(concessoes).toEqual([]);

      const { rows: rls } = await cliente.query<{
        relname: string;
        relrowsecurity: boolean;
      }>(
        `select c.relname, c.relrowsecurity
           from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public'
            and c.relname in ('ia_geracoes', 'ia_alerta_de_gasto')
          order by 1`,
      );
      expect(rls.map((l) => l.relrowsecurity)).toEqual([true, true]);
      expect(rls.length).toBe(2);
    });
  });
});
