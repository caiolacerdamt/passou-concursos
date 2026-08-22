import { expect, it } from "vitest";

import { criarTopico } from "./acervo";
import { comoAluno, novoAluno, recusa } from "./aluno";
import { comTransacaoSemPerfilConcurso } from "./conexao";
import { descreveComBanco } from "./setup";

/**
 * SPEC 06 · T51 — as tabelas do plano e a fronteira com o Raio-X
 * (ALUNO-05 AC1, ALUNO-11, ALUNO-12, AD-056/AD-057).
 *
 * Dois pontos aqui nao sao detalhe de schema, sao requisito:
 *   - `plano_dia.frase` **anulavel** e o que faz o nucleo nao depender de IA ao
 *     vivo (invariante nº7);
 *   - `raiox_peso_topico` e a fronteira que a SPEC 11 vai trocar. O teste fixa a
 *     **assinatura**, nao o valor 1.0 — trocar o corpo da view nao pode quebrar
 *     este arquivo, mas mudar as colunas dela tem de quebrar.
 */

descreveComBanco("perfil_estudo — o caminho de quem pula o diagnostico (ALUNO-05 AC1)", () => {
  it("nivel declarado + minutos por dia bastam; data_prova pode faltar", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const aluno = novoAluno();
      await cliente.query(
        `insert into public.perfil_estudo (user_id, nivel_declarado, minutos_por_dia)
         values ($1, 'iniciante', 45)`,
        [aluno],
      );

      const { rows } = await cliente.query<{
        nivel_declarado: string;
        minutos_por_dia: number;
        data_prova: string | null;
      }>("select * from public.perfil_estudo where user_id = $1", [aluno]);

      expect(rows[0].nivel_declarado).toBe("iniciante");
      expect(rows[0].minutos_por_dia).toBe(45);
      // Nulo e o normal: o produto existe antes de o edital do BB sair.
      expect(rows[0].data_prova).toBeNull();
    });
  });

  it("recusa nivel fora dos tres, e recusa perfil sem minutos", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const aluno = novoAluno();

      await recusa(
        cliente,
        () =>
          cliente.query(
            `insert into public.perfil_estudo (user_id, nivel_declarado, minutos_por_dia)
             values ($1, 'expert', 45)`,
            [aluno],
          ),
        /perfil_nivel_conhecido/,
      );

      // Sem `minutos_por_dia` nao ha corte por tempo e o plano viraria lista
      // infinita — por isso a coluna e `not null`, nao um default silencioso.
      await recusa(
        cliente,
        () =>
          cliente.query(
            "insert into public.perfil_estudo (user_id) values ($1)",
            [aluno],
          ),
        /minutos_por_dia|not-null/,
      );

      await recusa(
        cliente,
        () =>
          cliente.query(
            "insert into public.perfil_estudo (user_id, minutos_por_dia) values ($1, 0)",
            [aluno],
          ),
        /perfil_minutos_positivos/,
      );
    });
  });
});

descreveComBanco("plano_dia e plano_bloco (ALUNO-11, ALUNO-12)", () => {
  async function criarPlano(
    cliente: Parameters<typeof recusa>[0],
    aluno: string,
    data = "2026-08-17",
  ): Promise<string> {
    const { rows } = await cliente.query<{ id: string }>(
      "insert into public.plano_dia (user_id, data) values ($1, $2) returning id",
      [aluno, data],
    );
    return rows[0].id;
  }

  it("`frase` nasce nula — o plano vale sem a IA ter respondido (invariante nº7)", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const aluno = novoAluno();
      const plano = await criarPlano(cliente, aluno);

      const { rows } = await cliente.query<{ frase: string | null }>(
        "select frase from public.plano_dia where id = $1",
        [plano],
      );
      expect(rows[0].frase).toBeNull();
    });
  });

  it("um plano por aluno por dia — e o que faz rerodar substituir, nao duplicar", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const aluno = novoAluno();
      await criarPlano(cliente, aluno);
      await recusa(
        cliente,
        () => criarPlano(cliente, aluno),
        /plano_dia_unico|duplicate key/,
      );
      // Outro dia e outro plano.
      await criarPlano(cliente, aluno, "2026-08-18");
    });
  });

  it("os dois niveis convivem na mesma ordem: piso 1 e meta_cheia 1 (ALUNO-11)", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const aluno = novoAluno();
      const plano = await criarPlano(cliente, aluno);
      const topico = await criarTopico(cliente);

      const bloco = (nivel: string, ordem: number, tipo = "revisar") => () =>
        cliente.query(
          `insert into public.plano_bloco
             (plano_dia_id, tipo, nivel, ordem, topico_id, minutos_estimados, motivo)
           values ($1, $2::public.bloco_tipo, $3::public.plano_nivel, $4, $5, 20, 'porque sim')`,
          [plano, tipo, nivel, ordem, topico],
        );

      await bloco("piso", 1)();
      // Mesma ordem, nivel diferente: o unique e do PAR, senao os dois niveis
      // nao caberiam no mesmo plano.
      await bloco("meta_cheia", 1)();
      await recusa(cliente, bloco("piso", 1), /plano_bloco_ordem_unica|duplicate key/);
    });
  });

  it("o bloco `treinar` pode nao ter topico — ele mistura assuntos (ALUNO-08 AC3)", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const aluno = novoAluno();
      const plano = await criarPlano(cliente, aluno);

      await cliente.query(
        `insert into public.plano_bloco
           (plano_dia_id, tipo, nivel, ordem, topico_id, minutos_estimados)
         values ($1, 'treinar', 'meta_cheia', 1, null, 20)`,
        [plano],
      );

      const { rows } = await cliente.query<{ topico_id: string | null }>(
        "select topico_id from public.plano_bloco where plano_dia_id = $1",
        [plano],
      );
      expect(rows[0].topico_id).toBeNull();
    });
  });

  it("apagar o plano leva os blocos junto, e nao leva a sessao", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const aluno = novoAluno();
      const plano = await criarPlano(cliente, aluno);
      await cliente.query(
        `insert into public.plano_bloco (plano_dia_id, tipo, nivel, ordem, minutos_estimados)
         values ($1, 'treinar', 'meta_cheia', 1, 20)`,
        [plano],
      );
      const { rows: sessao } = await cliente.query<{ id: string }>(
        `insert into public.sessoes (user_id, contexto, plano_dia_id)
         values ($1, 'plano', $2) returning id`,
        [aluno, plano],
      );

      await cliente.query("delete from public.plano_dia where id = $1", [plano]);

      const { rows: blocos } = await cliente.query(
        "select 1 from public.plano_bloco where plano_dia_id = $1",
        [plano],
      );
      expect(blocos).toHaveLength(0);

      // `set null` e nao `cascade`: apagar o plano nao pode apagar o registro de
      // que o aluno estudou.
      const { rows: viva } = await cliente.query<{ plano_dia_id: string | null }>(
        "select plano_dia_id from public.sessoes where id = $1",
        [sessao[0].id],
      );
      expect(viva).toHaveLength(1);
      expect(viva[0].plano_dia_id).toBeNull();
    });
  });
});

