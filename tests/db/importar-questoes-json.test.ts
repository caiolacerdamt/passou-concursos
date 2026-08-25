import { expect, it } from "vitest";

import { importarDados, lerQuestoesNdjson, type Preparacao } from "../../scripts/jobs/importar-questoes-json.mts";

import { comTransacaoRevertida } from "./conexao";
import { descreveComBanco } from "./setup";

const ARQUIVO_EXISTENTE = "tests/fixtures/prova-minima.fixture";

function preparar(): Preparacao {
  const q1 = {
    id: "DB-Q-1",
    natureza: "real",
    instituicao: "Banco do Brasil",
    banca: "Fundação Cesgranrio",
    ano: 2023,
    cargo: "Escriturário",
    disciplina: "Matemática",
    caderno_tipo: "Prova A",
    numero_original: 1,
    enunciado: "Qual é a resposta?",
    blocos: [],
    tipo_resposta: "multipla_escolha",
    alternativas: [
      { rotulo: "A", texto: "Uma" },
      { rotulo: "B", texto: "Duas" },
    ],
    gabarito_definitivo: "B",
    fonte: { source_id: "SRC-DB-1", arquivo_local: ARQUIVO_EXISTENTE },
  };
  const q2 = {
    ...q1,
    id: "DB-Q-2",
    numero_original: 2,
    tipo_resposta: "certo_errado",
    alternativas: [
      { rotulo: "C", texto: "Certo" },
      { rotulo: "E", texto: "Errado" },
    ],
    gabarito_definitivo: "C",
  };
  const q3 = { ...q1, id: "DB-Q-3", numero_original: 3, gabarito_definitivo: "ANULADA" };
  const json = JSON.stringify(q1) + "\n" + JSON.stringify(q2) + "\n" + JSON.stringify(q3);
  const questoes = lerQuestoesNdjson(json);
  return {
    questoes,
    taxonomia: { materias: [{ nome: "Matemática", ordem: 1, topicos: ["Geral"] }] },
    mapa: {
      "DB-Q-1": { materia: "Matemática", topico: "Geral" },
      "DB-Q-2": { materia: "Matemática", topico: "Geral" },
      "DB-Q-3": { materia: "Matemática", topico: "Geral" },
    },
    arquivos: { pdfs: [ARQUIVO_EXISTENTE], imagens: [], imagensAusentes: [] },
  };
}

descreveComBanco("importar questoes JSON contra o banco", () => {
  it("insere, cruza gabarito e retoma sem duplicar", async () => {
    await comTransacaoRevertida(async (cliente) => {
      const preparacao = preparar();
      const primeira = await importarDados(cliente, preparacao, {
        transacao: false,
        bucket: "questoes",
        raiz: process.cwd(),
        subirImagem: async () => {},
      });
      const segunda = await importarDados(cliente, preparacao, {
        transacao: false,
        bucket: "questoes",
        raiz: process.cwd(),
        subirImagem: async () => {},
      });

      expect(primeira.total.inseridas).toBe(3);
      expect(segunda.total.jaExistentes).toBe(3);

      const { rows } = await cliente.query(
        `select numero, tipo_questao::text, alternativas, resposta_correta, anulada, status::text, numero as numero_original
           from public.questoes
          where prova_id in (
            select id
              from public.provas
             where banca = 'Fundação Cesgranrio'
               and ano = 2023
               and orgao = 'Banco do Brasil'
               and cargo = 'Escriturário'
               and caderno = 'Prova A'
          )
          order by numero`,
      );
      expect(rows).toHaveLength(3);
      expect(rows[0].resposta_correta).toBe("B");
      expect(rows[1].tipo_questao).toBe("certo_errado");
      expect(rows[1].alternativas).toBeNull();
      expect(rows[2].resposta_correta).toBeNull();
      expect(rows[2].anulada).toBe(true);
      expect(rows.every((row) => row.status === "rascunho")).toBe(true);
      expect(rows.map((row) => row.numero_original)).toEqual([1, 2, 3]);
    });
  });
});
