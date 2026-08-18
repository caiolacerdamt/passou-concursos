import { Client } from "pg";
import { expect, it } from "vitest";

import {
  type QuestaoParaResponder,
  inserirTentativa,
  novoAluno,
  questaoParaResponder,
  recusa,
} from "./aluno";
import { comTransacaoRevertida } from "./conexao";
import { descreveComBanco } from "./setup";

/**
 * SPEC 06 · T49 — `recalcula_projecoes()` (ALUNO-02 AC1/AC3/AC4, ALUNO-10 AC1).
 *
 * O teste central desta suite e o **Independent Test da story**: apagar as duas
 * projecoes inteiras, rodar a funcao e obter os mesmos numeros. Se ele passar, a
 * aposta do AD-015 esta de pe — o log cru basta para reconstruir o estado.
 *
 * Toda chamada passa `p_user_id` de proposito: sem ele a funcao recalcula o
 * banco inteiro, e o banco de desenvolvimento e compartilhado.
 */

type Dominio = {
  n_respostas: number;
  n_acertos: number;
  n_chute_certo: number;
  score: string;
};

async function recalcular(cliente: Client, aluno: string): Promise<number> {
  const { rows } = await cliente.query<{ recalcula_projecoes: number }>(
    "select public.recalcula_projecoes($1) as recalcula_projecoes",
    [aluno],
  );
  return rows[0].recalcula_projecoes;
}

async function dominioDe(cliente: Client, aluno: string): Promise<Dominio[]> {
  const { rows } = await cliente.query<Dominio>(
    `select n_respostas, n_acertos, n_chute_certo, score
       from public.dominio_topico where user_id = $1 order by topico_id`,
    [aluno],
  );
  return rows;
}

/** Responde `n` questoes do mesmo topico, com o resultado que o teste pedir. */
async function responder(
  cliente: Client,
  aluno: string,
  questao: QuestaoParaResponder,
  respostas: Array<{ correta: boolean; chute?: boolean; causa?: string }>,
): Promise<void> {
  const sessao = crypto.randomUUID();
  let ordem = 1;
  for (const r of respostas) {
    await inserirTentativa(cliente, questao, {
      user_id: aluno,
      sessao_id: sessao,
      ordem_na_sessao: ordem++,
      correta: r.correta,
      marcou_chute: r.chute ?? false,
      causa_erro: r.causa ?? null,
      causa_origem: r.causa ? "aluno" : null,
      contexto: "treino",
      resposta_dada: r.correta ? "C" : "A",
    });
  }
}

descreveComBanco("recalcula_projecoes — reconstrucao a partir do log (ALUNO-02 AC1)", () => {
  it("apagar as duas projecoes e rodar de novo devolve OS MESMOS numeros", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = novoAluno();
      const questao = await questaoParaResponder(cliente);

      await responder(cliente, aluno, questao, [
        { correta: true },
        { correta: true },
        { correta: false, causa: "errei_a_conta" },
        { correta: false, causa: "nao_sabia_conteudo" },
      ]);

      await recalcular(cliente, aluno);
      const antes = await dominioDe(cliente, aluno);
      const { rows: cadernoAntes } = await cliente.query(
        "select topico_id, causa_erro, n_erros from public.caderno_erros where user_id = $1 order by causa_erro",
        [aluno],
      );
      expect(antes).toHaveLength(1);
      expect(cadernoAntes).toHaveLength(2);

      // O gesto do Independent Test: as projecoes deixam de existir.
      await cliente.query("delete from public.dominio_topico where user_id = $1", [aluno]);
      await cliente.query("delete from public.caderno_erros  where user_id = $1", [aluno]);
      expect(await dominioDe(cliente, aluno)).toHaveLength(0);

      await recalcular(cliente, aluno);

      expect(await dominioDe(cliente, aluno)).toEqual(antes);
      const { rows: cadernoDepois } = await cliente.query(
        "select topico_id, causa_erro, n_erros from public.caderno_erros where user_id = $1 order by causa_erro",
        [aluno],
      );
      expect(cadernoDepois).toEqual(cadernoAntes);
    });
  });

  it("rodar duas vezes seguidas nao muda nada nem duplica linha (AC4)", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = novoAluno();
      const questao = await questaoParaResponder(cliente);
      await responder(cliente, aluno, questao, [
        { correta: true },
        { correta: false, causa: "chutei" },
      ]);

      await recalcular(cliente, aluno);
      const primeira = await dominioDe(cliente, aluno);
      await recalcular(cliente, aluno);
      const segunda = await dominioDe(cliente, aluno);

      expect(segunda).toEqual(primeira);
      expect(segunda).toHaveLength(1);
    });
  });

  it("o aluno sem tentativa nenhuma nao ganha linha de projecao", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = novoAluno();
      expect(await recalcular(cliente, aluno)).toBe(0);
      expect(await dominioDe(cliente, aluno)).toHaveLength(0);
    });
  });
});

