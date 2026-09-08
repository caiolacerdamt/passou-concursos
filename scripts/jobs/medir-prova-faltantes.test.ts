import { afterEach, describe, expect, it } from "vitest";

import type { LeitorDeConfig } from "@/modules/config";
import { definirLeitorDeConfig, restaurarLeitorPadrao } from "@/modules/config";
import type { Adaptador, ClienteSql } from "@/modules/ia";
import {
  definirAdaptador,
  definirRepositorioDeIa,
  restaurarAdaptadorPadrao,
  restaurarRepositorioAusente,
} from "@/modules/ia";

import { acaoEtiquetar, formatarEtiquetagem } from "./medir-prova.mts";

/**
 * AD-146 T4 — o etiquetador so recebe o que ainda nao foi medido.
 *
 * O acervo tem provas inteiras publicadas item a item, com assunto conferido por
 * humano. O que se prova aqui e uma decisao de custo: prova ja publicada custa
 * **zero**, prova pela metade custa metade, e o numero que o relatorio declara e
 * o dos itens enviados — nao o dos itens separados.
 */

const PERFIL = {
  modelo: "modelo-de-teste",
  versao: "modelo-de-teste-2026-01-01",
  esforco: "baixo",
  batch: false,
  cache: true,
  fallback: null,
};

const PROVA = "11111111-1111-1111-1111-111111111111";
const TOPICO = "22222222-2222-2222-2222-222222222222";

