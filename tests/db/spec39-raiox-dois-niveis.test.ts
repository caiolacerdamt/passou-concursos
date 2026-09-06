import { expect, it } from "vitest";

import { inserirQuestao, sufixo } from "./acervo";
import { comTransacaoSemPerfilConcurso } from "./conexao";
import {
  criarMateria,
  criarPerfil,
  criarProvaMedida,
  lerMaterias,
  lerTopicos,
  recalcular,
} from "./medicao";
import { descreveComBanco } from "./setup";

/**
 * SPEC 39 — os Success Criteria, contra o banco.
 *
 * O eixo e o que o AD-138 corrigiu: **o denominador nao e mais o acervo**.
 *
 *     peso(assunto) = peso_oficial(materia) x share(assunto | materia)
 *
 * O nivel 1 vem do documento (grade declarada da prova ou peso do edital) e o
 * nivel 2 e estimado dos itens etiquetados, por prova, combinado por media
 * ponderada pelo decaimento. Cada teste abaixo persegue um numero exato: e a
 * unica forma de o sensor de mutacao ter o que ficar vermelho.
 */

descreveComBanco("SPEC 39 — a prova e a unidade de medida", () => {
  it("40 itens de uma prova e 15 de outra do mesmo ano pesam igual", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const a = await criarMateria(cliente, 1);
      const b = await criarMateria(cliente, 1);
      const { perfilId, orgao } = await criarPerfil(cliente, [
        ...a.topicos,
        ...b.topicos,
      ]);

      // Prova grande: 40 itens, metade de cada materia.
      await criarProvaMedida(cliente, {
        orgao,
        ano: 2024,
        cargo: "Escriturario",
        blocos: [
          { materiaId: a.materiaId, itens: 20 },
          { materiaId: b.materiaId, itens: 20 },
        ],
        etiquetas: Object.fromEntries([
          ...Array.from({ length: 20 }, (_, i) => [i + 1, a.topicos[0]] as const),
          ...Array.from({ length: 20 }, (_, i) => [i + 21, b.topicos[0]] as const),
        ]),
      });

      // Prova pequena: 15 itens, 5 da materia A e 10 da B, MESMO ano.
      await criarProvaMedida(cliente, {
        orgao,
        ano: 2024,
        cargo: "Agente Comercial",
        blocos: [
          { materiaId: a.materiaId, itens: 5 },
          { materiaId: b.materiaId, itens: 10 },
        ],
        etiquetas: Object.fromEntries([
          ...Array.from({ length: 5 }, (_, i) => [i + 1, a.topicos[0]] as const),
          ...Array.from({ length: 10 }, (_, i) => [i + 6, b.topicos[0]] as const),
        ]),
      });

      await recalcular(cliente);
      const materias = await lerMaterias(cliente, perfilId);
      const porId = new Map(materias.map((linha) => [linha.materia_id, linha]));

      // Media das taxas por prova: (20/40 + 5/15) / 2 = 0,41666667.
      // Denominador unico daria 25/55 = 0,45454545 — a conta antiga.
      expect(Number(porId.get(a.materiaId)!.peso)).toBeCloseTo(0.41666667, 7);
      expect(Number(porId.get(b.materiaId)!.peso)).toBeCloseTo(0.58333333, 7);

      // Cada prova pesou uma vez, e o lastro diz quantas e de qual ano.
      expect(porId.get(a.materiaId)!.n_provas).toBe(2);
      expect(porId.get(a.materiaId)!.anos).toEqual([2024]);
      expect(porId.get(a.materiaId)!.degrau).toBe(1);
    });
  });

  it("prova abaixo do piso de cobertura fica de fora e aparece na lista de pendentes", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const a = await criarMateria(cliente, 1);
      const b = await criarMateria(cliente, 1);
      const { perfilId, orgao } = await criarPerfil(cliente, [
        ...a.topicos,
        ...b.topicos,
      ]);

      // Prova cheia: 10 itens, todos etiquetados.
      await criarProvaMedida(cliente, {
        orgao,
        ano: 2024,
        cargo: "Escriturario",
        blocos: [
          { materiaId: a.materiaId, itens: 5 },
          { materiaId: b.materiaId, itens: 5 },
        ],
        etiquetas: Object.fromEntries([
          ...Array.from({ length: 5 }, (_, i) => [i + 1, a.topicos[0]] as const),
          ...Array.from({ length: 5 }, (_, i) => [i + 6, b.topicos[0]] as const),
        ]),
      });

      // Prova pela metade: declara 10, so 4 itens etiquetados (cobertura 0,4).
      const parcial = await criarProvaMedida(cliente, {
        orgao,
        ano: 2024,
        cargo: "Agente Comercial",
        blocos: [{ materiaId: b.materiaId, itens: 10 }],
        etiquetas: Object.fromEntries(
          Array.from({ length: 4 }, (_, i) => [i + 1, b.topicos[0]] as const),
        ),
      });

      await recalcular(cliente);
      const materias = await lerMaterias(cliente, perfilId);
      const porId = new Map(materias.map((linha) => [linha.materia_id, linha]));

      // So a prova cheia entrou: 50/50, e nao os 5/15 que a segunda imporia.
      expect(Number(porId.get(a.materiaId)!.peso)).toBeCloseTo(0.5, 7);
      expect(porId.get(a.materiaId)!.n_provas).toBe(1);

      const { rows: pendentes } = await cliente.query<{ prova_id: string }>(
        "select prova_id from public.provas_pendentes_de_ingestao where prova_id = $1",
        [parcial],
      );
      expect(pendentes).toHaveLength(1);
    });
  });

  it("caderno irmao entra uma vez so", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const a = await criarMateria(cliente, 1);
      const b = await criarMateria(cliente, 1);
      const { perfilId, orgao } = await criarPerfil(cliente, [
        ...a.topicos,
        ...b.topicos,
      ]);

      const criar = async (caderno: string, itensDeA: number) => {
        const { rows } = await cliente.query<{ id: string }>(
          `insert into public.provas (banca, ano, orgao, cargo, caderno)
           values ('Cesgranrio', 2024, $1, 'Escriturario', $2) returning id`,
          [orgao, caderno],
        );
        const prova = rows[0].id;
        await cliente.query(
          "select public.registrar_grade_declarada($1, 10, $2::jsonb)",
          [
            prova,
            JSON.stringify([
              {
                ordem: 1,
                item_inicial: 1,
                item_final: itensDeA,
                materia_id: a.materiaId,
              },
              {
                ordem: 2,
                item_inicial: itensDeA + 1,
                item_final: 10,
                materia_id: b.materiaId,
              },
            ]),
          ],
        );
        await cliente.query(
          "select * from public.gravar_etiquetas_ia($1, $2::jsonb, 'teste')",
          [
            prova,
            JSON.stringify(
              Array.from({ length: 10 }, (_, i) => ({
                numero: i + 1,
                topico_id: i < itensDeA ? a.topicos[0] : b.topicos[0],
                confianca: 0.9,
              })),
            ),
          ],
        );
        return prova;
      };

      const principal = await criar("Tipo 1", 8);
      const irmao = await criar("Tipo 2", 2);
      await cliente.query("select public.vincular_caderno_irmao($1, $2)", [
        irmao,
        principal,
      ]);

      await recalcular(cliente);
      const porId = new Map(
        (await lerMaterias(cliente, perfilId)).map((l) => [l.materia_id, l]),
      );

      // O principal manda: 8/10. Se o irmao somasse, a media daria 0,5.
      expect(Number(porId.get(a.materiaId)!.peso)).toBeCloseTo(0.8, 7);
      expect(porId.get(a.materiaId)!.n_provas).toBe(1);
    });
  });
});

