import { Client } from "pg";
import { expect, it } from "vitest";

import { criarProva, inserirQuestao, sufixo } from "./acervo";
import { novoAluno } from "./aluno";
import {
  comTransacaoSemPerfilConcurso as comTransacaoSemPerfilConcursoBase,
} from "./conexao";
import { descreveComBanco } from "./setup";

/**
 * SPEC 06 · T52 — `gera_plano_do_dia()` (ALUNO-07, ALUNO-08, ALUNO-11).
 *
 * E o **Independent Test da story**: entra um retrato semeado, sai um plano com
 * blocos que cabem no tempo declarado e com `piso` e `meta_cheia` distintos.
 *
 * Todo teste passa `p_user_id` e `p_data`: sem eles a funcao percorre todo aluno
 * com perfil, e o banco de desenvolvimento e compartilhado.
 */

const HOJE = "2026-08-17";

type Bloco = {
  tipo: string;
  nivel: string;
  ordem: number;
  topico_id: string | null;
  minutos_estimados: number;
  motivo: string | null;
};

/** Topico com pelo menos uma questao publicada — o motor exige isso. */
async function topicoComQuestao(
  cliente: Client,
  opcoes: { publicada?: boolean } = {},
): Promise<string> {
  const { rows: materia } = await cliente.query<{ id: string }>(
    "insert into public.materias (nome) values ($1) returning id",
    [`Materia ${sufixo()}`],
  );
  const { rows: topico } = await cliente.query<{ id: string }>(
    "insert into public.topicos (materia_id, nome) values ($1, $2) returning id",
    [materia[0].id, `Topico ${sufixo()}`],
  );

  await inserirQuestao(cliente, {
    topico_id: topico[0].id,
    prova_id: await criarProva(cliente),
    status: opcoes.publicada === false ? "rascunho" : "publicada",
  });

  return topico[0].id;
}

/**
 * O banco de desenvolvimento tem acervo compartilhado. O motor consulta todo
 * tópico ativo, então os testes precisam começar com um catálogo vazio para
 * que os tópicos criados pela própria fixture controlem a seleção. A alteração
 * fica dentro da transação e o rollback restaura o acervo real.
 */
async function comTransacaoSemPerfilConcurso<T>(
  uso: (cliente: Client) => Promise<T>,
): Promise<T> {
  return comTransacaoSemPerfilConcursoBase(async (cliente) => {
    await cliente.query("update public.topicos set ativo = false where ativo");
    return uso(cliente);
  });
}

async function criarPerfil(
  cliente: Client,
  aluno: string,
  minutos: number,
  nivel: string | null = "iniciante",
): Promise<void> {
  await cliente.query(
    `insert into public.perfil_estudo (user_id, nivel_declarado, minutos_por_dia)
     values ($1, $2, $3)`,
    [aluno, nivel, minutos],
  );
}

async function gerar(cliente: Client, aluno: string): Promise<number> {
  const { rows } = await cliente.query<{ gera_plano_do_dia: number }>(
    "select public.gera_plano_do_dia($1, $2::date) as gera_plano_do_dia",
    [aluno, HOJE],
  );
  return rows[0].gera_plano_do_dia;
}

async function blocosDe(cliente: Client, aluno: string): Promise<Bloco[]> {
  const { rows } = await cliente.query<Bloco>(
    `select b.tipo, b.nivel, b.ordem, b.topico_id, b.minutos_estimados, b.motivo
       from public.plano_bloco b
       join public.plano_dia p on p.id = b.plano_dia_id
      where p.user_id = $1 and p.data = $2
      order by b.nivel, b.ordem`,
    [aluno, HOJE],
  );
  return rows;
}

/** Marca o topico como vencido para hoje. */
async function revisaoVencida(
  cliente: Client,
  aluno: string,
  topico: string,
  due = HOJE,
): Promise<void> {
  await cliente.query(
    `insert into public.revisao_agenda (user_id, topico_id, due) values ($1, $2, $3::date)`,
    [aluno, topico, due],
  );
}

