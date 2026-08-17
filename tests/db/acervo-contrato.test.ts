import { expect, it } from "vitest";

import {
  DIMENSAO_EMBEDDING,
  ENUMS_DO_ACERVO,
  alternativasSchema,
  fonteCitacaoSchema,
} from "@/modules/acervo";

import { ALTERNATIVAS, fonteCitacao, inserirQuestao } from "./acervo";
import { comBanco, comTransacaoRevertida } from "./conexao";
import { descreveComBanco } from "./setup";

/**
 * AD-039 · AD-040 · BANCO-09 AC3
 *
 * O contrato TS e o schema do banco dizem a mesma coisa? Este e o teste que
 * impede as duas pontas de divergirem em silencio — sem ele, alguem acrescenta
 * um valor de enum na migracao, esquece o arquivo de contrato, e o codigo passa a
 * nao conhecer um estado que existe no banco.
 *
 * Mesma funcao que `catalogo-sem-orfa.test.ts` cumpre para a configuracao.
 */
descreveComBanco("contrato TS x schema do banco", () => {
  it("cada enum do contrato e igual ao pg_enum, valor por valor e na mesma ordem", async () => {
    await comBanco(async (cliente) => {
      const { rows } = await cliente.query<{ tipo: string; valores: string[] }>(
        `select t.typname as tipo,
                array_agg(e.enumlabel::text order by e.enumsortorder) as valores
           from pg_type t
           join pg_enum e on e.enumtypid = t.oid
           join pg_namespace n on n.oid = t.typnamespace
          where n.nspname = 'public' and t.typname = any($1)
          group by t.typname`,
        [Object.keys(ENUMS_DO_ACERVO)],
      );

      const noBanco = Object.fromEntries(rows.map((l) => [l.tipo, l.valores]));

      for (const [tipo, valores] of Object.entries(ENUMS_DO_ACERVO)) {
        expect({ tipo, valores: noBanco[tipo] }).toEqual({
          tipo,
          valores: [...valores],
        });
      }
    });
  });

  it("DIMENSAO_EMBEDDING e a dimensao real da coluna", async () => {
    await comBanco(async (cliente) => {
      const { rows } = await cliente.query<{ tipo: string }>(
        `select format_type(a.atttypid, a.atttypmod) as tipo
           from pg_attribute a
          where a.attrelid = 'public.questoes'::regclass and a.attname = 'embedding'`,
      );

      // Se alguem trocar a dimensao na migracao e esquecer o contrato (ou o
      // contrario), este teste fica vermelho antes de a SPEC 11 gravar vetor de
      // tamanho errado em lote.
      expect(rows[0].tipo).toBe(`vector(${DIMENSAO_EMBEDDING})`);
    });
  });

  it("o que o contrato aceita, o banco tambem aceita", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const alternativas = JSON.parse(ALTERNATIVAS);
      const fonte = JSON.parse(fonteCitacao(7));

      expect(alternativasSchema.safeParse(alternativas).success).toBe(true);
      expect(fonteCitacaoSchema.safeParse(fonte).success).toBe(true);

      const { id } = await inserirQuestao(cliente, {
        numero: 7,
        alternativas: ALTERNATIVAS,
        fonte_citacao: fonteCitacao(7),
        status: "publicada",
      });
      expect(id).toBeTruthy();
    });
  });

  it("o que o contrato recusa por formato, o banco tambem recusa", async () => {
    await comTransacaoRevertida(async (cliente) => {
      // Array vazio: as duas pontas dizem nao, por razoes proprias — Zod pelo
      // `.min(2)`, o banco pelo `alternativas_conforme_tipo`.
      expect(alternativasSchema.safeParse([]).success).toBe(false);
      await cliente.query("savepoint alternativas");
      await expect(inserirQuestao(cliente, { alternativas: "[]" })).rejects.toThrow(
        /alternativas_conforme_tipo/,
      );
      await cliente.query("rollback to savepoint alternativas");

      // Proveniencia incompleta: Zod pelas chaves obrigatorias, banco pelo `?&`.
      const incompleta = JSON.stringify({ banca: "Cesgranrio", ano: 2023 });
      expect(fonteCitacaoSchema.safeParse(JSON.parse(incompleta)).success).toBe(false);
      await expect(
        inserirQuestao(cliente, { fonte_citacao: incompleta }),
      ).rejects.toThrow(/fonte_citacao_completa/);
    });
  });
});