descreveComBanco("SPEC 39 — peso oficial em dois niveis", () => {
  it("zerar as questoes de uma materia nao muda o peso dela e divide em partes iguais", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const a = await criarMateria(cliente, 2);
      const b = await criarMateria(cliente, 3);
      const { perfilId, orgao } = await criarPerfil(cliente, [
        ...a.topicos,
        ...b.topicos,
      ]);

      // 10 itens de A e 10 de B na grade declarada; SO os de A tem etiqueta.
      await criarProvaMedida(cliente, {
        orgao,
        ano: 2024,
        cargo: "Escriturario",
        blocos: [
          { materiaId: a.materiaId, itens: 10 },
          { materiaId: b.materiaId, itens: 10 },
        ],
        etiquetas: Object.fromEntries([
          ...Array.from({ length: 10 }, (_, i) => [
            i + 1,
            i < 6 ? a.topicos[0] : a.topicos[1],
          ] as const),
          // Os 10 itens de B tambem sao etiquetados, mas com assunto de A: a
          // cobertura fica cheia e a materia B continua com amostra zero.
          ...Array.from({ length: 10 }, (_, i) => [i + 11, a.topicos[0]] as const),
        ]),
      });

      await recalcular(cliente);
      const materias = new Map(
        (await lerMaterias(cliente, perfilId)).map((l) => [l.materia_id, l]),
      );

      // O peso da materia vem da GRADE, nao da contagem: 10/20 para cada uma,
      // mesmo com B sem um unico item etiquetado.
      expect(Number(materias.get(b.materiaId)!.peso)).toBeCloseTo(0.5, 7);
      expect(materias.get(b.materiaId)!.n_questoes).toBe(0);
      expect(materias.get(b.materiaId)!.degrau).toBe(2);
      expect(materias.get(b.materiaId)!.amostra_baixa).toBe(true);

      const topicos = new Map(
        (await lerTopicos(cliente, perfilId)).map((l) => [l.topico_id, l]),
      );
      // Partes iguais: 0,5 / 3 assuntos.
      for (const topico of b.topicos) {
        expect(Number(topicos.get(topico)!.peso)).toBeCloseTo(0.5 / 3, 7);
        expect(topicos.get(topico)!.amostra_baixa).toBe(true);
        expect(topicos.get(topico)!.degrau).toBe(2);
      }
    });
  });

  it("o amortecimento tem como ancora a media DAQUELA materia, nao a media geral", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      // A tem 2 assuntos (media da materia = 1/2); B tem 8 (media = 1/8).
      // A media GERAL seria 1/10 — e a diferenca que o sensor persegue.
      const a = await criarMateria(cliente, 2);
      const b = await criarMateria(cliente, 8);
      const { perfilId, orgao } = await criarPerfil(cliente, [
        ...a.topicos,
        ...b.topicos,
      ]);

      // 10 itens de A, todos do primeiro assunto de A. B nao e medida.
      await criarProvaMedida(cliente, {
        orgao,
        ano: 2026,
        cargo: "Escriturario",
        blocos: [
          { materiaId: a.materiaId, itens: 10 },
          { materiaId: b.materiaId, itens: 10 },
        ],
        etiquetas: Object.fromEntries(
          Array.from({ length: 20 }, (_, i) => [i + 1, a.topicos[0]] as const),
        ),
      });

      await recalcular(cliente, "2026-01-15");
      const topicos = new Map(
        (await lerTopicos(cliente, perfilId)).map((l) => [l.topico_id, l]),
      );

      // n_m = 20 (todos os itens etiquetados caem na materia do ASSUNTO, que e
      // A), k = 10, share_bruto = 1 para o primeiro assunto e 0 para o segundo.
      //   share(a1) = (20*1 + 10*(1/2)) / 30 = 0,83333333
      //   share(a2) = (20*0 + 10*(1/2)) / 30 = 0,16666667
      // Com a media GERAL (1/10) sairia 0,7 e 0,03333 — renormalizado, outro
      // numero. E este `toBeCloseTo` que fica vermelho na mutacao.
      expect(Number(topicos.get(a.topicos[0])!.peso)).toBeCloseTo(0.5 * 0.83333333, 6);
      expect(Number(topicos.get(a.topicos[1])!.peso)).toBeCloseTo(0.5 * 0.16666667, 6);

      // A soma dos shares dentro da materia e 1 (RAIOX-16 AC3).
      const somaA =
        Number(topicos.get(a.topicos[0])!.peso) +
        Number(topicos.get(a.topicos[1])!.peso);
      expect(somaA).toBeCloseTo(0.5, 6);
    });
  });

  it("assunto fora do programa recebe zero antes de qualquer multiplicacao", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const a = await criarMateria(cliente, 2);
      // So o primeiro assunto de A entra no programa do edital.
      const { perfilId, orgao } = await criarPerfil(cliente, [a.topicos[0]]);

      await criarProvaMedida(cliente, {
        orgao,
        ano: 2026,
        cargo: "Escriturario",
        blocos: [{ materiaId: a.materiaId, itens: 10 }],
        etiquetas: Object.fromEntries(
          Array.from({ length: 10 }, (_, i) => [
            i + 1,
            i < 5 ? a.topicos[0] : a.topicos[1],
          ] as const),
        ),
      });

      await recalcular(cliente, "2026-01-15");
      const topicos = await lerTopicos(cliente, perfilId);

      // O assunto de fora nao tem linha, e o de dentro fica com a materia
      // inteira: o share nao divide com quem o edital nao cobra.
      expect(topicos).toHaveLength(1);
      expect(topicos[0].topico_id).toBe(a.topicos[0]);
      expect(Number(topicos[0].peso)).toBeCloseTo(1, 6);
      // n conta so o item elegivel: 5, e nao os 10 da materia.
      expect(topicos[0].n_questoes).toBe(5);
      // E a amostra da MATERIA tambem: 5 itens elegiveis contra o piso de 10.
      // Contar os 10 itens da materia levaria a amostra a 10 e apagaria o
      // rotulo — e a diferenca observavel entre zerar antes e zerar depois.
      expect(topicos[0].amostra_baixa).toBe(true);
      const { rows: materia } = await cliente.query<{ n_questoes: number }>(
        `select n_questoes from public.raiox_projecoes_materia
          where perfil_concurso_id = $1`,
        [perfilId],
      );
      expect(materia[0].n_questoes).toBe(5);
    });
  });

  it("a taxa e por prova: duas provas do mesmo ano entram pela media, nao pela soma", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const a = await criarMateria(cliente, 2);
      const { perfilId, orgao } = await criarPerfil(cliente, a.topicos);

      // Prova grande, inclinada para o primeiro assunto: 16 x 4.
      await criarProvaMedida(cliente, {
        orgao,
        ano: 2025,
        cargo: "Escriturario",
        blocos: [{ materiaId: a.materiaId, itens: 20 }],
        etiquetas: Object.fromEntries(
          Array.from({ length: 20 }, (_, i) => [
            i + 1,
            i < 16 ? a.topicos[0] : a.topicos[1],
          ] as const),
        ),
      });

      // Prova pequena do MESMO ano, inclinada para o outro lado: 1 x 4.
      await criarProvaMedida(cliente, {
        orgao,
        ano: 2025,
        cargo: "Agente Comercial",
        blocos: [{ materiaId: a.materiaId, itens: 5 }],
        etiquetas: Object.fromEntries(
          Array.from({ length: 5 }, (_, i) => [
            i + 1,
            i < 1 ? a.topicos[0] : a.topicos[1],
          ] as const),
        ),
      });

      await recalcular(cliente, "2026-01-15");
      const topicos = new Map(
        (await lerTopicos(cliente, perfilId)).map((l) => [l.topico_id, l]),
      );

      // Media das taxas por prova, com o mesmo peso de ano: (0,8 + 0,2)/2 = 0,5.
      // Somar os itens das duas provas num denominador so daria 17/25 = 0,68 —
      // e a prova grande decidiria a distribuicao sozinha.
      expect(Number(topicos.get(a.topicos[0])!.peso)).toBeCloseTo(0.5, 6);
      expect(Number(topicos.get(a.topicos[1])!.peso)).toBeCloseTo(0.5, 6);
      expect(topicos.get(a.topicos[0])!.n_questoes).toBe(17);
      expect(topicos.get(a.topicos[0])!.n_provas).toBe(2);
    });
  });

  it("a base do peso e registrada: pontos quando a prova declara pontuacao", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const a = await criarMateria(cliente, 1);
      const b = await criarMateria(cliente, 1);
      const { perfilId, orgao } = await criarPerfil(cliente, [
        ...a.topicos,
        ...b.topicos,
      ]);

      await criarProvaMedida(cliente, {
        orgao,
        ano: 2026,
        cargo: "Escriturario",
        pontuacaoPorItem: 2,
        blocos: [
          { materiaId: a.materiaId, itens: 5 },
          { materiaId: b.materiaId, itens: 5 },
        ],
        etiquetas: Object.fromEntries([
          ...Array.from({ length: 5 }, (_, i) => [i + 1, a.topicos[0]] as const),
          ...Array.from({ length: 5 }, (_, i) => [i + 6, b.topicos[0]] as const),
        ]),
      });

      await recalcular(cliente, "2026-01-15");
      const materias = await lerMaterias(cliente, perfilId);
      expect(materias.every((linha) => linha.base_do_peso === "pontos")).toBe(true);
    });
  });
});