/** Semeia dominio: score alto = topico forte, score baixo = topico fraco. */
async function dominio(
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

descreveComBanco("gera_plano_do_dia — os dois niveis (ALUNO-11)", () => {
  it("com revisao vencida, `piso` traz SO ela e `meta_cheia` traz o dia inteiro", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const aluno = novoAluno();
      const vencido = await topicoComQuestao(cliente);
      const novo = await topicoComQuestao(cliente);
      await criarPerfil(cliente, aluno, 120);
      await revisaoVencida(cliente, aluno, vencido);
      await dominio(cliente, aluno, novo, 0.2);

      expect(await gerar(cliente, aluno)).toBe(1);
      const blocos = await blocosDe(cliente, aluno);

      const piso = blocos.filter((b) => b.nivel === "piso");
      const meta = blocos.filter((b) => b.nivel === "meta_cheia");

      // O piso e o minimo que mantem a sequencia: so as revisoes devidas.
      expect(piso).toHaveLength(1);
      expect(piso[0].tipo).toBe("revisar");
      expect(piso[0].topico_id).toBe(vencido);

      // A meta cheia repete a revisao e acrescenta o resto do dia.
      expect(meta.length).toBeGreaterThan(piso.length);
      expect(meta.map((b) => b.tipo)).toContain("revisar");
      expect(meta.map((b) => b.tipo)).toContain("avancar");
    });
  });

  it("sem revisao vencida o `piso` fica VAZIO, e isso e correto", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const aluno = novoAluno();
      await topicoComQuestao(cliente);
      await criarPerfil(cliente, aluno, 60);

      await gerar(cliente, aluno);
      const blocos = await blocosDe(cliente, aluno);

      // Quem nao deve revisao nenhuma nao tem nada obrigatorio a fazer para
      // manter a sequencia — o piso vazio e a resposta honesta, nao um bug.
      expect(blocos.filter((b) => b.nivel === "piso")).toHaveLength(0);
      expect(blocos.filter((b) => b.nivel === "meta_cheia").length).toBeGreaterThan(0);
    });
  });

  it("o bloco Revisar carrega o porque (ALUNO-08 AC5)", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const aluno = novoAluno();
      const vencido = await topicoComQuestao(cliente);
      await criarPerfil(cliente, aluno, 60);
      await revisaoVencida(cliente, aluno, vencido);

      await gerar(cliente, aluno);
      const revisar = (await blocosDe(cliente, aluno)).find(
        (b) => b.tipo === "revisar",
      );
      expect(revisar?.motivo).toMatch(/não perder o que você já conquistou/);
    });
  });
});

descreveComBanco("gera_plano_do_dia — o corte por tempo (ALUNO-07 AC2)", () => {
  it("a meta cheia CABE no `minutos_por_dia` declarado", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const aluno = novoAluno();
      // 6 topicos disponiveis, 40 minutos por dia. Bloco padrao = 10 questoes x
      // 2 min = 20 min, entao so 2 blocos cabem.
      for (let i = 0; i < 6; i += 1) await topicoComQuestao(cliente);
      await criarPerfil(cliente, aluno, 40);

      await gerar(cliente, aluno);
      const meta = (await blocosDe(cliente, aluno)).filter(
        (b) => b.nivel === "meta_cheia",
      );

      const total = meta.reduce((soma, b) => soma + b.minutos_estimados, 0);
      expect(total).toBeLessThanOrEqual(40);
      expect(meta).toHaveLength(2);
    });
  });

  it("mais tempo declarado significa mais bloco", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const curto = novoAluno();
      const longo = novoAluno();
      for (let i = 0; i < 6; i += 1) await topicoComQuestao(cliente);
      await criarPerfil(cliente, curto, 40);
      await criarPerfil(cliente, longo, 120);

      await gerar(cliente, curto);
      await gerar(cliente, longo);

      expect((await blocosDe(cliente, longo)).length).toBeGreaterThan(
        (await blocosDe(cliente, curto)).length,
      );
    });
  });

  it("a revisao vencida participa sem estourar a capacidade diaria", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const aluno = novoAluno();
      const a = await topicoComQuestao(cliente);
      const b = await topicoComQuestao(cliente);
      const c = await topicoComQuestao(cliente);
      // Há conteúdo novo elegível para o único slot de avanço; os três
      // primeiros tópicos estão vencidos e ocupam apenas a fila de revisão.
      await topicoComQuestao(cliente);
      await criarPerfil(cliente, aluno, 20);
      for (const t of [a, b, c]) await revisaoVencida(cliente, aluno, t);

      await gerar(cliente, aluno);
      const piso = (await blocosDe(cliente, aluno)).filter((x) => x.nivel === "piso");

      // Mesmo com revisão vencida, o único slot precisa preservar avanço quando
      // há conteúdo elegível. A revisão limitada não paralisa o edital.
      expect(piso).toHaveLength(0);
      const meta = (await blocosDe(cliente, aluno)).filter(
        (x) => x.nivel === "meta_cheia",
      );
      expect(meta.reduce((total, bloco) => total + bloco.minutos_estimados, 0)).toBeLessThanOrEqual(20);
      expect(meta).toHaveLength(1);
      expect(meta[0].tipo).toBe("avancar");
    });
  });
});

