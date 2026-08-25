import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  type LeitorDeConfig,
  definirLeitorDeConfig,
  restaurarLeitorPadrao,
} from "@/modules/config";
import type { Adaptador, ClienteSql } from "@/modules/ia";
import {
  definirAdaptador,
  definirRepositorioDeIa,
  restaurarAdaptadorPadrao,
  restaurarRepositorioAusente,
} from "@/modules/ia";
import {
  definirDestinoDeErro,
  restaurarDestinoPadrao,
} from "@/modules/observabilidade";

import {
  CONSULTA_DOS_BLOCOS,
  CONSULTA_DOS_PLANOS,
  type PlanoSemFrase,
  entradaDoPedido,
  escreverFrases,
  executar,
  limparFrase,
  motivoDeParada,
  planosSemFrase,
} from "./frase-do-plano.mts";

const perfil = {
  modelo: "modelo-de-teste",
  versao: "modelo-de-teste-2026-01-01",
  esforco: "baixo",
  batch: false,
  cache: true,
  fallback: null,
};

function comMatriz(): void {
  const leitor: LeitorDeConfig = async () => ({
    "param.m2.matriz_de_modelos": { frase_do_plano: perfil },
  });
  definirLeitorDeConfig(leitor);
}

/**
 * Banco de mentira. Guarda o que foi atualizado e responde as duas consultas do
 * job — e so elas: consulta que o job nao faz devolve vazio, o que deixa um
 * erro de SQL aparecer como resultado errado em vez de passar batido.
 */
function bancoFalso(
  planos: Record<string, unknown>[],
  blocos: Record<string, unknown>[] = [],
  linhasDoUpdate = 1,
) {
  const atualizacoes: { frase: string; id: string }[] = [];

  const cliente = {
    async query(texto: string, valores?: unknown[]) {
      if (texto === CONSULTA_DOS_PLANOS) return { rows: planos };
      if (texto === CONSULTA_DOS_BLOCOS) return { rows: blocos };
      if (texto.includes("update public.plano_dia")) {
        const [frase, id] = valores as [string, string];
        // `linhasDoUpdate` e o que o `and frase is null` devolveria: 0 quando
        // outra execucao escreveu no meio.
        if (linhasDoUpdate > 0) atualizacoes.push({ frase, id });
        return { rows: [], rowCount: linhasDoUpdate };
      }
      if (texto.includes("configuracoes_vigentes")) {
        return {
          rows: [
            {
              chave: "param.m2.matriz_de_modelos",
              valor: { frase_do_plano: perfil },
            },
          ],
        };
      }
      return { rows: [] };
    },
    async connect() {},
    async end() {},
  };

  return { cliente: cliente as unknown as ClienteSql, atualizacoes, conexao: cliente };
}

/** Adapter que responde bem, ou quebra para um aluno especifico. */
function adaptadorQueQuebraEm(marca: string | null = null) {
  const falso: Adaptador = async (_destino, pedido) => {
    if (marca !== null && pedido.entrada.includes(marca)) {
      throw new Error("o provedor recusou");
    }
    return {
      texto: "Hoje voce revisa o que ja conquistou e avanca um assunto novo.",
      tokensEntrada: 100,
      tokensCacheados: 0,
      tokensSaida: 20,
    };
  };
  definirAdaptador(falso);
}

function repositorioSilencioso(): void {
  definirRepositorioDeIa({
    async buscarPorChave() {
      return null;
    },
    async gravar() {},
    async gastoDoPeriodo() {
      return 0;
    },
    async registrarAlerta() {
      return true;
    },
  });
}

let reportes: { contexto: Record<string, unknown> }[];

beforeEach(() => {
  reportes = [];
  definirDestinoDeErro((_erro, contexto) => {
    reportes.push({ contexto });
  });
});

afterEach(() => {
  restaurarLeitorPadrao();
  restaurarDestinoPadrao();
  restaurarAdaptadorPadrao();
  restaurarRepositorioAusente();
});

