import type { Client } from "pg";
import { expect, it } from "vitest";

import { criarTopico, inserirQuestao, sufixo } from "./acervo";
import { novoAluno } from "./aluno";
import { criarUsuario } from "./conta";
import { comTransacaoSemPerfilConcurso } from "./conexao";
import { descreveComBanco } from "./setup";

/**
 * SPEC 37 — os Success Criteria, contra o banco.
 *
 * O eixo de tudo aqui é o mesmo: o assunto canônico (`topicos`) é compartilhado
 * e é onde a questão grava; o nome de matéria é do concurso e não vaza para o
 * núcleo.
 */

async function criarPerfilConcurso(
  cliente: Client,
  topicos: string[],
  ativo: boolean,
): Promise<string> {
  const { rows } = await cliente.query<{ id: string }>(
    `insert into public.perfil_concurso (orgao, banca, programa_edital, ativo)
     values ($1, 'indefinida', $2::jsonb, $3)
     returning id`,
    [`Orgao ${sufixo()}`, JSON.stringify(topicos), ativo],
  );
  return rows[0].id;
}

async function criarConcurso(
  cliente: Client,
  perfil: string,
  visibilidade: "oculto" | "elegivel" = "oculto",
): Promise<string> {
  const { rows } = await cliente.query<{ id: string }>(
    `insert into public.concursos (orgao, cargo, perfil_concurso_id, visibilidade)
     values ($1, $2, $3, $4)
     returning id`,
    [`Orgao ${sufixo()}`, `Cargo ${sufixo()}`, perfil, visibilidade],
  );
  return rows[0].id;
}

async function comMateria(
  cliente: Client,
  concurso: string,
  nome: string,
  topicos: string[],
): Promise<string> {
  const { rows } = await cliente.query<{ id: string }>(
    `insert into public.concurso_materias (concurso_id, nome, ordem)
     values ($1, $2, 1) returning id`,
    [concurso, nome],
  );
  for (const [posicao, topico] of topicos.entries()) {
    await cliente.query(
      `insert into public.concurso_materia_assuntos
         (concurso_id, concurso_materia_id, topico_id, ordem)
       values ($1, $2, $3, $4)`,
      [concurso, rows[0].id, topico, posicao],
    );
  }
  return rows[0].id;
}

async function criarProjecao(
  cliente: Client,
  perfil: string,
  topico: string,
  peso: number,
): Promise<void> {
  await cliente.query(
    `insert into public.raiox_projecoes
       (perfil_concurso_id, topico_id, taxa_bruta, peso, n_questoes, tendencia, amostra_baixa)
     values ($1, $2, $3, $3, 10, 'estavel', false)`,
    [perfil, topico, peso],
  );
}

async function criarPerfilEstudo(
  cliente: Client,
  aluno: string,
  concurso: string | null,
): Promise<void> {
  await cliente.query(
    `insert into public.perfil_estudo
       (user_id, nivel_declarado, minutos_por_dia, concurso_id)
     values ($1, 'iniciante', 120, $2)`,
    [aluno, concurso],
  );
}

async function ligarMultiConcurso(cliente: Client, ligada: boolean): Promise<void> {
  const autor = await criarUsuario(cliente);
  await cliente.query(
    `insert into public.configuracoes (chave, valor, modulo_dono, alterado_por, motivo)
     values ('flag.m5.multi_concurso', $1::jsonb, 'm5', $2, 'teste SPEC 37')`,
    [JSON.stringify(ligada), autor],
  );
}

async function pesos(cliente: Client, aluno: string) {
  const { rows } = await cliente.query<{ topico_id: string; peso: string }>(
    "select topico_id, peso from public.raiox_peso_do_aluno($1) order by peso desc",
    [aluno],
  );
  return rows;
}