descreveComBanco("gera_plano_do_dia — a nota do topico (ALUNO-07)", () => {
  it("topico mais fraco vem antes de topico mais forte", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const aluno = novoAluno();
      const forte = await topicoComQuestao(cliente);
      const fraco = await topicoComQuestao(cliente);
      await criarPerfil(cliente, aluno, 120);
      await dominio(cliente, aluno, forte, 0.95);
      await dominio(cliente, aluno, fraco, 0.05);

      await gerar(cliente, aluno);
      const meta = (await blocosDe(cliente, aluno)).filter(
        (b) => b.nivel === "meta_cheia",
      );

      // `fraqueza = 1 - score`: o de score 0.05 tem nota 19x a do de 0.95.
      expect(meta[0].topico_id).toBe(fraco);
      expect(meta[0].tipo).toBe("avancar");
    });
  });

  it("topico com revisao vencida ganha do topico so fraco — o multiplicador manda", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const aluno = novoAluno();
      const fraco = await topicoComQuestao(cliente);
      const vencido = await topicoComQuestao(cliente);
      await criarPerfil(cliente, aluno, 120);
      await dominio(cliente, aluno, fraco, 0.1);
      // Dominio bom, mas devendo revisao: 1.5 x (1 - 0.7) = 0.45 contra 0.9.
      // Aqui o fraco vence na nota, mas o vencido entra no PISO de qualquer jeito
      // — que e a garantia que o ALUNO-11 pede.
      await dominio(cliente, aluno, vencido, 0.7);
      await revisaoVencida(cliente, aluno, vencido);

      await gerar(cliente, aluno);
      const blocos = await blocosDe(cliente, aluno);

      const piso = blocos.filter((b) => b.nivel === "piso");
      expect(piso).toHaveLength(1);
      expect(piso[0].topico_id).toBe(vencido);
      // E o fraco continua no dia, como Avancar.
      expect(
        blocos.some((b) => b.tipo === "avancar" && b.topico_id === fraco),
      ).toBe(true);
    });
  });

  it("revisao com `due` no futuro NAO conta como vencida", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const aluno = novoAluno();
      const topico = await topicoComQuestao(cliente);
      await criarPerfil(cliente, aluno, 60);
      await revisaoVencida(cliente, aluno, topico, "2026-09-30");

      await gerar(cliente, aluno);
      expect(
        (await blocosDe(cliente, aluno)).filter((b) => b.nivel === "piso"),
      ).toHaveLength(0);
    });
  });
});

