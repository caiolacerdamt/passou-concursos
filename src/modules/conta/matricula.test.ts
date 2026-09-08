import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { matriculaAtiva, ultimaMatricula } from "./matricula";

/** Cliente de mentira: so os dois caminhos que `matriculaAtiva` usa. */
function leitor(opcoes: {
  user?: { id: string } | null;
  linha?: { id: string; estado: string; fim_em: string; tipo: "pago" | "trial" } | null;
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
    const linha = { id: "m1", estado: "ativa", fim_em: "2027-01-01T00:00:00Z", tipo: "pago" as const };

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

  /**
   * O `tipo` vem da propria linha de `matriculas`, sem join: e a coluna que o
   * gatilho copia do produto no INSERT. Sem ele na projecao, `contextoDaMatricula`
   * leria `undefined` e todo aluno de trial seria tratado como pago — a trava
   * some sem nenhum teste ficar vermelho.
   */
  it("traz o tipo da matricula na projecao", async () => {
    const colunas: string[] = [];
    const construtor = {
      select: (lista: string) => {
        colunas.push(lista);
        return construtor;
      },
      eq: () => construtor,
      gt: () => construtor,
      maybeSingle: async () => ({ data: null }),
    };
    await matriculaAtiva({
      auth: { getUser: async () => ({ data: { user: { id: "a" } } }) },
      from: () => construtor,
    } as unknown as Parameters<typeof matriculaAtiva>[0]);

    expect(colunas[0]).toContain("tipo");
  });

  it("exige que a matricula ainda esteja no prazo", async () => {
    const registro: { coluna: string; valor: string }[] = [];
    await matriculaAtiva(leitor({ user: { id: "a" }, linha: null, registro }));

    const prazo = registro.find((f) => f.coluna === "fim_em");
    expect(Date.parse(prazo!.valor)).toBeGreaterThan(Date.now() - 5_000);
  });
});

/** Cliente de mentira para a leitura da ultima matricula. */
function leitorDaUltima(opcoes: {
  linha?: { id: string; estado: string; fim_em: string; tipo: "pago" | "trial" } | null;
  erro?: unknown;
  registro?: { coluna: string; ascendente: boolean }[];
}) {
  const construtor = {
    select: () => construtor,
    order: (coluna: string, o: { ascending: boolean }) => {
      opcoes.registro?.push({ coluna, ascendente: o.ascending });
      return construtor;
    },
    limit: () => construtor,
    maybeSingle: async () => ({ data: opcoes.linha ?? null, error: opcoes.erro ?? null }),
  };

  return { from: () => construtor } as Parameters<typeof ultimaMatricula>[0];
}

describe("ultimaMatricula", () => {
  const VENCIDA = {
    id: "m1",
    estado: "expirada",
    fim_em: "2026-08-20T12:00:00Z",
    tipo: "pago" as const,
  };

  /**
   * O ponto todo desta leitura: `matriculaAtiva` devolve `null` para quem venceu
   * e leva a data embora junto. Sem ela a conta nao consegue dizer *quando* o
   * acesso terminou.
   */
  it("devolve a matricula vencida que matriculaAtiva ja nao enxerga", async () => {
    expect(await ultimaMatricula(leitorDaUltima({ linha: VENCIDA }))).toEqual(VENCIDA);
  });

  it("pega a mais recente: ordena por fim_em decrescente", async () => {
    const registro: { coluna: string; ascendente: boolean }[] = [];
    await ultimaMatricula(leitorDaUltima({ linha: VENCIDA, registro }));

    expect(registro).toEqual([{ coluna: "fim_em", ascendente: false }]);
  });

  it("quem nunca teve matricula recebe null, e nao um objeto vazio", async () => {
    expect(await ultimaMatricula(leitorDaUltima({ linha: null }))).toBeNull();
  });

  /**
   * Leitura que falha cala a data. Uma tela que diz "seu acesso terminou em
   * <data errada>" e pior que uma que so diz "seu acesso terminou".
   */
  it("erro de leitura devolve null em vez de derrubar a conta", async () => {
    expect(
      await ultimaMatricula(leitorDaUltima({ erro: new Error("banco fora do ar") })),
    ).toBeNull();
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

  /**
   * A **unica** excecao, e ela e nominal de proposito: uma lista com o motivo
   * escrito ao lado obriga quem quiser a segunda a defende-la aqui, em vez de
   * afrouxar a varredura inteira.
   *
   * `/app/conta` nao e tela de conteudo: e onde o titular exerce os direitos do
   * art. 18 da LGPD — exportar e apagar os proprios dados. Esses direitos nao
   * vencem com a matricula, e quem mais os exerce e justamente quem saiu. Com a
   * guarda, esse aluno era mandado para `/assinar` e so conseguia apagar os
   * dados comprando de novo. A tela continua exigindo **sessao**, e sem
   * matricula nao renderiza uma linha do acervo.
   */
  const EXCECOES: { pagina: string; motivo: string }[] = [
    {
      pagina: "conta",
      motivo:
        "Direitos do titular (LGPD art. 18) nao vencem com a matricula; a tela exige sessao e nao mostra acervo.",
    },
  ];

  function paginas(pasta: string): string[] {
    return readdirSync(pasta, { withFileTypes: true }).flatMap((entrada) => {
      const caminho = path.join(pasta, entrada.name);
      if (entrada.isDirectory()) return paginas(caminho);
      return entrada.name === "page.tsx" ? [caminho] : [];
    });
  }

  /** `src/app/app/conta/page.tsx` -> `conta`; a raiz vira `.`. */
  function nomeRelativo(arquivo: string): string {
    return path.relative(raiz, path.dirname(arquivo)).split(path.sep).join("/") || ".";
  }

  it("nenhuma pagina sob /app renderiza sem exigirMatriculaAtiva", () => {
    const encontradas = paginas(raiz);
    expect(encontradas.length).toBeGreaterThan(0);

    const dispensadas = new Set(EXCECOES.map((e) => e.pagina));
    const semGuarda = encontradas.filter(
      (arquivo) =>
        !dispensadas.has(nomeRelativo(arquivo)) &&
        !readFileSync(arquivo, "utf8").includes("exigirMatriculaAtiva"),
    );

    expect(semGuarda).toEqual([]);
  });

  /**
   * A excecao tem que continuar valendo para uma pagina que **existe**. Sem
   * isto, renomear `/app/conta` deixaria a dispensa orfa apontando para nada — e
   * a proxima tela criada com esse nome herdaria a dispensa em silencio.
   */
  it("toda excecao aponta para uma pagina existente e tem motivo escrito", () => {
    const existentes = new Set(paginas(raiz).map(nomeRelativo));

    for (const excecao of EXCECOES) {
      expect(existentes.has(excecao.pagina)).toBe(true);
      expect(excecao.motivo.length).toBeGreaterThan(20);
    }
  });
});
