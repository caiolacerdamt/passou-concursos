import type { Client } from "pg";
import { expect, it } from "vitest";

import { inserirQuestao, sufixo } from "./acervo";
import { comTransacaoRevertida, comTransacaoSemPerfilConcurso } from "./conexao";
import { criarUsuario } from "./conta";
import {
  criarMateria,
  criarProvaMedida,
  etiquetasEmRodizio,
  lerMaterias,
  recalcular,
} from "./medicao";
import { descreveComBanco } from "./setup";

/**
 * AD-146 — a medicao efetiva e o vinculo concurso-prova, contra o banco.
 *
 * Dois eixos, e cada um corrige uma metade do Raio-X zerado do BB:
 *
 *   `itens_medidos_efetivos`  uma linha por (prova, numero), com a precedencia
 *                             questao publicada > etiqueta humana > etiqueta de
 *                             IA — e **sem copiar** questao para etiqueta;
 *   `concurso_provas`         "esta prova e deste concurso" e decisao humana
 *                             registrada, nao coincidencia de texto.
 */

const MOTIVO = "prova oficial conferida pelo operador na abertura";

async function criarOperador(cliente: Client): Promise<string> {
  const operador = await criarUsuario(cliente);
  await cliente.query("insert into public.operadores (operador_id) values ($1)", [operador]);
  return operador;
}

/** Uma prova crua do catalogo, sem grade e sem item. */
async function novaProva(
  cliente: Client,
  dados: { orgao?: string; cargo?: string; ano?: number; banca?: string; caderno?: string } = {},
): Promise<string> {
  const { rows } = await cliente.query<{ id: string }>(
    `insert into public.provas (banca, ano, orgao, cargo, caderno)
     values ($1, $2, $3, $4, $5) returning id`,
    [
      dados.banca ?? "Fundacao Cesgranrio",
      dados.ano ?? 2023,
      dados.orgao ?? `Banco do Brasil ${sufixo()}`,
      dados.cargo ?? "Escriturario",
      dados.caderno ?? null,
    ],
  );
  return rows[0].id;
}

async function etiquetar(
  cliente: Client,
  prova: string,
  numero: number,
  topico: string,
): Promise<void> {
  await cliente.query("select * from public.gravar_etiquetas_ia($1, $2::jsonb, $3)", [
    prova,
    JSON.stringify([{ numero, topico_id: topico, confianca: 0.7 }]),
    "versao-fixada-de-teste",
  ]);
}

type ItemEfetivo = { numero: number; topico_id: string; fonte: string };

async function itensEfetivos(cliente: Client, prova: string): Promise<ItemEfetivo[]> {
  const { rows } = await cliente.query<ItemEfetivo>(
    `select numero, topico_id, fonte from public.itens_medidos_efetivos
      where prova_id = $1 order by numero`,
    [prova],
  );
  return rows;
}

async function recusa(
  cliente: Client,
  sql: string,
  parametros: unknown[],
  padrao: RegExp,
): Promise<void> {
  await cliente.query("savepoint recusa");
  await expect(cliente.query(sql, parametros)).rejects.toThrow(padrao);
  await cliente.query("rollback to savepoint recusa");
}