descreveComBanco("SPEC 39 — degraus de lastro", () => {
  it("concurso so com edital mostra peso por materia, degrau 2 e sem detalhe por assunto", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const a = await criarMateria(cliente, 2);
      const b = await criarMateria(cliente, 4);
      const { perfilId } = await criarPerfil(cliente, [...a.topicos, ...b.topicos]);

      const { rows: concurso } = await cliente.query<{ id: string }>(
        `insert into public.concursos (orgao, cargo, perfil_concurso_id)
         values ($1, 'Escriturario', $2) returning id`,
        [`CAIXA ${sufixo()}`, perfilId],
      );

      // O edital declara 30 questoes de A e 10 de B. Nenhuma prova existe.
      await cliente.query(
        "select public.registrar_peso_do_edital($1, $2::jsonb)",
        [
          concurso[0].id,
          JSON.stringify([
            { materia_id: a.materiaId, peso_declarado: 30, base: "itens" },
            { materia_id: b.materiaId, peso_declarado: 10, base: "itens" },
          ]),
        ],
      );

      await recalcular(cliente, "2026-01-15");
      const materias = new Map(
        (await lerMaterias(cliente, perfilId)).map((l) => [l.materia_id, l]),
      );

      expect(Number(materias.get(a.materiaId)!.peso)).toBeCloseTo(0.75, 7);
      expect(Number(materias.get(b.materiaId)!.peso)).toBeCloseTo(0.25, 7);
      expect(materias.get(a.materiaId)!.degrau).toBe(2);
      expect(materias.get(a.materiaId)!.base_do_peso).toBe("edital");
      expect(materias.get(a.materiaId)!.n_provas).toBe(0);

      // Sem prova nenhuma, o desenho de dentro e partes iguais e a tela para na
      // materia: nao ha percentual por assunto que a evidencia sustente.
      const topicos = new Map(
        (await lerTopicos(cliente, perfilId)).map((l) => [l.topico_id, l]),
      );
      for (const topico of a.topicos) {
        expect(Number(topicos.get(topico)!.peso)).toBeCloseTo(0.75 / 2, 7);
        expect(topicos.get(topico)!.degrau).toBe(2);
      }
      for (const topico of b.topicos) {
        expect(Number(topicos.get(topico)!.peso)).toBeCloseTo(0.25 / 4, 7);
      }
    });
  });

  it("degrau 3 muda o desenho de dentro da materia e nao muda o peso da materia", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const a = await criarMateria(cliente, 2);
      const b = await criarMateria(cliente, 1);
      const { perfilId, orgao } = await criarPerfil(cliente, [
        ...a.topicos,
        ...b.topicos,
      ]);

      // Prova do PROPRIO concurso: grade declarada (peso da materia), e as
      // etiquetas caem todas em B — a materia A fica sem desenho proprio.
      await criarProvaMedida(cliente, {
        orgao,
        ano: 2026,
        cargo: "Escriturario",
        blocos: [
          { materiaId: a.materiaId, itens: 6 },
          { materiaId: b.materiaId, itens: 4 },
        ],
        etiquetas: Object.fromEntries(
          Array.from({ length: 10 }, (_, i) => [i + 1, b.topicos[0]] as const),
        ),
      });

      // Prova da MESMA banca em outro orgao: mede a materia A, 3 para o
      // primeiro assunto e 1 para o segundo.
      await criarProvaMedida(cliente, {
        orgao: `CAIXA ${sufixo()}`,
        ano: 2026,
        cargo: "Tecnico Bancario",
        blocos: [{ materiaId: a.materiaId, itens: 4 }],
        etiquetas: {
          1: a.topicos[0],
          2: a.topicos[0],
          3: a.topicos[0],
          4: a.topicos[1],
        },
      });

      await recalcular(cliente, "2026-01-15");
      const materias = new Map(
        (await lerMaterias(cliente, perfilId)).map((l) => [l.materia_id, l]),
      );
      const topicos = new Map(
        (await lerTopicos(cliente, perfilId)).map((l) => [l.topico_id, l]),
      );

      // O peso da materia continua vindo do documento do PROPRIO concurso:
      // 6/10, e nao 4/4 da prova do outro orgao.
      expect(Number(materias.get(a.materiaId)!.peso)).toBeCloseTo(0.6, 7);
      expect(materias.get(a.materiaId)!.degrau).toBe(3);
      expect(materias.get(a.materiaId)!.base_do_peso).toBe("itens");

      // O desenho de dentro veio emprestado e por isso desempata para o lado do
      // primeiro assunto, mas amortecido mais forte (n efetivo = 4 x 0,5 = 2):
      //   share(a1) = (2*0,75 + 10*0,5) / 12 = 0,54166667
      const primeiro = Number(topicos.get(a.topicos[0])!.peso) / 0.6;
      const segundo = Number(topicos.get(a.topicos[1])!.peso) / 0.6;
      expect(primeiro).toBeCloseTo(0.54166667, 6);
      expect(segundo).toBeCloseTo(0.45833333, 6);
      expect(primeiro + segundo).toBeCloseTo(1, 6);
    });
  });

  it("sem documento proprio a linha cai para degrau 4, nunca importa peso de outro orgao", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const a = await criarMateria(cliente, 2);
      const { perfilId, orgao } = await criarPerfil(cliente, a.topicos);

      // So existe prova de outro orgao da mesma banca. Nenhum documento do
      // proprio concurso, nenhum peso de edital.
      await criarProvaMedida(cliente, {
        orgao: `CAIXA ${sufixo()}`,
        ano: 2026,
        cargo: "Tecnico Bancario",
        blocos: [{ materiaId: a.materiaId, itens: 4 }],
        etiquetas: { 1: a.topicos[0], 2: a.topicos[0], 3: a.topicos[0], 4: a.topicos[1] },
      });
      void orgao;

      await recalcular(cliente, "2026-01-15");
      const materias = await lerMaterias(cliente, perfilId);

      expect(materias).toHaveLength(1);
      expect(materias[0].degrau).toBe(4);
      expect(Number(materias[0].peso)).toBe(0);
      expect(materias[0].base_do_peso).toBe("sem_dado");
      expect(materias[0].n_provas).toBe(0);
      expect(materias[0].anos).toEqual([]);
    });
  });

  it("o cargo 'indefinido' do concurso migrado nao filtra prova nenhuma", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const a = await criarMateria(cliente, 1);
      const b = await criarMateria(cliente, 1);
      const { perfilId, orgao } = await criarPerfil(cliente, [
        ...a.topicos,
        ...b.topicos,
      ]);

      // O concurso numero 1 nasceu da migracao da SPEC 37 com o sentinela
      // `indefinido` no cargo, igual a `banca = 'indefinida'`. Filtrar por ele
      // deixaria o concurso sem prova propria, tudo no degrau 4 e o plano do dia
      // sem topico — que e o produto inteiro parando.
      await cliente.query(
        `insert into public.concursos (orgao, cargo, perfil_concurso_id)
         values ($1, 'indefinido', $2)`,
        [orgao, perfilId],
      );

      await criarProvaMedida(cliente, {
        orgao,
        ano: 2025,
        cargo: "Escriturario",
        blocos: [
          { materiaId: a.materiaId, itens: 6 },
          { materiaId: b.materiaId, itens: 4 },
        ],
        etiquetas: Object.fromEntries([
          ...Array.from({ length: 6 }, (_, i) => [i + 1, a.topicos[0]] as const),
          ...Array.from({ length: 4 }, (_, i) => [i + 7, b.topicos[0]] as const),
        ]),
      });

      await recalcular(cliente, "2026-01-15");
      const materias = new Map(
        (await lerMaterias(cliente, perfilId)).map((l) => [l.materia_id, l]),
      );

      expect(materias.get(a.materiaId)!.degrau).toBe(1);
      expect(Number(materias.get(a.materiaId)!.peso)).toBeCloseTo(0.6, 7);
    });
  });

  it("degraus diferentes coexistem na mesma projecao", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const a = await criarMateria(cliente, 1);
      const b = await criarMateria(cliente, 2);
      const { perfilId, orgao } = await criarPerfil(cliente, [
        ...a.topicos,
        ...b.topicos,
      ]);

      // A prova propria mede A e declara B; ninguem mede B em lugar nenhum.
      await criarProvaMedida(cliente, {
        orgao,
        ano: 2026,
        cargo: "Escriturario",
        blocos: [
          { materiaId: a.materiaId, itens: 5 },
          { materiaId: b.materiaId, itens: 5 },
        ],
        etiquetas: Object.fromEntries(
          Array.from({ length: 10 }, (_, i) => [i + 1, a.topicos[0]] as const),
        ),
      });

      await recalcular(cliente, "2026-01-15");
      const materias = new Map(
        (await lerMaterias(cliente, perfilId)).map((l) => [l.materia_id, l]),
      );

      expect(materias.get(a.materiaId)!.degrau).toBe(1);
      expect(materias.get(b.materiaId)!.degrau).toBe(2);
    });
  });
});

