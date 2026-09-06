import type { Client } from "pg";
import { expect, it } from "vitest";

import { criarProva, criarTopico, inserirQuestao, sufixo } from "./acervo";
import { comTransacaoRevertida } from "./conexao";
import { criarUsuario } from "./conta";
import { descreveComBanco } from "./setup";

/**
 * SPEC 38 — os Success Criteria, contra o banco.
 *
 * O eixo e a hierarquia que a spec fixou e que nenhum caminho pode furar:
 *
 *     questao publicada  >  etiqueta humana  >  etiqueta de IA
 *
 * mais o veredito da grade: soma que nao fecha **barra** a prova, em vez de
 * deixar entrar peso errado.
 */

const CAIXA_2021 = [
  { ordem: 1, nome_impresso: "LÍNGUA PORTUGUESA", item_inicial: 1, item_final: 10, pontuacao_por_item: 1 },
  { ordem: 2, nome_impresso: "MATEMÁTICA FINANCEIRA", item_inicial: 11, item_final: 20, pontuacao_por_item: 1 },
  { ordem: 3, nome_impresso: "CONHECIMENTOS BANCÁRIOS", item_inicial: 21, item_final: 30, pontuacao_por_item: 1 },
  { ordem: 4, nome_impresso: "NOÇÕES DE PROBABILIDADE E ESTATÍSTICA", item_inicial: 31, item_final: 35, pontuacao_por_item: 1 },
  { ordem: 5, nome_impresso: "CONHECIMENTOS DE INFORMÁTICA", item_inicial: 36, item_final: 45, pontuacao_por_item: 1 },
  { ordem: 6, nome_impresso: "ATENDIMENTO BANCÁRIO", item_inicial: 46, item_final: 60, pontuacao_por_item: 1 },
];

async function registrarGrade(
  cliente: Client,
  prova: string,
  total: number | null,
  blocos: unknown[],
): Promise<string> {
  const { rows } = await cliente.query<{ status: string }>(
    "select public.registrar_grade_declarada($1, $2, $3::jsonb) as status",
    [prova, total, JSON.stringify(blocos)],
  );
  return rows[0].status;
}

async function etiquetar(
  cliente: Client,
  prova: string,
  etiquetas: { numero: number; topico_id: string; confianca: number }[],
  modelo = "versao-fixada-de-teste",
): Promise<{ gravadas: number; preservadas: number; alinhadas: number }> {
  const { rows } = await cliente.query(
    "select * from public.gravar_etiquetas_ia($1, $2::jsonb, $3)",
    [prova, JSON.stringify(etiquetas), modelo],
  );
  return {
    gravadas: Number(rows[0].gravadas),
    preservadas: Number(rows[0].preservadas),
    alinhadas: Number(rows[0].alinhadas),
  };
}

async function criarOperador(cliente: Client): Promise<string> {
  const operador = await criarUsuario(cliente);
  await cliente.query("insert into public.operadores (operador_id) values ($1)", [operador]);
  return operador;
}

