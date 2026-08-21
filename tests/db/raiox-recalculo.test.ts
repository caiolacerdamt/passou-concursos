import type { Client } from "pg";
import { expect, it } from "vitest";

import { criarTopico, inserirQuestao } from "./acervo";
import { comTransacaoRevertida } from "./conexao";
import { descreveComBanco } from "./setup";

async function criarPerfil(
  cliente: Client,
  topicos: string[],
  opcoes: { banca?: string; ativo?: boolean } = {},
): Promise<string> {
  const { rows } = await cliente.query<{ id: string }>(
    `insert into public.perfil_concurso
       (orgao, banca, programa_edital, ativo)
     values ('Banco do Brasil', $1, $2::jsonb, $3)
     returning id`,
    [
      opcoes.banca ?? "Cesgranrio",
      JSON.stringify(topicos),
      opcoes.ativo ?? true,
    ],
  );
  return rows[0].id;
}

async function criarQuestaoPublicada(
  cliente: Client,
  topicoId: string,
  opcoes: { ano?: number; banca?: string; anulada?: boolean } = {},
): Promise<{ id: string; provaId: string }> {
  const questao = await inserirQuestao(cliente, {
    topico_id: topicoId,
    status: "publicada",
    anulada: opcoes.anulada ?? false,
  });
  const { rows: origem } = await cliente.query<{ prova_id: string }>(
    "select prova_id from public.questoes where id = $1 and questao_versao = $2",
    [questao.id, questao.questao_versao],
  );
  await cliente.query(
    "update public.provas set ano = $1, banca = $2 where id = $3",
    [opcoes.ano ?? 2023, opcoes.banca ?? "Cesgranrio", origem[0].prova_id],
  );
  return { id: questao.id, provaId: origem[0].prova_id };
}

async function recalcular(cliente: Client, referencia = "2026-08-21"): Promise<number> {
  const { rows } = await cliente.query<{ total: number }>(
    "select public.recalcula_raiox($1::date) as total",
    [referencia],
  );
  return Number(rows[0].total);
}

type Projecao = {
  topico_id: string;
  taxa_bruta: string;
  peso: string;
  n_questoes: number;
  tendencia: string;
  amostra_baixa: boolean;
};

async function lerProjecoes(cliente: Client, perfil: string): Promise<Projecao[]> {
  const { rows } = await cliente.query<Projecao>(
    `select topico_id, taxa_bruta, peso, n_questoes, tendencia, amostra_baixa
       from public.raiox_projecoes
      where perfil_concurso_id = $1
      order by topico_id`,
    [perfil],
  );
  return rows;
}

descreveComBanco("recalcula_raiox — fonte e taxa", () => {
  it("conta real publicada vigente, mantém anulada e ignora inédita e versão antiga", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const topico = await criarTopico(cliente);
      const perfil = await criarPerfil(cliente, [topico]);
      const primeira = await criarQuestaoPublicada(cliente, topico);

      await inserirQuestao(cliente, {
        id: primeira.id,
        questao_versao: 2,
        prova_id: primeira.provaId,
        numero: 1,
        topico_id: topico,
        status: "publicada",
        mudanca_tipo: "substantiva",
        mudanca_motivo: "gabarito retificado",
      });
      await criarQuestaoPublicada(cliente, topico, { anulada: true });
      await inserirQuestao(cliente, {
        origem: "gerada_ia",
        prova_id: null,
        numero: null,
        fonte_citacao: null,
        topico_id: topico,
        status: "em_revisao",
      });

      expect(await recalcular(cliente)).toBe(1);
      const [linha] = await lerProjecoes(cliente, perfil);

      // A versão 1 deixou de ser vigente; a anulada ainda mede o que a banca
      // cobrou; a inédita não entra em nenhuma circunstância.
      expect(linha.n_questoes).toBe(2);
      expect(Number(linha.taxa_bruta)).toBeGreaterThan(0);
      expect(linha.amostra_baixa).toBe(true);

      const { rows: funcao } = await cliente.query<{ definicao: string }>(
        "select pg_get_functiondef('public.recalcula_raiox(date)'::regprocedure) as definicao",
      );
      expect(funcao[0].definicao).not.toMatch(/\btentativas\b/);
    });
  });
});

