import type { Client } from "pg";
import { expect, it } from "vitest";

import { comTransacaoRevertida } from "./conexao";
import { descreveComBanco } from "./setup";

/**
 * BANCO-05 (parte: taxonomia) · BANCO-09 AC3 (enums) · AD-039
 *
 * Cada teste roda dentro de uma transacao que sempre volta atras, entao nada
 * sobra no banco de desenvolvimento.
 */

async function criarMateria(cliente: Client, nome: string): Promise<string> {
  const { rows } = await cliente.query<{ id: string }>(
    "insert into public.materias (nome) values ($1) returning id",
    [nome],
  );
  return rows[0].id;
}

/** Nome unico por execucao: a unicidade e global e o banco e compartilhado. */
function nomeUnico(prefixo: string): string {
  return `${prefixo}-${Math.random().toString(36).slice(2, 10)}`;
}

descreveComBanco("enums do acervo (AD-039)", () => {
  it("tem exatamente os valores que o AD-039 fixou", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows } = await cliente.query<{ tipo: string; valores: string[] }>(
        // `enumlabel` e do tipo `name`; sem o cast para text[] o driver devolve
        // a string crua "{a,b}" em vez de um array.
        `select t.typname as tipo,
                array_agg(e.enumlabel::text order by e.enumsortorder) as valores
           from pg_type t
           join pg_enum e on e.enumtypid = t.oid
           join pg_namespace n on n.oid = t.typnamespace
          where n.nspname = 'public'
            and t.typname in ('tipo_questao', 'origem_questao', 'status_questao',
                              'tipo_mudanca', 'status_prova', 'status_candidato')
          group by t.typname`,
      );

      const porTipo = Object.fromEntries(rows.map((l) => [l.tipo, l.valores]));

      // Estes tres sao literais do AD-039. Mudar um valor aqui muda o snapshot
      // congelado de `tentativas` e o contrato de `explicacoes`.
      expect(porTipo.tipo_questao).toEqual(["multipla_escolha", "certo_errado"]);
      expect(porTipo.origem_questao).toEqual(["real", "gerada_ia"]);
      expect(porTipo.status_questao).toEqual([
        "rascunho",
        "em_revisao",
        "publicada",
        "rejeitada",
        "precisa_ocr",
      ]);
      // BANCO-13 — o IA-09 AC4 (SPEC 14) le este enum para decidir invalidacao.
      expect(porTipo.tipo_mudanca).toEqual(["cosmetica", "substantiva"]);
      expect(porTipo.status_prova).toEqual([
        "catalogada",
        "extraindo",
        "extraida",
        "gabarito_cruzado",
        "concluida",
        "precisa_ocr",
        "falhou",
      ]);
      expect(porTipo.status_candidato).toEqual(["pendente", "aprovado", "rejeitado"]);
    });
  });

  it("recusa valor fora da lista do enum", async () => {
    await comTransacaoRevertida(async (cliente) => {
      await expect(
        cliente.query("select 'discursiva'::public.tipo_questao"),
      ).rejects.toThrow(/invalid input value for enum/);
    });
  });
});

