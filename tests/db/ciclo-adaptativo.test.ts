import type { Client } from "pg";
import { expect, it } from "vitest";

import { criarProva, inserirQuestao, sufixo } from "./acervo";
import { comoAluno, criarSessao, novoAluno, recusa } from "./aluno";
import { comTransacaoSemPerfilConcurso } from "./conexao";
import { descreveComBanco } from "./setup";

const SEGUNDA = "2026-08-24";
const DOMINGO = "2026-08-23";
const QUARTA = "2026-08-26";
const SEGUNDA_SEGUINTE = "2026-08-31";

type Bloco = {
  id: string;
  tipo: string;
  nivel: string;
  ordem: number;
  topico_id: string | null;
  n_questoes: number;
  n_questoes_cheias: number;
  minutos_estimados: number;
  ajuste_usuario: boolean;
};

async function topicoPublicado(
  cliente: Client,
  materiaId?: string,
): Promise<{ topico: string; materia: string }> {
  const materia = materiaId
    ? { id: materiaId }
    : (
        await cliente.query<{ id: string }>(
          "insert into public.materias (nome) values ($1) returning id",
          [`Materia ${sufixo()}`],
        )
      ).rows[0];
  const topico = await criarTopicoComMateria(cliente, materia.id);
  await inserirQuestao(cliente, {
    topico_id: topico,
    prova_id: await criarProva(cliente),
    status: "publicada",
  });
  return { topico, materia: materia.id };
}

async function criarTopicoComMateria(cliente: Client, materiaId: string): Promise<string> {
  const { rows } = await cliente.query<{ id: string }>(
    "insert into public.topicos (materia_id, nome) values ($1, $2) returning id",
    [materiaId, `Topico ${sufixo()}`],
  );
  return rows[0].id;
}

async function topicosDaMateria(cliente: Client, quantidade: number): Promise<string[]> {
  const { rows: materia } = await cliente.query<{ id: string }>(
    "insert into public.materias (nome) values ($1) returning id",
    [`Materia ${sufixo()}`],
  );
  const topicos: string[] = [];
  for (let indice = 0; indice < quantidade; indice += 1) {
    const topico = await criarTopicoComMateria(cliente, materia[0].id);
    await inserirQuestao(cliente, {
      topico_id: topico,
      prova_id: await criarProva(cliente),
      status: "publicada",
    });
    topicos.push(topico);
  }
  return topicos;
}

async function criarPerfil(
  cliente: Client,
  aluno: string,
  minutos = 120,
  dias: number[] | null = null,
): Promise<void> {
  await cliente.query(
    `insert into public.perfil_estudo
       (user_id, nivel_declarado, minutos_por_dia, dias_estudo)
     values ($1, 'iniciante', $2, $3::smallint[])`,
    [aluno, minutos, dias],
  );
}

async function gerar(cliente: Client, aluno: string, data: string): Promise<number> {
  const { rows } = await cliente.query<{ gera_plano_do_dia: number | string }>(
    "select public.gera_plano_do_dia($1, $2::date) as gera_plano_do_dia",
    [aluno, data],
  );
  return Number(rows[0].gera_plano_do_dia);
}

async function blocosDe(cliente: Client, aluno: string, data: string): Promise<Bloco[]> {
  const { rows } = await cliente.query<Bloco>(
    `select b.id, b.tipo, b.nivel, b.ordem, b.topico_id,
            b.n_questoes, b.n_questoes_cheias, b.minutos_estimados,
            b.ajuste_usuario
       from public.plano_bloco b
       join public.plano_dia p on p.id = b.plano_dia_id
      where p.user_id = $1 and p.data = $2
      order by b.nivel, b.ordem`,
    [aluno, data],
  );
  return rows;
}

async function planoIdDe(cliente: Client, aluno: string, data: string): Promise<string> {
  const { rows } = await cliente.query<{ id: string }>(
    "select id from public.plano_dia where user_id = $1 and data = $2",
    [aluno, data],
  );
  return rows[0].id;
}

