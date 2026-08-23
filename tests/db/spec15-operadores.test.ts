import { expect, it } from "vitest";

import { comTransacaoRevertida } from "./conexao";
import { criarUsuario } from "./conta";
import { descreveComBanco } from "./setup";

descreveComBanco("SPEC 15 — identidade e trilha do operador", () => {
  it("reconhece somente operador ativo e fecha as tabelas para o navegador", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const operador = await criarUsuario(cliente);
      await cliente.query(
        "insert into public.operadores (operador_id) values ($1)",
        [operador],
      );

      const { rows: antes } = await cliente.query<{ ativo: boolean }>(
        "select public.operador_ativo($1) as ativo",
        [operador],
      );
      expect(antes[0].ativo).toBe(true);

      await cliente.query(
        "update public.operadores set ativo = false where operador_id = $1",
        [operador],
      );
      const { rows: depois } = await cliente.query<{ ativo: boolean }>(
        "select public.operador_ativo($1) as ativo",
        [operador],
      );
      expect(depois[0].ativo).toBe(false);

      await cliente.query("savepoint navegador");
      await cliente.query("set local role authenticated");
      await expect(
        cliente.query("select * from public.operadores"),
      ).rejects.toThrow(/permission denied/i);
      await cliente.query("rollback to savepoint navegador");
    });
  });

  it("registra quem, quando, o que e motivo e recusa autor inativo", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const operador = await criarUsuario(cliente);
      const inativo = await criarUsuario(cliente);
      await cliente.query(
        "insert into public.operadores (operador_id, ativo) values ($1, true), ($2, false)",
        [operador, inativo],
      );

      const { rows: criada } = await cliente.query<{ id: string }>(
        `select public.registrar_acao_operador(
           $1, 'config_alterada', 'configuracao', 'flag.m5.raiox',
           'liberar homologacao', '{"valor":true}'::jsonb
         ) as id`,
        [operador],
      );
      const { rows } = await cliente.query<{
        operador_id: string;
        tipo: string;
        entidade: string;
        entidade_id: string;
        motivo: string;
        dados: { valor: boolean };
        criada_em: Date;
      }>(
        `select operador_id, tipo, entidade, entidade_id, motivo, dados, criada_em
           from public.operador_acoes where id = $1`,
        [criada[0].id],
      );

      expect(rows[0]).toMatchObject({
        operador_id: operador,
        tipo: "config_alterada",
        entidade: "configuracao",
        entidade_id: "flag.m5.raiox",
        motivo: "liberar homologacao",
        dados: { valor: true },
      });
      expect(rows[0].criada_em).toBeInstanceOf(Date);

      await cliente.query("savepoint inativo");
      await expect(
        cliente.query(
          "select public.registrar_acao_operador($1, 'x', 'y', null, 'motivo')",
          [inativo],
        ),
      ).rejects.toThrow(/operador_nao_autorizado/);
      await cliente.query("rollback to savepoint inativo");
    });
  });

  it("exige motivo e torna a trilha append-only", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const operador = await criarUsuario(cliente);
      await cliente.query("insert into public.operadores (operador_id) values ($1)", [operador]);

      await cliente.query("savepoint motivo_vazio");
      await expect(
        cliente.query(
          "select public.registrar_acao_operador($1, 'x', 'y', null, '   ')",
          [operador],
        ),
      ).rejects.toThrow(/motivo_da_acao_obrigatorio/);
      await cliente.query("rollback to savepoint motivo_vazio");

      const { rows } = await cliente.query<{ id: string }>(
        "select public.registrar_acao_operador($1, 'x', 'y', null, 'motivo') as id",
        [operador],
      );
      await cliente.query("savepoint atualizar");
      await expect(
        cliente.query("update public.operador_acoes set motivo = 'outro' where id = $1", [rows[0].id]),
      ).rejects.toThrow(/append-only/);
      await cliente.query("rollback to savepoint atualizar");

      await cliente.query("savepoint apagar");
      await expect(
        cliente.query("delete from public.operador_acoes where id = $1", [rows[0].id]),
      ).rejects.toThrow(/append-only/);
      await cliente.query("rollback to savepoint apagar");

      await cliente.query("savepoint truncar");
      await expect(
        cliente.query("truncate table public.operador_acoes"),
      ).rejects.toThrow(/append-only/);
      await cliente.query("rollback to savepoint truncar");
    });
  });

  it("recusa nova configuracao sem motivo e aceita motivo explicito", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const autor = await criarUsuario(cliente);
      await cliente.query("savepoint sem_motivo");
      await expect(
        cliente.query(
          `insert into public.configuracoes
             (chave, valor, modulo_dono, alterado_por)
           values ('flag.m5.raiox', 'true'::jsonb, 'm5', $1)`,
          [autor],
        ),
      ).rejects.toThrow(/motivo_configuracao_obrigatorio/);
      await cliente.query("rollback to savepoint sem_motivo");

      const { rows } = await cliente.query<{ motivo: string }>(
        `insert into public.configuracoes
           (chave, valor, modulo_dono, alterado_por, motivo)
         values ('flag.m5.raiox', 'true'::jsonb, 'm5', $1, 'homologacao')
         returning motivo`,
        [autor],
      );
      expect(rows[0].motivo).toBe("homologacao");
    });
  });
});
