import { expect, it } from "vitest";

import { comTransacaoRevertida } from "./conexao";
import { descreveComBanco } from "./setup";
import {
  garantirParticao,
  inserirTentativa,
  novoAluno,
  questaoParaResponder,
} from "./aluno";

/**
 * SPEC 05 · T41 — a forma do log (ALUNO-01 AC2/AC3/AC4, ALUNO-04 AC2, INFRA-04 AC4).
 *
 * O que este arquivo NAO cobre: a trava do so-INSERT (T43), o particionamento
 * por pg_partman (T42) e o endurecimento das particoes (T44).
 */

/**
 * Mensagem do Postgres quando um CHECK/FK recusa.
 *
 * O `savepoint` nao e enfeite: statement que falha aborta a transacao inteira, e
 * sem ele o segundo `recusa` do mesmo teste devolveria "current transaction is
 * aborted" em vez do nome da constraint — um teste que passaria pelo motivo
 * errado.
 */
async function recusa(
  cliente: { query: (sql: string) => Promise<unknown> },
  fn: () => Promise<unknown>,
): Promise<string> {
  await cliente.query("savepoint tentativa_recusada");
  try {
    await fn();
  } catch (erro) {
    await cliente.query("rollback to savepoint tentativa_recusada");
    return (erro as Error).message;
  }
  throw new Error("o banco aceitou uma linha que deveria ter sido recusada");
}

descreveComBanco("tentativas — vocabulario do log", () => {
  it("causa_erro tem as 6 causas do ALUNO-04 AC2, mais 'nao sei dizer' e 'faltou tempo'", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows } = await cliente.query<{ valores: string[] }>(
        `select array_agg(enumlabel::text order by enumsortorder)::text[] as valores
           from pg_enum where enumtypid = 'public.causa_erro'::regtype`,
      );
      expect(rows[0].valores).toEqual([
        "nao_sabia_conteudo",
        "errei_a_conta",
        "entendi_errado_enunciado",
        "confundi_conceitos",
        "fiquei_na_duvida",
        "chutei",
        "nao_sei_dizer",
        "faltou_tempo",
      ]);
    });
  });

  it("contexto_tentativa tem exatamente os cinco valores do ALUNO-01 AC4", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows } = await cliente.query<{ valores: string[] }>(
        `select array_agg(enumlabel::text order by enumsortorder)::text[] as valores
           from pg_enum where enumtypid = 'public.contexto_tentativa'::regtype`,
      );
      expect(rows[0].valores).toEqual([
        "diagnostico",
        "plano",
        "treino",
        "simulado",
        "revisao",
      ]);
    });
  });

  it("causa_origem separa o auto-relato do aluno da deducao futura da IA", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows } = await cliente.query<{ valores: string[] }>(
        `select array_agg(enumlabel::text order by enumsortorder)::text[] as valores
           from pg_enum where enumtypid = 'public.causa_origem'::regtype`,
      );
      expect(rows[0].valores).toEqual(["aluno", "sistema"]);
    });
  });

  it("um contexto fora do conjunto nao existe como valor (ALUNO-01 AC4)", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const mensagem = await recusa(cliente, () =>
        cliente.query("select 'estudo_livre'::public.contexto_tentativa"),
      );
      expect(mensagem).toMatch(/invalid input value for enum/i);
    });
  });
});