descreveComBanco("AD-146 — itens_medidos_efetivos", () => {
  it("questao publicada sozinha ja e item medido, sem existir etiqueta", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { topicos } = await criarMateria(cliente, 1);
      const prova = await novaProva(cliente);
      await inserirQuestao(cliente, {
        prova_id: prova,
        numero: 7,
        topico_id: topicos[0],
        status: "publicada",
      });

      expect(await itensEfetivos(cliente, prova)).toEqual([
        { numero: 7, topico_id: topicos[0], fonte: "questao_publicada" },
      ]);

      // A regra do AD-146: a questao NAO virou linha em `etiquetas_de_item`.
      const { rows } = await cliente.query<{ n: string }>(
        "select count(*) as n from public.etiquetas_de_item where prova_id = $1",
        [prova],
      );
      expect(Number(rows[0].n)).toBe(0);
    });
  });

  it("etiqueta sozinha aparece, e a origem dela vira a fonte", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { topicos } = await criarMateria(cliente, 2);
      const prova = await novaProva(cliente);
      const operador = await criarOperador(cliente);

      await etiquetar(cliente, prova, 1, topicos[0]);
      await cliente.query("select public.corrigir_etiqueta($1, $2::smallint, $3, $4, $5)", [
        prova,
        2,
        topicos[1],
        operador,
        "correcao humana de teste",
      ]);

      expect(await itensEfetivos(cliente, prova)).toEqual([
        { numero: 1, topico_id: topicos[0], fonte: "etiqueta_ia" },
        { numero: 2, topico_id: topicos[1], fonte: "etiqueta_humana" },
      ]);
    });
  });

  it("questao publicada e etiqueta conflitante dao UMA linha, com o topico da questao", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { topicos } = await criarMateria(cliente, 2);
      const prova = await novaProva(cliente);

      // A etiqueta entra primeiro, apontando para o assunto errado.
      await etiquetar(cliente, prova, 3, topicos[1]);
      await inserirQuestao(cliente, {
        prova_id: prova,
        numero: 3,
        topico_id: topicos[0],
        status: "publicada",
      });

      expect(await itensEfetivos(cliente, prova)).toEqual([
        { numero: 3, topico_id: topicos[0], fonte: "questao_publicada" },
      ]);
    });
  });

  it("rascunho e rejeitada nao vencem a etiqueta", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { topicos } = await criarMateria(cliente, 2);
      const prova = await novaProva(cliente);

      await etiquetar(cliente, prova, 1, topicos[1]);
      await etiquetar(cliente, prova, 2, topicos[1]);
      await inserirQuestao(cliente, {
        prova_id: prova,
        numero: 1,
        topico_id: topicos[0],
        status: "rascunho",
      });
      await inserirQuestao(cliente, {
        prova_id: prova,
        numero: 2,
        topico_id: topicos[0],
        status: "rejeitada",
      });

      expect(await itensEfetivos(cliente, prova)).toEqual([
        { numero: 1, topico_id: topicos[1], fonte: "etiqueta_ia" },
        { numero: 2, topico_id: topicos[1], fonte: "etiqueta_ia" },
      ]);
    });
  });

  it("versao antiga da mesma questao nao duplica o item", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { topicos } = await criarMateria(cliente, 2);
      const prova = await novaProva(cliente);

      const primeira = await inserirQuestao(cliente, {
        prova_id: prova,
        numero: 4,
        topico_id: topicos[0],
        status: "publicada",
      });
      // Mesma `id` = versao nova. A anterior perde `vigente` pelo gatilho, e a
      // partir da v2 a mudanca precisa ser declarada (BANCO-13).
      await inserirQuestao(cliente, {
        id: primeira.id,
        prova_id: prova,
        numero: 4,
        topico_id: topicos[1],
        status: "publicada",
        mudanca_tipo: "substantiva",
        mudanca_motivo: "reclassificacao do assunto",
      });

      const { rows } = await cliente.query<{ n: string }>(
        "select count(*) as n from public.questoes where id = $1",
        [primeira.id],
      );
      expect(Number(rows[0].n)).toBe(2);

      expect(await itensEfetivos(cliente, prova)).toEqual([
        { numero: 4, topico_id: topicos[1], fonte: "questao_publicada" },
      ]);
    });
  });

  it("questao gerada por IA nao entra como verdade de prova", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { topicos } = await criarMateria(cliente, 1);
      const prova = await novaProva(cliente);

      // Publicar uma inedita e recusado pelo proprio banco desde a SPEC 10 — o
      // filtro `origem = 'real'` da view e a segunda tranca, nao a primeira.
      await cliente.query("savepoint inedita");
      await expect(
        inserirQuestao(cliente, {
          prova_id: prova,
          numero: 9,
          topico_id: topicos[0],
          origem: "gerada_ia",
          fonte_citacao: null,
          status: "publicada",
        }),
      ).rejects.toThrow(/gerada_ia_passa_por_revisao/);
      await cliente.query("rollback to savepoint inedita");

      // E a inedita que existe, em rascunho, tambem nao mede nada.
      await inserirQuestao(cliente, {
        prova_id: prova,
        numero: 9,
        topico_id: topicos[0],
        origem: "gerada_ia",
        fonte_citacao: null,
      });

      expect(await itensEfetivos(cliente, prova)).toEqual([]);
    });
  });

  it("a cobertura conta uma linha por item, misturando questao e etiqueta", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { topicos } = await criarMateria(cliente, 1);
      const prova = await novaProva(cliente);

      await cliente.query("select public.registrar_grade_declarada($1, $2, $3::jsonb)", [
        prova,
        4,
        JSON.stringify([
          { ordem: 1, nome_impresso: "BLOCO", item_inicial: 1, item_final: 4 },
        ]),
      ]);

      // Item 1 e 2: questao publicada. Item 2 tambem tem etiqueta — e a
      // duplicidade que a view existe para nao deixar virar cobertura de 125%.
      await inserirQuestao(cliente, {
        prova_id: prova,
        numero: 1,
        topico_id: topicos[0],
        status: "publicada",
      });
      await inserirQuestao(cliente, {
        prova_id: prova,
        numero: 2,
        topico_id: topicos[0],
        status: "publicada",
      });
      await etiquetar(cliente, prova, 2, topicos[0]);
      await etiquetar(cliente, prova, 3, topicos[0]);

      const { rows } = await cliente.query<{ itens_ingeridos: number; cobertura: string }>(
        "select itens_ingeridos, cobertura from public.cobertura_da_prova where prova_id = $1",
        [prova],
      );
      expect(rows[0].itens_ingeridos).toBe(3);
      expect(Number(rows[0].cobertura)).toBeCloseTo(0.75, 4);
    });
  });
});

