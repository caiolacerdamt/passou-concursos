import type { Client } from "pg";
import { expect, it } from "vitest";

import { criarProva } from "./acervo";
import { comTransacaoRevertida } from "./conexao";
import { descreveComBanco } from "./setup";

async function inserirBloco(
  cliente: Client,
  provaId: string,
  campos: Record<string, unknown> = {},
) {
  const linha = {
    bloco: 0,
    chave_dedup: `prova:${provaId}:bloco:0:v1`,
    primeira_pagina: 1,
    ultima_pagina: 4,
    tokens_estimados: 12_000,
    status: "montado",
    lote_provedor: null,
    ...campos,
  };

  return cliente.query(
    `insert into public.prova_lote
       (prova_id, bloco, chave_dedup, primeira_pagina, ultima_pagina,
        tokens_estimados, status, lote_provedor)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      provaId,
      linha.bloco,
      linha.chave_dedup,
      linha.primeira_pagina,
      linha.ultima_pagina,
      linha.tokens_estimados,
      linha.status,
      linha.lote_provedor,
    ],
  );
}

descreveComBanco("prova_lote — a retomada da extracao (AD-036)", () => {
  it("recusa o mesmo bloco da mesma prova duas vezes", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const prova = await criarProva(cliente);
      await inserirBloco(cliente, prova);

      // Reenviar a prova nao pode remontar bloco que ja existe: seria pagar
      // duas vezes pelo mesmo pedaco.
      await expect(
        inserirBloco(cliente, prova, { chave_dedup: `outra:${prova}` }),
      ).rejects.toThrow(/prova_lote_bloco_unico|duplicate key/i);
    });
  });

  it("recusa a mesma chave de dedup, mesmo em bloco de indice diferente", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const prova = await criarProva(cliente);
      await inserirBloco(cliente, prova, { bloco: 0 });

      await expect(inserirBloco(cliente, prova, { bloco: 1 })).rejects.toThrow(
        /prova_lote_chave_unica|duplicate key/i,
      );
    });
  });

  it("blocos diferentes da mesma prova convivem", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const prova = await criarProva(cliente);
      await inserirBloco(cliente, prova, { bloco: 0 });
      await inserirBloco(cliente, prova, {
        bloco: 1,
        chave_dedup: `prova:${prova}:bloco:1:v1`,
        primeira_pagina: 5,
        ultima_pagina: 9,
      });

      const { rows } = await cliente.query(
        "select count(*)::int as total from public.prova_lote where prova_id = $1",
        [prova],
      );
      expect(rows[0].total).toBe(2);
    });
  });

  it("lote enviado sem id do provedor e recusado", async () => {
    // Sem o id nao existe como colher: a linha seria trabalho perdido em voo.
    await comTransacaoRevertida(async (cliente) => {
      const prova = await criarProva(cliente);

      // Savepoint: a recusa aborta a transacao, e o proximo INSERT do mesmo
      // teste precisa de uma transacao viva para provar o outro lado da regra.
      await cliente.query("savepoint sem_id");
      await expect(
        inserirBloco(cliente, prova, { status: "enviado" }),
      ).rejects.toThrow(/prova_lote_enviado_tem_id/i);
      await cliente.query("rollback to savepoint sem_id");

      await expect(
        inserirBloco(cliente, prova, { status: "enviado", lote_provedor: "lote_x" }),
      ).resolves.toBeTruthy();
    });
  });

  it("pagina final antes da inicial e recusada", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const prova = await criarProva(cliente);
      await expect(
        inserirBloco(cliente, prova, { primeira_pagina: 9, ultima_pagina: 4 }),
      ).rejects.toThrow(/prova_lote_paginas_em_ordem/i);
    });
  });

  it("carimba `atualizado_em` no UPDATE", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const prova = await criarProva(cliente);
      await inserirBloco(cliente, prova);

      // Um valor antigo escrito na mao: se o gatilho nao existisse, ele
      // sobreviveria ao UPDATE seguinte.
      await cliente.query(
        `update public.prova_lote set atualizado_em = now() - interval '3 days'
          where prova_id = $1`,
        [prova],
      );
      await cliente.query(
        `update public.prova_lote set status = 'falhou', erro = 'teste'
          where prova_id = $1`,
        [prova],
      );

      const { rows } = await cliente.query(
        `select atualizado_em > now() - interval '1 minute' as recente
           from public.prova_lote where prova_id = $1`,
        [prova],
      );
      expect(rows[0].recente).toBe(true);
    });
  });

  it("esta fechada para anon e authenticated", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows } = await cliente.query(
        `select coalesce(count(*), 0)::int as concessoes
           from information_schema.role_table_grants
          where table_schema = 'public' and table_name = 'prova_lote'
            and grantee in ('anon', 'authenticated')`,
      );
      expect(rows[0].concessoes).toBe(0);

      const { rows: rls } = await cliente.query(
        `select relrowsecurity from pg_class where relname = 'prova_lote'`,
      );
      expect(rls[0].relrowsecurity).toBe(true);
    });
  });
});

descreveComBanco("provas — carimbo de atualizada_em (divida da SPEC 04)", () => {
  it("o UPDATE carimba, mesmo sem o chamador se lembrar", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const prova = await criarProva(cliente);
      await cliente.query(
        `update public.provas set atualizada_em = now() - interval '3 days' where id = $1`,
        [prova],
      );

      await cliente.query(
        "update public.provas set status = 'extraindo' where id = $1",
        [prova],
      );

      const { rows } = await cliente.query(
        `select atualizada_em > now() - interval '1 minute' as recente
           from public.provas where id = $1`,
        [prova],
      );
      expect(rows[0].recente).toBe(true);
    });
  });
});
