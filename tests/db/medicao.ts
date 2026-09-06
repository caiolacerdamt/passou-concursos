import type { Client } from "pg";
import { expect } from "vitest";

import { sufixo } from "./acervo";

/**
 * Fixtures da **medicao** (SPEC 38/39).
 *
 * Depois do AD-138 a unidade que move o Raio-X nao e mais a questao publicada:
 * e a `(prova, numero, assunto)` da etiqueta, dentro de uma prova com grade
 * declarada. Todo teste do recalculo precisa das mesmas quatro pecas — materia
 * com assuntos, perfil com programa, prova medida e a chamada do job — e elas
 * moram aqui para que os dois arquivos de teste falem da mesma prova.
 */

export type BlocoDeTeste = { materiaId: string | null; itens: number };

export async function criarMateria(cliente: Client, quantosTopicos: number) {
  const { rows: materia } = await cliente.query<{ id: string }>(
    "insert into public.materias (nome) values ($1) returning id",
    [`Materia ${sufixo()}`],
  );
  const topicos: string[] = [];
  for (let i = 0; i < quantosTopicos; i += 1) {
    const { rows } = await cliente.query<{ id: string }>(
      "insert into public.topicos (materia_id, nome) values ($1, $2) returning id",
      [materia[0].id, `Topico ${sufixo()}`],
    );
    topicos.push(rows[0].id);
  }
  return { materiaId: materia[0].id, topicos };
}

export async function criarPerfil(
  cliente: Client,
  topicos: string[],
  opcoes: { orgao?: string; banca?: string; ativo?: boolean } = {},
): Promise<{ perfilId: string; orgao: string }> {
  const orgao = opcoes.orgao ?? `Banco do Brasil ${sufixo()}`;
  const { rows } = await cliente.query<{ id: string }>(
    `insert into public.perfil_concurso (orgao, banca, programa_edital, ativo)
     values ($1, $2, $3::jsonb, $4) returning id`,
    [orgao, opcoes.banca ?? "Cesgranrio", JSON.stringify(topicos), opcoes.ativo ?? true],
  );
  return { perfilId: rows[0].id, orgao };
}

/**
 * Uma prova que **entra** no Raio-X: grade lida, sem conferencia pendente,
 * caderno principal e cobertura cheia. Os blocos ja nascem com a materia
 * canonica vinculada — e a via explicita do RAIOX-16 AC2, e a unica que
 * sobrevive a uma materia perder todas as etiquetas.
 */
export async function criarProvaMedida(
  cliente: Client,
  opcoes: {
    orgao: string;
    ano: number;
    banca?: string;
    cargo?: string;
    blocos: BlocoDeTeste[];
    /** numero do item -> topico. Item sem entrada fica sem etiqueta. */
    etiquetas?: Record<number, string>;
    pontuacaoPorItem?: number;
  },
): Promise<string> {
  const { rows } = await cliente.query<{ id: string }>(
    `insert into public.provas (banca, ano, orgao, cargo)
     values ($1, $2, $3, $4) returning id`,
    [
      opcoes.banca ?? "Cesgranrio",
      opcoes.ano,
      opcoes.orgao,
      opcoes.cargo ?? `Cargo ${sufixo()}`,
    ],
  );
  const prova = rows[0].id;

  let cursor = 1;
  const blocos = opcoes.blocos.map((bloco, indice) => {
    const inicial = cursor;
    cursor += bloco.itens;
    return {
      ordem: indice + 1,
      nome_impresso: `BLOCO ${indice + 1}`,
      item_inicial: inicial,
      item_final: cursor - 1,
      pontuacao_por_item: opcoes.pontuacaoPorItem ?? null,
      materia_id: bloco.materiaId,
    };
  });

  const { rows: grade } = await cliente.query<{ status: string }>(
    "select public.registrar_grade_declarada($1, $2, $3::jsonb) as status",
    [prova, cursor - 1, JSON.stringify(blocos)],
  );
  expect(grade[0].status).toBe("lida");

  const etiquetas = Object.entries(opcoes.etiquetas ?? {}).map(([numero, topico]) => ({
    numero: Number(numero),
    topico_id: topico,
    confianca: 0.9,
  }));

  if (etiquetas.length > 0) {
    await cliente.query(
      "select * from public.gravar_etiquetas_ia($1, $2::jsonb, $3)",
      [prova, JSON.stringify(etiquetas), "versao-fixada-de-teste"],
    );
  }

  return prova;
}

/** Etiqueta o item `i` com `topicos[i % topicos.length]`, do 1 ao `quantos`. */
export function etiquetasEmRodizio(
  quantos: number,
  topicos: readonly string[],
  inicio = 1,
): Record<number, string> {
  return Object.fromEntries(
    Array.from({ length: quantos }, (_, i) => [
      i + inicio,
      topicos[i % topicos.length],
    ] as const),
  );
}

export async function recalcular(
  cliente: Client,
  referencia = "2026-01-15",
): Promise<number> {
  const { rows } = await cliente.query<{ total: number }>(
    "select public.recalcula_raiox($1::date) as total",
    [referencia],
  );
  return Number(rows[0].total);
}

export type LinhaMateria = {
  materia_id: string;
  peso: string;
  n_questoes: number;
  n_topicos: number;
  degrau: number;
  n_provas: number;
  anos: number[];
  base_do_peso: string;
  amostra_baixa: boolean;
};

export async function lerMaterias(
  cliente: Client,
  perfil: string,
): Promise<LinhaMateria[]> {
  const { rows } = await cliente.query<LinhaMateria>(
    `select materia_id, peso, n_questoes, n_topicos, degrau, n_provas, anos,
            base_do_peso, amostra_baixa
       from public.raiox_projecoes_materia
      where perfil_concurso_id = $1
      order by materia_id`,
    [perfil],
  );
  return rows;
}

export type LinhaTopico = {
  topico_id: string;
  peso: string;
  taxa_bruta: string;
  n_questoes: number;
  tendencia: string;
  degrau: number;
  amostra_baixa: boolean;
  n_provas: number;
  anos: number[];
  base_do_peso: string;
};

export async function lerTopicos(
  cliente: Client,
  perfil: string,
): Promise<LinhaTopico[]> {
  const { rows } = await cliente.query<LinhaTopico>(
    `select topico_id, peso, taxa_bruta, n_questoes, tendencia, degrau,
            amostra_baixa, n_provas, anos, base_do_peso
       from public.raiox_projecoes
      where perfil_concurso_id = $1
      order by topico_id`,
    [perfil],
  );
  return rows;
}
