import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { LeitorDeConfig } from "@/modules/config";
import { definirLeitorDeConfig, restaurarLeitorPadrao } from "@/modules/config";
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
  CONSULTA_DAS_QUESTOES,
  type QuestaoDaFabrica,
  gerarExplicacoes,
  executar,
  motivoDeParada,
  questoesSemExplicacao,
} from "./explicacoes.mts";

const PERFIL = {
  modelo: "modelo-de-teste",
  versao: "modelo-de-teste-2026-01-01",
  esforco: "baixo",
  batch: false,
  cache: true,
  fallback: null,
};

const ID = "11111111-1111-1111-1111-111111111111";
const QUESTAO: QuestaoDaFabrica = {
  id: ID,
  questaoVersao: 1,
  topicoId: "22222222-2222-2222-2222-222222222222",
  provaId: "33333333-3333-3333-3333-333333333333",
  numero: 7,
  enunciado: "Qual alternativa está correta?",
  alternativas: [
    { letra: "A", texto: "Primeira" },
    { letra: "B", texto: "Segunda" },
  ],
  respostaCorreta: "B",
  gabaritoVersao: "definitivo-2024",
  fonteCitacao: {
    banca: "Cesgranrio",
    ano: 2024,
    orgao: "Banco do Brasil",
    cargo: "Escriturario",
    numero: 7,
  },
  origem: "real",
};

const REFERENCIA = {
  id: "base:documento-1",
  titulo: "Documento conferido",
  conteudo: "A alternativa B é a correta.",
  origem: "oficial" as const,
  baseReferenciaId: "44444444-4444-4444-4444-444444444444",
  topicoId: QUESTAO.topicoId,
};

