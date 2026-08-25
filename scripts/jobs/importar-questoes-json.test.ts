import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  auditarArquivos,
  argumentosDaExecucao,
  enunciadoComBlocos,
  executar,
  lerQuestoesNdjson,
  prepararImportacao,
  validarMapa,
} from "./importar-questoes-json.mts";

const ARQUIVO_EXISTENTE = "tests/fixtures/prova-minima.fixture";

function questao(campos: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "Q-1",
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
    fonte: { source_id: "SRC-1", arquivo_local: ARQUIVO_EXISTENTE },
    ...campos,
  };
}

function ndjson(...questoes: Record<string, unknown>[]): string {
  return questoes.map((item) => JSON.stringify(item)).join("\n");
}

const TAXONOMIA = JSON.stringify({
  materias: [{ nome: "Matemática", ordem: 1, topicos: ["Geral"] }],
});

describe("importar questoes JSON", () => {
  it("lê NDJSON, mantém C/E na entrada e aceita anulada", () => {
    const resultado = lerQuestoesNdjson(
      ndjson(
        questao(),
        questao({
          id: "Q-2",
          numero_original: 2,
          tipo_resposta: "certo_errado",
          alternativas: [
            { rotulo: "C", texto: "Certo" },
            { rotulo: "E", texto: "Errado" },
          ],
          gabarito_definitivo: "ANULADA",
        }),
      ),
    );

    expect(resultado).toHaveLength(2);
    expect(resultado[1].gabarito_definitivo).toBe("ANULADA");
    expect(resultado[1].alternativas.map((item) => item.rotulo)).toEqual(["C", "E"]);
  });

  it("recusa natureza, gabarito e número repetido antes da escrita", () => {
    expect(() => lerQuestoesNdjson(ndjson(questao({ natureza: "gerada_ia" })))).toThrow(
      /natureza precisa ser real/,
    );
    expect(() => lerQuestoesNdjson(ndjson(questao({ gabarito_definitivo: "F" })))).toThrow(
      /gabarito definitivo invalido/,
    );
    expect(() =>
      lerQuestoesNdjson(ndjson(questao(), questao({ id: "Q-2" }))),
    ).toThrow(/numero 1 repetido/);
  });

  it("preserva texto-base, fórmula e tabela sem repetir o enunciado", () => {
    const q = lerQuestoesNdjson(
      ndjson(
        questao({
          enunciado: "Qual é a resposta?",
          blocos: [
            { tipo: "texto_base", texto: "Texto de apoio" },
            { tipo: "formula", texto: "x + 1" },
            { tipo: "tabela", dados: [["A", "B"]], legenda: "Dados" },
            { tipo: "paragrafo", texto: "Qual é a resposta?" },
          ],
        }),
      ),
    )[0];

    const enunciado = enunciadoComBlocos(q);
    expect(enunciado).toContain("Texto de apoio");
    expect(enunciado).toContain("Fórmula: x + 1");
    expect(enunciado).toContain("Tabela:");
    expect(enunciado.match(/Qual é a resposta\?/g)).toHaveLength(1);
  });

  it("faz dry-run sem abrir conexão e sem exigir chave de IA", async () => {
    const arquivo = new Map<string, string>([
      ["questoes.json", ndjson(questao())],
      ["taxonomia.json", TAXONOMIA],
      ["mapa.json", JSON.stringify({ "Q-1": { materia: "Matemática", topico: "Geral" } })],
    ]);
    const abrirConexao = vi.fn(() => {
      throw new Error("dry-run não abre banco");
    });

    const codigo = await executar({}, ["--dry-run", "--json", "questoes.json", "--taxonomia", "taxonomia.json", "--mapa", "mapa.json"], {
      raiz: process.cwd(),
      lerArquivo: (caminho) => arquivo.get(path.basename(caminho)) ?? "",
      abrirConexao,
    });

    expect(codigo).toBe(0);
    expect(abrirConexao).not.toHaveBeenCalled();
  });

  it("reconhece o dry-run que o npm consome como configuração", () => {
    expect(argumentosDaExecucao([], { npm_config_dry_run: "true" })).toEqual(["--dry-run"]);
    expect(argumentosDaExecucao(["--dry-run"], { npm_config_dry_run: "true" })).toEqual(["--dry-run"]);
  });

  it("recusa mapa ausente ou fora do catálogo fechado", () => {
    const questoes = lerQuestoesNdjson(ndjson(questao()));
    const taxonomia = { materias: [{ nome: "Matemática", ordem: 1, topicos: ["Geral"] }] };
    expect(() => validarMapa(questoes, taxonomia, {})).toThrow(/mapa ausente/);
    expect(() =>
      validarMapa(questoes, taxonomia, { "Q-1": { materia: "Matemática", topico: "Livre" } }),
    ).toThrow(/materia\/topico inexistente/);
  });

  it("aceita alternativas ilustradas e lista os arquivos ausentes", () => {
    const questoes = lerQuestoesNdjson(
      ndjson(
        questao({
          alternativas: [
            { rotulo: "A", texto: "", imagem: "imagens/nao-existe.png" },
            { rotulo: "B", texto: "Texto" },
          ],
        }),
      ),
    );
    const arquivos = auditarArquivos(questoes, process.cwd());
    expect(arquivos.imagensAusentes).toEqual(["imagens/nao-existe.png"]);
  });
});