descreveComBanco("taxonomia materia -> topico", () => {
  it("recusa materia com nome repetido", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const nome = nomeUnico("Matematica Financeira");
      await criarMateria(cliente, nome);

      await expect(criarMateria(cliente, nome)).rejects.toThrow(
        /materias_nome_unico/,
      );
    });
  });

  it("recusa topico com nome repetido dentro da mesma materia", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const materia = await criarMateria(cliente, nomeUnico("Materia"));

      await cliente.query(
        "insert into public.topicos (materia_id, nome) values ($1, 'Juros Simples')",
        [materia],
      );

      await expect(
        cliente.query(
          "insert into public.topicos (materia_id, nome) values ($1, 'Juros Simples')",
          [materia],
        ),
      ).rejects.toThrow(/topicos_nome_unico_na_materia/);
    });
  });

  it("aceita o mesmo nome de topico em materias diferentes", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const a = await criarMateria(cliente, nomeUnico("Materia-A"));
      const b = await criarMateria(cliente, nomeUnico("Materia-B"));

      // "Juros Simples" existe em Matematica Financeira e pode existir em
      // Conhecimentos Bancarios. Unicidade global obrigaria nome artificial.
      for (const materia of [a, b]) {
        const { rowCount } = await cliente.query(
          "insert into public.topicos (materia_id, nome) values ($1, 'Juros Simples')",
          [materia],
        );
        expect(rowCount).toBe(1);
      }
    });
  });

  it("exige que o topico aponte para uma materia que existe", async () => {
    await comTransacaoRevertida(async (cliente) => {
      await expect(
        cliente.query(
          "insert into public.topicos (materia_id, nome) values (gen_random_uuid(), 'Orfao')",
        ),
      ).rejects.toThrow(/violates foreign key constraint/);
    });
  });

  it("permite reclassificar: renomear o topico e move-lo de materia", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const origem = await criarMateria(cliente, nomeUnico("Origem"));
      const destino = await criarMateria(cliente, nomeUnico("Destino"));

      const { rows } = await cliente.query<{ id: string }>(
        "insert into public.topicos (materia_id, nome) values ($1, 'Nome Antigo') returning id",
        [origem],
      );
      const topico = rows[0].id;

      // A taxonomia e editavel de proposito (BANCO-05 P3 AC2). Quem protege o
      // historico e `tentativas` (AD-042), que copia id E rotulo na resposta.
      const renomeado = await cliente.query(
        "update public.topicos set nome = 'Nome Novo', materia_id = $2 where id = $1",
        [topico, destino],
      );
      expect(renomeado.rowCount).toBe(1);

      const { rows: depois } = await cliente.query<{
        nome: string;
        materia_id: string;
      }>("select nome, materia_id from public.topicos where id = $1", [topico]);
      expect(depois[0].nome).toBe("Nome Novo");
      expect(depois[0].materia_id).toBe(destino);
    });
  });

  it("desativa em vez de apagar: `ativa`/`ativo` existem com default true", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const materia = await criarMateria(cliente, nomeUnico("Sai do Edital"));
      const { rows } = await cliente.query<{ id: string; ativo: boolean }>(
        "insert into public.topicos (materia_id, nome) values ($1, 'Topico') returning id, ativo",
        [materia],
      );
      expect(rows[0].ativo).toBe(true);

      await cliente.query("update public.topicos set ativo = false where id = $1", [
        rows[0].id,
      ]);
      await cliente.query("update public.materias set ativa = false where id = $1", [
        materia,
      ]);

      const { rows: conferencia } = await cliente.query<{
        ativa: boolean;
        ativo: boolean;
      }>(
        `select m.ativa, t.ativo
           from public.materias m join public.topicos t on t.materia_id = m.id
          where m.id = $1`,
        [materia],
      );
      expect(conferencia[0]).toEqual({ ativa: false, ativo: false });
    });
  });

  it("e invisivel e nao-escrivel para anon e authenticated", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const nome = nomeUnico("Fechada");
      const materia = await criarMateria(cliente, nome);
      await cliente.query(
        "insert into public.topicos (materia_id, nome) values ($1, 'Topico')",
        [materia],
      );

      // Controle: as linhas existem de verdade. Sem isto, "ninguem ve" passaria
      // tambem numa tabela vazia.
      const comoServidor = await cliente.query(
        "select 1 from public.materias where id = $1",
        [materia],
      );
      expect(comoServidor.rowCount).toBe(1);

      for (const papel of ["anon", "authenticated"]) {
        await cliente.query("savepoint navegador");
        await cliente.query(`set local role ${papel}`);

        for (const tabela of ["materias", "topicos"]) {
          const leitura = await cliente.query(`select 1 from public.${tabela}`);
          expect(leitura.rowCount).toBe(0);
        }

        // Cada tentativa recusada aborta a transacao, entao cada uma precisa do
        // seu proprio savepoint — senao a segunda falha por "transaction is
        // aborted" e o teste passaria pelo motivo errado.
        await cliente.query("savepoint escrita");
        await expect(
          cliente.query("insert into public.materias (nome) values ('invasao')"),
        ).rejects.toThrow(/permission denied|row-level security/);
        await cliente.query("rollback to savepoint escrita");

        await cliente.query("savepoint truncagem");
        await expect(
          cliente.query("truncate table public.topicos"),
        ).rejects.toThrow(/permission denied/);
        await cliente.query("rollback to savepoint truncagem");

        await cliente.query("rollback to savepoint navegador");
      }
    });
  });
});
