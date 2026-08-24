import { describe, expect, it, vi } from "vitest";

import {
  lerArgumentos,
  lerLoteCurado,
  publicarLoteCurado,
  type ExplicacaoCurada,
} from "./publicar-lote-curado.mts";

const TEXTO =
  "O gabarito oficial aponta a letra C porque o enunciado exige o princípio " +
  "que trata o valor pela ótica do cliente, e as demais alternativas descrevem " +
  "outros princípios da mesma metodologia.";

function linha(extra: Partial<ExplicacaoCurada> = {}): string {
  return JSON.stringify({
    lote: "lote-02",
    source_id: "SRC-1",
    numero: 46,
    alternativa_correta: "C",
    texto: TEXTO,
    fontes_citadas: [{ doc_id: "curado:SRC-1:46", trecho: "Gabarito oficial: C" }],
    ...extra,
  });
}

describe("leitura do lote curado", () => {
  it("exige arquivo nomeado", () => {
    expect(lerArgumentos(["--arquivo", "lote.jsonl", "--dry-run"])).toEqual({
      arquivo: "lote.jsonl",
      dryRun: true,
    });
    expect(() => lerArgumentos(["--dry-run"])).toThrow(/uso:/);
  });

  it("recusa explicação curta, sem fonte e questão repetida", () => {
    expect(() => lerLoteCurado(linha({ texto: "curta demais" }))).toThrow(/curta demais/);
    expect(() => lerLoteCurado(linha({ fontes_citadas: [] }))).toThrow(/sem fonte/);
    expect(() => lerLoteCurado(`${linha()}\n${linha()}`)).toThrow(/repetida/);
  });

  it("recusa fonte auto-referente do lote antigo", () => {
    expect(() =>
      lerLoteCurado(
        linha({
          fontes_citadas: [
            { doc_id: "curado:SRC-1:46", trecho: "Gabarito oficial da questão 46: C" },
          ],
        }),
      ),
    ).toThrow(/fonte auto-referente/);
  });
});

function clienteFalso(questao: Record<string, unknown>) {
  const executadas: string[] = [];
  const cliente = {
    query: vi.fn(async (sql: string) => {
      executadas.push(sql);
      if (sql.includes("from public.operadores")) {
        return { rows: [{ operador_id: "11111111-1111-1111-1111-111111111111" }] };
      }
      if (sql.includes("from public.questoes q")) return { rows: [questao] };
      if (sql.includes("insert into public.explicacoes")) return { rows: [{ id: "e1" }], rowCount: 1 };
      if (sql.includes("from public.questao_revisoes")) return { rows: [] };
      if (sql.includes("publicar_questao")) return { rows: [] };
      return { rows: [] };
    }),
  };
  return { cliente, executadas };
}

describe("publicação do lote curado", () => {
  const base = {
    id: "q1",
    questao_versao: 1,
    resposta_correta: "C",
    anulada: false,
    status: "rascunho",
    materia: "Cultura e Comportamento Digital",
  };

  it("publica quando o gabarito do banco confirma a letra do lote", async () => {
    const { cliente, executadas } = clienteFalso(base);
    const relatorio = await publicarLoteCurado(cliente, lerLoteCurado(linha()), {
      transacao: false,
    });

    expect(relatorio).toEqual({
      lidas: 1,
      explicacoesInseridas: 1,
      reaproveitadas: 0,
      publicadas: 1,
      porMateria: [{ materia: "Cultura e Comportamento Digital", publicadas: 1 }],
    });
    expect(executadas.some((sql) => sql.includes("publicar_questao"))).toBe(true);
  });

  it("para sem publicar quando o gabarito do banco diverge do lote", async () => {
    const { cliente, executadas } = clienteFalso({ ...base, resposta_correta: "D" });

    await expect(
      publicarLoteCurado(cliente, lerLoteCurado(linha()), { transacao: false }),
    ).rejects.toThrow(/gabarito do banco diverge/);
    expect(executadas.some((sql) => sql.includes("insert into public.explicacoes"))).toBe(false);
  });

  it("no dry-run confere o gabarito e não escreve nada", async () => {
    const { cliente, executadas } = clienteFalso(base);
    const relatorio = await publicarLoteCurado(cliente, lerLoteCurado(linha()), {
      transacao: false,
      dryRun: true,
    });

    expect(relatorio.publicadas).toBe(0);
    expect(relatorio.porMateria).toEqual([
      { materia: "Cultura e Comportamento Digital", publicadas: 1 },
    ]);
    expect(executadas.some((sql) => sql.includes("insert into"))).toBe(false);
  });
});
