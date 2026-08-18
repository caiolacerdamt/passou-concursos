import type { Client } from "pg";
import { expect, it } from "vitest";

import { criarTopico } from "./acervo";
import { abrirPortaDoEsquecimento, comoAluno, novoAluno, recusa } from "./aluno";
import { comTransacaoRevertida } from "./conexao";
import { descreveComBanco } from "./setup";

/**
 * SPEC 06 · T48 — as tabelas da camada 2 (ALUNO-02 AC1, ALUNO-09 AC1/AC4,
 * ALUNO-10 AC1).
 *
 * O que estes testes provam nao e "a tabela existe" — e a **diferenca de regime**
 * entre as quatro: tres sao reescritas pelo job a cada madrugada e por isso
 * aceitam UPDATE; a quarta e log e por isso nao aceita. Confundir as duas coisas
 * ou travaria o job ou deixaria o historico de revisao editavel.
 */

descreveComBanco("projecoes — dominio_topico (ALUNO-02 AC1)", () => {
  it("aceita ser reescrita: o job apaga e reconstroi todo dia", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = novoAluno();
      const topico = await criarTopico(cliente);

      await cliente.query(
        `insert into public.dominio_topico
           (user_id, topico_id, n_respostas, n_acertos, n_chute_certo, score)
         values ($1, $2, 10, 6, 1, 0.5)`,
        [aluno, topico],
      );

      await cliente.query(
        "update public.dominio_topico set score = 0.7 where user_id = $1",
        [aluno],
      );
      await cliente.query("delete from public.dominio_topico where user_id = $1", [
        aluno,
      ]);

      const { rows } = await cliente.query(
        "select 1 from public.dominio_topico where user_id = $1",
        [aluno],
      );
      expect(rows).toHaveLength(0);
    });
  });

  it("recusa contagem incoerente — o job nao pode gravar chute maior que acerto", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = novoAluno();
      const topico = await criarTopico(cliente);

      const gravar = (acertos: number, chuteCerto: number, score: number) => () =>
        cliente.query(
          `insert into public.dominio_topico
             (user_id, topico_id, n_respostas, n_acertos, n_chute_certo, score)
           values ($1, $2, 10, $3, $4, $5)`,
          [aluno, topico, acertos, chuteCerto, score],
        );

      await recusa(cliente, gravar(20, 0, 0.5), /dominio_acertos_cabem_nas_respostas/);
      await recusa(cliente, gravar(4, 9, 0.5), /dominio_chute_cabe_nos_acertos/);
      await recusa(cliente, gravar(4, 1, 1.5), /dominio_score_entre_0_e_1/);
    });
  });
});

descreveComBanco("projecoes — caderno_erros (ALUNO-10 AC1)", () => {
  it("a chave e (aluno, topico, causa): a mesma causa nao entra duas vezes", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = novoAluno();
      const topico = await criarTopico(cliente);

      const gravar = (causa: string, n: number) => () =>
        cliente.query(
          `insert into public.caderno_erros
             (user_id, topico_id, causa_erro, n_erros, ultimo_erro_em)
           values ($1, $2, $3::public.causa_erro, $4, now())`,
          [aluno, topico, causa, n],
        );

      await gravar("errei_a_conta", 3)();
      // Outra causa no mesmo topico e outra linha — e o que faz o caderno
      // agrupar "por topico E por causa" em vez de so por topico.
      await gravar("nao_sabia_conteudo", 2)();
      await recusa(cliente, gravar("errei_a_conta", 5), /caderno_erros_pkey|duplicate key/);

      const { rows } = await cliente.query<{ n: string }>(
        "select count(*) as n from public.caderno_erros where user_id = $1",
        [aluno],
      );
      expect(rows[0].n).toBe("2");
    });
  });

  it("aceita `faltou_tempo` — a causa do simulado tambem vira caderno", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = novoAluno();
      const topico = await criarTopico(cliente);

      // `tentativas` recusa este valor por CHECK; o caderno **precisa** aceita-lo,
      // senao todo erro de simulado ficaria fora do caderno (ALUNO-04 AC3).
      await cliente.query(
        `insert into public.caderno_erros
           (user_id, topico_id, causa_erro, n_erros, ultimo_erro_em)
         values ($1, $2, 'faltou_tempo', 1, now())`,
        [aluno, topico],
      );

      const { rows } = await cliente.query<{ causa_erro: string }>(
        "select causa_erro from public.caderno_erros where user_id = $1",
        [aluno],
      );
      expect(rows[0].causa_erro).toBe("faltou_tempo");
    });
  });
});

descreveComBanco("projecoes — revisao_agenda (ALUNO-09 AC1/AC4)", () => {
  it("os dois algoritmos escrevem na MESMA coluna `due` — trocar nao migra dado", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = novoAluno();
      const topico = await criarTopico(cliente);

      await cliente.query(
        `insert into public.revisao_agenda
           (user_id, topico_id, algoritmo, fsrs_card, due, ultima_nota)
         values ($1, $2, 'fsrs', '{"stability":2.3}'::jsonb, current_date + 3, 3)`,
        [aluno, topico],
      );

      // Troca de algoritmo: a linha continua a mesma, o `due` continua na mesma
      // coluna. E o que o AC4 exige — nenhum agendamento se perde.
      await cliente.query(
        `update public.revisao_agenda
            set algoritmo = 'regua_fixa', regua_passo = 1
          where user_id = $1`,
        [aluno],
      );

      const { rows } = await cliente.query<{
        algoritmo: string;
        regua_passo: number;
      }>(
        "select algoritmo, regua_passo from public.revisao_agenda where user_id = $1",
        [aluno],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].algoritmo).toBe("regua_fixa");
      expect(rows[0].regua_passo).toBe(1);
    });
  });

  it("recusa algoritmo desconhecido e nota fora de 1-4", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = novoAluno();
      const topico = await criarTopico(cliente);

      await recusa(
        cliente,
        () =>
          cliente.query(
            `insert into public.revisao_agenda (user_id, topico_id, algoritmo, due)
             values ($1, $2, 'sm2', current_date)`,
            [aluno, topico],
          ),
        /revisao_algoritmo_conhecido/,
      );

      await recusa(
        cliente,
        () =>
          cliente.query(
            `insert into public.revisao_agenda (user_id, topico_id, due, ultima_nota)
             values ($1, $2, current_date, 5)`,
            [aluno, topico],
          ),
        /revisao_nota_de_1_a_4/,
      );
    });
  });
});

