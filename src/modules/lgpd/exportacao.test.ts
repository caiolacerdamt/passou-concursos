import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  EXCECOES_DO_APAGAMENTO,
  TABELAS_GRUPO_1,
  TABELAS_GRUPO_1_INDIRETAS,
} from "./grupo-1";
import {
  FORA_DA_EXPORTACAO,
  TABELAS_FINANCEIRAS_EXPORTADAS,
  TETO_DE_LINHAS_POR_TABELA,
  exportarDadosDoTitular,
  nomeDoArquivo,
  registrarPedidoDeExportacao,
  totalDeLinhas,
} from "./exportacao";

vi.mock("@/lib/db/servidor", () => ({ clienteDeServico: vi.fn() }));
vi.mock("@/modules/observabilidade/reporte", () => ({ reportarErro: vi.fn() }));

const TITULAR = { id: "aluno-a", email: "a@exemplo.com" };

type Pedido = { tabela: string; filtros: { coluna: string; valor: unknown }[] };

/**
 * Cliente de mentira que **registra o que foi pedido**.
 *
 * O que importa nesta suíte quase nunca é o conteúdo devolvido: é qual tabela
 * foi consultada e com qual filtro. Um export que devolve o JSON certo por
 * acaso, filtrando pela coluna errada, é o defeito caro aqui.
 */
function leitor(opcoes: {
  linhas?: Record<string, Record<string, unknown>[]>;
  contagens?: Record<string, number>;
  falham?: string[];
  pedidos?: Pedido[];
}) {
  const linhas = opcoes.linhas ?? {};
  const pedidos = opcoes.pedidos ?? [];

  return {
    from: (tabela: string) => ({
      select: () => {
        const pedido: Pedido = { tabela, filtros: [] };
        pedidos.push(pedido);

        const filtro = {
          eq: (coluna: string, valor: unknown) => {
            pedido.filtros.push({ coluna, valor });
            return filtro;
          },
          in: (coluna: string, valor: unknown) => {
            pedido.filtros.push({ coluna, valor });
            return filtro;
          },
          limit: async (n: number) => {
            if (opcoes.falham?.includes(tabela)) {
              return { data: null, error: new Error("sem permissão"), count: null };
            }
            const todas = linhas[tabela] ?? [];
            return {
              data: todas.slice(0, n),
              error: null,
              // `?? todas.length` engoliria um `null` posto de propósito, e o
              // caso "banco não devolveu contagem" nunca seria exercido.
              count:
                opcoes.contagens && tabela in opcoes.contagens
                  ? opcoes.contagens[tabela]
                  : todas.length,
            };
          },
        };
        return filtro;
      },
    }),
  } as unknown as Parameters<typeof exportarDadosDoTitular>[1];
}