descreveComBanco("gera_plano_do_dia — os edge cases da spec", () => {
  it("topico SEM questao publicada e pulado; o motor pega o proximo", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const aluno = novoAluno();
      const semQuestao = await topicoComQuestao(cliente, { publicada: false });
      const comQuestao = await topicoComQuestao(cliente);
      await criarPerfil(cliente, aluno, 60);
      // O topico frio e o mais fraco: se o motor olhasse so a nota, ele viria
      // primeiro e o aluno abriria um bloco sem questao nenhuma.
      await dominio(cliente, aluno, semQuestao, 0);
      await dominio(cliente, aluno, comQuestao, 0.5);

      await gerar(cliente, aluno);
      const blocos = await blocosDe(cliente, aluno);

      expect(blocos.map((b) => b.topico_id)).not.toContain(semQuestao);
      expect(blocos.map((b) => b.topico_id)).toContain(comQuestao);
    });
  });

  it("retrato frio — so o nivel declarado — ainda gera o plano do 1o dia (ALUNO-05)", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const aluno = novoAluno();
      await topicoComQuestao(cliente);
      await topicoComQuestao(cliente);
      // Nenhuma tentativa, nenhuma projecao, nenhuma agenda. So a declaracao.
      await criarPerfil(cliente, aluno, 60, "iniciante");

      expect(await gerar(cliente, aluno)).toBe(1);
      const blocos = await blocosDe(cliente, aluno);

      // E a promessa do "diagnostico e sempre pulavel" (invariante nº5): quem
      // so declarou o nivel recebe plano igual.
      expect(blocos.length).toBeGreaterThan(0);
      expect(blocos.some((b) => b.tipo === "avancar")).toBe(true);
    });
  });

  it("a semente do nivel E a fraqueza: iniciante prioriza topico virgem, avancado nao", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const iniciante = novoAluno();
      const avancado = novoAluno();
      const virgem = await topicoComQuestao(cliente);
      const conhecido = await topicoComQuestao(cliente);
      await criarPerfil(cliente, iniciante, 120, "iniciante");
      await criarPerfil(cliente, avancado, 120, "avancado");
      // Dominio medio no topico conhecido: fraqueza 0.5 para os dois alunos.
      await dominio(cliente, iniciante, conhecido, 0.5);
      await dominio(cliente, avancado, conhecido, 0.5);

      await gerar(cliente, iniciante);
      await gerar(cliente, avancado);

      const primeiro = async (aluno: string) =>
        (await blocosDe(cliente, aluno)).filter((b) => b.nivel === "meta_cheia")[0]
          .topico_id;

      // A semente do iniciante e 0.9 (fraco em tudo que nunca viu) e ganha do
      // 0.5 do topico conhecido; a do avancado e 0.35 e perde.
      //
      // A versao anterior invertia a semente (`1 - coalesce(score, semente)`) e
      // dava exatamente o contrario. O teste de ordenacao antigo nao pegava
      // porque semeava dominio nos DOIS topicos comparados — nunca comparou
      // topico com historico contra topico virgem.
      expect(await primeiro(iniciante)).toBe(virgem);
      expect(await primeiro(avancado)).toBe(conhecido);
    });
  });

  it("aluno sem perfil nao ganha plano nenhum", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const aluno = novoAluno();
      await topicoComQuestao(cliente);

      expect(await gerar(cliente, aluno)).toBe(0);
      expect(await blocosDe(cliente, aluno)).toHaveLength(0);
    });
  });

  it("rerodar no mesmo dia SUBSTITUI o plano, nao duplica", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const aluno = novoAluno();
      await topicoComQuestao(cliente);
      await criarPerfil(cliente, aluno, 60);

      await gerar(cliente, aluno);
      const primeira = await blocosDe(cliente, aluno);
      await gerar(cliente, aluno);
      const segunda = await blocosDe(cliente, aluno);

      expect(segunda).toEqual(primeira);
      const { rows } = await cliente.query<{ n: string }>(
        "select count(*) as n from public.plano_dia where user_id = $1",
        [aluno],
      );
      expect(rows[0].n).toBe("1");
    });
  });

  it("plano novo zera a frase da IA — texto velho nao descreve plano novo", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const aluno = novoAluno();
      await topicoComQuestao(cliente);
      await criarPerfil(cliente, aluno, 60);

      await gerar(cliente, aluno);
      await cliente.query(
        "update public.plano_dia set frase = 'bom dia, hoje tem matematica' where user_id = $1",
        [aluno],
      );
      await gerar(cliente, aluno);

      const { rows } = await cliente.query<{ frase: string | null }>(
        "select frase from public.plano_dia where user_id = $1",
        [aluno],
      );
      expect(rows[0].frase).toBeNull();
    });
  });

  it("bloco `simulado` nao sai com a flag desligada (P3 / SPEC 32)", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const aluno = novoAluno();
      await topicoComQuestao(cliente);
      await criarPerfil(cliente, aluno, 60);

      await gerar(cliente, aluno);
      expect((await blocosDe(cliente, aluno)).map((b) => b.tipo)).not.toContain(
        "simulado",
      );

      // Ligada, o bloco aparece — o lugar dele ja existe no motor, e ligar o
      // simulado na SPEC 32 nao vai exigir reescrever a funcao.
      const { rows: autor } = await cliente.query<{ id: string }>(
        "insert into auth.users (id) values (gen_random_uuid()) returning id",
      );
      await cliente.query(
        `insert into public.configuracoes (chave, valor, modulo_dono, alterado_por, motivo)
         values ('flag.m4.simulado_semanal', 'true'::jsonb, 'm4', $1, 'teste do simulado')`,
        [autor[0].id],
      );
      await gerar(cliente, aluno);
      expect((await blocosDe(cliente, aluno)).map((b) => b.tipo)).toContain(
        "simulado",
      );
    });
  });
});

descreveComBanco("gera_plano_do_dia — reentrancia", () => {
  it("com o lock ja tomado por outra sessao devolve -1, sem erro", async () => {
    const segurando = new Client({ connectionString: process.env.DATABASE_URL });
    await segurando.connect();
    try {
      await segurando.query("begin");
      await segurando.query("select pg_advisory_xact_lock(8406, 2)");

      await comTransacaoSemPerfilConcurso(async (cliente) => {
        expect(await gerar(cliente, novoAluno())).toBe(-1);
      });
    } finally {
      await segurando.query("rollback");
      await segurando.end();
    }
  });

  it("usa lock diferente do recalculo — os dois jobs nao se atrapalham", async () => {
    const segurando = new Client({ connectionString: process.env.DATABASE_URL });
    await segurando.connect();
    try {
      await segurando.query("begin");
      // Lock do `recalcula_projecoes`.
      await segurando.query("select pg_advisory_xact_lock(8406, 1)");

      await comTransacaoSemPerfilConcurso(async (cliente) => {
        // O plano roda mesmo assim: chaves iguais fariam um job atrasado
        // cancelar o outro em silencio.
        expect(await gerar(cliente, novoAluno())).toBe(0);
      });
    } finally {
      await segurando.query("rollback");
      await segurando.end();
    }
  });
});
