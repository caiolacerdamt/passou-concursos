import type { Client } from "pg";
import { expect, it } from "vitest";

import { criarTopico, inserirQuestao } from "./acervo";
import { novoAluno } from "./aluno";
import { comTransacaoSemPerfilConcurso } from "./conexao";
import { descreveComBanco } from "./setup";

const HOJE = "2026-08-21";

async function criarPerfilConcurso(
  cliente: Client,
  topicos: string[],
): Promise<string> {
  const { rows } = await cliente.query<{ id: string }>(
    `insert into public.perfil_concurso
       (orgao, banca, programa_edital, ativo)
     values ('Banco do Brasil', 'indefinida', $1::jsonb, true)
     returning id`,
    [JSON.stringify(topicos)],
  );
  return rows[0].id;
}

async function criarPerfilEstudo(cliente: Client, aluno: string): Promise<void> {
  await cliente.query(
    `insert into public.perfil_estudo (user_id, nivel_declarado, minutos_por_dia)
     values ($1, 'iniciante', 120)`,
    [aluno],
  );
}

async function criarProjecao(
  cliente: Client,
  perfil: string,
  topico: string,
  peso: number,
): Promise<void> {
  await cliente.query(
    `insert into public.raiox_projecoes
       (perfil_concurso_id, topico_id, taxa_bruta, peso, n_questoes, tendencia, amostra_baixa)
     values ($1, $2, $3, $3, 10, 'estavel', false)`,
    [perfil, topico, peso],
  );
}

async function primeiroBloco(cliente: Client, aluno: string) {
  const { rows } = await cliente.query<{ topico_id: string; tipo: string }>(
    `select b.topico_id, b.tipo
       from public.plano_bloco b
       join public.plano_dia p on p.id = b.plano_dia_id
      where p.user_id = $1 and p.data = $2 and b.nivel = 'meta_cheia'
      order by b.ordem
      limit 1`,
    [aluno, HOJE],
  );
  return rows[0];
}

descreveComBanco("contrato Raio-X → plano", () => {
  it("a view reordena o plano sem alterar o motor SQL do M4", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const aluno = novoAluno();
      const primeiro = await criarTopico(cliente);
      const segundo = await criarTopico(cliente);
      await inserirQuestao(cliente, { topico_id: primeiro, status: "publicada" });
      await inserirQuestao(cliente, { topico_id: segundo, status: "publicada" });
      const perfilConcurso = await criarPerfilConcurso(cliente, [primeiro, segundo]);
      await criarPerfilEstudo(cliente, aluno);
      await criarProjecao(cliente, perfilConcurso, primeiro, 0.2);
      await criarProjecao(cliente, perfilConcurso, segundo, 0.8);

      const { rows: antes } = await cliente.query<{ definicao: string }>(
        "select pg_get_functiondef('public.gera_plano_do_dia(uuid,date)'::regprocedure) as definicao",
      );

      await cliente.query(
        "select public.gera_plano_do_dia($1, $2::date)",
        [aluno, HOJE],
      );
      const planoComSegundoPrimeiro = await primeiroBloco(cliente, aluno);
      expect(planoComSegundoPrimeiro.topico_id).toBe(segundo);

      await cliente.query(
        `update public.raiox_projecoes
            set peso = case when topico_id = $2 then 0.9 else 0.1 end,
                taxa_bruta = case when topico_id = $2 then 0.9 else 0.1 end
          where perfil_concurso_id = $1`,
        [perfilConcurso, primeiro],
      );
      await cliente.query(
        "select public.gera_plano_do_dia($1, $2::date)",
        [aluno, HOJE],
      );
      const planoComPrimeiroPrimeiro = await primeiroBloco(cliente, aluno);
      expect(planoComPrimeiroPrimeiro.topico_id).toBe(primeiro);
      expect(planoComPrimeiroPrimeiro.tipo).toBe("avancar");

      const { rows: depois } = await cliente.query<{ definicao: string }>(
        "select pg_get_functiondef('public.gera_plano_do_dia(uuid,date)'::regprocedure) as definicao",
      );
      expect(depois[0].definicao).toBe(antes[0].definicao);
      expect(antes[0].definicao).toMatch(/raiox_peso_topico/);
    });
  });
});
