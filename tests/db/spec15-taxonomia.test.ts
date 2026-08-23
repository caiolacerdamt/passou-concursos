import type { Client } from "pg";
import { expect, it } from "vitest";

import { criarUsuario } from "./conta";
import { comTransacaoRevertida } from "./conexao";
import { descreveComBanco } from "./setup";

async function operadorAtivo(cliente: Client) {
  const id = await criarUsuario(cliente);
  await cliente.query("insert into public.operadores (operador_id) values ($1)", [id]);
  return id;
}

async function materia(cliente: Client, nome = "Matemática") {
  const { rows } = await cliente.query<{ id: string }>(
    "insert into public.materias (nome) values ($1) returning id",
    [`${nome} ${crypto.randomUUID()}`],
  );
  return rows[0].id;
}

async function candidato(cliente: Client, materiaId: string | null) {
  const { rows } = await cliente.query<{ id: string }>(
    `insert into public.topico_candidato (nome_sugerido, materia_id, ocorrencias)
     values ('Juros compostos', $1, 7) returning id`,
    [materiaId],
  );
  return rows[0].id;
}

descreveComBanco("SPEC 15 — curadoria da taxonomia", () => {
  it("aprova candidato criando o topico canonico com autoria, motivo e log", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const operador = await operadorAtivo(cliente);
      const materiaId = await materia(cliente);
      const candidatoId = await candidato(cliente, materiaId);

      const { rows: decisao } = await cliente.query<{ topico_id: string }>(
        `select public.decidir_topico_candidato(
           $1, 'aprovado', $2, null, 'Juros compostos e equivalência',
           'nome ajustado ao edital'
         ) as topico_id`,
        [candidatoId, operador],
      );

      const { rows } = await cliente.query<{
        status: string;
        topico_id: string;
        nome: string;
        materia_id: string;
        decidido_por: string;
        motivo_decisao: string;
        logs: number;
      }>(
        `select c.status::text, c.topico_id, t.nome, t.materia_id,
                c.decidido_por, c.motivo_decisao,
                (select count(*)::int from public.operador_acoes
                  where operador_id = $2 and tipo = 'topico_candidato_aprovado'
                    and entidade_id = $1::text
                    and motivo = 'nome ajustado ao edital') as logs
           from public.topico_candidato c
           join public.topicos t on t.id = c.topico_id
          where c.id = $1::uuid`,
        [candidatoId, operador],
      );
      expect(decisao[0].topico_id).toBe(rows[0].topico_id);
      expect(rows[0]).toEqual({
        status: "aprovado",
        topico_id: decisao[0].topico_id,
        nome: "Juros compostos e equivalência",
        materia_id: materiaId,
        decidido_por: operador,
        motivo_decisao: "nome ajustado ao edital",
        logs: 1,
      });
    });
  });

  it("rejeita candidato sem criar topico e recusa uma segunda decisao", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const operador = await operadorAtivo(cliente);
      const materiaId = await materia(cliente);
      const candidatoId = await candidato(cliente, materiaId);
      const { rows: antes } = await cliente.query<{ total: number }>(
        "select count(*)::int as total from public.topicos where materia_id = $1",
        [materiaId],
      );

      const { rows: rejeicao } = await cliente.query<{ topico_id: string | null }>(
        `select public.decidir_topico_candidato(
           $1, 'rejeitado', $2, null, null, 'sinonimo de topico existente'
         ) as topico_id`,
        [candidatoId, operador],
      );
      expect(rejeicao[0].topico_id).toBeNull();

      await cliente.query("savepoint segunda_decisao");
      await expect(
        cliente.query(
          `select public.decidir_topico_candidato(
             $1, 'aprovado', $2, $3, null, 'tentativa repetida'
           )`,
          [candidatoId, operador, materiaId],
        ),
      ).rejects.toThrow(/candidato_nao_esta_pendente/);
      await cliente.query("rollback to savepoint segunda_decisao");

      const { rows } = await cliente.query<{
        status: string;
        topico_id: string | null;
        motivo_decisao: string;
        total: number;
        logs: number;
      }>(
        `select c.status::text, c.topico_id, c.motivo_decisao,
                (select count(*)::int from public.topicos where materia_id = $2::uuid) as total,
                (select count(*)::int from public.operador_acoes
                  where operador_id = $3 and tipo = 'topico_candidato_rejeitado'
                    and entidade_id = $1::text) as logs
           from public.topico_candidato c where c.id = $1::uuid`,
        [candidatoId, materiaId, operador],
      );
      expect(rows[0]).toEqual({
        status: "rejeitado",
        topico_id: null,
        motivo_decisao: "sinonimo de topico existente",
        total: antes[0].total,
        logs: 1,
      });
    });
  });

  it("edita somente campos declarados, desativa sem DELETE e registra o motivo", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const operador = await operadorAtivo(cliente);
      const materiaId = await materia(cliente);
      const outraMateria = await materia(cliente, "Conhecimentos bancários");
      const { rows: topico } = await cliente.query<{ id: string }>(
        "insert into public.topicos (materia_id, nome) values ($1, 'Juros') returning id",
        [materiaId],
      );

      const { rows: resultado } = await cliente.query<{ ok: boolean }>(
        `select public.editar_taxonomia_operador(
           'topico', $1, $2, 'adequar ao edital novo',
           jsonb_build_object('nome', 'Juros e taxas', 'ordem', 9, 'ativo', false, 'materia_id', $3::text)
         ) as ok`,
        [topico[0].id, operador, outraMateria],
      );
      expect(resultado[0].ok).toBe(true);

      const { rows } = await cliente.query<{
        nome: string;
        ordem: number;
        ativo: boolean;
        materia_id: string;
        logs: number;
      }>(
        `select t.nome, t.ordem, t.ativo, t.materia_id,
                (select count(*)::int from public.operador_acoes
                  where operador_id = $2 and tipo = 'topico_editado'
                    and entidade_id = $1::text and motivo = 'adequar ao edital novo') as logs
           from public.topicos t where t.id = $1::uuid`,
        [topico[0].id, operador],
      );
      expect(rows[0]).toEqual({
        nome: "Juros e taxas",
        ordem: 9,
        ativo: false,
        materia_id: outraMateria,
        logs: 1,
      });

      await cliente.query("savepoint campo_extra");
      await expect(
        cliente.query(
          `select public.editar_taxonomia_operador(
             'topico', $1, $2, 'tentativa', '{"criado_em":"2000-01-01"}'::jsonb
           )`,
          [topico[0].id, operador],
        ),
      ).rejects.toThrow(/campo_de_taxonomia_nao_permitido/);
      await cliente.query("rollback to savepoint campo_extra");
    });
  });
});
