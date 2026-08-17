import { expect, it } from "vitest";

import { criarTopico, inserirQuestao } from "./acervo";
import { comTransacaoRevertida } from "./conexao";
import { descreveComBanco } from "./setup";

/**
 * BANCO-09 AC1/AC3 (parte: schema e indice) · AD-005 · AD-040
 *
 * As colunas e os indices da busca hibrida existem e funcionam. **Preencher o
 * embedding e a SPEC 11**: aqui ele nasce nulo, de proposito.
 */

/** Vetor de dimensao arbitraria, gerado no banco em vez de no JavaScript. */
function vetorDe(dimensoes: number): string {
  return `array_fill(0.1::real, array[${dimensoes}])::vector`;
}

descreveComBanco("colunas de busca do acervo", () => {
  it("embedding e vector(1536), a dimensao do Cohere embed-v4", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows } = await cliente.query<{ tipo: string }>(
        `select format_type(a.atttypid, a.atttypmod) as tipo
           from pg_attribute a
          where a.attrelid = 'public.questoes'::regclass and a.attname = 'embedding'`,
      );

      // Le do catalogo, nao do texto da migracao: e a dimensao que o banco vai
      // cobrar de verdade quando a SPEC 11 gravar o primeiro vetor.
      expect(rows[0].tipo).toBe("vector(1536)");
    });
  });

  it("nasce nulo: preencher e a SPEC 11", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { id } = await inserirQuestao(cliente);
      const { rows } = await cliente.query<{ embedding: unknown }>(
        "select embedding from public.questoes where id = $1",
        [id],
      );
      expect(rows[0].embedding).toBeNull();
    });
  });

  it("aceita vetor de 1536 dimensoes e recusa qualquer outra", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { id } = await inserirQuestao(cliente);

      const certo = await cliente.query(
        `update public.questoes set embedding = ${vetorDe(1536)} where id = $1 and vigente`,
        [id],
      );
      expect(certo.rowCount).toBe(1);

      for (const dimensoes of [1024, 1537]) {
        await cliente.query("savepoint dimensao");
        await expect(
          cliente.query(
            `update public.questoes set embedding = ${vetorDe(dimensoes)} where id = $1 and vigente`,
            [id],
          ),
        ).rejects.toThrow(/expected 1536 dimensions/);
        await cliente.query("rollback to savepoint dimensao");
      }
    });
  });

  it("fts e coluna gerada e enche sozinha, sem gatilho e sem script", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { id } = await inserirQuestao(cliente, {
        enunciado: "O saldo dos financiamentos bancarios cresceu no periodo.",
      });

      const { rows } = await cliente.query<{ gerada: boolean; fts: string }>(
        `select a.attgenerated <> '' as gerada,
                (select q.fts::text from public.questoes q where q.id = $1) as fts
           from pg_attribute a
          where a.attrelid = 'public.questoes'::regclass and a.attname = 'fts'`,
        [id],
      );

      // Coluna gerada garante que nunca existe questao com texto e sem indice.
      expect(rows[0].gerada).toBe(true);
      expect(rows[0].fts.length).toBeGreaterThan(0);
    });
  });

  it("usa a configuracao portuguesa: acha a palavra flexionada", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { id } = await inserirQuestao(cliente, {
        enunciado: "Os financiamentos bancarios foram renegociados.",
      });

      // 'bancario' no singular acha 'bancarios' no plural porque a configuracao
      // 'portuguese' reduz as duas ao mesmo radical. Com 'simple' nao acharia —
      // e isso que este teste discrimina.
      const { rows } = await cliente.query<{ achou: boolean }>(
        `select fts @@ to_tsquery('portuguese', 'bancario & renegociar') as achou
           from public.questoes where id = $1`,
        [id],
      );
      expect(rows[0].achou).toBe(true);
    });
  });

  it("acompanha a mudanca do enunciado sem ninguem mandar", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { id } = await inserirQuestao(cliente, { enunciado: "Enunciado inicial" });

      await cliente.query(
        "update public.questoes set enunciado = 'Alienacao fiduciaria de bem imovel' where id = $1 and vigente",
        [id],
      );

      // O que este teste prova e que a coluna gerada acompanhou o UPDATE: o
      // radical velho saiu e o novo entrou. Quem prova o stemming portugues e o
      // teste anterior.
      const { rows } = await cliente.query<{ achou: boolean; sumiu: boolean }>(
        `select fts @@ to_tsquery('portuguese', 'fiduciaria') as achou,
                not (fts @@ to_tsquery('portuguese', 'inicial')) as sumiu
           from public.questoes where id = $1`,
        [id],
      );
      expect(rows[0].achou).toBe(true);
      expect(rows[0].sumiu).toBe(true);
    });
  });
});