descreveComBanco("recalcula_raiox — decaimento e tendência", () => {
  it("dá mais peso ao recente e produz as três tendências", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const recente = await criarTopico(cliente);
      const anterior = await criarTopico(cliente);
      const antigo = await criarTopico(cliente);
      const perfil = await criarPerfil(cliente, [recente, anterior, antigo]);

      await criarQuestaoPublicada(cliente, recente, { ano: 2025 });
      await criarQuestaoPublicada(cliente, anterior, { ano: 2022 });
      await criarQuestaoPublicada(cliente, antigo, { ano: 2010 });

      await recalcular(cliente);
      const linhas = await lerProjecoes(cliente, perfil);
      const porTopico = new Map(linhas.map((linha) => [linha.topico_id, linha]));

      const linhaRecente = porTopico.get(recente);
      const linhaAnterior = porTopico.get(anterior);
      const linhaAntigo = porTopico.get(antigo);
      expect(linhaRecente).toBeDefined();
      expect(linhaAnterior).toBeDefined();
      expect(linhaAntigo).toBeDefined();
      expect(Number(linhaRecente!.peso)).toBeGreaterThan(Number(linhaAnterior!.peso));
      expect(linhaRecente!.tendencia).toBe("subindo");
      expect(linhaAnterior!.tendencia).toBe("caindo");
      expect(linhaAntigo!.tendencia).toBe("estavel");
    });
  });
});

descreveComBanco("recalcula_raiox — amortecimento e idempotência", () => {
  it("puxa amostra pequena para a média e dá média ao tópico sem questão", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const pequeno = await criarTopico(cliente);
      const robusto = await criarTopico(cliente);
      const semQuestao = await criarTopico(cliente);
      const perfil = await criarPerfil(cliente, [pequeno, robusto, semQuestao]);

      for (let i = 0; i < 3; i += 1) {
        await criarQuestaoPublicada(cliente, pequeno);
      }
      await criarQuestaoPublicada(cliente, robusto);

      await recalcular(cliente);
      const linhas = await lerProjecoes(cliente, perfil);
      const porTopico = new Map(linhas.map((linha) => [linha.topico_id, linha]));
      const linhaPequeno = porTopico.get(pequeno)!;
      const linhaSemQuestao = porTopico.get(semQuestao)!;
      const media = Number(linhaSemQuestao.peso);

      expect(linhaPequeno.n_questoes).toBe(3);
      expect(linhaPequeno.amostra_baixa).toBe(true);
      expect(Number(linhaPequeno.peso)).not.toBe(Number(linhaPequeno.taxa_bruta));
      expect(Math.abs(Number(linhaPequeno.peso) - media)).toBeLessThan(
        Math.abs(Number(linhaPequeno.taxa_bruta) - media),
      );
      expect(linhaSemQuestao.n_questoes).toBe(0);
      expect(Number(linhaSemQuestao.taxa_bruta)).toBe(0);
      expect(media).toBeGreaterThan(0);
      expect(linhaSemQuestao.amostra_baixa).toBe(true);
    });
  });

  it("reroda com o mesmo resultado e preserva a projeção se uma execução falhar", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const topico = await criarTopico(cliente);
      const perfil = await criarPerfil(cliente, [topico]);
      await criarQuestaoPublicada(cliente, topico);

      await recalcular(cliente);
      const antes = await lerProjecoes(cliente, perfil);
      await recalcular(cliente);
      const depois = await lerProjecoes(cliente, perfil);
      expect(depois).toEqual(antes);

      // O programa aceita JSON por contrato; um UUID que não existe falha na
      // FK da projeção. O savepoint prova que o DELETE não deixa meia projeção.
      await cliente.query(
        "update public.perfil_concurso set programa_edital = $1::jsonb where id = $2",
        [JSON.stringify([crypto.randomUUID()]), perfil],
      );
      await cliente.query("savepoint falha_raiox");
      await expect(recalcular(cliente)).rejects.toThrow(/foreign key|raiox_projecoes/);
      await cliente.query("rollback to savepoint falha_raiox");

      const preservada = await lerProjecoes(cliente, perfil);
      expect(preservada).toEqual(antes);
    });
  });
});