descreveComBanco("recalcula_projecoes — as duas exclusoes do AC3", () => {
  it("acerto marcado como chute e descontado do score, e contado a parte", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = novoAluno();
      const questao = await questaoParaResponder(cliente);

      // 4 respostas, 3 certas, mas 2 das certas foram chute.
      await responder(cliente, aluno, questao, [
        { correta: true },
        { correta: true, chute: true },
        { correta: true, chute: true },
        { correta: false, causa: "nao_sei_dizer" },
      ]);

      await recalcular(cliente, aluno);
      const [d] = await dominioDe(cliente, aluno);

      expect(d.n_respostas).toBe(4);
      expect(d.n_acertos).toBe(3);
      expect(d.n_chute_certo).toBe(2);
      // (3 acertos - 2 chutes) / 4 = 0.25, e nao 0.75. Anti-coasting: o placar
      // mostra o que o aluno sabe, nao o que ele sorteou.
      expect(Number(d.score)).toBeCloseTo(0.25, 4);
    });
  });

  it("chutar tudo e acertar tudo da dominio zero, nunca negativo", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = novoAluno();
      const questao = await questaoParaResponder(cliente);
      await responder(cliente, aluno, questao, [
        { correta: true, chute: true },
        { correta: true, chute: true },
      ]);

      await recalcular(cliente, aluno);
      const [d] = await dominioDe(cliente, aluno);
      expect(Number(d.score)).toBe(0);
    });
  });

  it("questao anulada nao entra na conta — nem no dominio, nem no caderno", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = novoAluno();
      const valida = await questaoParaResponder(cliente);
      const anulada = await questaoParaResponder(cliente);

      await responder(cliente, aluno, valida, [{ correta: true }]);
      await responder(cliente, aluno, anulada, [
        { correta: false, causa: "entendi_errado_enunciado" },
      ]);

      // A anulacao acontece **depois** da resposta, que e o caso real: a banca
      // anula, e o historico do aluno nao pode ser punido por isso.
      await cliente.query(
        "update public.questoes set anulada = true where id = $1 and questao_versao = $2",
        [anulada.questao_id, anulada.questao_versao],
      );

      await recalcular(cliente, aluno);

      const dominio = await dominioDe(cliente, aluno);
      expect(dominio).toHaveLength(1);
      expect(dominio[0].n_respostas).toBe(1);

      const { rows: caderno } = await cliente.query(
        "select 1 from public.caderno_erros where user_id = $1",
        [aluno],
      );
      expect(caderno).toHaveLength(0);
    });
  });
});

