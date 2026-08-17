import { expect, it } from "vitest";

import {
  ALTERNATIVAS,
  criarProva,
  criarTopico,
  fonteCitacao,
  inserirQuestao,
} from "./acervo";
import { comTransacaoRevertida } from "./conexao";
import { descreveComBanco } from "./setup";

/**
 * BANCO-09 AC3 · BANCO-13 (colunas de versao) · AD-039 · AD-040
 *
 * O contrato de identidade e de formato da questao. Cada teste sobrescreve so o
 * campo que quer provar: assim a razao de a linha ser recusada e sempre a que o
 * nome do teste diz.
 */
descreveComBanco("questoes: identidade e formato (AD-039/AD-040)", () => {
  it("a chave primaria e o par (id, questao_versao)", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows } = await cliente.query<{ colunas: string[] }>(
        `select array_agg(a.attname::text order by k.ordinalidade) as colunas
           from pg_constraint c
           join lateral unnest(c.conkey) with ordinality as k(attnum, ordinalidade)
                on true
           join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
          where c.conrelid = 'public.questoes'::regclass and c.contype = 'p'`,
      );

      // E o par que `tentativas` (AD-042) e `explicacoes` (AD-052) referenciam.
      expect(rows[0].colunas).toEqual(["id", "questao_versao"]);
    });
  });

  it("nasce rascunho, versao 1 e vigente", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const prova = await criarProva(cliente);
      // INSERT cru, sem passar status nem versao: o que se prova aqui e o
      // **default do banco**, e o fixture os preencheria.
      const { rows: criada } = await cliente.query<{ id: string }>(
        `insert into public.questoes
           (prova_id, numero, fonte_citacao, tipo_questao, enunciado, alternativas)
         values ($1, 1, $2::jsonb, 'multipla_escolha', 'enunciado', $3::jsonb)
         returning id`,
        [prova, fonteCitacao(), ALTERNATIVAS],
      );
      const id = criada[0].id;

      const { rows } = await cliente.query<{
        questao_versao: number;
        vigente: boolean;
        status: string;
        imagens: unknown[];
        anulada: boolean;
      }>(
        "select questao_versao, vigente, status, imagens, anulada from public.questoes where id = $1",
        [id],
      );

      // Nunca `publicada` direto (M1 P1 AC6).
      expect(rows[0].questao_versao).toBe(1);
      expect(rows[0].vigente).toBe(true);
      expect(rows[0].status).toBe("rascunho");
      expect(rows[0].imagens).toEqual([]);
      expect(rows[0].anulada).toBe(false);
    });
  });

  it("guarda a proveniencia dentro da propria questao, legivel para a tela", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { id } = await inserirQuestao(cliente, { numero: 42 });

      const { rows } = await cliente.query<{ fonte_citacao: Record<string, unknown> }>(
        "select fonte_citacao from public.questoes where id = $1",
        [id],
      );

      // BANCO-01 AC2: a fonte esta disponivel para exibicao sem join nenhum.
      expect(rows[0].fonte_citacao).toEqual({
        banca: "Cesgranrio",
        ano: 2023,
        orgao: "Banco do Brasil",
        cargo: "Escriturario",
        numero: 42,
      });
    });
  });

  it("recusa certo-errado com alternativas", async () => {
    await comTransacaoRevertida(async (cliente) => {
      await expect(
        inserirQuestao(cliente, {
          tipo_questao: "certo_errado",
          alternativas: ALTERNATIVAS,
          resposta_correta: "C",
        }),
      ).rejects.toThrow(/alternativas_conforme_tipo/);
    });
  });

  it("recusa multipla escolha sem alternativas ou com array vazio", async () => {
    await comTransacaoRevertida(async (cliente) => {
      for (const alternativas of [null, "[]"]) {
        await cliente.query("savepoint tentativa");
        await expect(
          inserirQuestao(cliente, { alternativas }),
        ).rejects.toThrow(/alternativas_conforme_tipo/);
        await cliente.query("rollback to savepoint tentativa");
      }
    });
  });

  it("aceita certo-errado sem alternativas, com resposta C ou E", async () => {
    await comTransacaoRevertida(async (cliente) => {
      for (const resposta of ["C", "E"]) {
        const { id } = await inserirQuestao(cliente, {
          tipo_questao: "certo_errado",
          alternativas: null,
          resposta_correta: resposta,
          numero: resposta === "C" ? 1 : 2,
        });
        expect(id).toBeTruthy();
      }
    });
  });

  it("recusa letra de gabarito que nao existe no tipo", async () => {
    await comTransacaoRevertida(async (cliente) => {
      // 'F' nao existe em multipla escolha (AD-040 fixou A-E).
      await cliente.query("savepoint multipla");
      await expect(
        inserirQuestao(cliente, { resposta_correta: "F" }),
      ).rejects.toThrow(/resposta_conforme_tipo/);
      await cliente.query("rollback to savepoint multipla");

      // 'A' nao existe em certo-errado.
      await expect(
        inserirQuestao(cliente, {
          tipo_questao: "certo_errado",
          alternativas: null,
          resposta_correta: "A",
        }),
      ).rejects.toThrow(/resposta_conforme_tipo/);
    });
  });

  it("aceita questao sem gabarito: ela vive assim entre a extracao e o cruzamento", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { id } = await inserirQuestao(cliente, {
        resposta_correta: null,
        gabarito_versao: null,
      });

      const { rows } = await cliente.query<{ resposta_correta: string | null }>(
        "select resposta_correta from public.questoes where id = $1",
        [id],
      );
      expect(rows[0].resposta_correta).toBeNull();
    });
  });

  it("recusa imagens que nao seja array jsonb", async () => {
    await comTransacaoRevertida(async (cliente) => {
      await expect(
        inserirQuestao(cliente, { imagens: '{"storage_path": "x"}' }),
      ).rejects.toThrow(/imagens_e_array/);
    });
  });

  it("aceita imagem no formato do AD-040", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const imagens = JSON.stringify([
        {
          storage_path: "provas/cesgranrio-2023/q12-grafico.png",
          posicao: "enunciado",
          alt_text: "Grafico de barras da evolucao do saldo",
        },
      ]);

      const { id } = await inserirQuestao(cliente, { imagens });
      const { rows } = await cliente.query<{ imagens: unknown[] }>(
        "select imagens from public.questoes where id = $1",
        [id],
      );
      expect(rows[0].imagens).toHaveLength(1);
    });
  });

  it("recusa dificuldade fora de 1 a 5 e confianca fora de 0 a 1", async () => {
    await comTransacaoRevertida(async (cliente) => {
      for (const dificuldade of [0, 6]) {
        await cliente.query("savepoint dificuldade");
        await expect(inserirQuestao(cliente, { dificuldade })).rejects.toThrow(
          /dificuldade/,
        );
        await cliente.query("rollback to savepoint dificuldade");
      }

      for (const confianca of [-0.1, 1.001]) {
        await cliente.query("savepoint confianca");
        await expect(
          inserirQuestao(cliente, { confianca_ia: confianca }),
        ).rejects.toThrow(/confianca_ia/);
        await cliente.query("rollback to savepoint confianca");
      }
    });
  });

  it("recusa questao real sem prova ou sem numero oficial", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const prova = await criarProva(cliente);

      await cliente.query("savepoint sem_prova");
      await expect(
        cliente.query(
          `insert into public.questoes
             (origem, fonte_citacao, tipo_questao, enunciado, alternativas, numero)
           values ('real', $1::jsonb, 'multipla_escolha', 'x', $2::jsonb, 1)`,
          [fonteCitacao(), ALTERNATIVAS],
        ),
      ).rejects.toThrow(/real_veio_de_prova/);
      await cliente.query("rollback to savepoint sem_prova");

      await expect(
        inserirQuestao(cliente, { prova_id: prova, numero: null }),
      ).rejects.toThrow(/real_veio_de_prova/);
    });
  });

  it("aceita inedita sem prova e sem numero: ela nao veio de prova nenhuma", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { id } = await inserirQuestao(cliente, {
        origem: "gerada_ia",
        prova_id: null,
        numero: null,
        fonte_citacao: null,
        status: "em_revisao",
      });
      expect(id).toBeTruthy();
    });
  });

  it("recusa numero zero ou negativo", async () => {
    await comTransacaoRevertida(async (cliente) => {
      await expect(inserirQuestao(cliente, { numero: 0 })).rejects.toThrow(
        /questoes_numero_check|violates check constraint/,
      );
    });
  });

  it("recusa enunciado vazio ou so com espaco", async () => {
    await comTransacaoRevertida(async (cliente) => {
      for (const enunciado of ["", "   "]) {
        await cliente.query("savepoint tentativa");
        await expect(inserirQuestao(cliente, { enunciado })).rejects.toThrow(
          /questoes_enunciado_check|violates check constraint/,
        );
        await cliente.query("rollback to savepoint tentativa");
      }
    });
  });

  it("recusa versao 1 que declara tipo de mudanca (BANCO-13)", async () => {
    await comTransacaoRevertida(async (cliente) => {
      // A versao 1 e o original: nao mudou nada, entao nao ha o que classificar.
      await expect(
        inserirQuestao(cliente, { mudanca_tipo: "cosmetica" }),
      ).rejects.toThrow(/mudanca_declarada_a_partir_da_v2/);
    });
  });

  it("recusa a mesma questao da mesma prova duas vezes", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const prova = await criarProva(cliente);
      await inserirQuestao(cliente, { prova_id: prova, numero: 12 });

      // Edge case do M1: "mesma prova submetida duas vezes nao duplica".
      await expect(
        inserirQuestao(cliente, { prova_id: prova, numero: 12 }),
      ).rejects.toThrow(/questoes_numero_unico_na_prova/);
    });
  });

  it("aceita numeros diferentes da mesma prova e o mesmo numero em provas diferentes", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const a = await criarProva(cliente);
      const b = await criarProva(cliente);

      await inserirQuestao(cliente, { prova_id: a, numero: 1 });
      await inserirQuestao(cliente, { prova_id: a, numero: 2 });
      const terceira = await inserirQuestao(cliente, { prova_id: b, numero: 1 });

      expect(terceira.id).toBeTruthy();
    });
  });

  it("classifica no topico, e reclassificar muda so a questao", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const antes = await criarTopico(cliente);
      const depois = await criarTopico(cliente);
      const { id } = await inserirQuestao(cliente, { topico_id: antes });

      // Success Criteria nº3 da spec: a taxonomia muda sem tocar em nada mais.
      await cliente.query(
        "update public.questoes set topico_id = $2 where id = $1 and vigente",
        [id, depois],
      );

      const { rows } = await cliente.query<{
        topico_id: string;
        enunciado: string;
        questao_versao: number;
      }>(
        "select topico_id, enunciado, questao_versao from public.questoes where id = $1",
        [id],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].topico_id).toBe(depois);
      expect(rows[0].questao_versao).toBe(1);
    });
  });
});