async function criarPerfilConcurso(
  cliente: Client,
  programa: string[],
  pesos: Array<{ topico: string; peso: number }> = [],
): Promise<void> {
  const { rows } = await cliente.query<{ id: string }>(
    `insert into public.perfil_concurso
       (orgao, banca, programa_edital, ativo)
     values ('Banco do Brasil', 'Cesgranrio', $1::jsonb, true)
     returning id`,
    [JSON.stringify(programa)],
  );
  for (const linha of pesos) {
    await cliente.query(
      `insert into public.raiox_projecoes
         (perfil_concurso_id, topico_id, taxa_bruta, peso, n_questoes, tendencia, amostra_baixa)
       values ($1, $2, $3, $3, 10, 'estavel', false)`,
      [rows[0].id, linha.topico, linha.peso],
    );
  }
}

async function marcarDominio(
  cliente: Client,
  aluno: string,
  topico: string,
  score: number,
): Promise<void> {
  await cliente.query(
    `insert into public.dominio_topico
       (user_id, topico_id, n_respostas, n_acertos, n_chute_certo, score)
     values ($1, $2, 10, 5, 0, $3)`,
    [aluno, topico, score],
  );
}

async function marcarRevisao(
  cliente: Client,
  aluno: string,
  topico: string,
  data = SEGUNDA,
): Promise<void> {
  await cliente.query(
    "insert into public.revisao_agenda (user_id, topico_id, due) values ($1, $2, $3::date)",
    [aluno, topico, data],
  );
}

