import { expect, it } from "vitest";

import { criarTopico } from "./acervo";
import { comBanco, comTransacaoSemPerfilConcurso } from "./conexao";
import { descreveComBanco } from "./setup";

type Job = { jobname: string; schedule: string; command: string; active: boolean };

async function job(nome: string): Promise<Job | undefined> {
  const { rows } = await comBanco(async (cliente) =>
    cliente.query<Job>(
      "select jobname, schedule, command, active from cron.job where jobname = $1",
      [nome],
    ),
  );
  return rows[0];
}

descreveComBanco("raiox_peso_topico — assinatura e fallback", () => {
  it("mantém exatamente topico_id e peso e usa 1.0 sem perfil ativo", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const topico = await criarTopico(cliente);
      const { rows: colunas } = await cliente.query<{ column_name: string }>(
        `select column_name
           from information_schema.columns
          where table_schema = 'public' and table_name = 'raiox_peso_topico'
          order by ordinal_position`,
      );
      expect(colunas.map((coluna) => coluna.column_name)).toEqual([
        "topico_id",
        "peso",
      ]);

      const { rows } = await cliente.query<{ topico_id: string; peso: string }>(
        "select topico_id, peso from public.raiox_peso_topico where topico_id = $1",
        [topico],
      );
      expect(rows).toEqual([{ topico_id: topico, peso: "1.0" }]);
    });
  });
});

descreveComBanco("raiox_peso_topico — porteiro do edital", () => {
  it("entrega o programa ativo e deixa o tópico fora dele fora do plano", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const dentro = await criarTopico(cliente);
      const fora = await criarTopico(cliente);
      const { rows: perfis } = await cliente.query<{ id: string }>(
        `insert into public.perfil_concurso (orgao, banca, programa_edital, ativo)
         values ('Banco do Brasil', 'indefinida', $1::jsonb, true)
         returning id`,
        [JSON.stringify([dentro])],
      );
      await cliente.query(
        `insert into public.raiox_projecoes
           (perfil_concurso_id, topico_id, taxa_bruta, peso, n_questoes, tendencia, amostra_baixa)
         values ($1, $2, 0.8, 0.8, 3, 'subindo', true)`,
        [perfis[0].id, dentro],
      );

      const { rows } = await cliente.query<{ topico_id: string; peso: string }>(
        `select topico_id, peso
           from public.raiox_peso_topico
          where topico_id = any($1::uuid[])
          order by topico_id`,
        [[dentro, fora]],
      );
      expect(rows).toEqual([{ topico_id: dentro, peso: "0.80000000" }]);
    });
  });
});

descreveComBanco("pg_cron — job do Raio-X", () => {
  it("recalcula antes dos jobs do M4 e chama a função qualificada", async () => {
    const raiox = await job("m5-recalcula-raiox");
    const projecoes = await job("m4-recalcula-projecoes");
    expect(raiox).toBeDefined();
    expect(raiox?.schedule).toBe("30 5 * * *");
    expect(raiox?.active).toBe(true);
    expect(raiox?.command).toMatch(/public\.recalcula_raiox\(\)/);

    const minuto = (agendamento: Job | undefined) => {
      const [minuto, hora] = (agendamento?.schedule ?? "").split(" ");
      return Number(hora) * 60 + Number(minuto);
    };
    expect(minuto(raiox)).toBeLessThan(minuto(projecoes));
  });
});