describe("o que o job manda para o modelo", () => {
  it("descreve os blocos que o SQL escolheu, sem decidir nada", () => {
    const plano: PlanoSemFrase = {
      id: "p1",
      minutosPorDia: 45,
      blocos: [
        {
          tipo: "revisar",
          materia: "Matematica Financeira",
          topico: "Juros Compostos",
          motivo: "revisao vencida",
        },
        { tipo: "treinar", materia: null, topico: null, motivo: null },
      ],
    };

    const entrada = entradaDoPedido(plano);
    expect(entrada).toContain("45 minutos");
    expect(entrada).toContain(
      "revisar: Matematica Financeira · Juros Compostos (revisao vencida)",
    );
    expect(entrada).toContain("treinar: assuntos misturados");
  });

  it.each([
    {
      caso: "topico Geral",
      materia: "Conhecimentos Bancarios",
      topico: "Geral",
      esperado: "Conhecimentos Bancarios",
    },
    {
      caso: "bloco sem topico",
      materia: "Conhecimentos Bancarios",
      topico: null,
      esperado: "Conhecimentos Bancarios",
    },
    {
      caso: "materia ausente",
      materia: null,
      topico: "Juros Compostos",
      esperado: "Juros Compostos",
    },
    {
      caso: "materia e topico ausentes",
      materia: null,
      topico: null,
      esperado: "assuntos misturados",
    },
  ])("usa o rotulo da tela quando $caso", ({ materia, topico, esperado }) => {
    const entrada = entradaDoPedido({
      id: "p1",
      minutosPorDia: 30,
      blocos: [{ tipo: "avancar", materia, topico, motivo: null }],
    });

    expect(entrada).toContain(`avancar: ${esperado}`);
  });

  it("aluno sem tempo declarado nao vira numero inventado", () => {
    const entrada = entradaDoPedido({ id: "p1", minutosPorDia: null, blocos: [] });
    expect(entrada).toContain("nao informado");
    expect(entrada).not.toMatch(/\d+ minutos/);
  });
});

describe("limparFrase", () => {
  it("fica com a primeira linha e tira as aspas", () => {
    expect(limparFrase('"Hoje voce revisa."\nE mais uma linha')).toBe(
      "Hoje voce revisa.",
    );
  });

  it("resposta vazia nao vira frase", () => {
    expect(limparFrase("   \n  ")).toBeNull();
    expect(limparFrase("")).toBeNull();
  });
});

describe("planosSemFrase", () => {
  it("junta cada plano com os blocos da meta cheia, na ordem", async () => {
    const { cliente } = bancoFalso(
      [
        { id: "p1", minutos_por_dia: 30 },
        { id: "p2", minutos_por_dia: null },
      ],
      [
        {
          plano_dia_id: "p1",
          tipo: "revisar",
          motivo: null,
          materia: "Matematica Financeira",
          topico: "Juros",
        },
        {
          plano_dia_id: "p1",
          tipo: "avancar",
          motivo: null,
          materia: "Conhecimentos Bancarios",
          topico: "SAC",
        },
      ],
    );

    const planos = await planosSemFrase(cliente);

    expect(planos).toHaveLength(2);
    expect(planos[0].blocos.map((b) => [b.materia, b.topico])).toEqual([
      ["Matematica Financeira", "Juros"],
      ["Conhecimentos Bancarios", "SAC"],
    ]);
    expect(planos[1].blocos).toEqual([]);
    expect(planos[1].minutosPorDia).toBeNull();
  });

  it("so olha o plano de hoje que esta sem frase", () => {
    // Rerodar o job nao reescreve frase que ja existe: quem ja tem frase nao
    // entra na consulta, entao nao ha nem chamada de IA para ele.
    expect(CONSULTA_DOS_PLANOS).toContain("pd.frase is null");
    expect(CONSULTA_DOS_PLANOS).toContain("pd.data = current_date");
    expect(CONSULTA_DOS_BLOCOS).toContain("nivel = 'meta_cheia'");
    expect(CONSULTA_DOS_BLOCOS).toContain("join public.materias m");
  });
});