descreveComBanco("AD-146 — vincular_prova_ao_concurso", () => {
  async function concursoComPerfil(cliente: Client): Promise<{
    concurso: string;
    perfil: string;
    orgao: string;
  }> {
    const orgao = `Orgao ${sufixo()}`;
    const { rows: perfil } = await cliente.query<{ id: string }>(
      `insert into public.perfil_concurso (orgao, banca, programa_edital, ativo)
       values ($1, 'indefinida', '[]'::jsonb, false) returning id`,
      [orgao],
    );
    const { rows } = await cliente.query<{ id: string }>(
      `insert into public.concursos (orgao, cargo, perfil_concurso_id)
       values ($1, $2, $3) returning id`,
      [orgao, `Cargo ${sufixo()}`, perfil[0].id],
    );
    return { concurso: rows[0].id, perfil: perfil[0].id, orgao };
  }

  it("vinculo repetido e idempotente: devolve false e nao cria linha nem acao", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { concurso } = await concursoComPerfil(cliente);
      const prova = await novaProva(cliente);
      const operador = await criarOperador(cliente);

      const primeiro = await cliente.query<{ criou: boolean }>(
        "select public.vincular_prova_ao_concurso($1, $2, $3, $4) as criou",
        [concurso, prova, operador, MOTIVO],
      );
      const segundo = await cliente.query<{ criou: boolean }>(
        "select public.vincular_prova_ao_concurso($1, $2, $3, $4) as criou",
        [concurso, prova, operador, "outro motivo, mesmo fato"],
      );

      expect(primeiro.rows[0].criou).toBe(true);
      expect(segundo.rows[0].criou).toBe(false);

      const { rows: linhas } = await cliente.query<{ n: string; motivo: string }>(
        "select count(*) as n, min(motivo) as motivo from public.concurso_provas where concurso_id = $1",
        [concurso],
      );
      expect(Number(linhas[0].n)).toBe(1);
      // O motivo do primeiro vinculo e o que fica: repetir nao reescreve autoria.
      expect(linhas[0].motivo).toBe(MOTIVO);

      const { rows: acoes } = await cliente.query<{ n: string }>(
        `select count(*) as n from public.operador_acoes
          where tipo = 'vincular_prova_ao_concurso' and entidade_id = $1`,
        [concurso],
      );
      expect(Number(acoes[0].n)).toBe(1);
    });
  });

  it("recusa operador ausente, operador inativo, motivo vazio e abertura de outro concurso", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { concurso } = await concursoComPerfil(cliente);
      const outro = await concursoComPerfil(cliente);
      const prova = await novaProva(cliente);
      const operador = await criarOperador(cliente);
      const forasteiro = await criarUsuario(cliente);

      const sql = "select public.vincular_prova_ao_concurso($1, $2, $3, $4, $5)";

      await recusa(cliente, sql, [concurso, prova, forasteiro, MOTIVO, null], /operador_nao_autorizado/);

      await cliente.query("update public.operadores set ativo = false where operador_id = $1", [
        operador,
      ]);
      await recusa(cliente, sql, [concurso, prova, operador, MOTIVO, null], /operador_nao_autorizado/);
      await cliente.query("update public.operadores set ativo = true where operador_id = $1", [
        operador,
      ]);

      await recusa(cliente, sql, [concurso, prova, operador, "   ", null], /motivo_obrigatorio/);

      // Abertura existe, mas e de outro concurso: proveniencia errada e pior
      // que proveniencia ausente.
      const { rows: abertura } = await cliente.query<{ id: string }>(
        "select public.iniciar_abertura($1, $2) as id",
        [outro.concurso, operador],
      );
      await recusa(
        cliente,
        sql,
        [concurso, prova, operador, MOTIVO, abertura[0].id],
        /abertura_fora_do_concurso/,
      );

      const { rows } = await cliente.query<{ n: string }>(
        "select count(*) as n from public.concurso_provas where concurso_id = $1",
        [concurso],
      );
      expect(Number(rows[0].n)).toBe(0);
    });
  });
});