descreveComBanco("projecoes — revisao_evento e append-only (AD-084)", () => {
  async function gravarEvento(
    cliente: Client,
    aluno: string,
    topico: string,
  ): Promise<string> {
    const { rows } = await cliente.query<{ id: string }>(
      `insert into public.revisao_evento (user_id, topico_id, nota, percentual)
       values ($1, $2, 3, 0.8) returning id`,
      [aluno, topico],
    );
    return rows[0].id;
  }

  it("guarda percentual E nota na mesma linha — sem o percentual a conversao seria irreversivel", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = novoAluno();
      const topico = await criarTopico(cliente);
      await gravarEvento(cliente, aluno, topico);

      const { rows } = await cliente.query<{ nota: number; percentual: string }>(
        "select nota, percentual from public.revisao_evento where user_id = $1",
        [aluno],
      );
      expect(rows[0].nota).toBe(3);
      expect(Number(rows[0].percentual)).toBeCloseTo(0.8, 4);
    });
  });

  it("recusa UPDATE, inclusive para o service_role", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = novoAluno();
      const topico = await criarTopico(cliente);
      const id = await gravarEvento(cliente, aluno, topico);

      await recusa(
        cliente,
        () =>
          cliente.query("update public.revisao_evento set nota = 1 where id = $1", [id]),
        /UPDATE proibido/,
      );

      // A razao de existir o gatilho: o service_role tem o privilegio e passa
      // por cima da RLS, entao so a camada 2 o segura.
      await recusa(
        cliente,
        async () => {
          await cliente.query("set local role service_role");
          await cliente.query("update public.revisao_evento set nota = 1 where id = $1", [
            id,
          ]);
        },
        /UPDATE proibido/,
      );
      await cliente.query("reset role");
    });
  });

  it("recusa DELETE sem a porta do esquecimento, e aceita com ela (AD-029)", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = novoAluno();
      const outro = novoAluno();
      const topico = await criarTopico(cliente);
      const id = await gravarEvento(cliente, aluno, topico);

      await recusa(
        cliente,
        () => cliente.query("delete from public.revisao_evento where id = $1", [id]),
        /rotina de esquecimento/,
      );

      // Porta aberta para OUTRO titular nao apaga esta linha: a porta e nomeada,
      // nao um privilegio generico de administrador.
      await recusa(
        cliente,
        async () => {
          await abrirPortaDoEsquecimento(cliente, outro);
          await cliente.query("delete from public.revisao_evento where id = $1", [id]);
        },
        /rotina de esquecimento/,
      );

      await abrirPortaDoEsquecimento(cliente, aluno);
      const apagou = await cliente.query(
        "delete from public.revisao_evento where id = $1",
        [id],
      );
      expect(apagou.rowCount).toBe(1);
    });
  });

  it("recusa TRUNCATE", async () => {
    await comTransacaoRevertida(async (cliente) => {
      await recusa(
        cliente,
        () => cliente.query("truncate public.revisao_evento"),
        /TRUNCATE proibido/,
      );
    });
  });
});

descreveComBanco("projecoes — RLS das quatro tabelas", () => {
  it("o aluno le so o proprio e nao consegue escrever projecao nenhuma", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = novoAluno();
      const outro = novoAluno();
      const topico = await criarTopico(cliente);

      for (const dono of [aluno, outro]) {
        await cliente.query(
          `insert into public.dominio_topico
             (user_id, topico_id, n_respostas, n_acertos, n_chute_certo, score)
           values ($1, $2, 10, 5, 0, 0.5)`,
          [dono, topico],
        );
      }

      await comoAluno(cliente, aluno, async () => {
        const { rows } = await cliente.query<{ user_id: string }>(
          "select user_id from public.dominio_topico where topico_id = $1",
          [topico],
        );
        expect(rows.map((l) => l.user_id)).toEqual([aluno]);

        // Nao ha policy de INSERT: o aluno nao inventa o proprio dominio. Quem
        // escreve e o job.
        await recusa(
          cliente,
          () =>
            cliente.query(
              `insert into public.dominio_topico
                 (user_id, topico_id, n_respostas, n_acertos, n_chute_certo, score)
               values ($1, $2, 1, 1, 0, 1.0)`,
              [aluno, topico],
            ),
          /row-level security|permission denied/,
        );
      });
    });
  });

  it("as quatro tabelas estao com RLS ligada", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows } = await cliente.query<{ relname: string; relrowsecurity: boolean }>(
        `select relname, relrowsecurity from pg_class
          where relname in ('dominio_topico','caderno_erros','revisao_agenda','revisao_evento')
            and relnamespace = 'public'::regnamespace
          order by relname`,
      );
      expect(rows).toHaveLength(4);
      expect(rows.every((l) => l.relrowsecurity)).toBe(true);
    });
  });
});
