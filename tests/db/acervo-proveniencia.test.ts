import { expect, it } from "vitest";

import { fonteCitacao, inserirQuestao } from "./acervo";
import { comTransacaoRevertida } from "./conexao";
import { descreveComBanco } from "./setup";

/**
 * BANCO-01 AC1/AC2 · BANCO-07 AC2 · AD-003
 *
 * "Nunca publicar questao sem proveniencia" (proibicao absoluta do AGENTS.md) e
 * "a IA nao decide a alternativa correta" (invariante nº4), provados contra o
 * banco. A trava e CHECK e nao validacao de job de proposito: o teste ataca a
 * tabela direto, sem passar por codigo de aplicacao nenhum.
 */
descreveComBanco("trava de publicacao sem proveniencia", () => {
  it("recusa publicar questao real sem fonte_citacao", async () => {
    await comTransacaoRevertida(async (cliente) => {
      // Success Criteria nº1 da spec.
      await expect(
        inserirQuestao(cliente, {
          origem: "real",
          fonte_citacao: null,
          status: "publicada",
        }),
      ).rejects.toThrow(/real_tem_proveniencia/);
    });
  });

  it("recusa tambem no UPDATE: rascunho sem fonte nao vira publicada", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { id } = await inserirQuestao(cliente, {
        fonte_citacao: null,
        status: "rascunho",
      });

      // O caminho realista: a questao entra sem fonte e alguem tenta publicar
      // depois. CHECK vale nas duas operacoes; validacao de INSERT no job, nao.
      await expect(
        cliente.query(
          "update public.questoes set status = 'publicada' where id = $1 and vigente",
          [id],
        ),
      ).rejects.toThrow(/real_tem_proveniencia/);
    });
  });

  it("aceita rascunho sem proveniencia: a trava e de publicacao, nao de ingestao", async () => {
    await comTransacaoRevertida(async (cliente) => {
      // A questao vive assim entre a extracao (SPEC 08) e o cruzamento (SPEC 09).
      for (const status of ["rascunho", "em_revisao", "precisa_ocr"]) {
        const { id } = await inserirQuestao(cliente, {
          fonte_citacao: null,
          resposta_correta: null,
          status,
        });
        expect(id).toBeTruthy();
      }
    });
  });

  it("publica questao real quando a proveniencia esta completa", async () => {
    await comTransacaoRevertida(async (cliente) => {
      // Controle. Sem ele, os testes acima passariam com a tabela recusando tudo.
      const { id } = await inserirQuestao(cliente, {
        status: "publicada",
        resposta_correta: "C",
      });

      const { rows } = await cliente.query<{ status: string }>(
        "select status from public.questoes where id = $1",
        [id],
      );
      expect(rows[0].status).toBe("publicada");
    });
  });

  it("recusa fonte_citacao faltando qualquer uma das cinco chaves do AD-040", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const completa = {
        banca: "Cesgranrio",
        ano: 2023,
        orgao: "Banco do Brasil",
        cargo: "Escriturario",
        numero: 1,
      };

      for (const chave of Object.keys(completa)) {
        const incompleta: Record<string, unknown> = { ...completa };
        delete incompleta[chave];

        await cliente.query("savepoint tentativa");
        await expect(
          inserirQuestao(cliente, {
            fonte_citacao: JSON.stringify(incompleta),
          }),
        ).rejects.toThrow(/fonte_citacao_completa/);
        await cliente.query("rollback to savepoint tentativa");
      }
    });
  });

  it("recusa fonte_citacao vazia e fonte_citacao que nao e objeto", async () => {
    await comTransacaoRevertida(async (cliente) => {
      // `{}` passaria a trava de "nao nula" e nao diria nada ao aluno.
      for (const fonte of ["{}", '"Cesgranrio 2023"', "[]"]) {
        await cliente.query("savepoint tentativa");
        await expect(
          inserirQuestao(cliente, { fonte_citacao: fonte }),
        ).rejects.toThrow(/fonte_citacao_completa/);
        await cliente.query("rollback to savepoint tentativa");
      }
    });
  });

  it("recusa publicar sem gabarito (invariante nº4)", async () => {
    await comTransacaoRevertida(async (cliente) => {
      await expect(
        inserirQuestao(cliente, {
          status: "publicada",
          resposta_correta: null,
          gabarito_versao: null,
        }),
      ).rejects.toThrow(/publicada_tem_gabarito/);
    });
  });

  it("recusa inedita publicada sem passar pela revisao (BANCO-07 AC2)", async () => {
    await comTransacaoRevertida(async (cliente) => {
      await expect(
        inserirQuestao(cliente, {
          origem: "gerada_ia",
          prova_id: null,
          numero: null,
          fonte_citacao: null,
          status: "publicada",
        }),
      ).rejects.toThrow(/gerada_ia_passa_por_revisao/);
    });
  });

  it("recusa inedita indo a publicada por UPDATE", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { id } = await inserirQuestao(cliente, {
        origem: "gerada_ia",
        prova_id: null,
        numero: null,
        fonte_citacao: null,
        status: "em_revisao",
      });

      await expect(
        cliente.query(
          "update public.questoes set status = 'publicada' where id = $1 and vigente",
          [id],
        ),
      ).rejects.toThrow(/gerada_ia_passa_por_revisao/);
    });
  });

  it("a proveniencia acompanha a versao nova, e nao se perde na correcao", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const primeira = await inserirQuestao(cliente, {
        numero: 15,
        status: "publicada",
      });

      const { rows } = await cliente.query<{ prova_id: string }>(
        "select prova_id from public.questoes where id = $1",
        [primeira.id],
      );

      await inserirQuestao(cliente, {
        id: primeira.id,
        prova_id: rows[0].prova_id,
        numero: 15,
        fonte_citacao: fonteCitacao(15),
        status: "publicada",
        mudanca_tipo: "substantiva",
        mudanca_motivo: "gabarito retificado",
      });

      const { rows: versoes } = await cliente.query<{
        questao_versao: number;
        fonte_citacao: Record<string, unknown>;
      }>(
        `select questao_versao, fonte_citacao from public.questoes
          where id = $1 order by questao_versao`,
        [primeira.id],
      );

      // As duas versoes carregam a mesma proveniencia: BANCO-01 AC2 vale para o
      // historico, nao so para a linha de hoje.
      expect(versoes).toHaveLength(2);
      expect(versoes[0].fonte_citacao).toEqual(versoes[1].fonte_citacao);
    });
  });
});