descreveComBanco("indices de busca e de leitura do acervo", () => {
  it("os quatro indices existem, com o metodo e o operador certos", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows } = await cliente.query<{ nome: string; definicao: string }>(
        `select indexname as nome, indexdef as definicao
           from pg_indexes where schemaname = 'public' and tablename = 'questoes'`,
      );
      const porNome = Object.fromEntries(rows.map((l) => [l.nome, l.definicao]));

      // `indexdef` devolve as palavras-chave em maiuscula.
      expect(porNome.questoes_embedding_hnsw_idx).toMatch(/using hnsw/i);
      expect(porNome.questoes_embedding_hnsw_idx).toMatch(/vector_cosine_ops/);
      expect(porNome.questoes_fts_idx).toMatch(/using gin/i);
      // Contrato do Raio-X (SPEC 26): a taxa conta real + publicada.
      expect(porNome.questoes_origem_status_idx).toMatch(/origem, status/);
      expect(porNome.questoes_origem_status_idx).toMatch(/where vigente/i);
    });
  });

  /**
   * O banco de desenvolvimento esta praticamente vazio, e nessa escala o
   * planejador prefere Seq Scan por ser mais barato de verdade. Desligar o
   * Seq Scan e o que permite provar o que a spec pede — que existe indice
   * cobrindo o predicado — sem depender de volume de dado que ainda nao existe.
   *
   * **Nao se pode exigir um indice nominal com dois predicados nesta escala**: com
   * a tabela quase vazia o custo dos indices candidatos empata, e a escolha varia
   * entre execucoes (aconteceu de verdade nesta spec: `questoes_origem_status_idx`
   * atendeu a busca por topico via `Filter`). O teste pede o que e verdade — nada
   * de Seq Scan — e pina o indice nominal so onde a escolha e inequivoca.
   */
  async function planoSemSeqScan(
    cliente: import("pg").Client,
    sql: string,
    parametros: unknown[] = [],
  ): Promise<string> {
    await cliente.query("set local enable_seqscan = off");
    const { rows } = await cliente.query<{ "QUERY PLAN": string }>(
      `explain ${sql}`,
      parametros,
    );
    return rows.map((l) => l["QUERY PLAN"]).join("\n");
  }

  it("a busca por topico + status e coberta por indice, sem Seq Scan", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const topico = await criarTopico(cliente);
      await inserirQuestao(cliente, { topico_id: topico, status: "em_revisao" });

      // Success Criteria nº4 da spec.
      const plano = await planoSemSeqScan(
        cliente,
        `select id from public.questoes
          where topico_id = $1 and status = 'em_revisao' and vigente`,
        [topico],
      );

      expect(plano).not.toMatch(/Seq Scan/);
      expect(plano).toMatch(/Index Scan|Index Only Scan|Bitmap Index Scan/);
    });
  });

  it("a busca so por topico cai no indice de topico: la a escolha e inequivoca", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const topico = await criarTopico(cliente);
      await inserirQuestao(cliente, { topico_id: topico });

      // Nenhum outro indice de `questoes` tem `topico_id` como primeira coluna,
      // entao aqui o nome do indice e afirmacao segura.
      const plano = await planoSemSeqScan(
        cliente,
        "select id from public.questoes where topico_id = $1 and vigente",
        [topico],
      );

      expect(plano).toMatch(/questoes_topico_status_idx/);
    });
  });

  it("a contagem do Raio-X e coberta por indice", async () => {
    await comTransacaoRevertida(async (cliente) => {
      await inserirQuestao(cliente, { status: "publicada", resposta_correta: "C" });

      const plano = await planoSemSeqScan(
        cliente,
        `select count(*) from public.questoes
          where origem = 'real' and status = 'publicada' and vigente`,
      );

      expect(plano).not.toMatch(/Seq Scan/);
      expect(plano).toMatch(/Index Scan|Index Only Scan|Bitmap Index Scan/);
    });
  });

  it("a extensao vector esta instalada", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows } = await cliente.query<{ instalada: number }>(
        "select count(*)::int as instalada from pg_extension where extname = 'vector'",
      );
      expect(rows[0].instalada).toBe(1);
    });
  });
});
