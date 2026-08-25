import { expect, it } from "vitest";

import { inserirQuestao } from "./acervo";
import { criarUsuario } from "./conta";
import { comTransacaoRevertida } from "./conexao";
import { descreveComBanco } from "./setup";

type Questao = { id: string; questao_versao: number };

async function operadorAtivo(cliente: Parameters<typeof inserirQuestao>[0]) {
  const id = await criarUsuario(cliente);
  await cliente.query("insert into public.operadores (operador_id) values ($1)", [id]);
  return id;
}

async function revisaoPendente(
  cliente: Parameters<typeof inserirQuestao>[0],
  questao: Questao,
) {
  const { rows } = await cliente.query<{ id: string }>(
    `select id from public.questao_revisoes
      where questao_id = $1 and questao_versao = $2 and status = 'pendente'
      order by id limit 1`,
    [questao.id, questao.questao_versao],
  );
  return rows[0].id;
}

async function questaoParaFila(cliente: Parameters<typeof inserirQuestao>[0]) {
  return inserirQuestao(cliente, { confianca_ia: 0 });
}

descreveComBanco("SPEC 15 — operação da fila", () => {
  it("aprova o lote, publica as questoes e registra a mesma autoria e motivo", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const operador = await operadorAtivo(cliente);
      const questoes = [await questaoParaFila(cliente), await questaoParaFila(cliente)];
      const revisoes = [];
      for (const questao of questoes) revisoes.push(await revisaoPendente(cliente, questao));

      const { rows: resultado } = await cliente.query<{ total: number }>(
        `select public.decidir_revisoes_em_lote($1::bigint[], 'aprovada', $2, $3) as total`,
        [revisoes, operador, "conferidas no PDF oficial"],
      );
      expect(resultado[0].total).toBe(2);

      const { rows: publicadas } = await cliente.query<{
        status: string;
        decisoes: number;
        logs: number;
      }>(
        `select
           (select min(status::text) from public.questoes where id = any($1::uuid[]) and vigente) as status,
           (select count(*)::int from public.questao_revisoes
             where id = any($2::bigint[]) and status = 'aprovada'
               and decidido_por = $3 and observacao = $4) as decisoes,
           (select count(*)::int from public.operador_acoes
             where operador_id = $3 and tipo = 'questao_aprovada'
               and motivo = $4) as logs`,
        [questoes.map((q) => q.id), revisoes, operador, "conferidas no PDF oficial"],
      );
      expect(publicadas[0]).toEqual({ status: "publicada", decisoes: 2, logs: 2 });
    });
  });

  it("reverte o lote inteiro quando uma publicacao falha", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const operador = await operadorAtivo(cliente);
      const primeira = await questaoParaFila(cliente);
      const segunda = await questaoParaFila(cliente);
      // A segunda nao pode publicar: sem gabarito a trava do banco recusa.
      // O lote inteiro precisa cair junto com ela.
      await cliente.query(
        "update public.questoes set resposta_correta = null where id = $1 and questao_versao = $2",
        [segunda.id, segunda.questao_versao],
      );
      const revisoes = [
        await revisaoPendente(cliente, primeira),
        await revisaoPendente(cliente, segunda),
      ];

      await cliente.query("savepoint lote");
      await expect(
        cliente.query(
          `select public.decidir_revisoes_em_lote($1::bigint[], 'aprovada', $2, 'lote atomico')`,
          [revisoes, operador],
        ),
      ).rejects.toThrow(/publicada_tem_gabarito/);
      await cliente.query("rollback to savepoint lote");

      const { rows } = await cliente.query<{
        pendentes: number;
        publicadas: number;
        logs: number;
      }>(
        `select
           (select count(*)::int from public.questao_revisoes
             where id = any($1::bigint[]) and status = 'pendente') as pendentes,
           (select count(*)::int from public.questoes
             where id = any($2::uuid[]) and vigente and status = 'publicada') as publicadas,
           (select count(*)::int from public.operador_acoes
             where operador_id = $3 and tipo = 'questao_aprovada') as logs`,
        [revisoes, [primeira.id, segunda.id], operador],
      );
      expect(rows[0]).toEqual({ pendentes: 2, publicadas: 0, logs: 0 });
    });
  });

  it("rejeita a revisao e a questao e barra lote vazio ou maior que 50", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const operador = await operadorAtivo(cliente);
      const questao = await questaoParaFila(cliente);
      const revisao = await revisaoPendente(cliente, questao);

      const { rows: total } = await cliente.query<{ total: number }>(
        `select public.decidir_revisoes_em_lote(array[$1]::bigint[], 'rejeitada', $2, 'gabarito divergente') as total`,
        [revisao, operador],
      );
      expect(total[0].total).toBe(1);

      const { rows } = await cliente.query<{ questao: string; revisao: string; logs: number }>(
        `select
           (select status::text from public.questoes where id = $1 and vigente) as questao,
           (select status::text from public.questao_revisoes where id = $2) as revisao,
           (select count(*)::int from public.operador_acoes
             where operador_id = $3 and tipo = 'questao_rejeitada'
               and motivo = 'gabarito divergente') as logs`,
        [questao.id, revisao, operador],
      );
      expect(rows[0]).toEqual({ questao: "rejeitada", revisao: "rejeitada", logs: 1 });

      for (const ids of [[], Array.from({ length: 51 }, (_, i) => i + 1)]) {
        await cliente.query("savepoint limite");
        await expect(
          cliente.query(
            `select public.decidir_revisoes_em_lote($1::bigint[], 'rejeitada', $2, 'limite')`,
            [ids, operador],
          ),
        ).rejects.toThrow(/lote_de_revisoes_deve_ter_entre_1_e_50/);
        await cliente.query("rollback to savepoint limite");
      }
    });
  });

  it("corrige por INSERT, congela a publicada e abre revisao da nova versao", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const operador = await operadorAtivo(cliente);
      const original = await inserirQuestao(cliente, { status: "publicada", enunciado: "Texto antigo" });

      const { rows: nova } = await cliente.query<{ id: string; versao: number }>(
        `select questao_id as id, questao_versao as versao
           from public.corrigir_questao_operador(
             $1, $2, $3, 'substantiva', 'enunciado oficial corrigido',
             '{"enunciado":"Texto novo","dificuldade":4}'::jsonb
           )`,
        [original.id, original.questao_versao, operador],
      );
      expect(nova[0]).toEqual({ id: original.id, versao: 2 });

      const { rows } = await cliente.query<{
        questao_versao: number;
        vigente: boolean;
        status: string;
        enunciado: string;
        dificuldade: number;
        mudanca_tipo: string | null;
        mudanca_motivo: string | null;
      }>(
        `select questao_versao, vigente, status::text, enunciado, dificuldade,
                mudanca_tipo::text, mudanca_motivo
           from public.questoes where id = $1 order by questao_versao`,
        [original.id],
      );
      expect(rows).toEqual([
        {
          questao_versao: 1,
          vigente: false,
          status: "publicada",
          enunciado: "Texto antigo",
          dificuldade: 3,
          mudanca_tipo: null,
          mudanca_motivo: null,
        },
        {
          questao_versao: 2,
          vigente: true,
          status: "em_revisao",
          enunciado: "Texto novo",
          dificuldade: 4,
          mudanca_tipo: "substantiva",
          mudanca_motivo: "enunciado oficial corrigido",
        },
      ]);

      const { rows: efeitos } = await cliente.query<{ revisoes: number; logs: number }>(
        `select
           (select count(*)::int from public.questao_revisoes
             where questao_id = $1 and questao_versao = 2
               and motivo = 'correcao_operador' and status = 'pendente') as revisoes,
           (select count(*)::int from public.operador_acoes
             where operador_id = $2 and tipo = 'questao_corrigida'
               and entidade_id = $1::text and motivo = 'enunciado oficial corrigido') as logs`,
        [original.id, operador],
      );
      expect(efeitos[0]).toEqual({ revisoes: 1, logs: 1 });
    });
  });

  it("recusa campo de correcao fora da lista sem criar versao", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const operador = await operadorAtivo(cliente);
      const original = await inserirQuestao(cliente, { status: "publicada" });

      await cliente.query("savepoint campo_extra");
      await expect(
        cliente.query(
          `select * from public.corrigir_questao_operador(
             $1, $2, $3, 'cosmetica', 'tentativa', '{"status":"publicada"}'::jsonb
           )`,
          [original.id, original.questao_versao, operador],
        ),
      ).rejects.toThrow(/campo_de_correcao_nao_permitido/);
      await cliente.query("rollback to savepoint campo_extra");

      const { rows } = await cliente.query<{ total: number; vigente: boolean }>(
        `select count(*)::int as total, bool_and(vigente) as vigente
           from public.questoes where id = $1`,
        [original.id],
      );
      expect(rows[0]).toEqual({ total: 1, vigente: true });
    });
  });
});