descreveComBanco("AD-146 — prova propria no recalculo", () => {
  it("prova vinculada e degrau 1 mesmo com orgao e cargo escritos de outro jeito", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const materia = await criarMateria(cliente, 2);
      const operador = await criarOperador(cliente);

      // O retrato do banco real: o concurso e "Banco do Brasil — Escriturario,
      // Agente Comercial" com cargo sentinela, e a prova e "Banco do Brasil" +
      // "Escriturario - Agente Comercial". Nenhum texto casa.
      const { rows: perfil } = await cliente.query<{ id: string }>(
        `insert into public.perfil_concurso (orgao, banca, programa_edital, ativo)
         values ($1, 'Fundacao Cesgranrio', $2::jsonb, true) returning id`,
        [`Banco do Brasil — Escriturario, Agente Comercial ${sufixo()}`, JSON.stringify(materia.topicos)],
      );
      const { rows: concurso } = await cliente.query<{ id: string }>(
        `insert into public.concursos (orgao, cargo, perfil_concurso_id)
         values ($1, 'indefinido', $2) returning id`,
        [`Banco do Brasil — Escriturario, Agente Comercial ${sufixo()}`, perfil[0].id],
      );

      const prova = await criarProvaMedida(cliente, {
        orgao: `Banco do Brasil ${sufixo()}`,
        cargo: "Escriturario - Agente Comercial",
        banca: "Fundacao Cesgranrio",
        ano: 2023,
        blocos: [{ materiaId: materia.materiaId, itens: 10 }],
        etiquetas: etiquetasEmRodizio(10, materia.topicos),
      });

      // Sem vinculo, a prova entra so pela banca, e o degrau 3 empresta apenas
      // a distribuicao de dentro da materia — o PESO continua exigindo
      // documento do proprio concurso (SPEC 39). Sem edital e sem prova
      // propria, a linha cai para o degrau 4, com peso zero: e exatamente o
      // que a tela do BB mostrava.
      await recalcular(cliente);
      const antes = await lerMaterias(cliente, perfil[0].id);
      expect(antes[0].degrau).toBe(4);
      expect(Number(antes[0].peso)).toBe(0);

      await cliente.query("select public.vincular_prova_ao_concurso($1, $2, $3, $4)", [
        concurso[0].id,
        prova,
        operador,
        MOTIVO,
      ]);

      await recalcular(cliente);
      const depois = await lerMaterias(cliente, perfil[0].id);
      expect(depois[0].degrau).toBe(1);
      expect(depois[0].n_provas).toBe(1);
      expect(depois[0].anos).toEqual([2023]);
    });
  });

  it("prova de outro orgao da mesma banca nao vira propria por coincidencia de texto", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const materia = await criarMateria(cliente, 2);
      const operador = await criarOperador(cliente);
      const orgao = `Banco do Brasil ${sufixo()}`;

      const { rows: perfil } = await cliente.query<{ id: string }>(
        `insert into public.perfil_concurso (orgao, banca, programa_edital, ativo)
         values ($1, 'Fundacao Cesgranrio', $2::jsonb, true) returning id`,
        [orgao, JSON.stringify(materia.topicos)],
      );
      const { rows: concurso } = await cliente.query<{ id: string }>(
        `insert into public.concursos (orgao, cargo, perfil_concurso_id)
         values ($1, 'indefinido', $2) returning id`,
        [orgao, perfil[0].id],
      );

      // Prova do proprio orgao: casaria por texto, e por isso e o vinculo dela
      // que precisa ser o unico caminho.
      const propria = await criarProvaMedida(cliente, {
        orgao,
        cargo: "Escriturario",
        banca: "Fundacao Cesgranrio",
        ano: 2023,
        blocos: [{ materiaId: materia.materiaId, itens: 10 }],
        etiquetas: etiquetasEmRodizio(10, materia.topicos),
      });
      // Prova da mesma banca em OUTRO orgao, com o mesmo cargo.
      await criarProvaMedida(cliente, {
        orgao: `CAIXA ${sufixo()}`,
        cargo: "Escriturario",
        banca: "Fundacao Cesgranrio",
        ano: 2023,
        blocos: [{ materiaId: materia.materiaId, itens: 10 }],
        etiquetas: etiquetasEmRodizio(10, materia.topicos),
      });

      await cliente.query("select public.vincular_prova_ao_concurso($1, $2, $3, $4)", [
        concurso[0].id,
        propria,
        operador,
        MOTIVO,
      ]);
      await recalcular(cliente);

      const { rows } = await cliente.query<{ prova_id: string; via: string }>(
        "select prova_id, via from public.provas_proprias_do_concurso($1)",
        [concurso[0].id],
      );
      expect(rows).toEqual([{ prova_id: propria, via: "vinculo" }]);

      const materias = await lerMaterias(cliente, perfil[0].id);
      expect(materias[0].degrau).toBe(1);
      // Uma prova propria, nao duas: a do outro orgao ficou no degrau 3, que
      // esta materia nao precisou usar.
      expect(materias[0].n_provas).toBe(1);
    });
  });

  it("sem nenhum vinculo, a igualdade textual legada continua respondendo", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const orgao = `Orgao ${sufixo()}`;
      const { rows: perfil } = await cliente.query<{ id: string }>(
        `insert into public.perfil_concurso (orgao, banca, programa_edital, ativo)
         values ($1, 'indefinida', '[]'::jsonb, false) returning id`,
        [orgao],
      );
      const { rows: concurso } = await cliente.query<{ id: string }>(
        `insert into public.concursos (orgao, cargo, perfil_concurso_id)
         values ($1, 'indefinido', $2) returning id`,
        [orgao, perfil[0].id],
      );
      const prova = await novaProva(cliente, { orgao, cargo: "Qualquer Cargo" });

      const { rows } = await cliente.query<{ prova_id: string; via: string }>(
        "select prova_id, via from public.provas_proprias_do_concurso($1)",
        [concurso[0].id],
      );
      expect(rows).toEqual([{ prova_id: prova, via: "texto" }]);
    });
  });

  /*
   * O tamanho do caderno e incidental: o que o teste prova e que os tres
   * cadernos contam **uma** vez, e para isso basta `n_questoes` bater com UM
   * caderno em vez de tres. Publicar dez questoes por caderno custava trinta
   * publicacoes e fazia deste o teste mais lento da suite — o primeiro a
   * estourar o timeout na CI e derrubar todos os outros em cascata, porque a
   * conexao e compartilhada. Quatro provam o mesmo: 4 e diferente de 12.
   */
  const ITENS_POR_CADERNO = 4;

  it("cadernos A/B/C da mesma edicao contam uma vez", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const materia = await criarMateria(cliente, 2);
      const operador = await criarOperador(cliente);
      const orgao = `Banco do Brasil ${sufixo()}`;
      const cargo = "Escriturario - Agente Comercial";

      const { rows: perfil } = await cliente.query<{ id: string }>(
        `insert into public.perfil_concurso (orgao, banca, programa_edital, ativo)
         values ($1, 'Fundacao Cesgranrio', $2::jsonb, true) returning id`,
        [orgao, JSON.stringify(materia.topicos)],
      );
      const { rows: concurso } = await cliente.query<{ id: string }>(
        `insert into public.concursos (orgao, cargo, perfil_concurso_id)
         values ($1, 'indefinido', $2) returning id`,
        [orgao, perfil[0].id],
      );

      const cadernos: string[] = [];
      for (const letra of ["A", "B", "C"]) {
        const { rows } = await cliente.query<{ id: string }>(
          `insert into public.provas (banca, ano, orgao, cargo, caderno)
           values ('Fundacao Cesgranrio', 2021, $1, $2, $3) returning id`,
          [orgao, cargo, `Prova ${letra} - Gabarito 1`],
        );
        const prova = rows[0].id;
        await cliente.query("select public.registrar_grade_declarada($1, $2, $3::jsonb)", [
          prova,
          ITENS_POR_CADERNO,
          JSON.stringify([
            {
              ordem: 1,
              nome_impresso: "BLOCO",
              item_inicial: 1,
              item_final: ITENS_POR_CADERNO,
              materia_id: materia.materiaId,
            },
          ]),
        ]);
        for (let numero = 1; numero <= ITENS_POR_CADERNO; numero += 1) {
          await inserirQuestao(cliente, {
            prova_id: prova,
            numero,
            topico_id: materia.topicos[numero % materia.topicos.length],
            status: "publicada",
          });
        }
        await cliente.query("select public.vincular_prova_ao_concurso($1, $2, $3, $4)", [
          concurso[0].id,
          prova,
          operador,
          MOTIVO,
        ]);
        cadernos.push(prova);
      }

      // Os tres cadernos existem, estao vinculados e tem cobertura cheia...
      const { rows: cobertura } = await cliente.query<{ n: string }>(
        `select count(*) as n from public.cobertura_da_prova
          where prova_id = any($1) and cobertura = 1`,
        [cadernos],
      );
      expect(Number(cobertura[0].n)).toBe(3);

      // ...e ainda assim so um chega ao Raio-X (BANCO-16 AC6).
      const { rows: medidas } = await cliente.query<{ n: string }>(
        "select count(*) as n from public.provas_medidas where prova_id = any($1)",
        [cadernos],
      );
      expect(Number(medidas[0].n)).toBe(1);

      await recalcular(cliente);
      const materias = await lerMaterias(cliente, perfil[0].id);
      expect(materias[0].degrau).toBe(1);
      expect(materias[0].n_provas).toBe(1);
      // Os itens de UM caderno, todos por questao publicada — nenhuma etiqueta
      // existe. Se os tres contassem, seriam `3 * ITENS_POR_CADERNO`.
      expect(materias[0].n_questoes).toBe(ITENS_POR_CADERNO);
      const { rows: etiquetas } = await cliente.query<{ n: string }>(
        "select count(*) as n from public.etiquetas_de_item where prova_id = any($1)",
        [cadernos],
      );
      expect(Number(etiquetas[0].n)).toBe(0);
    });
  });
});