function configurarIa(adaptador: Adaptador): void {
  const leitor: LeitorDeConfig = async () => ({
    "param.m2.matriz_de_modelos": { etiqueta_de_item: PERFIL },
    "param.m1.itens_por_pedido_de_etiqueta": 20,
  });
  definirLeitorDeConfig(leitor);
  definirAdaptador(adaptador);
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

/**
 * Banco falso com uma medicao efetiva ja existente.
 *
 * `jaMedidos` sao os numeros que a view devolve — venham eles de questao
 * publicada ou de etiqueta; do ponto de vista do custo e a mesma coisa, e e
 * exatamente por isso que o comando le a view e nao as duas tabelas.
 */
function bancoCom(jaMedidos: readonly number[], declarados = 4) {
  const escritas: { texto: string; valores?: unknown[] }[] = [];
  const cliente = {
    async query(texto: string, valores?: unknown[]) {
      if (texto.includes("from public.itens_medidos_efetivos")) {
        return { rows: jaMedidos.map((numero) => ({ numero })) };
      }
      if (texto.includes("from public.cobertura_da_prova")) {
        return {
          rows: [
            {
              itens_ingeridos: declarados,
              cobertura: declarados === 0 ? null : 1,
            },
          ],
        };
      }
      if (texto.includes("from public.topicos")) {
        return {
          rows: [
            {
              id: TOPICO,
              nome: "Juros Compostos",
              materia_id: "m1",
              materia_nome: "Matemática Financeira",
            },
          ],
        };
      }
      escritas.push({ texto, valores });
      if (texto.includes("gravar_etiquetas_ia")) {
        return { rows: [{ gravadas: 1, preservadas: 0, alinhadas: 0 }] };
      }
      return { rows: [] };
    },
    async connect() {},
    async end() {},
  };
  return { cliente: cliente as unknown as ClienteSql, escritas };
}

const SEPARADOS = [
  { numero: 1, texto: "Qual o montante?", pagina: 1 },
  { numero: 2, texto: "Qual a taxa?", pagina: 1 },
  { numero: 3, texto: "Qual o prazo?", pagina: 1 },
  { numero: 4, texto: "Qual o capital?", pagina: 1 },
];

function respostaComEtiquetas(numeros: readonly number[]) {
  return async () => {
    const estruturado = {
      etiquetas: numeros.map((numero) => ({
        numero,
        assunto: "Juros Compostos",
        materia: "Matemática Financeira",
        confianca: 0.9,
      })),
    };
    return {
      texto: JSON.stringify(estruturado),
      estruturado,
      tokensEntrada: 10,
      tokensCacheados: 0,
      tokensSaida: 5,
    };
  };
}

describe("etiquetar so o que falta (AD-146)", () => {
  afterEach(() => {
    restaurarAdaptadorPadrao();
    restaurarRepositorioAusente();
    restaurarLeitorPadrao();
  });

  it("prova inteiramente medida nao chama modelo nem grava etiqueta", async () => {
    let chamadas = 0;
    configurarIa(async () => {
      chamadas += 1;
      throw new Error("o modelo nao deveria ter sido chamado");
    });
    const { cliente, escritas } = bancoCom([1, 2, 3, 4]);

    const resumo = await acaoEtiquetar(cliente, PROVA, SEPARADOS);

    expect(chamadas).toBe(0);
    expect(resumo.enviados).toBe(0);
    expect(resumo.jaMedidos).toBe(4);
    expect(resumo.custoUsd).toBe(0);
    expect(resumo.gravadas).toBe(0);
    // Nem `gravar_etiquetas_ia` com lista vazia: nao ha o que gravar.
    expect(escritas.some((e) => e.texto.includes("gravar_etiquetas_ia"))).toBe(false);
    // A cobertura vem da view, ja depois de tudo.
    expect(resumo.cobertura).toBe(1);
    expect(resumo.itensMedidos).toBe(4);
  });

  it("prova pela metade envia so os faltantes", async () => {
    const entradas: string[] = [];
    configurarIa(async (_destino, pedido) => {
      entradas.push(pedido.entrada);
      return respostaComEtiquetas([3, 4])();
    });
    const { cliente, escritas } = bancoCom([1, 2]);

    const resumo = await acaoEtiquetar(cliente, PROVA, SEPARADOS);

    expect(resumo.jaMedidos).toBe(2);
    expect(resumo.enviados).toBe(2);
    expect(resumo.pedidos).toBe(1);

    // O texto que chegou ao modelo tem os itens 3 e 4, e nao tem 1 nem 2.
    expect(entradas).toHaveLength(1);
    expect(entradas[0]).toContain("[3]");
    expect(entradas[0]).toContain("[4]");
    expect(entradas[0]).not.toContain("[1]");
    expect(entradas[0]).not.toContain("[2]");

    const gravacao = escritas.find((e) => e.texto.includes("gravar_etiquetas_ia"));
    const gravadas = JSON.parse(String(gravacao?.valores?.[1])) as { numero: number }[];
    expect(gravadas.map((e) => e.numero).sort()).toEqual([3, 4]);
  });

  it("prova sem nenhuma medicao envia tudo", async () => {
    configurarIa(respostaComEtiquetas([1, 2, 3, 4]));
    const { cliente } = bancoCom([]);

    const resumo = await acaoEtiquetar(cliente, PROVA, SEPARADOS);

    expect(resumo.jaMedidos).toBe(0);
    expect(resumo.enviados).toBe(4);
    expect(resumo.casadas).toBe(4);
  });

  it("item que ja e questao publicada nao vira etiqueta concorrente", async () => {
    configurarIa(respostaComEtiquetas([2]));
    const { cliente, escritas } = bancoCom([1, 3, 4]);

    await acaoEtiquetar(cliente, PROVA, SEPARADOS);

    const gravacao = escritas.find((e) => e.texto.includes("gravar_etiquetas_ia"));
    const gravadas = JSON.parse(String(gravacao?.valores?.[1])) as { numero: number }[];
    // O item 1 e questao publicada: ele nao entra na gravacao, e por isso o
    // BANCO-14 AC3 nao precisa desfazer nada depois.
    expect(gravadas.map((e) => e.numero)).toEqual([2]);
  });

  it("falha do modelo sobe: a medicao nao avanca em silencio", async () => {
    configurarIa(async () => {
      throw new Error("provedor fora do ar");
    });
    const { cliente, escritas } = bancoCom([1, 2, 3]);

    await expect(acaoEtiquetar(cliente, PROVA, SEPARADOS)).rejects.toThrow(/etiqueta_de_item/);
    expect(escritas.some((e) => e.texto.includes("gravar_etiquetas_ia"))).toBe(false);
  });
});

describe("formatarEtiquetagem", () => {
  const base = {
    jaMedidos: 0,
    enviados: 0,
    pedidos: 0,
    casadas: 0,
    naoCasadas: 0,
    gravadas: 0,
    preservadas: 0,
    alinhadas: 0,
    custoUsd: 0,
    cobertura: 1,
    itensMedidos: 70,
  };

  it("declara custo zero e diz por que, quando nada foi enviado", () => {
    const saida = formatarEtiquetagem({ ...base, jaMedidos: 70 });

    expect(saida).toContain("nenhuma chamada a modelo");
    expect(saida).toContain("70 itens separados ja");
    expect(saida).toContain("Custo 0.0000 USD");
    expect(saida).toContain("cobertura 100.0%");
  });

  it("o custo declarado e o dos itens enviados, nao o dos separados", () => {
    const saida = formatarEtiquetagem({
      ...base,
      jaMedidos: 60,
      enviados: 10,
      pedidos: 1,
      casadas: 10,
      gravadas: 10,
      custoUsd: 0.0031,
    });

    expect(saida).toContain("60 itens ja medidos foram poupados");
    expect(saida).toContain("10 enviados em 1 pedidos");
    expect(saida).toContain("Custo 0.0031 USD");
  });

  it("nao ha cobertura sem grade lida, e o relatorio diz isso", () => {
    expect(formatarEtiquetagem({ ...base, jaMedidos: 5, cobertura: null, itensMedidos: 5 }))
      .toContain("grade nao lida");
  });
});