describe("escreverFrases (ALUNO-12, ALUNO-05 AC4)", () => {
  it("escreve uma frase por aluno", async () => {
    comMatriz();
    adaptadorQueQuebraEm();
    repositorioSilencioso();
    const { cliente, atualizacoes } = bancoFalso([]);

    const resumo = await escreverFrases(cliente, [
      { id: "p1", minutosPorDia: 30, blocos: [] },
      { id: "p2", minutosPorDia: 60, blocos: [] },
    ]);

    expect(resumo).toEqual({ escritas: 2, falhadas: 0, total: 2 });
    expect(atualizacoes.map((a) => a.id)).toEqual(["p1", "p2"]);
  });

  it("a falha de um aluno deixa a frase dele nula e nao derruba os outros", async () => {
    comMatriz();
    adaptadorQueQuebraEm("60 minutos");
    repositorioSilencioso();
    const { cliente, atualizacoes } = bancoFalso([]);

    const resumo = await escreverFrases(cliente, [
      { id: "p1", minutosPorDia: 30, blocos: [] },
      { id: "p2", minutosPorDia: 60, blocos: [] },
      { id: "p3", minutosPorDia: 90, blocos: [] },
    ]);

    expect(resumo).toEqual({ escritas: 2, falhadas: 1, total: 3 });
    expect(atualizacoes.map((a) => a.id)).toEqual(["p1", "p3"]);
    // Dois reportes por aluno que falhou, e os dois sao desejados: o gateway
    // registra que o modelo caiu, e o job registra de quem era a frase.
    const doJob = reportes.filter((r) => r.contexto.job === "frase-do-plano");
    expect(doJob).toHaveLength(1);
    expect(doJob[0].contexto).toMatchObject({ plano_dia_id: "p2" });
  });

  it("nao sobrescreve frase escrita por outra execucao no meio", async () => {
    comMatriz();
    adaptadorQueQuebraEm();
    repositorioSilencioso();
    const { cliente, conexao } = bancoFalso([]);
    const consultas: string[] = [];
    const original = conexao.query.bind(conexao);
    conexao.query = async (texto: string, valores?: unknown[]) => {
      consultas.push(texto);
      return original(texto, valores);
    };

    await escreverFrases(cliente, [{ id: "p1", minutosPorDia: 30, blocos: [] }]);

    const update = consultas.find((c) => c.includes("update public.plano_dia"));
    expect(update).toContain("and frase is null");
  });

  it("frase que outra execucao ja escreveu nao entra na conta de escritas", async () => {
    comMatriz();
    adaptadorQueQuebraEm();
    repositorioSilencioso();
    // 0 linhas afetadas = o `and frase is null` barrou o UPDATE.
    const { cliente, atualizacoes } = bancoFalso([], [], 0);

    const resumo = await escreverFrases(cliente, [
      { id: "p1", minutosPorDia: 30, blocos: [] },
    ]);

    expect(resumo).toEqual({ escritas: 0, falhadas: 1, total: 1 });
    expect(atualizacoes).toEqual([]);
  });

  it("resposta vazia do modelo nao grava frase vazia", async () => {
    comMatriz();
    const falso: Adaptador = async () => ({
      texto: "   ",
      tokensEntrada: 1,
      tokensCacheados: 0,
      tokensSaida: 0,
    });
    definirAdaptador(falso);
    repositorioSilencioso();
    const { cliente, atualizacoes } = bancoFalso([]);

    const resumo = await escreverFrases(cliente, [
      { id: "p1", minutosPorDia: 30, blocos: [] },
    ]);

    expect(resumo.escritas).toBe(0);
    expect(atualizacoes).toEqual([]);
  });
});

describe("motivoDeParada", () => {
  it("sem DATABASE_URL o job para vermelho: nao da nem para olhar", () => {
    expect(motivoDeParada({ OPENAI_API_KEY: "x" })).toMatchObject({ parar: true });
  });

  it("sem OPENAI_API_KEY o job sai limpo — o plano vale sem frase", () => {
    const saida = motivoDeParada({ DATABASE_URL: "postgres://x" });
    expect(saida.parar).toBe(false);
    expect(saida.motivo).toContain("OPENAI_API_KEY");
  });

  it("com as duas, nada impede", () => {
    expect(
      motivoDeParada({ DATABASE_URL: "postgres://x", OPENAI_API_KEY: "x" }),
    ).toEqual({ parar: false, motivo: null });
  });
});

describe("executar", () => {
  it("sem chave, sai limpo sem nem abrir conexao com o banco", async () => {
    // O nome antigo deste teste ("IA fora do ar: sem escrever nada") prometia
    // mais do que o corpo entregava: ele nao escrevia nada porque nao chegava a
    // lugar nenhum. Agora isso e **asserção**: abrir conexao aqui e falha.
    const codigo = await executar({ DATABASE_URL: "postgres://x" }, () => {
      throw new Error("nao devia ter aberto conexao");
    });
    expect(codigo).toBe(0);
  });

  it("sem plano sem frase, nao chama modelo nenhum", async () => {
    comMatriz();
    let chamadas = 0;
    definirAdaptador(async () => {
      chamadas += 1;
      return {
        texto: "x",
        tokensEntrada: 0,
        tokensCacheados: 0,
        tokensSaida: 0,
      };
    });
    const { conexao } = bancoFalso([]);

    const codigo = await executar(
      { DATABASE_URL: "postgres://x", OPENAI_API_KEY: "chave-de-teste" },
      () => conexao as never,
    );

    expect(codigo).toBe(0);
    expect(chamadas).toBe(0);
  });

  it("um aluno sem frase nao pinta o job de vermelho", async () => {
    adaptadorQueQuebraEm("30 minutos");
    const { conexao, atualizacoes } = bancoFalso(
      [{ id: "p1", minutos_por_dia: 30 }],
      [],
    );

    const codigo = await executar(
      { DATABASE_URL: "postgres://x", OPENAI_API_KEY: "chave-de-teste" },
      () => conexao as never,
    );

    expect(codigo).toBe(0);
    expect(atualizacoes).toEqual([]);
    expect(
      reportes.filter((r) => r.contexto.job === "frase-do-plano"),
    ).toHaveLength(1);
  });
});
