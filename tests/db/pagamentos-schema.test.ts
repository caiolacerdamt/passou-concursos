import type { Client } from "pg";

import { expect, it } from "vitest";

import { comTransacaoRevertida } from "./conexao";
import { criarMatricula, criarUsuario, idDoProdutoUnico } from "./conta";
import { descreveComBanco } from "./setup";
import { hashTokenDeResultado } from "@/modules/pagamentos/resultado-token";

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
          "pagamento_resultado_tokens",
        ]],
      );
      expect(tabelas.map((linha) => linha.relname)).toEqual([
        "faturas",
        "pagamento_aceites",
        "pagamento_eventos",
        "pagamento_pendencias",
        "pagamento_resultado_tokens",
        "pagamento_transicoes",
        "pagamentos",
      ]);

      const { rows: rls } = await cliente.query<{ relname: string; relrowsecurity: boolean }>(
        `select c.relname, c.relrowsecurity
           from pg_class c
           join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public'
            and c.relname = any($1::text[])`,
        [[
          "pagamentos",
          "pagamento_aceites",
          "pagamento_eventos",
          "pagamento_transicoes",
          "faturas",
          "pagamento_pendencias",
          "pagamento_resultado_tokens",
        ]],
      );
      expect(rls.every((linha) => linha.relrowsecurity)).toBe(true);
    });
  });

  it("guarda somente o hash da capability e rejeita resultado expirado", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const pagamento = await criarPagamento(cliente);
      const token = "A".repeat(43);
      const hash = hashTokenDeResultado(token);

      await cliente.query(
        `insert into public.pagamento_resultado_tokens
           (pagamento_id, token_hash, expira_em)
         values ($1, $2, now() + interval '48 hours')`,
        [pagamento, hash],
      );

      const { rows: armazenado } = await cliente.query<{ token_hash: string }>(
        `select token_hash
           from public.pagamento_resultado_tokens
          where pagamento_id = $1`,
        [pagamento],
      );
      expect(armazenado[0].token_hash).toBe(hash);
      expect(armazenado[0].token_hash).not.toContain(token);

      const { rows: valido } = await cliente.query<{ pagamento_id: string }>(
        `select pagamento_id
           from public.pagamento_resultado_tokens
          where token_hash = $1 and expira_em > now()`,
        [hash],
      );
      expect(valido).toEqual([{ pagamento_id: pagamento }]);

      const { rows: desconhecido } = await cliente.query(
        `select pagamento_id
           from public.pagamento_resultado_tokens
          where token_hash = $1 and expira_em > now()`,
        [hashTokenDeResultado("B".repeat(43))],
      );
      expect(desconhecido).toEqual([]);

      await cliente.query(
        `update public.pagamento_resultado_tokens
            set expira_em = now() - interval '1 second'
          where pagamento_id = $1`,
        [pagamento],
      );
      const { rows: expirado } = await cliente.query(
        `select pagamento_id
           from public.pagamento_resultado_tokens
          where token_hash = $1 and expira_em > now()`,
        [hash],
      );
      expect(expirado).toEqual([]);
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

  it("só a RPC de reconciliação permite expirada para confirmada", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const pagamento = await criarPagamento(cliente, "expirada");

      await cliente.query("savepoint recon_guard");
      await expect(
        cliente.query(
          "select public.mudar_estado_pagamento($1, 'confirmada'::public.pagamento_estado, 'atalho')",
          [pagamento],
        ),
      ).rejects.toThrow(/transicao de pagamento invalida/);
      await cliente.query("rollback to savepoint recon_guard");

      await cliente.query(
        "select public.reabrir_pagamento_expirado_reconciliacao($1, 'reconciliacao_pagamento_pago')",
        [pagamento],
      );

      const { rows } = await cliente.query<{ estado: string }>(
        "select estado::text from public.pagamentos where id = $1",
        [pagamento],
      );
      expect(rows[0].estado).toBe("confirmada");
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

  it("RPC do checkout grava valor congelado e aceite no mesmo contrato", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const email = `checkout-${crypto.randomUUID()}@exemplo.test`;
      const referencia = `checkout-${crypto.randomUUID()}`;
      const { rows } = await cliente.query<{
        id: string;
        email: string;
        valor_centavos: number;
        meio: string;
        parcelas: number;
        estado: string;
        referencia_interna: string;
      }>(
        `select id, email, valor_centavos, meio::text, parcelas, estado::text,
                referencia_interna
           from public.criar_pagamento_checkout(
             'anual-unico'::text, $1::text, 19700::integer,
             'PIX'::public.pagamento_meio, 1::smallint, $2::text,
             true::boolean, 'termos-2026-08'::text,
             '2026-08-21T12:00:00Z'::timestamptz
           )`,
        [email, referencia],
      );

      expect(rows[0]).toMatchObject({
        email,
        valor_centavos: 19700,
        meio: "PIX",
        parcelas: 1,
        estado: "pendente",
        referencia_interna: referencia,
      });

      const { rows: aceites } = await cliente.query<{
        maior_de_idade: boolean;
        termos_versao: string;
        aceito_em: string;
      }>(
        `select maior_de_idade, termos_versao, aceito_em::text
           from public.pagamento_aceites
          where pagamento_id = $1`,
        [rows[0].id],
      );
      expect(aceites).toEqual([
        {
          maior_de_idade: true,
          termos_versao: "termos-2026-08",
          aceito_em: "2026-08-21 12:00:00+00",
        },
      ]);
    });
  });

  it("checkout não cria cobrança para e-mail com matrícula ativa", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const email = `matricula-${crypto.randomUUID()}@exemplo.test`;
      const aluno = await criarUsuario(cliente, email);
      await criarMatricula(cliente, aluno);

      await cliente.query("savepoint checkout_bloqueado");
      await expect(
        cliente.query(
          `select public.criar_pagamento_checkout(
             'anual-unico'::text, $1::text, 19700::integer,
             'PIX'::public.pagamento_meio, 1::smallint, $2::text,
             true::boolean, 'termos-2026-08'::text, now()
           )`,
          [email, `bloqueado-${crypto.randomUUID()}`],
        ),
      ).rejects.toThrow(/matricula_ativa/);
      await cliente.query("rollback to savepoint checkout_bloqueado");
    });
  });

  it("fatura e pendência preservam o vínculo e impedem fila duplicada", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const pagamento = await criarPagamento(cliente);

      await cliente.query(
        `insert into public.faturas
           (pagamento_id, asaas_fatura_id, referencia_fiscal, estado)
         values ($1, 'nf_1', 'ref_fiscal_1', 'emitida')`,
        [pagamento],
      );
      await cliente.query(
        `insert into public.pagamento_pendencias
           (pagamento_id, tipo, ultima_falha_codigo, proxima_tentativa_em)
         values ($1, 'reconciliacao', 'gateway_temporario', now())`,
        [pagamento],
      );

      await cliente.query("savepoint pendencia_duplicada");
      await expect(
        cliente.query(
          `insert into public.pagamento_pendencias (pagamento_id, tipo)
           values ($1, 'reconciliacao')`,
          [pagamento],
        ),
      ).rejects.toThrow(/pagamento_pendencias_uma_aberta|duplicate key/i);
      await cliente.query("rollback to savepoint pendencia_duplicada");

      const { rows: faturas } = await cliente.query<{
        asaas_fatura_id: string;
        referencia_fiscal: string;
        estado: string;
      }>(
        `select asaas_fatura_id, referencia_fiscal, estado
           from public.faturas
          where pagamento_id = $1`,
        [pagamento],
      );
      expect(faturas).toEqual([
        {
          asaas_fatura_id: "nf_1",
          referencia_fiscal: "ref_fiscal_1",
          estado: "emitida",
        },
      ]);
    });
  });

  it("logs de evento e transição são append-only", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const pagamento = await criarPagamento(cliente);
      const evento = `evento-${crypto.randomUUID()}`;
      await cliente.query(
        "select public.registrar_pagamento_evento($1, 'PAYMENT_CONFIRMED', null, $2, 'recebido')",
        [evento, pagamento],
      );
      await cliente.query(
        "select public.mudar_estado_pagamento($1, 'confirmada'::public.pagamento_estado, null)",
        [pagamento],
      );

      await cliente.query("savepoint update_log");
      await expect(
        cliente.query(
          "update public.pagamento_eventos set tipo = 'alterado' where evento_id = $1",
          [evento],
        ),
      ).rejects.toThrow(/append-only|mutacao/i);
      await cliente.query("rollback to savepoint update_log");

      await cliente.query("savepoint delete_log");
      await expect(
        cliente.query(
          "delete from public.pagamento_transicoes where pagamento_id = $1",
          [pagamento],
        ),
      ).rejects.toThrow(/append-only|mutacao/i);
      await cliente.query("rollback to savepoint delete_log");
    });
  });

  it("reembolso mantém a fatura e fecha o estado de acesso", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = await criarUsuario(cliente);
      const matricula = await criarMatricula(cliente, aluno);
      const pagamento = await criarPagamento(cliente);
      await cliente.query(
        "update public.pagamentos set matricula_id = $2 where id = $1",
        [pagamento, matricula.id],
      );
      await cliente.query(
        "insert into public.faturas (pagamento_id, estado) values ($1, 'pendente')",
        [pagamento],
      );

      await cliente.query(
        "select public.mudar_estado_pagamento($1, 'confirmada'::public.pagamento_estado, null)",
        [pagamento],
      );
      await cliente.query(
        "select public.mudar_estado_pagamento($1, 'ativada'::public.pagamento_estado, null)",
        [pagamento],
      );
      await cliente.query(
        "select public.mudar_estado_pagamento($1, 'reembolsada'::public.pagamento_estado, 'reembolso_confirmado')",
        [pagamento],
      );
      await cliente.query(
        "update public.matriculas set estado = 'reembolsada' where id = $1",
        [matricula.id],
      );

      const { rows } = await cliente.query<{
        pagamento_estado: string;
        reembolsado_em: string | null;
        matricula_estado: string;
        fatura_estado: string;
      }>(
        `select p.estado::text as pagamento_estado, p.reembolsado_em::text,
                m.estado::text as matricula_estado, f.estado as fatura_estado
           from public.pagamentos p
           join public.matriculas m on m.id = p.matricula_id
           join public.faturas f on f.pagamento_id = p.id
          where p.id = $1`,
        [pagamento],
      );
      expect(rows[0]).toMatchObject({
        pagamento_estado: "reembolsada",
        matricula_estado: "reembolsada",
        fatura_estado: "pendente",
      });
      expect(rows[0].reembolsado_em).not.toBeNull();
    });
  });

  it("fecha pagamento e matrícula na mesma RPC e permite retry idempotente", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = await criarUsuario(cliente);
      const matricula = await criarMatricula(cliente, aluno);
      const pagamento = await criarPagamento(cliente, "ativada");
      await cliente.query(
        "update public.pagamentos set user_id = $2, matricula_id = $3 where id = $1",
        [pagamento, aluno, matricula.id],
      );

      await cliente.query(
        `select public.confirmar_reembolso_pagamento(
          $1, $2, 'PIX'::public.pagamento_meio,
          '2026-08-21T12:00:00Z'::timestamptz, 'teste_reembolso'
        )`,
        [pagamento, aluno],
      );

      let { rows } = await cliente.query<{ pagamento: string; matricula: string }>(
        `select p.estado::text as pagamento, m.estado::text as matricula
           from public.pagamentos p
           join public.matriculas m on m.id = p.matricula_id
          where p.id = $1`,
        [pagamento],
      );
      expect(rows[0]).toEqual({ pagamento: "reembolsada", matricula: "reembolsada" });

      // Harness adversarial: representa a divergência que uma versão antiga
      // podia deixar após falha entre as duas escritas.
      await cliente.query(
        "update public.matriculas set estado = 'ativa' where id = $1",
        [matricula.id],
      );
      await cliente.query(
        `select public.confirmar_reembolso_pagamento(
          $1, $2, 'PIX'::public.pagamento_meio,
          '2026-08-21T12:01:00Z'::timestamptz, 'teste_reembolso_retry'
        )`,
        [pagamento, aluno],
      );

      ({ rows } = await cliente.query<{ pagamento: string; matricula: string }>(
        `select p.estado::text as pagamento, m.estado::text as matricula
           from public.pagamentos p
           join public.matriculas m on m.id = p.matricula_id
          where p.id = $1`,
        [pagamento],
      ));
      expect(rows[0]).toEqual({ pagamento: "reembolsada", matricula: "reembolsada" });
    });
  });
});