describe("exportação dos dados do titular", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * O ponto do arquivo inteiro. A exportação percorre `TABELAS_GRUPO_1` — que o
   * teste de banco obriga a manter completo — em vez de enumerar tabelas à mão.
   * Amarrada assim, a tabela nova entra na exportação no mesmo dia em que
   * alguém for obrigado a registrá-la; enumerada à mão, sumiria em silêncio.
   */
  it("percorre o inventário do grupo 1, e não uma lista literal", async () => {
    const pedidos: Pedido[] = [];
    await exportarDadosDoTitular(TITULAR, leitor({ pedidos }));

    const consultadas = new Set(pedidos.map((p) => p.tabela));
    for (const tabela of TABELAS_GRUPO_1) {
      expect(consultadas.has(tabela)).toBe(true);
    }
  });

  /**
   * Sensor de mutação da regra acima: se alguém trocar o `for` por `select`s
   * literais, este teste fica vermelho ao acrescentar uma tabela ao inventário.
   */
  it("uma tabela nova no inventário aparece na exportação sem tocar no exportador", async () => {
    const codigo = readFileSync(
      path.resolve(import.meta.dirname, "./exportacao.ts"),
      "utf8",
    );

    /*
     * `solicitacoes_exportacao` fica de fora da varredura: o literal dela é da
     * **escrita** do registro de auditoria, que é um insert nominal e não tem
     * como sair de lista nenhuma. A leitura é que não pode ter literal.
     */
    for (const tabela of TABELAS_GRUPO_1) {
      if (tabela === "solicitacoes_exportacao") continue;
      expect(codigo, `${tabela} está enumerada à mão`).not.toContain(`from("${tabela}")`);
    }
    expect(codigo).toContain("TABELAS_GRUPO_1");
  });

  it("filtra sempre por user_id do titular", async () => {
    const pedidos: Pedido[] = [];
    await exportarDadosDoTitular(TITULAR, leitor({ pedidos }));

    const diretas = pedidos.filter(
      (p) => !TABELAS_GRUPO_1_INDIRETAS.some((i) => i.tabela === p.tabela),
    );
    for (const pedido of diretas) {
      expect(pedido.filtros).toContainEqual({ coluna: "user_id", valor: TITULAR.id });
    }
  });

  it("a exportação de A não traz linha de B", async () => {
    const exportacao = await exportarDadosDoTitular(
      TITULAR,
      leitor({
        linhas: {
          tentativas: [
            { id: "t1", user_id: "aluno-a", correta: true },
            { id: "t2", user_id: "aluno-a", correta: false },
          ],
        },
      }),
    );

    const linhas = exportacao.tabelas.tentativas.linhas;
    expect(linhas).toHaveLength(2);
    expect(linhas.every((l) => l.user_id === TITULAR.id)).toBe(true);
  });

  it("traz o titular e um carimbo de quando o arquivo foi gerado", async () => {
    const exportacao = await exportarDadosDoTitular(TITULAR, leitor({}));

    expect(exportacao.titular).toEqual(TITULAR);
    expect(Number.isNaN(Date.parse(exportacao.gerado_em))).toBe(false);
  });

  describe("teto por tabela", () => {
    const MUITAS = Array.from({ length: TETO_DE_LINHAS_POR_TABELA + 500 }, (_, i) => ({
      id: `t${i}`,
    }));

    it("corta no teto e diz quantas linhas ficaram de fora", async () => {
      const exportacao = await exportarDadosDoTitular(
        TITULAR,
        leitor({
          linhas: { tentativas: MUITAS },
          contagens: { tentativas: MUITAS.length },
        }),
      );

      const tentativas = exportacao.tabelas.tentativas;
      expect(tentativas.linhas).toHaveLength(TETO_DE_LINHAS_POR_TABELA);
      expect(tentativas.truncada).toBe(true);
      expect(tentativas.linhas_omitidas).toBe(500);
      expect(exportacao.completa).toBe(false);
    });

    it("tabela que coube inteira não sai marcada como truncada", async () => {
      const exportacao = await exportarDadosDoTitular(
        TITULAR,
        leitor({ linhas: { tentativas: [{ id: "t1" }] } }),
      );

      expect(exportacao.tabelas.tentativas.truncada).toBe(false);
      expect(exportacao.tabelas.tentativas.linhas_omitidas).toBe(0);
      expect(exportacao.completa).toBe(true);
    });

    /*
     * Sem `count` legível não dá para dizer quantas faltaram, mas bater no teto
     * exatamente é sinal suficiente de corte. No empate a resposta é "truncada":
     * dizer "completa" e estar errado é o erro que ninguém detecta depois.
     */
    it("sem contagem legível, bater no teto ainda marca truncada", async () => {
      const exportacao = await exportarDadosDoTitular(
        TITULAR,
        leitor({
          linhas: { tentativas: MUITAS },
          contagens: { tentativas: null as unknown as number },
        }),
      );

      expect(exportacao.tabelas.tentativas.truncada).toBe(true);
      expect(exportacao.tabelas.tentativas.linhas_omitidas).toBeNull();
    });
  });

  describe("tabelas indiretas", () => {
    const PLANOS = [{ id: "p1" }, { id: "p2" }];

    it("alcança plano_bloco pelos ids dos planos do titular", async () => {
      const pedidos: Pedido[] = [];
      const exportacao = await exportarDadosDoTitular(
        TITULAR,
        leitor({
          pedidos,
          linhas: {
            plano_dia: PLANOS,
            plano_bloco: [{ id: "b1", plano_dia_id: "p1" }],
          },
        }),
      );

      const pedido = pedidos.find((p) => p.tabela === "plano_bloco");
      expect(pedido?.filtros).toEqual([
        { coluna: "plano_dia_id", valor: ["p1", "p2"] },
      ]);
      expect(exportacao.tabelas.plano_bloco.linhas).toHaveLength(1);
    });

    it("sem plano nenhum, nem consulta a tabela filha", async () => {
      const pedidos: Pedido[] = [];
      const exportacao = await exportarDadosDoTitular(TITULAR, leitor({ pedidos }));

      expect(pedidos.some((p) => p.tabela === "plano_bloco")).toBe(false);
      expect(exportacao.tabelas.plano_bloco.linhas).toEqual([]);
    });

    /*
     * Pai truncado é filho incompleto mesmo que o filho caiba: os blocos dos
     * dias que não vieram nunca chegaram a ser pedidos.
     */
    it("pai truncado deixa o filho marcado como truncado", async () => {
      const MUITOS = Array.from({ length: TETO_DE_LINHAS_POR_TABELA + 1 }, (_, i) => ({
        id: `p${i}`,
      }));
      const exportacao = await exportarDadosDoTitular(
        TITULAR,
        leitor({
          linhas: { plano_dia: MUITOS, plano_bloco: [{ id: "b1" }] },
          contagens: { plano_dia: MUITOS.length },
        }),
      );

      expect(exportacao.tabelas.plano_bloco.truncada).toBe(true);
    });
  });

  describe("falha de leitura", () => {
    /*
     * "Um JSON silenciosamente incompleto é pior que um erro." A tabela que não
     * deu para ler sai marcada, e o arquivo inteiro perde o selo de completo.
     */
    it("tabela ilegível sai marcada em vez de sair vazia como se estivesse ok", async () => {
      const exportacao = await exportarDadosDoTitular(
        TITULAR,
        leitor({ falham: ["tentativas"] }),
      );

      expect(exportacao.tabelas.tentativas.erro).toBeTruthy();
      expect(exportacao.completa).toBe(false);
    });

    it("uma tabela ilegível não leva as outras junto", async () => {
      const exportacao = await exportarDadosDoTitular(
        TITULAR,
        leitor({ falham: ["tentativas"], linhas: { matriculas: [{ id: "m1" }] } }),
      );

      expect(exportacao.tabelas.matriculas.linhas).toHaveLength(1);
      expect(exportacao.tabelas.matriculas.erro).toBeUndefined();
    });

    it("o erro no JSON não descreve o banco por dentro", async () => {
      const exportacao = await exportarDadosDoTitular(
        TITULAR,
        leitor({ falham: ["tentativas"] }),
      );

      expect(exportacao.tabelas.tentativas.erro).not.toContain("permissão");
    });

    it("pai ilegível não faz o filho parecer vazio de propósito", async () => {
      const exportacao = await exportarDadosDoTitular(
        TITULAR,
        leitor({ falham: ["plano_dia"] }),
      );

      expect(exportacao.tabelas.plano_bloco.erro).toBeTruthy();
    });
  });

  describe("registro financeiro", () => {
    it("exporta pagamentos: é o que o titular comprou", async () => {
      const pedidos: Pedido[] = [];
      await exportarDadosDoTitular(TITULAR, leitor({ pedidos }));

      expect(pedidos.map((p) => p.tabela)).toContain("pagamentos");
    });

    /*
     * URL de cobrança e QR de Pix são capability, não dado do titular sobre si.
     * Num arquivo que o aluno guarda e encaminha, elas viram superfície de graça.
     */
    it("não leva colunas de gateway no JSON", async () => {
      const exportacao = await exportarDadosDoTitular(
        TITULAR,
        leitor({
          linhas: {
            pagamentos: [
              {
                id: "pg1",
                valor_centavos: 19700,
                asaas_cobranca_id: "pay_123",
                resultado_pix_copia_e_cola: "0002012...",
                resultado_url: "https://asaas/x",
              },
            ],
          },
        }),
      );

      const linha = exportacao.tabelas.pagamentos.linhas[0];
      expect(linha).toEqual({ id: "pg1", valor_centavos: 19700 });
    });

    /*
     * O que fica de fora fica declarado. Sem esta amarra, a tabela financeira
     * nova simplesmente não apareceria no JSON e ninguém saberia dizer se foi
     * decisão ou esquecimento.
     */
    it("toda tabela financeira está exportada ou declarada fora, com motivo", () => {
      const exportadas = new Set<string>(TABELAS_FINANCEIRAS_EXPORTADAS);
      const fora = new Map(FORA_DA_EXPORTACAO.map((f) => [f.tabela, f.motivo]));

      for (const excecao of EXCECOES_DO_APAGAMENTO) {
        const decidida = exportadas.has(excecao.tabela) || fora.has(excecao.tabela);
        expect(decidida, `${excecao.tabela} não foi decidida`).toBe(true);
      }

      for (const motivo of fora.values()) {
        expect(motivo.length).toBeGreaterThan(20);
      }
    });
  });

  it("conta as linhas somando todas as tabelas", async () => {
    const exportacao = await exportarDadosDoTitular(
      TITULAR,
      leitor({ linhas: { tentativas: [{ id: "t1" }, { id: "t2" }], sessoes: [{ id: "s1" }] } }),
    );

    expect(totalDeLinhas(exportacao)).toBe(3);
  });
});

