import type { Client } from "pg";
import { expect, it } from "vitest";

import { criarProva, inserirQuestao } from "./acervo";
import { comTransacaoRevertida } from "./conexao";
import { descreveComBanco } from "./setup";

/**
 * BANCO-13 · AD-039 · AD-042
 *
 * "Correcao de questao publicada = nova versao, nunca reescreve a anterior."
 * Aqui se prova que essa frase e garantia do banco e nao disciplina de script.
 */

type Linha = {
  questao_versao: number;
  vigente: boolean;
  enunciado: string;
  resposta_correta: string | null;
  status: string;
  mudanca_tipo: string | null;
};

async function versoesDe(cliente: Client, id: string): Promise<Linha[]> {
  const { rows } = await cliente.query<Linha>(
    `select questao_versao, vigente, enunciado, resposta_correta, status, mudanca_tipo
       from public.questoes where id = $1 order by questao_versao`,
    [id],
  );
  return rows;
}

descreveComBanco("versionamento de questao", () => {
  it("INSERT com id existente cria a versao seguinte", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const prova = await criarProva(cliente);
      const primeira = await inserirQuestao(cliente, { prova_id: prova, numero: 7 });

      const segunda = await inserirQuestao(cliente, {
        id: primeira.id,
        prova_id: prova,
        numero: 7,
        mudanca_tipo: "substantiva",
        mudanca_motivo: "gabarito retificado pela banca",
      });

      expect(primeira.questao_versao).toBe(1);
      expect(segunda.questao_versao).toBe(2);
      expect(segunda.id).toBe(primeira.id);
    });
  });

  it("ignora o numero de versao que o chamador passou", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const prova = await criarProva(cliente);
      const primeira = await inserirQuestao(cliente, { prova_id: prova, numero: 7 });

      // Quem numera e o banco: numero calculado por script e numero que dois
      // scripts concorrentes calculam igual.
      const segunda = await inserirQuestao(cliente, {
        id: primeira.id,
        questao_versao: 99,
        prova_id: prova,
        numero: 7,
        mudanca_tipo: "cosmetica",
      });

      expect(segunda.questao_versao).toBe(2);
    });
  });

  it("existe exatamente uma versao vigente depois de cada INSERT", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const prova = await criarProva(cliente);
      const primeira = await inserirQuestao(cliente, { prova_id: prova, numero: 7 });

      // Tres versoes seguidas: prova que o selo de vigente e apagado ANTES da
      // nova linha entrar, senao o indice unico `(id) where vigente` recusaria.
      for (const rodada of [2, 3]) {
        await inserirQuestao(cliente, {
          id: primeira.id,
          prova_id: prova,
          numero: 7,
          mudanca_tipo: "cosmetica",
          mudanca_motivo: `rodada ${rodada}`,
        });
      }

      const versoes = await versoesDe(cliente, primeira.id);
      expect(versoes.map((l) => l.questao_versao)).toEqual([1, 2, 3]);
      expect(versoes.map((l) => l.vigente)).toEqual([false, false, true]);
    });
  });

  it("a versao anterior fica intacta campo por campo", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const prova = await criarProva(cliente);
      const original = await inserirQuestao(cliente, {
        prova_id: prova,
        numero: 7,
        enunciado: "Enunciado como o aluno respondeu",
        resposta_correta: "C",
        status: "publicada",
      });

      await inserirQuestao(cliente, {
        id: original.id,
        prova_id: prova,
        numero: 7,
        enunciado: "Enunciado corrigido depois",
        resposta_correta: "D",
        status: "publicada",
        mudanca_tipo: "substantiva",
        mudanca_motivo: "banca retificou o gabarito",
      });

      const [antiga, nova] = await versoesDe(cliente, original.id);

      // Success Criteria nº2 da spec. E a razao de o log de tentativas poder
      // apontar para (questao_id, questao_versao) e confiar.
      expect(antiga.enunciado).toBe("Enunciado como o aluno respondeu");
      expect(antiga.resposta_correta).toBe("C");
      expect(antiga.mudanca_tipo).toBeNull();
      expect(nova.enunciado).toBe("Enunciado corrigido depois");
      expect(nova.resposta_correta).toBe("D");
      expect(nova.mudanca_tipo).toBe("substantiva");
    });
  });

  it("exige classificar cosmetica x substantiva da versao 2 em diante (BANCO-13)", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const prova = await criarProva(cliente);
      const primeira = await inserirQuestao(cliente, { prova_id: prova, numero: 7 });

      // O IA-09 AC4 (SPEC 14) le `mudanca_tipo` para decidir se regera a
      // explicacao. Versao nova sem classificacao deixaria essa decisao cega.
      await expect(
        inserirQuestao(cliente, {
          id: primeira.id,
          prova_id: prova,
          numero: 7,
          mudanca_tipo: null,
        }),
      ).rejects.toThrow(/mudanca_declarada_a_partir_da_v2/);
    });
  });

  it("recusa UPDATE em versao que nao e mais vigente", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const prova = await criarProva(cliente);
      const primeira = await inserirQuestao(cliente, { prova_id: prova, numero: 7 });
      await inserirQuestao(cliente, {
        id: primeira.id,
        prova_id: prova,
        numero: 7,
        mudanca_tipo: "cosmetica",
      });

      // Inclusive para quem tem a chave de servico: RLS nao alcanca o
      // service_role, o gatilho alcanca (mesmo raciocinio do AD-082).
      for (const papel of ["postgres", "service_role"]) {
        await cliente.query("savepoint mutacao");
        await cliente.query(`set local role ${papel}`);
        await expect(
          cliente.query(
            "update public.questoes set enunciado = 'reescrito' where id = $1 and questao_versao = 1",
            [primeira.id],
          ),
        ).rejects.toThrow(/nao e mais vigente e esta congelada/);
        await cliente.query("rollback to savepoint mutacao");
      }
    });
  });

  it("recusa UPDATE que muda id ou questao_versao", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { id } = await inserirQuestao(cliente);

      for (const alteracao of [
        "set id = gen_random_uuid()",
        "set questao_versao = 5",
      ]) {
        await cliente.query("savepoint identidade");
        await expect(
          cliente.query(
            `update public.questoes ${alteracao} where id = $1 and vigente`,
            [id],
          ),
        ).rejects.toThrow(/id e questao_versao nao se editam/);
        await cliente.query("rollback to savepoint identidade");
      }
    });
  });

  it("permite UPDATE legitimo na versao vigente: a tabela nao e append-only", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { id } = await inserirQuestao(cliente, {
        resposta_correta: null,
        gabarito_versao: null,
        status: "rascunho",
      });

      // E o que a SPEC 09 (gabarito) e a SPEC 10 (status) vao fazer.
      const { rowCount } = await cliente.query(
        `update public.questoes
            set resposta_correta = 'C', gabarito_versao = 'definitivo-2023', status = 'em_revisao'
          where id = $1 and vigente`,
        [id],
      );
      expect(rowCount).toBe(1);

      const [linha] = await versoesDe(cliente, id);
      expect(linha.resposta_correta).toBe("C");
      expect(linha.status).toBe("em_revisao");
    });
  });

  it("carimba `atualizada_em` sozinha, por cima do que o chamador mandou", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { id } = await inserirQuestao(cliente);

      // Comparar "antes < depois" nao provaria nada: `now()` e o mesmo em toda a
      // transacao, entao o teste passaria com ou sem gatilho. O que discrimina e
      // mandar um valor obviamente errado e ver o banco recusa-lo em silencio.
      await cliente.query(
        `update public.questoes
            set status = 'em_revisao', atualizada_em = '2000-01-01T00:00:00Z'
          where id = $1 and vigente`,
        [id],
      );

      const { rows } = await cliente.query<{ carimbo_do_gatilho: boolean }>(
        `select atualizada_em = now() as carimbo_do_gatilho
           from public.questoes where id = $1`,
        [id],
      );
      expect(rows[0].carimbo_do_gatilho).toBe(true);
    });
  });

  it("recusa DELETE, inclusive para o service_role", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { id } = await inserirQuestao(cliente);

      for (const papel of ["postgres", "service_role"]) {
        await cliente.query("savepoint apagar");
        await cliente.query(`set local role ${papel}`);
        await expect(
          cliente.query("delete from public.questoes where id = $1", [id]),
        ).rejects.toThrow(/nao aceita DELETE/);
        await cliente.query("rollback to savepoint apagar");
      }
    });
  });

  it("recusa TRUNCATE: sem privilegio para o navegador, com gatilho para o service_role", async () => {
    await comTransacaoRevertida(async (cliente) => {
      await inserirQuestao(cliente);

      for (const papel of ["anon", "authenticated"]) {
        await cliente.query("savepoint truncagem");
        await cliente.query(`set local role ${papel}`);
        await expect(
          cliente.query("truncate table public.questoes"),
        ).rejects.toThrow(/permission denied/);
        await cliente.query("rollback to savepoint truncagem");
      }

      // RLS nao governa TRUNCATE (AD-084) e o service_role tem o privilegio.
      await cliente.query("savepoint truncagem_servico");
      await cliente.query("set local role service_role");
      await expect(
        cliente.query("truncate table public.questoes"),
      ).rejects.toThrow(/nao aceita TRUNCATE/);
      await cliente.query("rollback to savepoint truncagem_servico");
    });
  });
});