descreveComBanco("SPEC 38 — a prova declara a grade e o item ganha etiqueta", () => {
  it("a grade da CAIXA 2021 sai com 6 blocos somando 60 itens", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const prova = await criarProva(cliente);

      expect(await registrarGrade(cliente, prova, 60, CAIXA_2021)).toBe("lida");

      const { rows } = await cliente.query(
        `select count(*)::int as blocos,
                sum(item_final - item_inicial + 1)::int as itens,
                sum(public.peso_do_bloco(b.*))::numeric as peso
           from public.prova_blocos b where prova_id = $1`,
        [prova],
      );
      expect(rows[0].blocos).toBe(6);
      expect(rows[0].itens).toBe(60);
      // Pontuacao 1,0 por item: o peso em pontos e a contagem, e a base fica
      // registrada na linha (BANCO-15 AC3).
      expect(Number(rows[0].peso)).toBe(60);
    });
  });

  it("adulterar um cabecalho derruba a prova como inconsistente, sem gerar peso errado", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const prova = await criarProva(cliente);
      const adulterada = CAIXA_2021.map((b) =>
        b.ordem === 6 ? { ...b, item_final: 50 } : b,
      );

      expect(await registrarGrade(cliente, prova, 60, adulterada)).toBe("inconsistente");

      const { rows } = await cliente.query(
        "select count(*)::int as total from public.provas_medidas where prova_id = $1",
        [prova],
      );
      expect(rows[0].total).toBe(0);
    });
  });

  it("faixa sobreposta tambem e inconsistente, mesmo com a soma batendo", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const prova = await criarProva(cliente);
      // 1-10 e 5-14 somam 20 itens declarados, mas o item 5 pesaria duas vezes.
      const sobreposta = [
        { ordem: 1, nome_impresso: "A", item_inicial: 1, item_final: 10, pontuacao_por_item: 1 },
        { ordem: 2, nome_impresso: "B", item_inicial: 5, item_final: 14, pontuacao_por_item: 1 },
      ];

      expect(await registrarGrade(cliente, prova, 20, sobreposta)).toBe("inconsistente");
    });
  });

  it("grade que nao pode ser lida fica ausente, sem bloco e na fila humana", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const prova = await criarProva(cliente);

      expect(await registrarGrade(cliente, prova, null, [])).toBe("ausente");

      const { rows: blocos } = await cliente.query(
        "select count(*)::int as total from public.prova_blocos where prova_id = $1",
        [prova],
      );
      expect(blocos[0].total).toBe(0);

      const { rows: fila } = await cliente.query(
        "select count(*)::int as total from public.grade_ausente_fila where prova_id = $1",
        [prova],
      );
      expect(fila[0].total).toBe(1);
    });
  });

  it("relida, a grade e um retrato inteiro e nao a mistura de duas leituras", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const prova = await criarProva(cliente);
      await registrarGrade(cliente, prova, 60, CAIXA_2021);
      await registrarGrade(cliente, prova, 20, CAIXA_2021.slice(0, 2));

      const { rows } = await cliente.query(
        "select count(*)::int as total from public.prova_blocos where prova_id = $1",
        [prova],
      );
      expect(rows[0].total).toBe(2);
    });
  });

  it("corrigir tres etiquetas a mao e reexecutar preserva as tres e nao duplica linha", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const prova = await criarProva(cliente);
      const daIa = await criarTopico(cliente);
      const doHumano = await criarTopico(cliente);
      const operador = await criarOperador(cliente);

      const primeiraRodada = [1, 2, 3, 4, 5].map((numero) => ({
        numero,
        topico_id: daIa,
        confianca: 0.8,
      }));
      expect((await etiquetar(cliente, prova, primeiraRodada)).gravadas).toBe(5);

      for (const numero of [1, 2, 3]) {
        await cliente.query("select public.corrigir_etiqueta($1, $2, $3, $4, $5)", [
          prova,
          numero,
          doHumano,
          operador,
          "conferido no PDF",
        ]);
      }

      const segunda = await etiquetar(cliente, prova, primeiraRodada);
      expect(segunda.preservadas).toBe(3);

      const { rows } = await cliente.query(
        `select numero, topico_id, origem from public.etiquetas_de_item
          where prova_id = $1 order by numero`,
        [prova],
      );
      expect(rows).toHaveLength(5);
      expect(rows.filter((l) => l.origem === "humano").map((l) => l.topico_id)).toEqual([
        doHumano,
        doHumano,
        doHumano,
      ]);
      expect(rows.filter((l) => l.origem === "ia")).toHaveLength(2);
    });
  });

  it("a correcao humana fica registrada em operador_acoes", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const prova = await criarProva(cliente);
      const topico = await criarTopico(cliente);
      const operador = await criarOperador(cliente);

      await cliente.query("select public.corrigir_etiqueta($1, $2, $3, $4, $5)", [
        prova,
        7,
        topico,
        operador,
        "assunto errado na primeira rodada",
      ]);

      const { rows } = await cliente.query(
        `select motivo, dados from public.operador_acoes
          where tipo = 'corrigir_etiqueta' and entidade_id = $1`,
        [prova],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].dados.numero).toBe(7);
    });
  });

  it("recusa correcao de quem nao e operador ativo", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const prova = await criarProva(cliente);
      const topico = await criarTopico(cliente);
      const qualquer = await criarUsuario(cliente);

      await expect(
        cliente.query("select public.corrigir_etiqueta($1, $2, $3, $4, $5)", [
          prova,
          1,
          topico,
          qualquer,
          "motivo",
        ]),
      ).rejects.toThrow(/operador_invalido/);
    });
  });

  it("recusa correcao sem motivo", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const prova = await criarProva(cliente);
      const topico = await criarTopico(cliente);
      const operador = await criarOperador(cliente);

      await expect(
        cliente.query("select public.corrigir_etiqueta($1, $2, $3, $4, $5)", [
          prova,
          1,
          topico,
          operador,
          "   ",
        ]),
      ).rejects.toThrow(/motivo_obrigatorio/);
    });
  });

  it("a questao publicada e a verdade: a etiqueta aponta para o assunto dela", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const prova = await criarProva(cliente);
      const daIa = await criarTopico(cliente);
      const daQuestao = await criarTopico(cliente);

      await inserirQuestao(cliente, {
        prova_id: prova,
        numero: 4,
        topico_id: daQuestao,
        status: "publicada",
      });

      const resumo = await etiquetar(cliente, prova, [
        { numero: 4, topico_id: daIa, confianca: 0.6 },
      ]);
      expect(resumo.alinhadas).toBe(1);

      const { rows } = await cliente.query(
        "select topico_id, confianca from public.etiquetas_de_item where prova_id = $1 and numero = 4",
        [prova],
      );
      expect(rows[0].topico_id).toBe(daQuestao);
      expect(Number(rows[0].confianca)).toBe(1);
    });
  });

  it("item com questao publicada nao aceita correcao local — a correcao e na questao", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const prova = await criarProva(cliente);
      const daQuestao = await criarTopico(cliente);
      const outro = await criarTopico(cliente);
      const operador = await criarOperador(cliente);

      await inserirQuestao(cliente, {
        prova_id: prova,
        numero: 9,
        topico_id: daQuestao,
        status: "publicada",
      });

      await expect(
        cliente.query("select public.corrigir_etiqueta($1, $2, $3, $4, $5)", [
          prova,
          9,
          outro,
          operador,
          "quero mudar",
        ]),
      ).rejects.toThrow(/item_tem_questao_publicada/);
    });
  });

  it("etiqueta de IA sem versao do modelo nao entra", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const prova = await criarProva(cliente);
      const topico = await criarTopico(cliente);

      await expect(
        cliente.query("select * from public.gravar_etiquetas_ia($1, $2::jsonb, $3)", [
          prova,
          JSON.stringify([{ numero: 1, topico_id: topico, confianca: 0.5 }]),
          "  ",
        ]),
      ).rejects.toThrow(/modelo_versao_obrigatoria/);
    });
  });

  it("BB 2021 A, B e C contam como uma prova so no peso do ano", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const orgao = `Banco do Brasil ${sufixo()}`;
      const cadernos: string[] = [];
      for (const caderno of ["A", "B", "C"]) {
        const { rows } = await cliente.query<{ id: string }>(
          `insert into public.provas (banca, ano, orgao, cargo, caderno)
           values ('Cesgranrio', 2021, $1, 'Escriturario', $2) returning id`,
          [orgao, caderno],
        );
        cadernos.push(rows[0].id);
      }

      for (const id of cadernos) await registrarGrade(cliente, id, 60, CAIXA_2021);

      // **Antes** de qualquer vinculo: a view ja conta um caderno so. Nao existe
      // estado em que os tres somem peso, nem por esquecimento do operador.
      const { rows: semVinculo } = await cliente.query(
        `select count(*)::int as total from public.provas_medidas
          where orgao = $1 and ano = 2021`,
        [orgao],
      );
      expect(semVinculo[0].total).toBe(1);

      // Vincular e o ato explicito que registra qual e o principal (AC6).
      await cliente.query("select public.vincular_caderno_irmao($1, $2)", [cadernos[1], cadernos[0]]);
      await cliente.query("select public.vincular_caderno_irmao($1, $2)", [cadernos[2], cadernos[0]]);

      const { rows } = await cliente.query(
        `select prova_id from public.provas_medidas where orgao = $1 and ano = 2021`,
        [orgao],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].prova_id).toBe(cadernos[0]);

      // O irmao continua registrado e medivel — ele so nao soma peso.
      const { rows: todos } = await cliente.query(
        "select count(*)::int as total from public.cobertura_da_prova where orgao = $1",
        [orgao],
      );
      expect(todos[0].total).toBe(3);
    });
  });

  it("recusa vincular caderno de outro concurso como irmao", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const a = await criarProva(cliente);
      const b = await criarProva(cliente);

      await expect(
        cliente.query("select public.vincular_caderno_irmao($1, $2)", [a, b]),
      ).rejects.toThrow(/cadernos_de_concursos_diferentes/);
    });
  });

  it("cobertura e itens etiquetados sobre itens declarados", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const prova = await criarProva(cliente);
      const topico = await criarTopico(cliente);
      await registrarGrade(cliente, prova, 60, CAIXA_2021);

      await etiquetar(
        cliente,
        prova,
        Array.from({ length: 30 }, (_, i) => ({
          numero: i + 1,
          topico_id: topico,
          confianca: 0.9,
        })),
      );

      const { rows } = await cliente.query(
        "select itens_declarados, itens_ingeridos, cobertura from public.cobertura_da_prova where prova_id = $1",
        [prova],
      );
      expect(rows[0].itens_declarados).toBe(60);
      expect(rows[0].itens_ingeridos).toBe(30);
      expect(Number(rows[0].cobertura)).toBe(0.5);
    });
  });

  it("a etiqueta nao exige enunciado, alternativa nem gabarito", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const prova = await criarProva(cliente);
      const topico = await criarTopico(cliente);

      // BANCO-14 AC2: a linha existe com o que a medicao tem, e nada mais.
      await cliente.query(
        `insert into public.etiquetas_de_item (prova_id, numero, topico_id, origem, modelo_versao)
         values ($1, 1, $2, 'ia', 'versao-fixada-de-teste')`,
        [prova, topico],
      );

      const { rows } = await cliente.query(
        "select count(*)::int as total from public.etiquetas_de_item where prova_id = $1",
        [prova],
      );
      expect(rows[0].total).toBe(1);
    });
  });

  it("nao existem duas etiquetas para o mesmo item", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const prova = await criarProva(cliente);
      const topico = await criarTopico(cliente);
      await etiquetar(cliente, prova, [{ numero: 1, topico_id: topico, confianca: 0.5 }]);

      await expect(
        cliente.query(
          `insert into public.etiquetas_de_item (prova_id, numero, topico_id, origem, modelo_versao)
           values ($1, 1, $2, 'ia', 'outra')`,
          [prova, topico],
        ),
      ).rejects.toThrow();
    });
  });

  it("o navegador nao le nem escreve nas tabelas da medicao", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const { rows } = await cliente.query<{ grantee: string; table_name: string }>(
        `select grantee, table_name from information_schema.role_table_grants
          where table_schema = 'public'
            and table_name in ('prova_blocos', 'etiquetas_de_item')
            and grantee in ('anon', 'authenticated')`,
      );
      expect(rows).toEqual([]);

      const { rows: rls } = await cliente.query<{ relname: string; relrowsecurity: boolean }>(
        `select relname, relrowsecurity from pg_class
          where relname in ('prova_blocos', 'etiquetas_de_item')`,
      );
      expect(rls.every((l) => l.relrowsecurity)).toBe(true);
    });
  });
});
