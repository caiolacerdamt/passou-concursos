import { expect, it } from "vitest";

import { comTransacaoRevertida } from "./conexao";
import { descreveComBanco } from "./setup";
import { garantirParticao, inserirTentativa, novoAluno, questaoParaResponder } from "./aluno";

/**
 * SPEC 05 · T42 — particionamento mensal por pg_partman (INFRA-04 AC1/AC2/AC3, AD-067).
 *
 * Estes testes **leem** o que a migracao criou; nenhum deles cria particao
 * permanente. `create_parent` nao roda dentro de transacao revertida, e um teste
 * que o chamasse deixaria lixo no banco compartilhado.
 */

/** Primeiro dia do mes, `n` meses a frente (ou atras, com n negativo). */
function mesRelativo(n: number): Date {
  const hoje = new Date();
  return new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + n, 1));
}

function nomeEsperado(data: Date): string {
  const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
  return `tentativas_p${data.getUTCFullYear()}${mes}01`;
}

descreveComBanco("tentativas — particionamento (INFRA-04)", () => {
  it("esta registrada no pg_partman como range mensal em respondida_em", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows } = await cliente.query<{
        control: string;
        partition_interval: string;
        partition_type: string;
        premake: number;
      }>(
        `select control, partition_interval, partition_type, premake
           from partman.part_config where parent_table = 'public.tentativas'`,
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].control).toBe("respondida_em");
      expect(rows[0].partition_type).toBe("range");
      expect(rows[0].partition_interval).toBe("1 mon");
      expect(rows[0].premake).toBe(3);
    });
  });

  it("o mes corrente e os tres seguintes ja existem, antes de o mes virar (AC1/AC3)", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows } = await cliente.query<{ nome: string }>(
        `select c.relname as nome from pg_class c
           join pg_inherits i on i.inhrelid = c.oid
          where i.inhparent = 'public.tentativas'::regclass`,
      );
      const nomes = rows.map((r) => r.nome);
      for (const n of [0, 1, 2, 3]) {
        expect(nomes).toContain(nomeEsperado(mesRelativo(n)));
      }
    });
  });

  it("tem particao default — data fora de toda faixa entra em vez de derrubar a resposta", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows } = await cliente.query<{ nome: string }>(
        `select c.relname as nome from pg_class c
           join pg_inherits i on i.inhrelid = c.oid
          where i.inhparent = 'public.tentativas'::regclass
            and pg_get_expr(c.relpartbound, c.oid) = 'DEFAULT'`,
      );
      expect(rows).toHaveLength(1);

      const questao = await questaoParaResponder(cliente);
      const longe = "2099-03-15T12:00:00Z";
      const gravada = await inserirTentativa(cliente, questao, { respondida_em: longe });
      const { rows: onde } = await cliente.query<{ particao: string }>(
        "select tableoid::regclass::text as particao from public.tentativas where id = $1",
        [gravada.id],
      );
      expect(onde[0].particao).toBe(rows[0].nome);
    });
  });

  it("respostas de meses diferentes caem em particoes diferentes", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const questao = await questaoParaResponder(cliente);
      const aluno = novoAluno();

      const esteMes = mesRelativo(0);
      const proximo = mesRelativo(1);
      await garantirParticao(cliente, esteMes);
      await garantirParticao(cliente, proximo);

      const a = await inserirTentativa(cliente, questao, {
        user_id: aluno,
        respondida_em: new Date(esteMes.getTime() + 86_400_000).toISOString(),
      });
      const b = await inserirTentativa(cliente, questao, {
        user_id: aluno,
        respondida_em: new Date(proximo.getTime() + 86_400_000).toISOString(),
      });

      const { rows } = await cliente.query<{ id: string; particao: string }>(
        "select id, tableoid::regclass::text as particao from public.tentativas where id = any($1)",
        [[a.id, b.id]],
      );
      const porId = Object.fromEntries(rows.map((r) => [r.id, r.particao]));
      expect(porId[a.id]).toBe(nomeEsperado(esteMes));
      expect(porId[b.id]).toBe(nomeEsperado(proximo));
      expect(porId[a.id]).not.toBe(porId[b.id]);
    });
  });

  it("consulta por aluno e periodo poda para uma particao so (AC2)", async () => {
    await comTransacaoRevertida(async (cliente) => {
      // Armadilha nº4 do STATE.md: em tabela vazia o planejador escolhe Seq Scan
      // por custo. `enable_seqscan = off` tira o custo da conversa; o que este
      // teste afirma e **quais particoes aparecem no plano**, que e o que o
      // INFRA-04 AC2 pede.
      await cliente.query("set local enable_seqscan = off");

      const inicio = mesRelativo(0);
      const fim = mesRelativo(1);
      const { rows } = await cliente.query<{ "QUERY PLAN": string }>(
        `explain (costs off)
         select * from public.tentativas
          where user_id = $1 and respondida_em >= $2 and respondida_em < $3`,
        [novoAluno(), inicio.toISOString(), fim.toISOString()],
      );
      const plano = rows.map((r) => r["QUERY PLAN"]).join("\n");

      const citadas = [
        ...new Set(
          [...plano.matchAll(/tentativas_p\d{8}|tentativas_default/g)].map((m) => m[0]),
        ),
      ];
      expect(citadas).toEqual([nomeEsperado(inicio)]);
      expect(plano).not.toMatch(/Seq Scan/);
    });
  });

  it("a retencao esta desligada — particao nunca e dropada (AD-067)", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows } = await cliente.query<{
        retention: string | null;
        retention_keep_table: boolean;
        inherit_privileges: boolean;
      }>(
        `select retention, retention_keep_table, inherit_privileges
           from partman.part_config where parent_table = 'public.tentativas'`,
      );
      expect(rows[0].retention).toBeNull();
      expect(rows[0].retention_keep_table).toBe(true);
      // Primeira linha de defesa do AD-091: particao nova nao nasce com os
      // privilegios que o Supabase concede por default em `public`.
      expect(rows[0].inherit_privileges).toBe(true);
    });
  });
});