descreveComBanco("tentativas — forma da tabela", () => {
  it("e particionada por range em respondida_em, com PK (id, respondida_em)", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows: particao } = await cliente.query<{
        estrategia: string;
        chave: string;
      }>(
        `select p.partstrat as estrategia,
                pg_get_partkeydef('public.tentativas'::regclass) as chave
           from pg_partitioned_table p
          where p.partrelid = 'public.tentativas'::regclass`,
      );
      expect(particao[0].estrategia).toBe("r");
      expect(particao[0].chave).toBe("RANGE (respondida_em)");

      const { rows: pk } = await cliente.query<{ definicao: string }>(
        `select pg_get_constraintdef(oid) as definicao
           from pg_constraint
          where conrelid = 'public.tentativas'::regclass and contype = 'p'`,
      );
      expect(pk[0].definicao).toBe("PRIMARY KEY (id, respondida_em)");
    });
  });

  it("carrega id E rotulo de materia e topico, mais o resto do snapshot do AC2", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows } = await cliente.query<{ coluna: string }>(
        `select column_name as coluna from information_schema.columns
          where table_schema = 'public' and table_name = 'tentativas'`,
      );
      const colunas = rows.map((r) => r.coluna);
      for (const esperada of [
        "materia_id",
        "materia_rotulo",
        "topico_id",
        "topico_rotulo",
        "banca",
        "tipo_questao",
        "dificuldade",
        "origem",
        "questao_id",
        "questao_versao",
        "sessao_id",
        "contexto",
        "resposta_dada",
        "correta",
        "tempo_ms",
        "marcou_chute",
        "respondida_em",
      ]) {
        expect(colunas).toContain(esperada);
      }
    });
  });

  it("aponta para a versao respondida da questao, por FK do par (id, questao_versao)", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows } = await cliente.query<{ definicao: string }>(
        `select pg_get_constraintdef(oid) as definicao
           from pg_constraint
          where conrelid = 'public.tentativas'::regclass
            and contype = 'f' and conname = 'tentativas_questao_fk'`,
      );
      expect(rows[0].definicao).toContain(
        "FOREIGN KEY (questao_id, questao_versao) REFERENCES questoes(id, questao_versao)",
      );
    });
  });

  it("recusa tentativa de uma versao de questao que nunca existiu", async () => {
    await comTransacaoRevertida(async (cliente) => {
      await garantirParticao(cliente, new Date());
      const questao = await questaoParaResponder(cliente);
      const mensagem = await recusa(cliente, () =>
        inserirTentativa(cliente, { ...questao, questao_versao: 99 }),
      );
      expect(mensagem).toMatch(/tentativas_questao_fk/);
    });
  });

  it("user_id nao tem FK — a unica porta de DELETE e a do esquecimento (AD-029)", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows } = await cliente.query<{ definicao: string }>(
        `select pg_get_constraintdef(oid) as definicao
           from pg_constraint
          where conrelid = 'public.tentativas'::regclass and contype = 'f'`,
      );
      const paraUsuario = rows.filter((r) => r.definicao.includes("(user_id)"));
      expect(paraUsuario).toEqual([]);
    });
  });

  it("tem os quatro indices de acesso desde a primeira migracao (INFRA-04 AC4)", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows } = await cliente.query<{ indice: string }>(
        `select indexname as indice from pg_indexes
          where schemaname = 'public' and tablename = 'tentativas'`,
      );
      const indices = rows.map((r) => r.indice);
      expect(indices).toEqual(
        expect.arrayContaining([
          "tentativas_user_periodo_idx",
          "tentativas_sessao_idx",
          "tentativas_questao_idx",
          "tentativas_topico_idx",
        ]),
      );
    });
  });
});