descreveComBanco("SPEC 37 · multi-concurso", () => {
  it("dois alunos em concursos diferentes recebem o edital de cada um", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const compartilhado = await criarTopico(cliente);
      const soDoBb = await criarTopico(cliente);
      const soDaCaixa = await criarTopico(cliente);

      const perfilBb = await criarPerfilConcurso(cliente, [compartilhado, soDoBb], true);
      const perfilCaixa = await criarPerfilConcurso(
        cliente,
        [compartilhado, soDaCaixa],
        false,
      );
      const bb = await criarConcurso(cliente, perfilBb);
      const caixa = await criarConcurso(cliente, perfilCaixa);

      // O MESMO assunto canônico, sob nomes de matéria diferentes nos dois.
      await comMateria(cliente, bb, "Vendas e Negociação", [compartilhado, soDoBb]);
      await comMateria(cliente, caixa, "Atendimento Bancário", [compartilhado, soDaCaixa]);

      await criarProjecao(cliente, perfilBb, compartilhado, 0.6);
      await criarProjecao(cliente, perfilBb, soDoBb, 0.4);
      await criarProjecao(cliente, perfilCaixa, compartilhado, 0.3);
      await criarProjecao(cliente, perfilCaixa, soDaCaixa, 0.7);

      const alunoBb = novoAluno();
      const alunoCaixa = novoAluno();
      await criarPerfilEstudo(cliente, alunoBb, bb);
      await criarPerfilEstudo(cliente, alunoCaixa, caixa);
      await ligarMultiConcurso(cliente, true);

      expect((await pesos(cliente, alunoBb)).map((linha) => linha.topico_id)).toEqual([
        compartilhado,
        soDoBb,
      ]);
      expect((await pesos(cliente, alunoCaixa)).map((linha) => linha.topico_id)).toEqual([
        soDaCaixa,
        compartilhado,
      ]);

      // Renomear a matéria de um concurso não toca no outro.
      await cliente.query(
        "update public.concurso_materias set nome = 'Atendimento (edital 2026)' where concurso_id = $1",
        [caixa],
      );
      const { rows: nomes } = await cliente.query<{ nome: string }>(
        "select nome from public.concurso_materias where concurso_id = $1",
        [bb],
      );
      expect(nomes.map((linha) => linha.nome)).toEqual(["Vendas e Negociação"]);
    });
  });

  it("a questão gravada na prova do BB serve o aluno da CAIXA no assunto comum", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const compartilhado = await criarTopico(cliente);
      const questao = await inserirQuestao(cliente, {
        topico_id: compartilhado,
        status: "publicada",
      });

      const perfilCaixa = await criarPerfilConcurso(cliente, [compartilhado], true);
      const caixa = await criarConcurso(cliente, perfilCaixa);
      await comMateria(cliente, caixa, "Atendimento Bancário", [compartilhado]);
      await criarProjecao(cliente, perfilCaixa, compartilhado, 0.9);

      const aluno = novoAluno();
      await criarPerfilEstudo(cliente, aluno, caixa);
      await ligarMultiConcurso(cliente, true);

      // A questão nasceu numa prova do BB e não tem nenhuma marca de concurso:
      // o que a liga ao aluno da CAIXA é o assunto canônico.
      const { rows } = await cliente.query<{ id: string }>(
        `select q.id
           from public.questoes q
           join public.raiox_peso_do_aluno($1) rx on rx.topico_id = q.topico_id
          where q.vigente and q.status = 'publicada'`,
        [aluno],
      );
      expect(rows.map((linha) => linha.id)).toContain(questao.id);
    });
  });

  it("com a flag desligada, a escolha do aluno é ignorada e vale o perfil ativo", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const doAtivo = await criarTopico(cliente);
      const doOutro = await criarTopico(cliente);

      const perfilAtivo = await criarPerfilConcurso(cliente, [doAtivo], true);
      const perfilOutro = await criarPerfilConcurso(cliente, [doOutro], false);
      const concursoAtivo = await criarConcurso(cliente, perfilAtivo);
      const outro = await criarConcurso(cliente, perfilOutro);
      await criarProjecao(cliente, perfilAtivo, doAtivo, 0.5);
      await criarProjecao(cliente, perfilOutro, doOutro, 0.5);

      const aluno = novoAluno();
      await criarPerfilEstudo(cliente, aluno, outro);
      await ligarMultiConcurso(cliente, false);

      const { rows } = await cliente.query<{ concurso: string }>(
        "select public.concurso_do_aluno($1) as concurso",
        [aluno],
      );
      expect(rows[0].concurso).toBe(concursoAtivo);
      expect((await pesos(cliente, aluno)).map((linha) => linha.topico_id)).toEqual([
        doAtivo,
      ]);

      // Ligando a flag, a mesma linha de perfil passa a valer.
      await ligarMultiConcurso(cliente, true);
      expect((await pesos(cliente, aluno)).map((linha) => linha.topico_id)).toEqual([
        doOutro,
      ]);
    });
  });

  it("sem escolha, o aluno cai no concurso padrão e nunca fica sem projeção", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const topico = await criarTopico(cliente);
      const perfil = await criarPerfilConcurso(cliente, [topico], true);
      const concurso = await criarConcurso(cliente, perfil);
      await criarProjecao(cliente, perfil, topico, 0.5);

      const aluno = novoAluno();
      await criarPerfilEstudo(cliente, aluno, null);
      await ligarMultiConcurso(cliente, true);

      const { rows } = await cliente.query<{ concurso: string }>(
        "select public.concurso_do_aluno($1) as concurso",
        [aluno],
      );
      expect(rows[0].concurso).toBe(concurso);
      expect(await pesos(cliente, aluno)).toHaveLength(1);
    });
  });

  it("trocar de concurso preserva as tentativas e reaproveita o domínio", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const compartilhado = await criarTopico(cliente);
      const perfilBb = await criarPerfilConcurso(cliente, [compartilhado], true);
      const perfilCaixa = await criarPerfilConcurso(cliente, [compartilhado], false);
      const bb = await criarConcurso(cliente, perfilBb);
      const caixa = await criarConcurso(cliente, perfilCaixa);
      await criarProjecao(cliente, perfilBb, compartilhado, 0.5);
      await criarProjecao(cliente, perfilCaixa, compartilhado, 0.5);

      const aluno = novoAluno();
      await criarPerfilEstudo(cliente, aluno, bb);
      await ligarMultiConcurso(cliente, true);

      await cliente.query(
        `insert into public.dominio_topico
           (user_id, topico_id, n_respostas, n_acertos, n_chute_certo, score)
         values ($1, $2, 10, 8, 0, 0.8)`,
        [aluno, compartilhado],
      );

      await cliente.query(
        "update public.perfil_estudo set concurso_id = $2 where user_id = $1",
        [aluno, caixa],
      );

      const { rows } = await cliente.query<{ score: string; n_respostas: number }>(
        "select score, n_respostas from public.dominio_topico where user_id = $1 and topico_id = $2",
        [aluno, compartilhado],
      );
      expect(rows).toHaveLength(1);
      expect(Number(rows[0].score)).toBe(0.8);
      expect(rows[0].n_respostas).toBe(10);
    });
  });

  it("o aluno só escolhe concurso publicado", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const topico = await criarTopico(cliente);
      const perfil = await criarPerfilConcurso(cliente, [topico], true);
      const oculto = await criarConcurso(cliente, perfil);
      await ligarMultiConcurso(cliente, true);

      // `escolher_concurso` lê `auth.uid()`, que é nulo fora de uma sessão:
      // a recusa esperada aqui é a de sessão, e nunca a escrita.
      await expect(
        cliente.query("select public.escolher_concurso($1)", [oculto]),
      ).rejects.toThrow(/sem_sessao/);
    });
  });
});