descreveComBanco("ciclo adaptativo W2-A", () => {
  it("gera somente em dias declarados e mantém o fallback legado", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const aluno = novoAluno();
      await topicoPublicado(cliente);
      await criarPerfil(cliente, aluno, 60, [1]);

      expect(await gerar(cliente, aluno, DOMINGO)).toBe(0);
      expect(await blocosDe(cliente, aluno, DOMINGO)).toHaveLength(0);
      expect(await gerar(cliente, aluno, SEGUNDA)).toBe(1);
      expect((await blocosDe(cliente, aluno, SEGUNDA)).length).toBeGreaterThan(0);
    });
  });

  it("usa o programa do perfil ativo como porteiro do universo", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const aluno = novoAluno();
      const dentro = await topicoPublicado(cliente);
      const fora = await topicoPublicado(cliente);
      await criarPerfil(cliente, aluno, 120);
      await criarPerfilConcurso(cliente, [dentro.topico, fora.topico], [
        { topico: dentro.topico, peso: 0.2 },
        { topico: fora.topico, peso: 0.8 },
      ]);

      // O segundo perfil representa a fronteira: retirar o tópico do edital
      // não pode ser compensado por uma projeção que ainda exista.
      await cliente.query(
        "update public.perfil_concurso set programa_edital = $1::jsonb",
        [JSON.stringify([dentro.topico])],
      );
      await gerar(cliente, aluno, SEGUNDA);
      expect((await blocosDe(cliente, aluno, SEGUNDA)).map((b) => b.topico_id)).not.toContain(
        fora.topico,
      );
      expect((await blocosDe(cliente, aluno, SEGUNDA)).map((b) => b.topico_id)).toContain(
        dentro.topico,
      );
    });
  });

  it("prioriza cobertura virgem na matéria e nunca rotula virgem como treino", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const aluno = novoAluno();
      const topicos = await topicosDaMateria(cliente, 5);
      for (const topico of topicos.slice(1)) await marcarDominio(cliente, aluno, topico, 0.1);
      await criarPerfil(cliente, aluno, 120);

      await gerar(cliente, aluno, SEGUNDA);
      const blocos = await blocosDe(cliente, aluno, SEGUNDA);
      expect(blocos.find((b) => b.tipo === "avancar")?.topico_id).toBe(topicos[0]);
      expect(
        blocos.filter((b) => b.tipo === "treinar").every((b) => b.topico_id !== topicos[0]),
      ).toBe(true);
    });
  });

  it("limita revisão e reserva avanço quando há capacidade, inclusive no único slot", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const aluno = novoAluno();
      const revisao = await topicoPublicado(cliente);
      const novo = await topicoPublicado(cliente);
      await criarPerfil(cliente, aluno, 40);
      await marcarRevisao(cliente, aluno, revisao.topico);

      await gerar(cliente, aluno, SEGUNDA);
      const meta = (await blocosDe(cliente, aluno, SEGUNDA)).filter(
        (b) => b.nivel === "meta_cheia",
      );
      expect(meta.map((b) => b.tipo)).toEqual(expect.arrayContaining(["revisar", "avancar"]));
      expect(meta.some((b) => b.topico_id === novo.topico && b.tipo === "avancar")).toBe(true);
      expect(meta.reduce((total, bloco) => total + bloco.minutos_estimados, 0)).toBeLessThanOrEqual(40);

      const curto = novoAluno();
      await criarPerfil(cliente, curto, 20);
      await marcarRevisao(cliente, curto, revisao.topico);
      await gerar(cliente, curto, SEGUNDA);
      const metaCurta = (await blocosDe(cliente, curto, SEGUNDA)).filter(
        (b) => b.nivel === "meta_cheia",
      );
      expect(metaCurta).toHaveLength(1);
      expect(metaCurta[0].tipo).toBe("avancar");
    });
  });

  it("exige permutação própria/completa e não deixa reordenação parcial", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const aluno = novoAluno();
      const outroAluno = novoAluno();
      await topicosDaMateria(cliente, 5);
      await criarPerfil(cliente, aluno, 120);
      await criarPerfil(cliente, outroAluno, 120);
      await gerar(cliente, aluno, SEGUNDA);
      await gerar(cliente, outroAluno, SEGUNDA);

      const plano = await planoIdDe(cliente, aluno, SEGUNDA);
      const proprios = (await blocosDe(cliente, aluno, SEGUNDA)).filter(
        (b) => b.nivel === "meta_cheia",
      );
      const alheio = (await blocosDe(cliente, outroAluno, SEGUNDA)).find(
        (b) => b.nivel === "meta_cheia",
      );
      expect(proprios.length).toBeGreaterThan(1);
      await comoAluno(cliente, aluno, async () => {
        const invertidos = proprios.map((b) => b.id).reverse();
        await cliente.query(
          "select public.reordenar_plano_do_dia($1, 'meta_cheia'::public.plano_nivel, $2::uuid[])",
          [plano, invertidos],
        );
        const depois = await blocosDe(cliente, aluno, SEGUNDA);
        expect(depois.filter((b) => b.nivel === "meta_cheia").map((b) => b.id)).toEqual(
          invertidos,
        );

        const sessaoConcluida = await criarSessao(cliente, aluno, "plano");
        await cliente.query(
          `update public.sessoes
              set plano_dia_id = $1, plano_bloco_id = $2, encerrada_em = now()
            where id = $3`,
          [plano, proprios[0].id, sessaoConcluida],
        );
        const antesDaConclusao = await blocosDe(cliente, aluno, SEGUNDA);
        await recusa(
          cliente,
          () =>
            cliente.query(
              "select public.reordenar_plano_do_dia($1, 'meta_cheia'::public.plano_nivel, $2::uuid[])",
              [plano, invertidos],
            ),
          /permutacao_invalida/,
        );
        expect(await blocosDe(cliente, aluno, SEGUNDA)).toEqual(antesDaConclusao);

        await recusa(
          cliente,
          () =>
            cliente.query(
              "select public.reordenar_plano_do_dia($1, 'meta_cheia'::public.plano_nivel, $2::uuid[])",
              [plano, invertidos.slice(1)],
            ),
          /permutacao_invalida/,
        );
        await recusa(
          cliente,
          () =>
            cliente.query(
              "select public.reordenar_plano_do_dia($1, 'meta_cheia'::public.plano_nivel, $2::uuid[])",
              [plano, [...invertidos.slice(0, -1), alheio!.id]],
            ),
          /permutacao_invalida/,
        );
      });
    });
  });

  it("mantém a versão curta idempotente e acima de um", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const aluno = novoAluno();
      await topicoPublicado(cliente);
      await criarPerfil(cliente, aluno, 60);
      await gerar(cliente, aluno, SEGUNDA);
      const bloco = (await blocosDe(cliente, aluno, SEGUNDA)).find(
        (linha) => linha.nivel === "meta_cheia",
      );
      expect(bloco).toBeDefined();
      const identidadeAntes = {
        tipo: bloco?.tipo,
        topico_id: bloco?.topico_id,
      };

      await comoAluno(cliente, aluno, async () => {
        const primeira = await cliente.query<{ n_questoes: number; minutos_estimados: number }>(
          "select * from public.encurtar_plano_bloco($1)",
          [bloco?.id],
        );
        const segunda = await cliente.query<{ n_questoes: number; minutos_estimados: number }>(
          "select * from public.encurtar_plano_bloco($1)",
          [bloco?.id],
        );
        expect(segunda.rows[0]).toEqual(primeira.rows[0]);
        expect(segunda.rows[0].n_questoes).toBeGreaterThanOrEqual(1);
        expect(segunda.rows[0].minutos_estimados).toBeGreaterThanOrEqual(1);
        const depois = (await blocosDe(cliente, aluno, SEGUNDA)).find(
          (linha) => linha.id === bloco?.id,
        );
        expect({ tipo: depois?.tipo, topico_id: depois?.topico_id }).toEqual(identidadeAntes);
        expect(depois?.ajuste_usuario).toBe(true);
      });
    });
  });

  it("adia para o primeiro dia declarado com capacidade disponível", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const aluno = novoAluno();
      await topicoPublicado(cliente);
      const cheio = await topicoPublicado(cliente);
      await criarPerfil(cliente, aluno, 120, [1, 3]);
      await gerar(cliente, aluno, SEGUNDA);
      const bloco = (await blocosDe(cliente, aluno, SEGUNDA)).find(
        (linha) => linha.nivel === "meta_cheia",
      );
      expect(bloco).toBeDefined();

      const { rows: planoQuarta } = await cliente.query<{ id: string }>(
        "insert into public.plano_dia (user_id, data) values ($1, $2) returning id",
        [aluno, QUARTA],
      );
      await cliente.query(
        `insert into public.plano_bloco
           (plano_dia_id, tipo, nivel, ordem, topico_id, n_questoes,
            n_questoes_cheias, minutos_estimados, minutos_estimados_cheios,
            motivo, ajuste_usuario)
         values ($1, 'avancar', 'meta_cheia', 1, $2, 60, 60, 120, 120,
                 'ajuste existente', true)`,
        [planoQuarta[0].id, cheio.topico],
      );

      await comoAluno(cliente, aluno, async () => {
        const { rows } = await cliente.query<{ adiar_plano_bloco: string }>(
          "select public.adiar_plano_bloco($1) as adiar_plano_bloco",
          [bloco?.id],
        );
        expect(rows[0].adiar_plano_bloco).toBe(SEGUNDA_SEGUINTE);
      });
    });
  });

  it("regenerar preserva ajuste e sessão sem duplicar nem exceder capacidade", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const aluno = novoAluno();
      await topicosDaMateria(cliente, 3);
      await criarPerfil(cliente, aluno, 40);
      await gerar(cliente, aluno, SEGUNDA);
      const antes = (await blocosDe(cliente, aluno, SEGUNDA)).filter(
        (b) => b.nivel === "meta_cheia",
      );
      expect(antes.length).toBe(2);
      await cliente.query(
        `update public.plano_bloco
            set n_questoes = 1, minutos_estimados = 1, ajuste_usuario = true
          where id = $1`,
        [antes[0].id],
      );
      const sessao = await criarSessao(cliente, aluno, "plano");
      await cliente.query(
        "update public.sessoes set plano_dia_id = $1, plano_bloco_id = $2 where id = $3",
        [await planoIdDe(cliente, aluno, SEGUNDA), antes[1].id, sessao],
      );

      await gerar(cliente, aluno, SEGUNDA);
      const depois = await blocosDe(cliente, aluno, SEGUNDA);
      const meta = depois.filter((b) => b.nivel === "meta_cheia");
      expect(depois.filter((b) => b.id === antes[0].id)).toHaveLength(1);
      expect(depois.filter((b) => b.id === antes[1].id)).toHaveLength(1);
      expect(meta.reduce((total, bloco) => total + bloco.minutos_estimados, 0)).toBeLessThanOrEqual(40);
      expect(await cliente.query<{ n: string }>(
        "select count(*)::text as n from public.plano_dia where user_id = $1 and data = $2",
        [aluno, SEGUNDA],
      )).toMatchObject({ rows: [{ n: "1" }] });
    });
  });
});
