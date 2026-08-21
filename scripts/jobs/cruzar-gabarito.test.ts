import { describe, expect, it } from "vitest";

import { executar, lerArgumentos, motivoDeParada } from "./cruzar-gabarito.mts";

const PROVA = {
  id: "prova-1",
  banca: "Cesgranrio",
  ano: 2023,
  orgao: "Banco do Brasil",
  cargo: "Escriturario",
  status: "extraida",
};

function bancoFalso(resumo: Record<string, number> = {}) {
  const consultas: { texto: string; valores?: unknown[] }[] = [];

  const cliente = {
    async query(texto: string, valores?: unknown[]) {
      consultas.push({ texto, valores });

      if (texto.includes("from public.provas where id")) {
        return { rows: [PROVA], rowCount: 1 };
      }
      if (texto.includes("cruzar_gabarito")) {
        return {
          rows: [
            {
              resumo: {
                preenchidas: 0,
                inalteradas: 0,
                versionadas: 0,
                anuladas: 0,
                sem_questao: 0,
                ...resumo,
              },
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    },
    async connect() {},
    async end() {},
  };

  return { cliente, consultas };
}

const AMBIENTE = { DATABASE_URL: "postgres://x" };
const ARGV = ["--prova", "prova-1", "--gabarito", "g.json"];

describe("lerArgumentos", () => {
  it("le prova, arquivo e versao", () => {
    expect(lerArgumentos([...ARGV, "--versao", "definitivo"])).toEqual({
      provaId: "prova-1",
      arquivo: "g.json",
      versao: "definitivo",
    });
  });

  it("versao e opcional: o JSON pode traze-la dentro", () => {
    expect(lerArgumentos(ARGV).versao).toBeUndefined();
  });

  it("recusa argumento faltando", () => {
    expect(() => lerArgumentos(["--prova", "p1"])).toThrow(/uso:/);
  });
});

describe("motivoDeParada — o gabarito nao depende da IA", () => {
  it("basta o DATABASE_URL: a verdade e o gabarito oficial, nao o modelo", () => {
    // Invariante nº4. Este job roda com a IA inteira fora do ar.
    expect(motivoDeParada({})).toContain("DATABASE_URL");
    expect(motivoDeParada(AMBIENTE)).toBeNull();
  });
});

describe("executar", () => {
  it("aceita JSON com a versao dentro e cruza", async () => {
    const { cliente, consultas } = bancoFalso({ preenchidas: 2 });

    const codigo = await executar(AMBIENTE, ARGV, {
      abrirConexao: () => cliente,
      lerArquivo: () =>
        JSON.stringify({
          versao: "definitivo-2023",
          itens: [
            { numero: 1, resposta: "C" },
            { numero: 2, anulada: true },
          ],
        }),
    });

    expect(codigo).toBe(0);
    const chamada = consultas.find((c) => c.texto.includes("cruzar_gabarito"));
    expect(chamada?.valores?.[0]).toBe("prova-1");
    expect(chamada?.valores?.[2]).toBe("definitivo-2023");
    expect(JSON.parse(String(chamada?.valores?.[1]))).toHaveLength(2);

    const marca = consultas.find((c) => c.texto.includes("update public.provas"));
    expect(marca?.valores?.[1]).toBe("gabarito_cruzado");
  });

  it("aceita CSV com a versao declarada por fora", async () => {
    const { cliente, consultas } = bancoFalso({ preenchidas: 3 });

    const codigo = await executar(AMBIENTE, [...ARGV, "--versao", "definitivo-1"], {
      abrirConexao: () => cliente,
      lerArquivo: () => "numero,resposta,anulada\n1,C,\n2,,sim\n3,A,",
    });

    expect(codigo).toBe(0);
    const chamada = consultas.find((c) => c.texto.includes("cruzar_gabarito"));
    expect(chamada?.valores?.[2]).toBe("definitivo-1");
  });

  it("gabarito sem versao e recusado antes de qualquer escrita", async () => {
    // Sem versao, retificar e rodar duas vezes o mesmo arquivo sao a mesma
    // coisa. Recusar depois de escrever metade seria pior do que recusar.
    const { cliente, consultas } = bancoFalso();

    const codigo = await executar(AMBIENTE, ARGV, {
      abrirConexao: () => cliente,
      lerArquivo: () => "1,C,\n2,A,",
    });

    expect(codigo).toBe(1);
    expect(consultas.some((c) => c.texto.includes("cruzar_gabarito"))).toBe(false);
    expect(consultas.some((c) => c.texto.includes("update public.provas"))).toBe(false);
  });

  it("item sem questao deixa a prova como estava, para rodar de novo depois", async () => {
    // O gabarito chegou antes de a extracao terminar. Marcar `gabarito_cruzado`
    // aqui diria que o cruzamento acabou quando faltam questoes.
    const { cliente, consultas } = bancoFalso({ preenchidas: 1, sem_questao: 4 });

    const codigo = await executar(AMBIENTE, [...ARGV, "--versao", "v1"], {
      abrirConexao: () => cliente,
      lerArquivo: () => "1,C,",
    });

    expect(codigo).toBe(0);
    expect(consultas.some((c) => c.texto.includes("update public.provas"))).toBe(false);
  });

  it("sem DATABASE_URL sai 1 sem nem abrir conexao", async () => {
    const codigo = await executar({}, ARGV, {
      abrirConexao: () => {
        throw new Error("nao deveria abrir conexao");
      },
    });
    expect(codigo).toBe(1);
  });

  it("arquivo que nao existe sai 1", async () => {
    const codigo = await executar(AMBIENTE, ARGV, {
      abrirConexao: () => {
        throw new Error("nao deveria abrir conexao");
      },
      lerArquivo: () => {
        throw new Error("ENOENT");
      },
    });
    expect(codigo).toBe(1);
  });

  it("prova nao catalogada sai 1", async () => {
    const cliente = {
      async query() {
        return { rows: [], rowCount: 0 };
      },
      async connect() {},
      async end() {},
    };

    const codigo = await executar(AMBIENTE, [...ARGV, "--versao", "v1"], {
      abrirConexao: () => cliente,
      lerArquivo: () => "1,C,",
    });
    expect(codigo).toBe(1);
  });
});
