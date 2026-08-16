import type { Client } from "pg";
import { expect, it } from "vitest";

import { comTransacaoRevertida } from "./conexao";
import { descreveComBanco } from "./setup";

const INSERIR = `
  insert into public.configuracoes (chave, valor, modulo_dono, alterado_por, motivo)
  values ($1, $2::jsonb, $3, $4, $5)
  returning id
`;

/** Administrador de mentira, criado dentro da transacao. Some no rollback. */
async function criarAutor(cliente: Client): Promise<string> {
  const { rows } = await cliente.query<{ id: string }>(
    "insert into auth.users (id) values (gen_random_uuid()) returning id",
  );
  return rows[0].id;
}

descreveComBanco("tabela configuracoes", () => {
  it("recusa chave fora do padrao de prefixo (AC4)", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const autor = await criarAutor(cliente);

      const invalidas = [
        "flag.simulado", // sem o modulo dono
        "param.m0.x", // modulo fora da faixa m1..m9
        "FLAG.M4.SIMULADO", // maiuscula
        "flag.m4.Simulado", // maiuscula no nome
        "config.m4.simulado", // prefixo que nao e flag nem param
        "flag.m4.simulado.extra", // ponto a mais
      ];

      for (const chave of invalidas) {
        await cliente.query("savepoint tentativa");
        await expect(
          cliente.query(INSERIR, [chave, "true", "m4", autor, "teste"]),
        ).rejects.toThrow(/chave_com_prefixo_valido/);
        await cliente.query("rollback to savepoint tentativa");
      }

      // A do padrao certo entra — senao o teste acima passaria com a tabela quebrada.
      const { rowCount } = await cliente.query(INSERIR, [
        "flag.m4.simulado",
        "true",
        "m4",
        autor,
        "teste",
      ]);
      expect(rowCount).toBe(1);
    });
  });

  it("o valor vigente e a ultima linha da chave (AC7)", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const autor = await criarAutor(cliente);
      const chave = "param.m4.diagnostico_n_questoes";

      await cliente.query(INSERIR, [chave, "20", "m4", autor, "valor inicial"]);
      await cliente.query(INSERIR, [chave, "25", "m4", autor, "subiu"]);

      const { rows } = await cliente.query<{ valor: number; modulo_dono: string }>(
        "select valor, modulo_dono from public.configuracoes_vigentes where chave = $1",
        [chave],
      );

      // Uma linha so na view, e e a segunda. As duas insercoes compartilham o
      // now() da transacao: quem desempata e o `id desc` do indice.
      expect(rows).toHaveLength(1);
      expect(rows[0].valor).toBe(25);
      expect(rows[0].modulo_dono).toBe("m4");
    });
  });

  it("guarda o historico: o valor anterior continua sendo a penultima linha (AC7)", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const autor = await criarAutor(cliente);
      const chave = "param.m4.diagnostico_n_questoes";

      await cliente.query(INSERIR, [chave, "20", "m4", autor, "valor inicial"]);
      await cliente.query(INSERIR, [chave, "25", "m4", autor, "subiu"]);

      const { rows } = await cliente.query<{
        valor: number;
        motivo: string;
        alterado_por: string;
      }>(
        `select valor, motivo, alterado_por from public.configuracoes
         where chave = $1 order by id asc`,
        [chave],
      );

      // Quem, quando, valor anterior e valor novo saem da propria tabela —
      // sem tabela de historico paralela que possa divergir do fato.
      expect(rows).toHaveLength(2);
      expect(rows.map((l) => l.valor)).toEqual([20, 25]);
      expect(rows.map((l) => l.motivo)).toEqual(["valor inicial", "subiu"]);
      expect(rows.every((l) => l.alterado_por === autor)).toBe(true);
    });
  });

  it("recusa UPDATE, inclusive para o service_role (AD-081)", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const autor = await criarAutor(cliente);
      const chave = "flag.m4.simulado";
      await cliente.query(INSERIR, [chave, "false", "m4", autor, "nasce desligada"]);

      const alterar = `update public.configuracoes set valor = 'true'::jsonb where chave = $1`;

      for (const papel of ["postgres", "service_role"]) {
        await cliente.query("savepoint mutacao");
        await cliente.query(`set local role ${papel}`);
        await expect(cliente.query(alterar, [chave])).rejects.toThrow(
          /append-only: UPDATE proibido/,
        );
        await cliente.query("rollback to savepoint mutacao");
      }
    });
  });

  it("recusa DELETE, inclusive para o service_role (AD-081)", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const autor = await criarAutor(cliente);
      const chave = "flag.m4.simulado";
      await cliente.query(INSERIR, [chave, "false", "m4", autor, "nasce desligada"]);

      const apagar = "delete from public.configuracoes where chave = $1";

      for (const papel of ["postgres", "service_role"]) {
        await cliente.query("savepoint mutacao");
        await cliente.query(`set local role ${papel}`);
        await expect(cliente.query(apagar, [chave])).rejects.toThrow(
          /append-only: DELETE proibido/,
        );
        await cliente.query("rollback to savepoint mutacao");
      }
    });
  });

  it("recusa TRUNCATE: sem privilegio para o navegador, com gatilho para o service_role", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const autor = await criarAutor(cliente);
      await cliente.query(INSERIR, [
        "flag.m4.simulado",
        "false",
        "m4",
        autor,
        "nasce desligada",
      ]);

      // Camada 1: o privilegio foi revogado. RLS nao governa TRUNCATE, entao
      // sem o revoke a tabela append-only podia ser esvaziada inteira.
      for (const papel of ["anon", "authenticated"]) {
        await cliente.query("savepoint truncagem");
        await cliente.query(`set local role ${papel}`);
        await expect(
          cliente.query("truncate table public.configuracoes"),
        ).rejects.toThrow(/permission denied/);
        await cliente.query("rollback to savepoint truncagem");
      }

      // Camada 2: o service_role tem o privilegio; quem o segura e o gatilho.
      await cliente.query("savepoint truncagem_servico");
      await cliente.query("set local role service_role");
      await expect(
        cliente.query("truncate table public.configuracoes"),
      ).rejects.toThrow(/append-only: TRUNCATE proibido/);
      await cliente.query("rollback to savepoint truncagem_servico");
    });
  });

  it("e invisivel para anon e authenticated: RLS ligada e sem policy", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const autor = await criarAutor(cliente);
      const chave = "param.m9.preco_anual_centavos";
      await cliente.query(INSERIR, [chave, "19700", "m9", autor, "preco de lancamento"]);

      // Controle: a linha existe de verdade. Sem isto, "ninguem ve" passaria
      // tambem numa tabela vazia.
      const comoServidor = await cliente.query(
        "select 1 from public.configuracoes where chave = $1",
        [chave],
      );
      expect(comoServidor.rowCount).toBe(1);

      for (const papel of ["anon", "authenticated"]) {
        await cliente.query("savepoint navegador");
        await cliente.query(`set local role ${papel}`);

        const naTabela = await cliente.query(
          "select 1 from public.configuracoes where chave = $1",
          [chave],
        );
        const naView = await cliente.query(
          "select 1 from public.configuracoes_vigentes where chave = $1",
          [chave],
        );

        // A view nao pode virar porta lateral: `security_invoker` faz a RLS
        // valer para ela tambem.
        expect(naTabela.rowCount).toBe(0);
        expect(naView.rowCount).toBe(0);

        // E tambem nao escreve: sem policy, a RLS barra o INSERT.
        await expect(
          cliente.query(INSERIR, ["flag.m4.invasao", "true", "m4", autor, "nao"]),
        ).rejects.toThrow(/row-level security/);

        await cliente.query("rollback to savepoint navegador");
      }
    });
  });
});
