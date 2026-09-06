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

import { acaoEtiquetar, acaoSeparar } from "./medir-prova.mts";

/**
 * As duas superficies de modelo da medicao, com provedor e banco falsos.
 *
 * O que estes testes provam e a **fronteira** do BANCO-16 AC2/AC3: quando o
 * separador deterministico fecha com a grade, nenhuma chamada acontece; quando
 * nao fecha, a reserva entra e a prova sai marcada. Sao os dois lados de uma
 * decisao de custo, e nenhum deles se prova sem exercitar o caminho inteiro.
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

/**
 * Um PDF minimo **de verdade**, e nao um duplo do leitor.
 *
 * O comando le o arquivo com `lerPdf`; passar texto solto testaria outra coisa.
 * Este documento tem uma pagina com fluxo de conteudo sem compressao, que e o
 * formato mais simples que o leitor da fabrica aceita.
 */
function pdfDeUmaPagina(linhas: readonly string[]): Buffer {
  const conteudo = linhas.map((l) => `BT (${l}) Tj ET`).join("\n");
  const objetos = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>\nendobj\n",
    `4 0 obj\n<< /Length ${conteudo.length} >>\nstream\n${conteudo}\nendstream\nendobj\n`,
  ];
  return Buffer.from(
    `%PDF-1.4\n${objetos.join("")}trailer\n<< /Root 1 0 R >>\n%%EOF`,
    "latin1",
  );
}

function configurarIa(adaptador: Adaptador, tarefa: string): void {
  const leitor: LeitorDeConfig = async () => ({
    "param.m2.matriz_de_modelos": { [tarefa]: PERFIL },
    "param.m1.tolerancia_grade": 0,
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

/** Banco falso com a grade da prova ja registrada e um assunto no catalogo. */
function bancoComGrade(blocos: readonly Record<string, unknown>[], declarados: number) {
  const escritas: { texto: string; valores?: unknown[] }[] = [];
  const cliente = {
    async query(texto: string, valores?: unknown[]) {
      if (texto.includes("from public.provas where id")) {
        return { rows: [{ itens_declarados: declarados, grade_status: "lida" }] };
      }
      if (texto.includes("from public.prova_blocos")) return { rows: blocos };
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

const BLOCO_DE_DOIS_ITENS = [
  {
    ordem: 1,
    nome_impresso: "MATEMÁTICA FINANCEIRA",
    item_inicial: 1,
    item_final: 2,
    pontuacao_por_item: "1",
    base: "pontos",
  },
];

function respostaDoModelo(estruturado: unknown) {
  return async () => ({
    texto: JSON.stringify(estruturado),
    estruturado,
    tokensEntrada: 10,
    tokensCacheados: 0,
    tokensSaida: 5,
  });
}

describe("a separacao dos itens", () => {
  afterEach(() => {
    restaurarAdaptadorPadrao();
    restaurarRepositorioAusente();
    restaurarLeitorPadrao();
  });

  it("nao chama modelo nenhum quando o codigo fecha com a grade", async () => {
    let chamadas = 0;
    configurarIa(async () => {
      chamadas += 1;
      throw new Error("o modelo nao deveria ter sido chamado");
    }, "separacao_de_itens");
    const { cliente, escritas } = bancoComGrade(BLOCO_DE_DOIS_ITENS, 2);

    const resumo = await acaoSeparar(
      cliente,
      PROVA,
      pdfDeUmaPagina(["1", "Primeiro item", "2", "Segundo item"]),
    );

    expect(chamadas).toBe(0);
    expect(resumo.chamouModelo).toBe(false);
    expect(resumo.via).toBe("deterministica");
    expect(resumo.conferencia.fecha).toBe(true);

    const marcacao = escritas.find((e) => e.texto.includes("separacao_via"));
    expect(marcacao?.valores).toEqual([PROVA, "deterministica", null]);
  });

  it("cai na reserva quando nao fecha, e a prova fica marcada como tal", async () => {
    configurarIa(
      respostaDoModelo({
        itens: [
          { numero: 1, trecho_inicial: "Primeiro item" },
          { numero: 2, trecho_inicial: "Segundo item" },
        ],
      }),
      "separacao_de_itens",
    );
    const { cliente, escritas } = bancoComGrade(BLOCO_DE_DOIS_ITENS, 2);

    // So o primeiro item tem numero impresso: o codigo acha 1 de 2.
    const resumo = await acaoSeparar(
      cliente,
      PROVA,
      pdfDeUmaPagina(["1", "Primeiro item", "Segundo item"]),
    );

    expect(resumo.chamouModelo).toBe(true);
    expect(resumo.via).toBe("modelo");
    expect(resumo.itens).toBe(2);
    expect(escritas.find((e) => e.texto.includes("separacao_via"))?.valores?.[1]).toBe("modelo");
  });

  it("nao troca pela reserva quando o modelo devolve menos item que o codigo", async () => {
    configurarIa(respostaDoModelo({ itens: [] }), "separacao_de_itens");
    const { cliente, escritas } = bancoComGrade(BLOCO_DE_DOIS_ITENS, 2);

    const resumo = await acaoSeparar(
      cliente,
      PROVA,
      pdfDeUmaPagina(["1", "Primeiro item", "Segundo item"]),
    );

    expect(resumo.via).toBe("deterministica");
    expect(resumo.itens).toBe(1);
    // Continua sem fechar: a prova fica esperando conferencia humana (AC5).
    expect(
      String(escritas.find((e) => e.texto.includes("separacao_via"))?.valores?.[2]),
    ).toContain("separacao divergiu da grade");
  });
});

describe("a etiquetagem", () => {
  afterEach(() => {
    restaurarAdaptadorPadrao();
    restaurarRepositorioAusente();
    restaurarLeitorPadrao();
  });

  it("grava com a versao fixada da matriz e descarta assunto fora da taxonomia", async () => {
    configurarIa(
      respostaDoModelo({
        etiquetas: [
          {
            numero: 1,
            assunto: "Juros Compostos",
            materia: "Matemática Financeira",
            confianca: 0.9,
          },
          { numero: 2, assunto: "Assunto que nao existe", materia: "Outra", confianca: 0.3 },
        ],
      }),
      "etiqueta_de_item",
    );
    const { cliente, escritas } = bancoComGrade(BLOCO_DE_DOIS_ITENS, 2);

    const resumo = await acaoEtiquetar(cliente, PROVA, [
      { numero: 1, texto: "Qual o montante?", pagina: 1 },
      { numero: 2, texto: "Qual a taxa?", pagina: 1 },
    ]);

    expect(resumo.casadas).toBe(1);
    expect(resumo.naoCasadas).toBe(1);

    const gravacao = escritas.find((e) => e.texto.includes("gravar_etiquetas_ia"));
    // AD-068: o nome do modelo vem da matriz de configuracao, nunca do codigo.
    expect(gravacao?.valores?.[2]).toBe(PERFIL.versao);
    expect(JSON.parse(String(gravacao?.valores?.[1]))).toEqual([
      { numero: 1, topico_id: TOPICO, confianca: 0.9 },
    ]);
  });
});
