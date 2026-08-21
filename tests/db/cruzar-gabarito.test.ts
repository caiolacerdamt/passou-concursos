import type { Client } from "pg";
import { expect, it } from "vitest";

import { criarProva, inserirQuestao } from "./acervo";
import { inserirTentativa, questaoParaResponder } from "./aluno";
import { comTransacaoRevertida } from "./conexao";
import { descreveComBanco } from "./setup";

type Item = { numero: number; resposta?: string | null; anulada?: boolean };

async function cruzar(
  cliente: Client,
  prova: string,
  itens: Item[],
  versao: string,
) {
  const { rows } = await cliente.query(
    "select public.cruzar_gabarito($1, $2::jsonb, $3) as resumo",
    [prova, JSON.stringify(itens), versao],
  );
  return rows[0].resumo as Record<string, number>;
}

async function versoesDe(cliente: Client, id: string) {
  const { rows } = await cliente.query(
    `select questao_versao, vigente, resposta_correta, gabarito_versao, anulada,
            mudanca_tipo::text, mudanca_motivo
       from public.questoes where id = $1 order by questao_versao`,
    [id],
  );
  return rows;
}

descreveComBanco("cruzar_gabarito (BANCO-04)", () => {
  it("preenche resposta_correta e gabarito_versao e marca as anuladas (AC1/AC2)", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const prova = await criarProva(cliente);
      const q1 = await inserirQuestao(cliente, {
        prova_id: prova,
        numero: 1,
        resposta_correta: null,
        gabarito_versao: null,
      });
      const q2 = await inserirQuestao(cliente, {
        prova_id: prova,
        numero: 2,
        resposta_correta: null,
        gabarito_versao: null,
      });

      const resumo = await cruzar(
        cliente,
        prova,
        [
          { numero: 1, resposta: "B" },
          { numero: 2, anulada: true },
        ],
        "definitivo-2023",
      );

      expect(resumo.preenchidas).toBe(2);
      expect(resumo.versionadas).toBe(0);
      expect(resumo.anuladas).toBe(1);

      const [linha1] = await versoesDe(cliente, q1.id);
      expect(linha1.resposta_correta).toBe("B");
      expect(linha1.gabarito_versao).toBe("definitivo-2023");
      expect(linha1.anulada).toBe(false);

      const [linha2] = await versoesDe(cliente, q2.id);
      // AC2: anulada e **mantida**. Uma versao so, e ela continua existindo.
      expect(linha2.anulada).toBe(true);
      expect(linha2.questao_versao).toBe(1);
    });
  });

  it("rodar o mesmo gabarito duas vezes nao cria versao nova", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const prova = await criarProva(cliente);
      const questao = await inserirQuestao(cliente, {
        prova_id: prova,
        numero: 1,
        resposta_correta: null,
        gabarito_versao: null,
      });

      await cruzar(cliente, prova, [{ numero: 1, resposta: "B" }], "definitivo-1");
      const segunda = await cruzar(
        cliente,
        prova,
        [{ numero: 1, resposta: "B" }],
        "definitivo-1",
      );

      expect(segunda.inalteradas).toBe(1);
      expect(segunda.versionadas).toBe(0);
      expect(await versoesDe(cliente, questao.id)).toHaveLength(1);
    });
  });

  it("mesma letra com rotulo de versao novo carimba sem versionar (cosmetico)", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const prova = await criarProva(cliente);
      const questao = await inserirQuestao(cliente, {
        prova_id: prova,
        numero: 1,
        resposta_correta: null,
        gabarito_versao: null,
      });

      await cruzar(cliente, prova, [{ numero: 1, resposta: "B" }], "preliminar");
      await cruzar(cliente, prova, [{ numero: 1, resposta: "B" }], "definitivo");

      const versoes = await versoesDe(cliente, questao.id);
      expect(versoes).toHaveLength(1);
      expect(versoes[0].gabarito_versao).toBe("definitivo");
    });
  });

  it("retificacao cria versao nova, marcada substantiva, sem reescrever a anterior (AC3)", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const prova = await criarProva(cliente);
      const questao = await inserirQuestao(cliente, {
        prova_id: prova,
        numero: 1,
        resposta_correta: null,
        gabarito_versao: null,
      });

      await cruzar(cliente, prova, [{ numero: 1, resposta: "B" }], "preliminar");
      const resumo = await cruzar(
        cliente,
        prova,
        [{ numero: 1, resposta: "D" }],
        "definitivo",
      );

      expect(resumo.versionadas).toBe(1);

      const versoes = await versoesDe(cliente, questao.id);
      expect(versoes).toHaveLength(2);
      // A anterior continua dizendo o que dizia. Nao foi reescrita.
      expect(versoes[0]).toMatchObject({
        questao_versao: 1,
        vigente: false,
        resposta_correta: "B",
        gabarito_versao: "preliminar",
      });
      // A nova e a vigente, e a classificacao nasceu junto dela (BANCO-13).
      expect(versoes[1]).toMatchObject({
        questao_versao: 2,
        vigente: true,
        resposta_correta: "D",
        gabarito_versao: "definitivo",
        mudanca_tipo: "substantiva",
      });
      expect(String(versoes[1].mudanca_motivo)).toContain("retificacao");
    });
  });

  it("anular depois de ja ter gabarito tambem e retificacao", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const prova = await criarProva(cliente);
      const questao = await inserirQuestao(cliente, {
        prova_id: prova,
        numero: 1,
        resposta_correta: null,
        gabarito_versao: null,
      });

      await cruzar(cliente, prova, [{ numero: 1, resposta: "B" }], "preliminar");
      await cruzar(cliente, prova, [{ numero: 1, anulada: true }], "definitivo");

      const versoes = await versoesDe(cliente, questao.id);
      expect(versoes).toHaveLength(2);
      expect(versoes[1].anulada).toBe(true);
      expect(versoes[0].anulada).toBe(false);
    });
  });

  it("a tentativa antiga continua apontando para a versao que o aluno respondeu", async () => {
    // E o invariante nº1 e nº2 juntos: o log e imutavel e o snapshot congela.
    // Retificar gabarito NAO pode deslocar o historico de quem ja respondeu.
    await comTransacaoRevertida(async (cliente) => {
      const questao = await questaoParaResponder(cliente);
      const { rows: prova } = await cliente.query(
        "select prova_id, numero from public.questoes where id = $1 and vigente",
        [questao.questao_id],
      );

      const tentativa = await inserirTentativa(cliente, questao, {
        resposta_dada: "C",
        correta: true,
      });

      await cruzar(
        cliente,
        String(prova[0].prova_id),
        [{ numero: Number(prova[0].numero), resposta: "D" }],
        "retificado",
      );

      const versoes = await versoesDe(cliente, questao.questao_id);
      expect(versoes).toHaveLength(2);

      const { rows: log } = await cliente.query(
        "select questao_versao, resposta_dada, correta from public.tentativas where id = $1",
        [tentativa.id],
      );
      expect(log[0].questao_versao).toBe(questao.questao_versao);
      expect(log[0].resposta_dada).toBe("C");
      expect(log[0].correta).toBe(true);
    });
  });

  it("gabarito que chega antes da extracao nao quebra: conta e espera", async () => {
    // Edge case do M1: o cruzamento e idempotente e retomavel.
    await comTransacaoRevertida(async (cliente) => {
      const prova = await criarProva(cliente);

      const resumo = await cruzar(
        cliente,
        prova,
        [{ numero: 1, resposta: "A" }, { numero: 2, resposta: "B" }],
        "definitivo",
      );

      expect(resumo.sem_questao).toBe(2);
      expect(resumo.preenchidas).toBe(0);
    });
  });

  it("recusa gabarito sem versao", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const prova = await criarProva(cliente);
      await expect(
        cruzar(cliente, prova, [{ numero: 1, resposta: "A" }], "   "),
      ).rejects.toThrow(/gabarito_versao/);
    });
  });

  it("nao esta concedida a anon nem a authenticated", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows } = await cliente.query(
        `select count(*)::int as concessoes
           from information_schema.routine_privileges
          where routine_schema = 'public' and routine_name = 'cruzar_gabarito'
            and grantee in ('anon', 'authenticated')`,
      );
      expect(rows[0].concessoes).toBe(0);
    });
  });
});