descreveComBanco("recalcula_projecoes — caderno de erros (ALUNO-10 AC1)", () => {
  it("agrupa por topico E por causa, e nao conta acerto", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = novoAluno();
      const q1 = await questaoParaResponder(cliente);
      const q2 = await questaoParaResponder(cliente);

      await responder(cliente, aluno, q1, [
        { correta: false, causa: "errei_a_conta" },
        { correta: false, causa: "errei_a_conta" },
        { correta: false, causa: "confundi_conceitos" },
        { correta: true },
      ]);
      await responder(cliente, aluno, q2, [{ correta: false, causa: "errei_a_conta" }]);

      await recalcular(cliente, aluno);

      const { rows } = await cliente.query<{
        topico_id: string;
        causa_erro: string;
        n_erros: number;
      }>(
        `select topico_id, causa_erro, n_erros from public.caderno_erros
          where user_id = $1 order by causa_erro, topico_id`,
        [aluno],
      );

      // 3 linhas: (t1, errei_a_conta)=2, (t1, confundi)=1, (t2, errei_a_conta)=1.
      // O mesmo par causa+topico soma; topico diferente e linha diferente.
      expect(rows).toHaveLength(3);
      const contagem = Object.fromEntries(
        rows.map((l) => [`${l.topico_id}|${l.causa_erro}`, Number(l.n_erros)]),
      );
      expect(contagem[`${q1.topico_id}|errei_a_conta`]).toBe(2);
      expect(contagem[`${q1.topico_id}|confundi_conceitos`]).toBe(1);
      expect(contagem[`${q2.topico_id}|errei_a_conta`]).toBe(1);
    });
  });

  it("a causa declarada na revisao pos-prova tambem vira caderno (ALUNO-04 AC3)", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = novoAluno();
      const questao = await questaoParaResponder(cliente);

      // Simulado: a prova nao e interrompida, entao a tentativa nasce SEM causa.
      const t = await inserirTentativa(cliente, questao, {
        user_id: aluno,
        contexto: "simulado",
        correta: false,
        resposta_dada: "A",
      });
      await cliente.query(
        `insert into public.tentativa_causa_simulado
           (tentativa_id, respondida_em, user_id, causa_erro)
         values ($1, $2, $3, 'faltou_tempo')`,
        [t.id, t.respondida_em, aluno],
      );

      await recalcular(cliente, aluno);

      const { rows } = await cliente.query<{ causa_erro: string; n_erros: number }>(
        "select causa_erro, n_erros from public.caderno_erros where user_id = $1",
        [aluno],
      );
      // Sem esta uniao o caderno perderia todo erro de simulado — e `faltou_tempo`
      // nunca apareceria, porque `tentativas` recusa esse valor por CHECK.
      expect(rows).toHaveLength(1);
      expect(rows[0].causa_erro).toBe("faltou_tempo");
      expect(Number(rows[0].n_erros)).toBe(1);
    });
  });
});

descreveComBanco("recalcula_projecoes — reentrancia e falha (AC4)", () => {
  it("com o lock ja tomado por OUTRA sessao devolve -1, sem levantar erro", async () => {
    // Duas conexoes de verdade: uma segura o lock, a outra e o job da madrugada
    // chegando por cima do disparo anterior. Com uma conexao so o teste nao
    // provaria nada — `pg_try_advisory_xact_lock` e reentrante para a mesma
    // sessao e devolveria `true`.
    const segurando = new Client({ connectionString: process.env.DATABASE_URL });
    await segurando.connect();
    try {
      await segurando.query("begin");
      await segurando.query("select pg_advisory_xact_lock(8406, 1)");

      await comTransacaoRevertida(async (cliente) => {
        expect(await recalcular(cliente, novoAluno())).toBe(-1);
      });
    } finally {
      await segurando.query("rollback");
      await segurando.end();
    }
  });

  it("falha no meio deixa a projecao anterior INTACTA, nao corrompida", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const aluno = novoAluno();
      const questao = await questaoParaResponder(cliente);
      await responder(cliente, aluno, questao, [
        { correta: true },
        { correta: false, causa: "errei_a_conta" },
      ]);

      await recalcular(cliente, aluno);
      const bom = await dominioDe(cliente, aluno);
      expect(bom).toHaveLength(1);

      // Sabota a segunda metade da funcao (o caderno), depois de a primeira
      // metade (o dominio) ja ter apagado e reinserido. `not valid` para a
      // constraint valer so nas linhas novas. Se a funcao nao fosse
      // atomica, o dominio ficaria gravado e o caderno vazio — corrompido.
      await cliente.query(
        "alter table public.caderno_erros add constraint sabotagem check (n_erros < 0) not valid",
      );

      await recusa(
        cliente,
        () => recalcular(cliente, aluno),
        /sabotagem/,
      );

      // O `recusa` volta ao savepoint: o recalculo abortado desaparece inteiro,
      // e os numeros de antes continuam la. A constraint de sabotagem sobrevive
      // ao savepoint e some no rollback da transacao do teste.
      expect(await dominioDe(cliente, aluno)).toEqual(bom);
      const { rows: caderno } = await cliente.query(
        "select n_erros from public.caderno_erros where user_id = $1",
        [aluno],
      );
      expect(caderno).toHaveLength(1);
    });
  });
});
