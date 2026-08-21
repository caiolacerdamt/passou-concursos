import type { Client } from "pg";
import { expect, it } from "vitest";

import type { TopicoCanonico } from "@/modules/acervo";
import { gravarQuestoes, lerCatalogo, lerProva } from "@/modules/acervo";

import { criarProva, sufixo } from "./acervo";
import { comTransacaoRevertida } from "./conexao";
import { descreveComBanco } from "./setup";

/**
 * O teste unitario de `gravarQuestoes` prova a **decisao** (que status, que
 * proveniencia, que topico) contra um banco de mentira. O que ele nao consegue
 * provar e que o comando roda: um `on conflict` que nao casa com nenhum indice
 * e erro de sintaxe do Postgres, e o banco falso responde igual de qualquer
 * jeito. Este arquivo escreve de verdade.
 */

function questao(campos: Record<string, unknown> = {}) {
  return {
    numero: 12,
    tipo_questao: "multipla_escolha" as const,
    enunciado: "Qual e o montante de R$ 1.000,00 a 10% ao ano por 2 anos?",
    alternativas: [
      { letra: "A" as const, texto: "R$ 1.100,00" },
      { letra: "B" as const, texto: "R$ 1.210,00" },
    ],
    materia_sugerida: "",
    topico_sugerido: "",
    dificuldade: 3,
    confianca_ia: 0.9,
    tem_imagem: false,
    pagina: 1,
    truncada: false,
    ...campos,
  };
}

async function contextoDaProva(cliente: Client, provaId: string) {
  return {
    prova: await lerProva(cliente, provaId),
    catalogo: [] as TopicoCanonico[],
    imagensPorPagina: new Map(),
    subirImagem: async () => {},
    bucket: "questoes",
  };
}

descreveComBanco("gravarQuestoes contra o banco de verdade", () => {
  it("insere a questao como rascunho, com proveniencia completa", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const prova = await criarProva(cliente);

      const resumo = await gravarQuestoes(
        cliente,
        [questao()],
        await contextoDaProva(cliente, prova),
      );

      expect(resumo.inseridas).toBe(1);

      const { rows } = await cliente.query(
        `select status::text, numero, origem::text, fonte_citacao, questao_versao, vigente
           from public.questoes where prova_id = $1`,
        [prova],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe("rascunho");
      expect(rows[0].origem).toBe("real");
      expect(rows[0].questao_versao).toBe(1);
      expect(rows[0].vigente).toBe(true);
      // As cinco chaves do AD-040: o `CHECK fonte_citacao_completa` recusaria
      // qualquer coisa menor, e este teste falha se o job parar de preenche-las.
      expect(Object.keys(rows[0].fonte_citacao as object).sort()).toEqual([
        "ano",
        "banca",
        "cargo",
        "numero",
        "orgao",
      ]);
    });
  });

  it("colher o mesmo bloco duas vezes nao cria a segunda questao", async () => {
    // O edge case do M1 "mesma prova submetida duas vezes", provado pelo
    // comportamento e nao pelo texto do SQL.
    await comTransacaoRevertida(async (cliente) => {
      const prova = await criarProva(cliente);
      const contexto = await contextoDaProva(cliente, prova);

      const primeira = await gravarQuestoes(cliente, [questao()], contexto);
      const segunda = await gravarQuestoes(cliente, [questao()], contexto);

      expect(primeira.inseridas).toBe(1);
      expect(segunda.inseridas).toBe(0);
      expect(segunda.jaExistiam).toBe(1);

      const { rows } = await cliente.query(
        "select count(*)::int as total from public.questoes where prova_id = $1",
        [prova],
      );
      expect(rows[0].total).toBe(1);
    });
  });

  it("questao com imagem entra em revisao com o caminho do Storage", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const prova = await criarProva(cliente);
      const contexto = {
        ...(await contextoDaProva(cliente, prova)),
        imagensPorPagina: new Map([
          [1, [{ nome: "Im0", jpeg: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) }]],
        ]),
      };

      await gravarQuestoes(cliente, [questao({ tem_imagem: true })], contexto);

      const { rows } = await cliente.query(
        "select status::text, imagens from public.questoes where prova_id = $1",
        [prova],
      );
      expect(rows[0].status).toBe("em_revisao");
      expect(rows[0].imagens).toHaveLength(1);
    });
  });

  it("classifica no topico existente e abre candidato para o que nao existe", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const prova = await criarProva(cliente);
      const nomeDaMateria = `Matematica ${sufixo()}`;
      const nomeDoTopico = `Juros Compostos ${sufixo()}`;

      const { rows: materia } = await cliente.query(
        "insert into public.materias (nome) values ($1) returning id",
        [nomeDaMateria],
      );
      await cliente.query(
        "insert into public.topicos (materia_id, nome) values ($1, $2)",
        [materia[0].id, nomeDoTopico],
      );

      const contexto = {
        ...(await contextoDaProva(cliente, prova)),
        catalogo: await lerCatalogo(cliente),
      };

      const resumo = await gravarQuestoes(
        cliente,
        [
          questao({
            numero: 1,
            topico_sugerido: nomeDoTopico.toUpperCase(),
            materia_sugerida: nomeDaMateria,
          }),
          questao({
            numero: 2,
            topico_sugerido: `Assunto Inexistente ${sufixo()}`,
            materia_sugerida: nomeDaMateria,
          }),
        ],
        contexto,
      );

      expect(resumo.candidatosDeTopico).toBe(1);

      const { rows } = await cliente.query(
        `select numero, topico_id from public.questoes
          where prova_id = $1 order by numero`,
        [prova],
      );
      expect(rows[0].topico_id).not.toBeNull();
      expect(rows[1].topico_id).toBeNull();
    });
  });

  it("nada do que esta ingestao grava pode chegar ao aluno", async () => {
    // Invariante: publicar e da SPEC 10. Se um dia alguem mudar o status default
    // aqui, este teste falha antes de a questao aparecer numa tela.
    await comTransacaoRevertida(async (cliente) => {
      const prova = await criarProva(cliente);
      const contexto = await contextoDaProva(cliente, prova);

      await gravarQuestoes(
        cliente,
        [questao({ numero: 1 }), questao({ numero: 2, tem_imagem: true })],
        contexto,
      );

      const { rows } = await cliente.query(
        `select count(*)::int as publicadas from public.questoes
          where prova_id = $1 and status = 'publicada'`,
        [prova],
      );
      expect(rows[0].publicadas).toBe(0);
    });
  });
});