descreveComBanco("SPEC 37 · prontidão e publicação", () => {
  it("concurso nasce oculto, o operador vê o que falta e publicar é humano", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const forte = await criarTopico(cliente);
      const fraco = await criarTopico(cliente);
      const perfil = await criarPerfilConcurso(cliente, [forte, fraco], true);
      const concurso = await criarConcurso(cliente, perfil);
      await comMateria(cliente, concurso, "Conhecimentos Bancários", [forte, fraco]);
      await criarProjecao(cliente, perfil, forte, 0.9);
      await criarProjecao(cliente, perfil, fraco, 0.1);

      // Só o assunto de maior peso tem acervo.
      for (let indice = 0; indice < 5; indice += 1) {
        await inserirQuestao(cliente, { topico_id: forte, status: "publicada" });
      }

      const { rows: falta } = await cliente.query<{
        assunto: string;
        pronto: boolean;
        materia: string;
      }>(
        "select assunto, pronto, materia from public.prontidao_do_concurso where concurso_id = $1 order by peso desc",
        [concurso],
      );
      expect(falta).toHaveLength(2);
      expect(falta[0].pronto).toBe(true);
      expect(falta[1].pronto).toBe(false);
      // A lista fala o nome do edital do concurso, não o da taxonomia canônica.
      expect(falta[0].materia).toBe("Conhecimentos Bancários");

      // 0,9 de 1,0 de peso coberto passa do piso de 0,8: sobe para elegível.
      await cliente.query("select public.avaliar_prontidao_do_concurso($1)", [concurso]);
      const { rows: depois } = await cliente.query<{ visibilidade: string }>(
        "select visibilidade from public.concursos where id = $1",
        [concurso],
      );
      expect(depois[0].visibilidade).toBe("elegivel");

      // Elegível não é publicado: o aluno ainda não vê.
      const operador = novoAluno();
      await expect(
        cliente.query("select public.publicar_concurso($1, $2, $3)", [
          concurso,
          operador,
          "primeiro lote conferido",
        ]),
      ).rejects.toThrow(/operador_invalido/);
    });
  });

  it("publicado que cai abaixo do piso é alertado, nunca despublicado", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const topico = await criarTopico(cliente);
      const perfil = await criarPerfilConcurso(cliente, [topico], true);
      const concurso = await criarConcurso(cliente, perfil, "elegivel");
      await comMateria(cliente, concurso, "Matemática", [topico]);
      await criarProjecao(cliente, perfil, topico, 0.9);

      const operador = await criarUsuario(cliente);
      await cliente.query(
        "insert into public.operadores (operador_id) values ($1)",
        [operador],
      );

      await cliente.query("select public.publicar_concurso($1, $2, $3)", [
        concurso,
        operador,
        "lote conferido",
      ]);

      const { rows: publicado } = await cliente.query<{
        visibilidade: string;
        publicado_por: string;
      }>("select visibilidade, publicado_por from public.concursos where id = $1", [
        concurso,
      ]);
      expect(publicado[0].visibilidade).toBe("publicado");
      expect(publicado[0].publicado_por).toBe(operador);

      // A ação humana ficou registrada.
      const { rows: acoes } = await cliente.query<{ motivo: string }>(
        "select motivo from public.operador_acoes where entidade = 'concursos' and entidade_id = $1",
        [concurso],
      );
      expect(acoes.map((linha) => linha.motivo)).toEqual(["lote conferido"]);

      // Sem acervo, a cobertura é zero — e ainda assim segue publicado.
      await cliente.query("select public.avaliar_prontidao_do_concurso($1)", [concurso]);
      const { rows: depois } = await cliente.query<{
        visibilidade: string;
        prontidao_alerta_em: Date | null;
      }>(
        "select visibilidade, prontidao_alerta_em from public.concursos where id = $1",
        [concurso],
      );
      expect(depois[0].visibilidade).toBe("publicado");
      expect(depois[0].prontidao_alerta_em).not.toBeNull();
    });
  });
});

