import type { Client } from "pg";

import { expect, it } from "vitest";

import { comTransacaoRevertida } from "./conexao";
import { criarUsuario, idDoProdutoUnico } from "./conta";
import { descreveComBanco } from "./setup";

async function criarPagamento(cliente: Client, estado = "pendente") {
  const usuario = await criarUsuario(cliente);
  const produto = await idDoProdutoUnico(cliente);
  const { rows } = await cliente.query<{ id: string }>(
    `insert into public.pagamentos
       (produto_id, email, valor_centavos, meio, parcelas, referencia_interna, user_id, estado)
     values ($1, $2, 19700, 'PIX', 1, $3, $4, $5::public.pagamento_estado)
     returning id`,
    [produto, `schema-${crypto.randomUUID()}@exemplo.test`, `schema-${crypto.randomUUID()}`, usuario, estado],
  );
  return rows[0].id;
}

descreveComBanco("schema de pagamentos", () => {
  it("declara os enums, tabelas e RLS fechada para o navegador", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows: tabelas } = await cliente.query<{ relname: string }>(
        `select c.relname
           from pg_class c
           join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public'
            and c.relname = any($1::text[])
          order by c.relname`,
        [[
          "pagamentos",
          "pagamento_aceites",
          "pagamento_eventos",
          "pagamento_transicoes",
          "faturas",
          "pagamento_pendencias",
        ]],
      );
      expect(tabelas.map((linha) => linha.relname)).toEqual([
        "faturas",
        "pagamento_aceites",
        "pagamento_eventos",
        "pagamento_pendencias",
        "pagamento_transicoes",
        "pagamentos",
      ]);

      const { rows: rls } = await cliente.query<{ relname: string; relrowsecurity: boolean }>(
        `select c.relname, c.relrowsecurity
           from pg_class c
           join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public'
            and c.relname = any($1::text[])`,
        [["pagamentos", "pagamento_eventos", "pagamento_transicoes", "faturas"]],
      );
      expect(rls.every((linha) => linha.relrowsecurity)).toBe(true);
    });
  });

  it("aceita somente transicoes validas e grava log append-only", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const pagamento = await criarPagamento(cliente);

      await cliente.query(
        "select public.mudar_estado_pagamento($1, 'confirmada'::public.pagamento_estado, 'webhook')",
        [pagamento],
      );
      await cliente.query(
        "select public.mudar_estado_pagamento($1, 'ativada'::public.pagamento_estado, null)",
        [pagamento],
      );

      const { rows } = await cliente.query<{ de_estado: string; para_estado: string }>(
        `select de_estado::text, para_estado::text
           from public.pagamento_transicoes
          where pagamento_id = $1
          order by id`,
        [pagamento],
      );
      expect(rows).toEqual([
        { de_estado: "pendente", para_estado: "confirmada" },
        { de_estado: "confirmada", para_estado: "ativada" },
      ]);

      await expect(
        cliente.query(
          "select public.mudar_estado_pagamento($1, 'pendente'::public.pagamento_estado, null)",
          [pagamento],
        ),
      ).rejects.toThrow(/transicao de pagamento invalida/);
    });
  });

  it("idempotencia do evento e claim concorrente deixam uma linha e um dono", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const pagamento = await criarPagamento(cliente);
      const evento = `evt_${crypto.randomUUID()}`;

      const primeira = await cliente.query<{ registrar_pagamento_evento: boolean }>(
        "select public.registrar_pagamento_evento($1, 'PAYMENT_RECEIVED', null, $2, 'recebido')",
        [evento, pagamento],
      );
      const segunda = await cliente.query<{ registrar_pagamento_evento: boolean }>(
        "select public.registrar_pagamento_evento($1, 'PAYMENT_RECEIVED', null, $2, 'recebido')",
        [evento, pagamento],
      );
      expect(primeira.rows[0].registrar_pagamento_evento).toBe(true);
      expect(segunda.rows[0].registrar_pagamento_evento).toBe(false);

      await cliente.query(
        "select public.mudar_estado_pagamento($1, 'confirmada'::public.pagamento_estado, null)",
        [pagamento],
      );
      const claim1 = await cliente.query<{ reservar_ativacao_pagamento: boolean }>(
        "select public.reservar_ativacao_pagamento($1, 'worker-a')",
        [pagamento],
      );
      const claim2 = await cliente.query<{ reservar_ativacao_pagamento: boolean }>(
        "select public.reservar_ativacao_pagamento($1, 'worker-b')",
        [pagamento],
      );
      expect(claim1.rows[0].reservar_ativacao_pagamento).toBe(true);
      expect(claim2.rows[0].reservar_ativacao_pagamento).toBe(false);
    });
  });

  it("aceite exige maioridade afirmativa e não tem coluna de nascimento", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const pagamento = await criarPagamento(cliente);
      const { rows: colunas } = await cliente.query<{ column_name: string }>(
        `select column_name
           from information_schema.columns
          where table_schema = 'public' and table_name = 'pagamento_aceites'`,
      );
      expect(colunas.map((linha) => linha.column_name)).not.toContain(
        "data_nascimento",
      );

      await expect(
        cliente.query(
          `insert into public.pagamento_aceites
             (pagamento_id, maior_de_idade, termos_versao, aceito_em)
           values ($1, false, 'v1', now())`,
          [pagamento],
        ),
      ).rejects.toThrow(/pagamento_aceite_maioridade/);
    });
  });
});