descreveComBanco("SPEC 39 — invariantes que nao podem cair", () => {
  it("publicar centenas de ineditas nao move nenhuma linha", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const a = await criarMateria(cliente, 2);
      const { perfilId, orgao } = await criarPerfil(cliente, a.topicos);

      await criarProvaMedida(cliente, {
        orgao,
        ano: 2026,
        cargo: "Escriturario",
        blocos: [{ materiaId: a.materiaId, itens: 10 }],
        etiquetas: Object.fromEntries(
          Array.from({ length: 10 }, (_, i) => [
            i + 1,
            i < 7 ? a.topicos[0] : a.topicos[1],
          ] as const),
        ),
      });

      await recalcular(cliente, "2026-01-15");
      const antes = await lerTopicos(cliente, perfilId);

      // 300 ineditas no assunto menos cobrado. A trava `gerada_ia_passa_por_
      // revisao` (BANCO-07 AC2) impede que inedita chegue a `publicada` por
      // INSERT; `em_revisao` e o mais longe que ela vai sem a fila humana — e
      // ja e mais do que o suficiente, porque o recalculo **nao le `questoes`**.
      await cliente.query(
        `insert into public.questoes
           (origem, topico_id, tipo_questao, enunciado, alternativas,
            resposta_correta, status)
         select 'gerada_ia', $1, 'multipla_escolha',
                'Enunciado inedito ' || g, $2::jsonb, 'A', 'em_revisao'
           from generate_series(1, 300) g`,
        [
          a.topicos[1],
          JSON.stringify([
            { letra: "A", texto: "um" },
            { letra: "B", texto: "dois" },
            { letra: "C", texto: "tres" },
            { letra: "D", texto: "quatro" },
            { letra: "E", texto: "cinco" },
          ]),
        ],
      );

      // E questoes REAIS publicadas de uma prova sem grade lida: o acervo
      // cresceu, e mesmo assim nenhuma linha se mexe. Era exatamente isto que a
      // conta antiga nao aguentava.
      for (let i = 0; i < 3; i += 1) {
        await inserirQuestao(cliente, {
          topico_id: a.topicos[1],
          numero: i + 1,
          status: "publicada",
        });
      }

      await recalcular(cliente, "2026-01-15");
      expect(await lerTopicos(cliente, perfilId)).toEqual(antes);
    });
  });

  it("apagar a projecao e recalcular devolve exatamente os mesmos numeros", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const a = await criarMateria(cliente, 3);
      const b = await criarMateria(cliente, 2);
      const { perfilId, orgao } = await criarPerfil(cliente, [
        ...a.topicos,
        ...b.topicos,
      ]);

      await criarProvaMedida(cliente, {
        orgao,
        ano: 2023,
        cargo: "Escriturario",
        blocos: [
          { materiaId: a.materiaId, itens: 7 },
          { materiaId: b.materiaId, itens: 3 },
        ],
        etiquetas: Object.fromEntries([
          ...Array.from({ length: 7 }, (_, i) => [
            i + 1,
            a.topicos[i % 3],
          ] as const),
          ...Array.from({ length: 3 }, (_, i) => [i + 8, b.topicos[i % 2]] as const),
        ]),
      });
      await criarProvaMedida(cliente, {
        orgao,
        ano: 2026,
        cargo: "Agente Comercial",
        blocos: [
          { materiaId: a.materiaId, itens: 4 },
          { materiaId: b.materiaId, itens: 6 },
        ],
        etiquetas: Object.fromEntries([
          ...Array.from({ length: 4 }, (_, i) => [i + 1, a.topicos[i % 3]] as const),
          ...Array.from({ length: 6 }, (_, i) => [i + 5, b.topicos[i % 2]] as const),
        ]),
      });

      await recalcular(cliente, "2026-01-15");
      const primeira = await lerTopicos(cliente, perfilId);
      const primeiraMateria = await lerMaterias(cliente, perfilId);

      await cliente.query(
        "delete from public.raiox_projecoes where perfil_concurso_id = $1",
        [perfilId],
      );
      await cliente.query(
        "delete from public.raiox_projecoes_materia where perfil_concurso_id = $1",
        [perfilId],
      );
      await recalcular(cliente, "2026-01-15");

      expect(await lerTopicos(cliente, perfilId)).toEqual(primeira);
      expect(await lerMaterias(cliente, perfilId)).toEqual(primeiraMateria);
    });
  });

  it("nenhuma consulta do Raio-X toca tentativas", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const { rows } = await cliente.query<{ corpo: string }>(
        `select pg_get_functiondef(p.oid) as corpo
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = 'recalcula_raiox'`,
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].corpo).not.toMatch(/\btentativas\b/);
      // A view do bloco e a fonte do nivel 1: tambem nao pode olhar o aluno.
      const { rows: view } = await cliente.query<{ corpo: string }>(
        "select pg_get_viewdef('public.prova_bloco_materia'::regclass) as corpo",
      );
      expect(view[0].corpo).not.toMatch(/\btentativas\b/);
    });
  });

  it("a assinatura da fronteira com o motor do plano nao muda", async () => {
    await comTransacaoSemPerfilConcurso(async (cliente) => {
      const { rows } = await cliente.query<{ coluna: string }>(
        `select attname as coluna
           from pg_attribute
          where attrelid = 'public.raiox_peso_topico'::regclass and attnum > 0
          order by attnum`,
      );
      expect(rows.map((linha) => linha.coluna)).toEqual(["topico_id", "peso"]);
    });
  });
});