descreveComBanco("tentativas — o que a tabela recusa", () => {
  it("recusa letra que nao existe no tipo da questao", async () => {
    await comTransacaoRevertida(async (cliente) => {
      await garantirParticao(cliente, new Date());
      const certoErrado = await questaoParaResponder(cliente, {
        tipo_questao: "certo_errado",
      });
      const mensagem = await recusa(cliente, () =>
        inserirTentativa(cliente, certoErrado, { resposta_dada: "D" }),
      );
      expect(mensagem).toMatch(/resposta_valida/);
    });
  });

  it("aceita C e E em certo-errado e A..E em multipla escolha", async () => {
    await comTransacaoRevertida(async (cliente) => {
      await garantirParticao(cliente, new Date());
      const certoErrado = await questaoParaResponder(cliente, {
        tipo_questao: "certo_errado",
      });
      await expect(
        inserirTentativa(cliente, certoErrado, {
          contexto: "diagnostico",
          resposta_dada: "E",
          correta: false,
        }),
      ).resolves.toBeTruthy();

      const multipla = await questaoParaResponder(cliente);
      await expect(
        inserirTentativa(cliente, multipla, {
          contexto: "diagnostico",
          resposta_dada: "D",
          correta: false,
        }),
      ).resolves.toBeTruthy();
    });
  });

  it("recusa erro no treino sem causa (ALUNO-03 AC1, a rede embaixo do modulo)", async () => {
    await comTransacaoRevertida(async (cliente) => {
      await garantirParticao(cliente, new Date());
      const questao = await questaoParaResponder(cliente);
      const mensagem = await recusa(cliente, () =>
        inserirTentativa(cliente, questao, {
          contexto: "treino",
          correta: false,
          resposta_dada: "A",
        }),
      );
      expect(mensagem).toMatch(/causa_obrigatoria_no_treino/);
    });
  });

  it("aceita erro no treino com causa, inclusive 'nao_sei_dizer' (ALUNO-03 AC4)", async () => {
    await comTransacaoRevertida(async (cliente) => {
      await garantirParticao(cliente, new Date());
      const questao = await questaoParaResponder(cliente);
      await expect(
        inserirTentativa(cliente, questao, {
          contexto: "treino",
          correta: false,
          resposta_dada: "A",
          causa_erro: "nao_sei_dizer",
          causa_origem: "aluno",
        }),
      ).resolves.toBeTruthy();
    });
  });

  it("nao pede causa em diagnostico e simulado, mas pede no plano", async () => {
    await comTransacaoRevertida(async (cliente) => {
      await garantirParticao(cliente, new Date());
      const questao = await questaoParaResponder(cliente);
      for (const contexto of ["diagnostico", "simulado"] as const) {
        await expect(
          inserirTentativa(cliente, questao, {
            contexto,
            correta: false,
            resposta_dada: "A",
          }),
        ).resolves.toBeTruthy();
      }

      const mensagem = await recusa(cliente, () =>
        inserirTentativa(cliente, questao, {
          contexto: "plano",
          correta: false,
          resposta_dada: "A",
        }),
      );
      expect(mensagem).toMatch(/causa_obrigatoria_no_treino/);
    });
  });

  it("recusa causa em resposta certa", async () => {
    await comTransacaoRevertida(async (cliente) => {
      await garantirParticao(cliente, new Date());
      const questao = await questaoParaResponder(cliente);
      const mensagem = await recusa(cliente, () =>
        inserirTentativa(cliente, questao, {
          correta: true,
          causa_erro: "chutei",
          causa_origem: "aluno",
        }),
      );
      expect(mensagem).toMatch(/causa_so_com_erro/);
    });
  });

  it("recusa 'faltou_tempo' — esse valor so entra na tabela vizinha (ALUNO-04 AC3)", async () => {
    await comTransacaoRevertida(async (cliente) => {
      await garantirParticao(cliente, new Date());
      const questao = await questaoParaResponder(cliente);
      const mensagem = await recusa(cliente, () =>
        inserirTentativa(cliente, questao, {
          contexto: "simulado",
          correta: false,
          resposta_dada: "A",
          causa_erro: "faltou_tempo",
          causa_origem: "aluno",
        }),
      );
      expect(mensagem).toMatch(/faltou_tempo_so_no_simulado/);
    });
  });

  it("recusa causa sem origem, e origem sem causa", async () => {
    await comTransacaoRevertida(async (cliente) => {
      await garantirParticao(cliente, new Date());
      const questao = await questaoParaResponder(cliente);
      const semOrigem = await recusa(cliente, () =>
        inserirTentativa(cliente, questao, {
          contexto: "treino",
          correta: false,
          resposta_dada: "A",
          causa_erro: "chutei",
          causa_origem: null,
        }),
      );
      expect(semOrigem).toMatch(/causa_origem_acompanha_causa/);

      const semCausa = await recusa(cliente, () =>
        inserirTentativa(cliente, questao, {
          correta: true,
          causa_origem: "aluno",
        }),
      );
      expect(semCausa).toMatch(/causa_origem_acompanha_causa/);
    });
  });

  it("recusa dificuldade fora de 1..5", async () => {
    await comTransacaoRevertida(async (cliente) => {
      await garantirParticao(cliente, new Date());
      const questao = await questaoParaResponder(cliente);
      const mensagem = await recusa(cliente, () =>
        inserirTentativa(cliente, questao, { dificuldade: 7 }),
      );
      expect(mensagem).toMatch(/dificuldade_1_a_5/);
    });
  });
});

descreveComBanco("tentativas — o snapshot congelado (ALUNO-01 AC3)", () => {
  it("reclassificar a questao depois nao desloca a tentativa antiga", async () => {
    await comTransacaoRevertida(async (cliente) => {
      await garantirParticao(cliente, new Date());
      const questao = await questaoParaResponder(cliente);
      const aluno = novoAluno();
      const gravada = await inserirTentativa(cliente, questao, { user_id: aluno });

      // O operador renomeia o topico e o move para outra materia (SPEC 15).
      const { rows: outraMateria } = await cliente.query<{ id: string }>(
        "insert into public.materias (nome) values ($1) returning id",
        [`Materia nova ${Date.now()}`],
      );
      await cliente.query(
        "update public.topicos set nome = $1, materia_id = $2 where id = $3",
        ["Juros Compostos (renomeado)", outraMateria[0].id, questao.topico_id],
      );
      await cliente.query(
        "update public.questoes set topico_id = $1 where id = $2 and questao_versao = $3",
        [questao.topico_id, questao.questao_id, questao.questao_versao],
      );

      const { rows: depois } = await cliente.query<{
        topico_id: string;
        topico_rotulo: string;
        materia_id: string;
        materia_rotulo: string;
      }>(
        `select topico_id, topico_rotulo, materia_id, materia_rotulo
           from public.tentativas where id = $1`,
        [gravada.id],
      );

      expect(depois[0].topico_id).toBe(questao.topico_id);
      expect(depois[0].topico_rotulo).toBe(questao.topico_rotulo);
      expect(depois[0].materia_id).toBe(questao.materia_id);
      expect(depois[0].materia_rotulo).toBe(questao.materia_rotulo);

      // E o presente mudou de verdade — senao o teste passaria por nada ter acontecido.
      const { rows: topicoAgora } = await cliente.query<{ nome: string }>(
        "select nome from public.topicos where id = $1",
        [questao.topico_id],
      );
      expect(topicoAgora[0].nome).toBe("Juros Compostos (renomeado)");
    });
  });
});
