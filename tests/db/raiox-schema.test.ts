import type { Client } from "pg";
import { expect, it } from "vitest";

import { criarTopico } from "./acervo";
import { recusa } from "./aluno";
import { comTransacaoSemPerfilConcurso } from "./conexao";
import { descreveComBanco } from "./setup";

async function criarPerfil(
  cliente: Client,
  opcoes: {
    ativo?: boolean;
    programa?: string[];
    banca?: string;
  } = {},
): Promise<string> {
  const { rows } = await cliente.query<{ id: string }>(
    `insert into public.perfil_concurso
       (orgao, banca, programa_edital, data_prova, formato, ativo)
     values ($1, $2, $3::jsonb, null, 'multipla_escolha', $4)
     returning id`,
    [
      "Banco do Brasil",
      opcoes.banca ?? "Cesgranrio",
      JSON.stringify(opcoes.programa ?? []),
      opcoes.ativo ?? false,
    ],
  );
  return rows[0].id;
}

descreveComBanco("perfil_concurso — cadastro multi-concurso (RAIOX-08)", () => {
  it("aceita banca indefinida, programa, formato e data de prova vazia", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const topico = await criarTopico(cliente);
      const { rows } = await cliente.query<{
        banca: string;
        programa_edital: string[];
        data_prova: string | null;
        formato: string;
      }>(
        `insert into public.perfil_concurso
           (orgao, banca, programa_edital, data_prova, formato)
         values ('Banco do Brasil', 'indefinida', $1::jsonb, null, 'multipla_escolha')
         returning banca, programa_edital, data_prova, formato`,
        [JSON.stringify([topico])],
      );

      expect(rows[0].banca).toBe("indefinida");
      expect(rows[0].programa_edital).toEqual([topico]);
      expect(rows[0].data_prova).toBeNull();
      expect(rows[0].formato).toBe("multipla_escolha");
    });
  });

  it("modela mais de um perfil, mas recusa dois perfis ativos", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      await criarPerfil(cliente, { ativo: true, banca: "Cesgranrio" });
      const outro = () => criarPerfil(cliente, { ativo: true, banca: "FGV" });

      await recusa(cliente, outro, /perfil_concurso_uma_ativa|duplicate key/);
      await criarPerfil(cliente, { ativo: false, banca: "Cebraspe" });

      const { rows } = await cliente.query<{ quantidade: number }>(
        "select count(*)::int as quantidade from public.perfil_concurso",
      );
      expect(rows[0].quantidade).toBe(2);
    });
  });

  it("recusa programa que não seja um array JSON", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      await recusa(
        cliente,
        () =>
          cliente.query(
            `insert into public.perfil_concurso (orgao, programa_edital)
             values ('Banco do Brasil', '{"topico":"nao-array"}'::jsonb)`,
          ),
        /perfil_concurso_programa_edital_check|check constraint/,
      );
    });
  });
});

descreveComBanco("raiox_projecoes — contrato persistido", () => {
  it("persiste taxa, peso, amostra e os três valores de tendência", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const topico = await criarTopico(cliente);
      const perfil = await criarPerfil(cliente, { programa: [topico] });

      for (const tendencia of ["subindo", "estavel", "caindo"]) {
        await cliente.query(
          `insert into public.raiox_projecoes
             (perfil_concurso_id, topico_id, taxa_bruta, peso, n_questoes, tendencia, amostra_baixa)
           values ($1, $2, 0.25, 0.2, 3, $3::public.raiox_tendencia, true)
           on conflict (perfil_concurso_id, topico_id) do update
             set tendencia = excluded.tendencia`,
          [perfil, topico, tendencia],
        );
      }

      const { rows } = await cliente.query<{
        taxa_bruta: string;
        peso: string;
        n_questoes: number;
        tendencia: string;
        amostra_baixa: boolean;
      }>(
        `select taxa_bruta, peso, n_questoes, tendencia, amostra_baixa
           from public.raiox_projecoes
          where perfil_concurso_id = $1 and topico_id = $2`,
        [perfil, topico],
      );

      expect(Number(rows[0].taxa_bruta)).toBe(0.25);
      expect(Number(rows[0].peso)).toBe(0.2);
      expect(rows[0].n_questoes).toBe(3);
      expect(rows[0].tendencia).toBe("caindo");
      expect(rows[0].amostra_baixa).toBe(true);
    });
  });

  it("não oferece leitura ou escrita direta para authenticated", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const topico = await criarTopico(cliente);
      const perfil = await criarPerfil(cliente);
      await cliente.query(
        `insert into public.raiox_projecoes
           (perfil_concurso_id, topico_id, taxa_bruta, peso, n_questoes, tendencia, amostra_baixa)
         values ($1, $2, 0.1, 0.1, 1, 'estavel', true)`,
        [perfil, topico],
      );

      await cliente.query("savepoint rls");
      await cliente.query("set local role authenticated");
      await cliente.query("savepoint leitura");
      await expect(
        cliente.query("select 1 from public.raiox_projecoes"),
      ).rejects.toThrow(/permission denied|row-level security/);
      await cliente.query("rollback to savepoint leitura");

      await cliente.query("savepoint escrita");
      await expect(
        cliente.query(
          `insert into public.perfil_concurso (orgao) values ('invasao')`,
        ),
      ).rejects.toThrow(/permission denied|row-level security/);
      await cliente.query("rollback to savepoint escrita");

      await cliente.query("rollback to savepoint rls");
    });
  });
});
