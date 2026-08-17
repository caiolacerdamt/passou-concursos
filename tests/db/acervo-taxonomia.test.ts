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

/**
 * Operador de mentira, criado dentro da transacao. Some no rollback.
 * `decidido_por` aponta para quem cura a taxonomia, nunca para o aluno.
 */
async function criarOperador(cliente: Client): Promise<string> {
  const { rows } = await cliente.query<{ id: string }>(
    "insert into auth.users (id) values (gen_random_uuid()) returning id",
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

  it("e invisivel e nao-escrivel para anon e authenticated (materias/topicos)", async () => {
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

descreveComBanco("topico_candidato: a IA sugere, nao cria", () => {
  const INSERIR = `
    insert into public.topico_candidato
      (nome_sugerido, materia_id, status, ocorrencias, topico_id, decidido_em, decidido_por)
    values ($1, $2, $3, $4, $5, $6, $7)
    returning id
  `;

  /** Candidato pendente, o unico estado em que a IA pode deixar a linha. */
  function pendente(nome: string, materia: string | null = null) {
    return [nome, materia, "pendente", 1, null, null, null];
  }

  it("nasce pendente, com uma ocorrencia e sem topico canonico", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows } = await cliente.query<{
        status: string;
        ocorrencias: number;
        topico_id: string | null;
        decidido_por: string | null;
      }>(
        `insert into public.topico_candidato (nome_sugerido)
         values ('Open Finance')
         returning status, ocorrencias, topico_id, decidido_por`,
      );

      expect(rows[0].status).toBe("pendente");
      expect(rows[0].ocorrencias).toBe(1);
      expect(rows[0].topico_id).toBeNull();
      expect(rows[0].decidido_por).toBeNull();
    });
  });

  it("aceita sugestao sem palpite de materia", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rowCount } = await cliente.query(INSERIR, pendente("Sem Materia"));
      expect(rowCount).toBe(1);
    });
  });

  it("recusa candidato aprovado sem topico canonico", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const autor = await criarOperador(cliente);

      await expect(
        cliente.query(INSERIR, [
          "Aprovado no Vazio",
          null,
          "aprovado",
          1,
          null,
          new Date(),
          autor,
        ]),
      ).rejects.toThrow(/candidato_aprovado_aponta_topico/);
    });
  });

  it("recusa candidato pendente que ja aponta para um topico", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const materia = await criarMateria(cliente, nomeUnico("Materia"));
      const { rows } = await cliente.query<{ id: string }>(
        "insert into public.topicos (materia_id, nome) values ($1, 'Ja Existe') returning id",
        [materia],
      );

      // O caminho pelo qual um topico nasceria sem ninguem decidir nada.
      await expect(
        cliente.query(INSERIR, [
          "Atalho",
          materia,
          "pendente",
          1,
          rows[0].id,
          null,
          null,
        ]),
      ).rejects.toThrow(/candidato_aprovado_aponta_topico/);
    });
  });

  it("recusa decisao sem autor e sem data", async () => {
    await comTransacaoRevertida(async (cliente) => {
      // Rejeitado nao precisa de topico, mas precisa de quem rejeitou.
      await expect(
        cliente.query(INSERIR, ["Rejeitado Anonimo", null, "rejeitado", 1, null, null, null]),
      ).rejects.toThrow(/candidato_decidido_tem_autor/);
    });
  });

  it("aceita o caminho completo: pendente -> aprovado com topico e autor", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const autor = await criarOperador(cliente);
      const materia = await criarMateria(cliente, nomeUnico("Materia"));

      const { rows: candidato } = await cliente.query<{ id: string }>(
        INSERIR,
        pendente("Open Finance", materia),
      );

      // O operador aprova: cria o topico canonico e amarra as duas linhas.
      const { rows: topico } = await cliente.query<{ id: string }>(
        "insert into public.topicos (materia_id, nome) values ($1, 'Open Finance') returning id",
        [materia],
      );

      const { rowCount } = await cliente.query(
        `update public.topico_candidato
            set status = 'aprovado', topico_id = $2, decidido_em = now(), decidido_por = $3
          where id = $1`,
        [candidato[0].id, topico[0].id, autor],
      );
      expect(rowCount).toBe(1);
    });
  });

  it("recusa ocorrencias zero ou negativa", async () => {
    await comTransacaoRevertida(async (cliente) => {
      for (const quantas of [0, -1]) {
        await cliente.query("savepoint tentativa");
        await expect(
          cliente.query(INSERIR, ["Contagem Invalida", null, "pendente", quantas, null, null, null]),
        ).rejects.toThrow(/ocorrencias_check|violates check constraint/);
        await cliente.query("rollback to savepoint tentativa");
      }
    });
  });

  it("e invisivel e nao-escrivel para anon e authenticated", async () => {
    await comTransacaoRevertida(async (cliente) => {
      await cliente.query(INSERIR, pendente("Fechada"));

      for (const papel of ["anon", "authenticated"]) {
        await cliente.query("savepoint navegador");
        await cliente.query(`set local role ${papel}`);

        const leitura = await cliente.query("select 1 from public.topico_candidato");
        expect(leitura.rowCount).toBe(0);

        await cliente.query("savepoint escrita");
        await expect(
          cliente.query(
            "insert into public.topico_candidato (nome_sugerido) values ('invasao')",
          ),
        ).rejects.toThrow(/permission denied|row-level security/);
        await cliente.query("rollback to savepoint escrita");

        await cliente.query("rollback to savepoint navegador");
      }
    });
  });
});