function configurarIa(adaptador: Adaptador): void {
  const leitor: LeitorDeConfig = async () => ({
    "param.m2.matriz_de_modelos": { explicacao: PERFIL },
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

function bancoFalso(
  questoes: Record<string, unknown>[] = [],
  referencia = [REFERENCIA],
) {
  const consultas: { texto: string; valores?: unknown[] }[] = [];
  const insercoes: { status: string; valores: unknown[] | undefined }[] = [];

  const cliente = {
    async query(texto: string, valores?: unknown[]) {
      consultas.push({ texto, valores });
      if (texto === CONSULTA_DAS_QUESTOES) return { rows: questoes };
      if (texto.includes("from public.base_referencia")) {
        return {
          rows: referencia.map((documento) => ({
            ...documento,
            id: String(documento.id).replace(/^base:/, ""),
            topico_id: documento.topicoId,
          })),
        };
      }
      if (texto.includes("enfileirar_questao_revisao")) return { rows: [{ id: 1 }] };
      if (texto.includes("insert into public.explicacoes")) {
        insercoes.push({ status: texto.includes("'aprovada'") ? "aprovada" : "rejeitada", valores });
        return { rows: [{ id: "explicacao-1" }] };
      }
      return { rows: [] };
    },
    async connect() {},
    async end() {},
  };

  return {
    cliente: cliente as unknown as ClienteSql,
    conexao: cliente,
    consultas,
    insercoes,
  };
}

function linhaDaQuestao(questao: QuestaoDaFabrica): Record<string, unknown> {
  return {
    ...questao,
    questao_versao: questao.questaoVersao,
    topico_id: questao.topicoId,
    prova_id: questao.provaId,
    resposta_correta: questao.respostaCorreta,
    gabarito_versao: questao.gabaritoVersao,
    fonte_citacao: questao.fonteCitacao,
  };
}

let reportes: Record<string, unknown>[];

beforeEach(() => {
  reportes = [];
  definirDestinoDeErro((_erro, contexto) => reportes.push(contexto));
});

afterEach(() => {
  restaurarLeitorPadrao();
  restaurarDestinoPadrao();
  restaurarAdaptadorPadrao();
  restaurarRepositorioAusente();
});

describe("job da fábrica de explicações", () => {
  it("consulta somente questão vigente sem explicação aprovada", () => {
    expect(CONSULTA_DAS_QUESTOES).toContain("q.vigente");
    expect(CONSULTA_DAS_QUESTOES).toContain("e.status = 'aprovada'");
    expect(CONSULTA_DAS_QUESTOES).toContain("not exists");
  });

  it("converte a linha SQL para o contrato do acervo", async () => {
    const { cliente } = bancoFalso([linhaDaQuestao(QUESTAO)]);

    const questoes = await questoesSemExplicacao(cliente);

    expect(questoes).toEqual([QUESTAO]);
  });

  it("gera, confere e grava a explicacao aprovada", async () => {
    configurarIa(async () => ({
      texto: JSON.stringify({
        texto: "A alternativa B é a correta.",
        alternativa_correta: "B",
        fontes_citadas: [{ doc_id: REFERENCIA.id, trecho: "alternativa B é a correta" }],
        afirmacoes_externas: [],
      }),
      estruturado: {
        texto: "A alternativa B é a correta.",
        alternativa_correta: "B",
        fontes_citadas: [{ doc_id: REFERENCIA.id, trecho: "alternativa B é a correta" }],
        afirmacoes_externas: [],
      },
      tokensEntrada: 10,
      tokensCacheados: 0,
      tokensSaida: 10,
    }));
    const { cliente, insercoes } = bancoFalso();

    const resumo = await gerarExplicacoes(cliente, [QUESTAO]);

    expect(resumo).toEqual({ total: 1, geradas: 1, reaproveitadas: 0, rejeitadas: 0 });
    expect(insercoes).toEqual([{ status: "aprovada", valores: expect.any(Array) }]);
  });

  it("rejeita citacao invalida, registra resultado fora de vigencia e enfileira", async () => {
    configurarIa(async () => ({
      texto: "{}",
      estruturado: {
        texto: "A alternativa B é a correta.",
        alternativa_correta: "B",
        fontes_citadas: [{ doc_id: REFERENCIA.id, trecho: "norma externa" }],
        afirmacoes_externas: [],
      },
      tokensEntrada: 10,
      tokensCacheados: 0,
      tokensSaida: 10,
    }));
    const { cliente, consultas, insercoes } = bancoFalso();

    const resumo = await gerarExplicacoes(cliente, [QUESTAO]);

    expect(resumo.rejeitadas).toBe(1);
    expect(insercoes).toEqual([{ status: "rejeitada", valores: expect.any(Array) }]);
    const fila = consultas.find((consulta) => consulta.texto.includes("enfileirar_questao_revisao"));
    expect(fila?.valores?.[2]).toBe("explicacao_citacao_fora_da_fonte");
    expect(reportes).toHaveLength(1);
  });

  it("fonte minima abre pendencia de base e continua sendo usada", async () => {
    configurarIa(async () => ({
      texto: "{}",
      estruturado: {
        texto: "A alternativa B é a correta.",
        alternativa_correta: "B",
        fontes_citadas: [{ doc_id: `minima:${QUESTAO.provaId}:${QUESTAO.id}:v1`, trecho: "Gabarito oficial (definitivo-2024): B" }],
        afirmacoes_externas: [],
      },
      tokensEntrada: 10,
      tokensCacheados: 0,
      tokensSaida: 10,
    }));
    const { cliente, consultas } = bancoFalso([], []);

    const resumo = await gerarExplicacoes(cliente, [{ ...QUESTAO, topicoId: null }]);

    expect(resumo.geradas).toBe(1);
    expect(consultas.some((consulta) => consulta.texto.includes("base_referencia_pendente"))).toBe(true);
  });
});

describe("degradação segura", () => {
  it("sem chave não abre conexão e sai limpo", async () => {
    const codigo = await executar({ DATABASE_URL: "postgres://x" }, () => {
      throw new Error("não devia abrir conexão");
    });

    expect(codigo).toBe(0);
  });

  it("sem banco para antes de tentar IA", () => {
    expect(motivoDeParada({ OPENAI_API_KEY: "x" })).toMatchObject({ parar: true });
  });

  it("com banco e chave pode rodar", () => {
    expect(motivoDeParada({ DATABASE_URL: "postgres://x", OPENAI_API_KEY: "x" })).toEqual({
      parar: false,
      motivo: null,
    });
  });
});