descreveComBanco("raiox_peso_topico — a fronteira com o M5 (AD-056/AD-057)", () => {
  it("a assinatura e (topico_id, peso) — e o que a SPEC 11 tem de preservar", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const { rows } = await cliente.query<{ attname: string }>(
        `select attname from pg_attribute
          where attrelid = 'public.raiox_peso_topico'::regclass
            and attnum > 0 and not attisdropped
          order by attnum`,
      );
      // Se a SPEC 11 renomear ou acrescentar coluna, este teste quebra — que e
      // exatamente o aviso que o motor do plano precisa receber.
      expect(rows.map((l) => l.attname)).toEqual(["topico_id", "peso"]);
    });
  });

  it("devolve um peso para todo topico ativo, e nenhum para o desativado", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const topico = await criarTopico(cliente);

      const peso = async () => {
        const { rows } = await cliente.query<{ peso: string }>(
          "select peso from public.raiox_peso_topico where topico_id = $1",
          [topico],
        );
        return rows;
      };

      // O valor e 1.0 hoje e vira frequencia real na SPEC 11. O que este teste
      // afirma e que **existe peso**, nao qual e — travar o 1.0 aqui obrigaria a
      // reescrever o teste quando o Raio-X entrar.
      expect(await peso()).toHaveLength(1);
      expect(Number((await peso())[0].peso)).toBeGreaterThan(0);

      // Topico desativado sai do edital novo e nao deve receber plano.
      await cliente.query("update public.topicos set ativo = false where id = $1", [
        topico,
      ]);
      expect(await peso()).toHaveLength(0);
    });
  });
});

descreveComBanco("plano — RLS", () => {
  it("o aluno escreve o proprio perfil e so LE o proprio plano", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const aluno = novoAluno();
      const outro = novoAluno();

      const { rows: planoAlheio } = await cliente.query<{ id: string }>(
        "insert into public.plano_dia (user_id, data) values ($1, '2026-08-17') returning id",
        [outro],
      );
      await cliente.query(
        "insert into public.plano_dia (user_id, data) values ($1, '2026-08-17')",
        [aluno],
      );
      await cliente.query(
        `insert into public.plano_bloco (plano_dia_id, tipo, nivel, ordem, minutos_estimados)
         values ($1, 'treinar', 'meta_cheia', 1, 20)`,
        [planoAlheio[0].id],
      );

      await comoAluno(cliente, aluno, async () => {
        // Declarar o proprio nivel e escrita legitima: e declaracao dele sobre ele.
        await cliente.query(
          `insert into public.perfil_estudo (user_id, nivel_declarado, minutos_por_dia)
           values ($1, 'intermediario', 30)`,
          [aluno],
        );

        const { rows: meus } = await cliente.query<{ user_id: string }>(
          "select user_id from public.plano_dia where data = '2026-08-17'",
        );
        expect(meus.map((l) => l.user_id)).toEqual([aluno]);

        // Bloco do plano alheio nao aparece nem pelo id.
        const { rows: blocos } = await cliente.query(
          "select 1 from public.plano_bloco where plano_dia_id = $1",
          [planoAlheio[0].id],
        );
        expect(blocos).toHaveLength(0);

        // Um aluno que pudesse editar o proprio plano se daria meta zero e
        // manteria a sequencia sem estudar.
        await recusa(
          cliente,
          () =>
            cliente.query(
              "insert into public.plano_dia (user_id, data) values ($1, '2026-08-19')",
              [aluno],
            ),
          /row-level security|permission denied/,
        );
      });
    });
  });

  it("nao consegue gravar perfil no nome de outro aluno", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const aluno = novoAluno();
      const outro = novoAluno();

      await comoAluno(cliente, aluno, async () => {
        await recusa(
          cliente,
          () =>
            cliente.query(
              `insert into public.perfil_estudo (user_id, minutos_por_dia)
               values ($1, 30)`,
              [outro],
            ),
          /row-level security/,
        );
      });
    });
  });
});
