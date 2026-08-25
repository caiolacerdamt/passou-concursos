import { expect, it } from "vitest";

import { criarTopico, inserirQuestao } from "./acervo";
import { comTransacaoRevertida } from "./conexao";
import { descreveComBanco } from "./setup";

descreveComBanco("recursos de estudo e inventário do acervo", () => {
  it("mantém a contagem por tópico separando importadas, publicadas e aptas", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const topico = await criarTopico(cliente);
      await inserirQuestao(cliente, { topico_id: topico, status: "publicada" });
      await inserirQuestao(cliente, { topico_id: topico, status: "rascunho" });
      await cliente.query(
        `insert into public.recursos_estudo
          (topico_id, titulo, url, tipo, duracao_minutos, ordem)
         values ($1, 'Aula', 'https://conteudo.test/aula', 'video', 20, 1)`,
        [topico],
      );

      const { rows } = await cliente.query<{
        total: number;
        importadas: number;
        publicadas: number;
        aptas_sessao: number;
      }>(
        `select total, importadas, publicadas, aptas_sessao
           from public.inventario_acervo
          where topico_id = $1`,
        [topico],
      );
      expect(rows[0]).toEqual({
        total: 2,
        importadas: 2,
        publicadas: 1,
        aptas_sessao: 1,
      });
    });
  });

  it("é retomável por tópico/URL e troca o estado ativo", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const topico = await criarTopico(cliente);
      const valores = [topico, "Aula", "https://conteudo.test/aula", "video", 20, 1, true];
      await cliente.query(
        `insert into public.recursos_estudo
          (topico_id, titulo, url, tipo, duracao_minutos, ordem, ativo)
         values ($1, $2, $3, $4::public.tipo_recurso_estudo, $5, $6, $7)
         on conflict (topico_id, url) do update set ativo = excluded.ativo`,
        valores,
      );
      await cliente.query(
        `insert into public.recursos_estudo
          (topico_id, titulo, url, tipo, duracao_minutos, ordem, ativo)
         values ($1, $2, $3, $4::public.tipo_recurso_estudo, $5, $6, $7)
         on conflict (topico_id, url) do update set ativo = excluded.ativo`,
        [topico, "Aula", "https://conteudo.test/aula", "video", 20, 1, false],
      );
      const { rows } = await cliente.query(
        "select count(*)::int as total, bool_and(not ativo) as inativo from public.recursos_estudo where topico_id = $1",
        [topico],
      );
      expect(rows[0]).toEqual({ total: 1, inativo: true });
    });
  });

  it("não concede mutação ao navegador e mantém RLS", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows } = await cliente.query<{ rls: boolean }>(
        `select c.relrowsecurity as rls
           from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relname = 'recursos_estudo'`,
      );
      expect(rows[0].rls).toBe(true);
      for (const papel of ["anon", "authenticated"]) {
        const privilegios = await cliente.query(
          `select has_table_privilege($1, 'public.recursos_estudo', 'INSERT') as insere,
                  has_table_privilege($1, 'public.recursos_estudo', 'UPDATE') as atualiza,
                  has_table_privilege($1, 'public.recursos_estudo', 'DELETE') as apaga`,
          [papel],
        );
        expect(privilegios.rows[0]).toEqual({ insere: false, atualiza: false, apaga: false });
      }
    });
  });
});
