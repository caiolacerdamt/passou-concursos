import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { matriculaAtiva } from "./matricula";

/** Cliente de mentira: so os dois caminhos que `matriculaAtiva` usa. */
function leitor(opcoes: {
  user?: { id: string } | null;
  linha?: { id: string; estado: string; fim_em: string } | null;
  registro?: { coluna: string; valor: string }[];
}) {
  const registro = opcoes.registro ?? [];

  const construtor = {
    select: () => construtor,
    eq: (coluna: string, valor: string) => {
      registro.push({ coluna, valor });
      return construtor;
    },
    gt: (coluna: string, valor: string) => {
      registro.push({ coluna, valor });
      return construtor;
    },
    maybeSingle: async () => ({ data: opcoes.linha ?? null }),
  };

  return {
    auth: { getUser: async () => ({ data: { user: opcoes.user ?? null } }) },
    from: () => construtor,
  } as Parameters<typeof matriculaAtiva>[0];
}

describe("matriculaAtiva", () => {
  it("sem sessao nao ha matricula", async () => {
    expect(await matriculaAtiva(leitor({ user: null }))).toBeNull();
  });

  it("devolve a matricula ativa do aluno da sessao", async () => {
    const linha = { id: "m1", estado: "ativa", fim_em: "2027-01-01T00:00:00Z" };

    expect(await matriculaAtiva(leitor({ user: { id: "a" }, linha }))).toEqual(linha);
  });

  it("sem linha ativa devolve null, e nao um objeto vazio", async () => {
    expect(await matriculaAtiva(leitor({ user: { id: "a" }, linha: null }))).toBeNull();
  });

  /**
   * A consulta filtra por estado e por validade, e **nao** por `user_id`: quem
   * separa aluno de aluno e a RLS. Se alguem acrescentar o filtro de `user_id`
   * aqui, a proxima tela copia a consulta sem ele achando que o filtro era a
   * protecao — e ai a protecao some junto.
   */
  it("nao filtra por user_id: quem separa aluno de aluno e a RLS", async () => {
    const registro: { coluna: string; valor: string }[] = [];
    await matriculaAtiva(leitor({ user: { id: "a" }, linha: null, registro }));

    expect(registro.map((f) => f.coluna)).toEqual(["estado", "fim_em"]);
  });

  it("exige que a matricula ainda esteja no prazo", async () => {
    const registro: { coluna: string; valor: string }[] = [];
    await matriculaAtiva(leitor({ user: { id: "a" }, linha: null, registro }));

    const prazo = registro.find((f) => f.coluna === "fim_em");
    expect(Date.parse(prazo!.valor)).toBeGreaterThan(Date.now() - 5_000);
  });
});

/**
 * PAG-01: "SHALL NOT haver segundo mecanismo de liberacao".
 *
 * A varredura vale mais que a leitura: ela pega a tela que a SPEC 13 ou a 14
 * criarem em `src/app/app/` sem a guarda. Uma tela paga sem
 * `exigirMatriculaAtiva` nao quebra teste nenhum por conta propria — ela so
 * renderiza o esqueleto vazio que a RLS deixou, que e exatamente o "conteudo
 * parcial" que o AC6 do m8 §P1 proibe.
 */
describe("toda tela paga passa pela guarda (PAG-01)", () => {
  const raiz = path.resolve(import.meta.dirname, "../../app/app");

  function paginas(pasta: string): string[] {
    return readdirSync(pasta, { withFileTypes: true }).flatMap((entrada) => {
      const caminho = path.join(pasta, entrada.name);
      if (entrada.isDirectory()) return paginas(caminho);
      return entrada.name === "page.tsx" ? [caminho] : [];
    });
  }

  it("nenhuma pagina sob /app renderiza sem exigirMatriculaAtiva", () => {
    const encontradas = paginas(raiz);
    expect(encontradas.length).toBeGreaterThan(0);

    const semGuarda = encontradas.filter(
      (arquivo) => !readFileSync(arquivo, "utf8").includes("exigirMatriculaAtiva"),
    );

    expect(semGuarda).toEqual([]);
  });
});