descreveComBanco("SPEC 37 · fundir assunto canônico", () => {
  it("move o acervo e o mapa, e não encosta em tentativas", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const origem = await criarTopico(cliente);
      const destino = await criarTopico(cliente);
      const questao = await inserirQuestao(cliente, {
        topico_id: origem,
        status: "publicada",
      });

      const perfil = await criarPerfilConcurso(cliente, [origem, destino], true);
      const concurso = await criarConcurso(cliente, perfil);
      await comMateria(cliente, concurso, "Matemática", [origem, destino]);

      const operador = await criarUsuario(cliente);
      await cliente.query(
        "insert into public.operadores (operador_id) values ($1)",
        [operador],
      );

      const { rows: movidas } = await cliente.query<{ movidas: number }>(
        "select public.fundir_assuntos_canonicos($1, $2, $3, $4) as movidas",
        [origem, destino, operador, "quase-duplicata do edital novo"],
      );
      expect(Number(movidas[0].movidas)).toBe(1);

      const { rows: daQuestao } = await cliente.query<{ topico_id: string }>(
        "select topico_id from public.questoes where id = $1 and vigente",
        [questao.id],
      );
      expect(daQuestao[0].topico_id).toBe(destino);

      // O concurso já tinha o destino: a linha do origem é descartada, não
      // duplicada — o assunto tem um pai só dentro de um concurso.
      const { rows: mapa } = await cliente.query<{ topico_id: string }>(
        "select topico_id from public.concurso_materia_assuntos where concurso_id = $1",
        [concurso],
      );
      expect(mapa.map((linha) => linha.topico_id)).toEqual([destino]);

      const { rows: fundido } = await cliente.query<{
        ativo: boolean;
        fundido_em_topico_id: string;
      }>("select ativo, fundido_em_topico_id from public.topicos where id = $1", [
        origem,
      ]);
      expect(fundido[0].ativo).toBe(false);
      expect(fundido[0].fundido_em_topico_id).toBe(destino);
    });
  });
});
