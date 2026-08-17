import type { Client } from "pg";
import { expect, it } from "vitest";

import { comTransacaoRevertida } from "./conexao";
import { descreveComBanco } from "./setup";

/**
 * BANCO-02 · BANCO-12 · AD-009 · AD-041
 *
 * O catalogo-alvo de provas e o estado da ingestao.
 */

const INSERIR = `
  insert into public.provas (banca, ano, orgao, cargo, caderno, status)
  values ($1, $2, $3, $4, $5, coalesce($6::public.status_prova, 'catalogada'))
  returning id, status
`;

/** Orgao unico por execucao: o alvo unico e global e o banco e compartilhado. */
function orgaoUnico(): string {
  return `Banco do Brasil ${Math.random().toString(36).slice(2, 10)}`;
}

async function catalogar(
  cliente: Client,
  dados: {
    banca?: string;
    ano?: number;
    orgao: string;
    cargo?: string;
    caderno?: string | null;
    status?: string | null;
  },
) {
  return cliente.query<{ id: string; status: string }>(INSERIR, [
    dados.banca ?? "Cesgranrio",
    dados.ano ?? 2023,
    dados.orgao,
    dados.cargo ?? "Escriturario",
    dados.caderno ?? null,
    dados.status ?? null,
  ]);
}

descreveComBanco("catalogo-alvo de provas", () => {
  it("nasce catalogada, antes de existir PDF na mao", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows } = await cliente.query<{
        status: string;
        pdf_storage_path: string | null;
      }>(
        `insert into public.provas (banca, ano, orgao, cargo)
         values ('FGV', 2024, $1, 'Escriturario')
         returning status, pdf_storage_path`,
        [orgaoUnico()],
      );

      // O alvo e registrado antes do download (AD-009). Estado inicial errado
      // faria a fila da fabrica pegar prova que nao tem arquivo.
      expect(rows[0].status).toBe("catalogada");
      expect(rows[0].pdf_storage_path).toBeNull();
    });
  });

  it("recusa a mesma prova catalogada duas vezes", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const orgao = orgaoUnico();
      await catalogar(cliente, { orgao, caderno: "Tipo 1" });

      await expect(
        catalogar(cliente, { orgao, caderno: "Tipo 1" }),
      ).rejects.toThrow(/provas_alvo_unico/);
    });
  });

  it("recusa duplicata tambem quando as duas linhas nao tem caderno", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const orgao = orgaoUnico();
      await catalogar(cliente, { orgao, caderno: null });

      // Em indice unico, NULL nao colide com NULL. Sem o coalesce da migracao
      // este INSERT passaria e a prova entraria duas vezes.
      await expect(
        catalogar(cliente, { orgao, caderno: null }),
      ).rejects.toThrow(/provas_alvo_unico/);
    });
  });

  it("aceita dois cadernos diferentes da mesma prova", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const orgao = orgaoUnico();

      for (const caderno of ["Tipo 1", "Tipo 2"]) {
        const { rowCount } = await catalogar(cliente, { orgao, caderno });
        expect(rowCount).toBe(1);
      }
    });
  });

  it("aceita a mesma banca e ano para cargos diferentes", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const orgao = orgaoUnico();

      for (const cargo of ["Escriturario", "Agente Comercial"]) {
        const { rowCount } = await catalogar(cliente, { orgao, cargo });
        expect(rowCount).toBe(1);
      }
    });
  });

  it("recusa ano fora da faixa de 1990 a 2100", async () => {
    await comTransacaoRevertida(async (cliente) => {
      for (const ano of [1989, 2101]) {
        await cliente.query("savepoint tentativa");
        await expect(
          catalogar(cliente, { orgao: orgaoUnico(), ano }),
        ).rejects.toThrow(/provas_ano_check|violates check constraint/);
        await cliente.query("rollback to savepoint tentativa");
      }

      const { rowCount } = await catalogar(cliente, { orgao: orgaoUnico(), ano: 1990 });
      expect(rowCount).toBe(1);
    });
  });

  it("aceita precisa_ocr: escaneada e adiada, nao ingerida (AD-041)", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows } = await catalogar(cliente, {
        orgao: orgaoUnico(),
        status: "precisa_ocr",
      });

      // O AD-041 adiou OCR e exigiu o estado existir para a prova escaneada nao
      // virar extracao ruim. Sem este valor no enum, a SPEC 08 nao teria onde
      // parar a prova.
      expect(rows[0].status).toBe("precisa_ocr");
    });
  });

  it("aceita todo o vocabulario de estado da ingestao", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const estados = [
        "catalogada",
        "extraindo",
        "extraida",
        "gabarito_cruzado",
        "concluida",
        "precisa_ocr",
        "falhou",
      ];

      for (const status of estados) {
        const { rows } = await catalogar(cliente, { orgao: orgaoUnico(), status });
        expect(rows[0].status).toBe(status);
      }
    });
  });

  it("e invisivel e nao-escrivel para anon e authenticated", async () => {
    await comTransacaoRevertida(async (cliente) => {
      await catalogar(cliente, { orgao: orgaoUnico() });

      for (const papel of ["anon", "authenticated"]) {
        await cliente.query("savepoint navegador");
        await cliente.query(`set local role ${papel}`);

        const leitura = await cliente.query("select 1 from public.provas");
        expect(leitura.rowCount).toBe(0);

        await cliente.query("savepoint escrita");
        await expect(
          cliente.query(
            `insert into public.provas (banca, ano, orgao, cargo)
             values ('X', 2020, 'invasao', 'y')`,
          ),
        ).rejects.toThrow(/permission denied|row-level security/);
        await cliente.query("rollback to savepoint escrita");

        await cliente.query("savepoint truncagem");
        await expect(cliente.query("truncate table public.provas")).rejects.toThrow(
          /permission denied/,
        );
        await cliente.query("rollback to savepoint truncagem");

        await cliente.query("rollback to savepoint navegador");
      }
    });
  });
});