describe("nome do arquivo", () => {
  it("leva a data do arquivo no nome", () => {
    expect(nomeDoArquivo("2026-09-08T12:00:00.000Z")).toBe(
      "passou-concursos-dados-2026-09-08.json",
    );
  });

  /*
   * O nome vai para um cabeçalho HTTP. Um carimbo estranho não pode virar
   * pedaço solto de `Content-Disposition`.
   */
  it("carimbo ilegível não vira lixo no cabeçalho", () => {
    expect(nomeDoArquivo('"; rm -rf /')).toBe("passou-concursos-dados-export.json");
  });
});

describe("registro do pedido", () => {
  function escritor(erro: unknown = null) {
    const insert = vi.fn(async () => ({ error: erro }));
    return {
      insert,
      cliente: { from: () => ({ insert }) } as unknown as Parameters<
        typeof registrarPedidoDeExportacao
      >[2],
    };
  }

  it("grava quem pediu, quanto saiu e se o arquivo foi cortado", async () => {
    const { insert, cliente } = escritor();

    await registrarPedidoDeExportacao(
      "aluno-a",
      { linhas_exportadas: 42, truncada: true },
      cliente,
    );

    expect(insert).toHaveBeenCalledWith({
      user_id: "aluno-a",
      linhas_exportadas: 42,
      truncada: true,
    });
  });

  /*
   * O direito do titular é receber o arquivo. O registro é controle interno
   * nosso — negar o arquivo porque o nosso controle caiu seria punir o aluno
   * por um problema que não é dele.
   */
  it("falhar no registro não derruba a entrega do arquivo", async () => {
    const { cliente } = escritor(new Error("tabela fora do ar"));

    await expect(
      registrarPedidoDeExportacao("aluno-a", { linhas_exportadas: 1, truncada: false }, cliente),
    ).resolves.toBeUndefined();
  });
});
