#!/usr/bin/env node
/**
 * Orquestra a classificação do Grupo 3 sem deixar workers escreverem no banco.
 *
 * Fluxo:
 *   prepare  -> exporta o acervo vigente e cria lotes disjuntos em .temp/grupo3
 *   merge    -> valida e consolida os resultados dos workers no mapa final
 *   apply    -> aplica o mapa em transações pequenas, sem tocar em tentativas
 *   reproject -> recalcula Raio-X e projeções
 *   deactivate -> desativa tópicos/matérias sem questão vigente
 *   report   -> emite o relatório de aceite diretamente do banco
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { Client } from "pg";

import { conferirAlvo, lerEnv } from "../alvo-do-banco.mjs";

export type MapaItem = { materia: string; topico: string };
export type Mapa = Record<string, MapaItem>;

export type MateriaTaxonomia = {
  nome: string;
  ordem: number;
  topicos: string[];
};

export type Taxonomia = { materias: MateriaTaxonomia[] };

export type QuestaoParaClassificar = {
  ordem: number;
  id: string;
  sourceId: string;
  numero: number | null;
  enunciado: string;
  alternativas: unknown;
  imagens: unknown;
  materiaAtual: string | null;
  topicoAtual: string | null;
};

export type Lote = {
  numero: number;
  inicio: number;
  fim: number;
  questoes: QuestaoParaClassificar[];
  resultado: string;
};

export type Manifesto = {
  versao: 1;
  criadoEm: string;
  total: number;
  tamanhoLote: number;
  questoes: string;
  baseline: string;
  lotes: Lote[];
};

export const TAXONOMIA_PADRAO = "scripts/data/taxonomia-grupo3-bb-2022.json";
export const MAPA_PADRAO = "scripts/data/mapeamento-topicos-v2.json";
export const DIRETORIO_PADRAO = ".temp/grupo3";
export const TAMANHO_LOTE_PADRAO = 280;

export const CONSULTA_QUESTOES = `
  select
    q.id::text as id,
    coalesce(
      q.fonte_citacao #>> '{source_id}',
      q.id::text
    ) as source_id,
    q.numero,
    q.enunciado,
    q.alternativas,
    q.imagens,
    q.topico_id::text as topico_id,
    t.nome as topico_atual,
    m.nome as materia_atual
  from public.questoes q
  join public.topicos t on t.id = q.topico_id
  join public.materias m on m.id = t.materia_id
  where q.vigente and t.ativo and m.ativa
  order by
    coalesce(
      q.fonte_citacao #>> '{source_id}',
      q.id::text
    ),
    q.numero nulls last,
    q.id
`;

export const CONSULTA_TENTATIVAS_DIGEST = `
  select
    count(*)::integer as total,
    md5(
      coalesce(
        string_agg(
          to_jsonb(t)::text,
          E'\\n' order by t.id::text, t.respondida_em
        ),
        ''
      )
    ) as digest
  from public.tentativas t
`;

function lerJson<T>(arquivo: string): T {
  return JSON.parse(readFileSync(arquivo, "utf8")) as T;
}

function escreverJson(arquivo: string, valor: unknown): void {
  mkdirSync(path.dirname(arquivo), { recursive: true });
  writeFileSync(arquivo, `${JSON.stringify(valor, null, 2)}\n`, "utf8");
}

export function caminhoAbsoluto(raiz: string, relativo: string): string {
  return path.resolve(raiz, relativo);
}

export function lerTaxonomia(arquivo: string): Taxonomia {
  const taxonomia = lerJson<Taxonomia>(arquivo);
  if (!Array.isArray(taxonomia.materias) || taxonomia.materias.length !== 8) {
    throw new Error("taxonomia do Grupo 3 deve ter exatamente oito matérias");
  }

  const nomes = new Set<string>();
  for (const materia of taxonomia.materias) {
    if (nomes.has(materia.nome)) throw new Error(`matéria duplicada: ${materia.nome}`);
    nomes.add(materia.nome);
    if (!Array.isArray(materia.topicos) || materia.topicos.length === 0) {
      throw new Error(`matéria sem tópicos: ${materia.nome}`);
    }
    if (new Set(materia.topicos).size !== materia.topicos.length) {
      throw new Error(`tópico duplicado em ${materia.nome}`);
    }
  }
  return taxonomia;
}

export function indiceDaTaxonomia(taxonomia: Taxonomia): Map<string, Set<string>> {
  return new Map(taxonomia.materias.map((materia) => [materia.nome, new Set(materia.topicos)]));
}

export function validarMapa(
  mapa: Mapa,
  idsEsperados: readonly string[],
  taxonomia: Taxonomia,
): void {
  const esperados = new Set(idsEsperados);
  const taxonomiaPorMateria = indiceDaTaxonomia(taxonomia);
  const chaves = Object.keys(mapa);

  for (const id of chaves) {
    if (!esperados.has(id)) throw new Error(`ID fora do lote/manifesto: ${id}`);
    const item = mapa[id];
    if (item === undefined || typeof item.materia !== "string" || typeof item.topico !== "string") {
      throw new Error(`classificação inválida para ${id}`);
    }
    const topicos = taxonomiaPorMateria.get(item.materia);
    if (topicos === undefined) throw new Error(`matéria fora da taxonomia em ${id}: ${item.materia}`);
    if (!topicos.has(item.topico)) {
      throw new Error(`tópico fora da taxonomia em ${id}: ${item.materia}/${item.topico}`);
    }
  }

  const faltantes = idsEsperados.filter((id) => mapa[id] === undefined);
  if (faltantes.length > 0) throw new Error(`questões sem classificação: ${faltantes.slice(0, 10).join(", ")}`);
  if (chaves.length !== idsEsperados.length) {
    throw new Error(`quantidade de classificações divergente: ${chaves.length} != ${idsEsperados.length}`);
  }
}

export function particionar(
  questoes: readonly QuestaoParaClassificar[],
  tamanhoLote: number,
  resultadoPrefixo = "resultado/lote",
): Lote[] {
  if (!Number.isInteger(tamanhoLote) || tamanhoLote < 1) throw new Error("tamanho de lote inválido");
  const lotes: Lote[] = [];
  for (let inicio = 0; inicio < questoes.length; inicio += tamanhoLote) {
    const numero = lotes.length + 1;
    const itens = questoes.slice(inicio, inicio + tamanhoLote);
    lotes.push({
      numero,
      inicio: inicio + 1,
      fim: inicio + itens.length,
      questoes: [...itens],
      resultado: `${resultadoPrefixo}-${String(numero).padStart(2, "0")}.json`,
    });
  }
  return lotes;
}

function ambienteDoScript(raiz: string): Record<string, string | undefined> {
  const arquivo = path.join(raiz, ".env");
  if (!existsSync(arquivo)) return { ...process.env };
  return { ...process.env, ...lerEnv(readFileSync(arquivo, "utf8")) };
}

function clienteDoBanco(ambiente: Record<string, string | undefined>): Client {
  const databaseUrl = ambiente.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL não está definida");
  const alvo = conferirAlvo(databaseUrl);
  if (!alvo.ok) throw new Error(alvo.motivo);
  return new Client({ connectionString: databaseUrl });
}

function argumentos(argv: readonly string[]): {
  comando: "prepare" | "merge" | "validate" | "apply" | "reproject" | "deactivate" | "report";
  raiz: string;
  taxonomia: string;
  mapa: string;
  diretorio: string;
  tamanhoLote: number;
} {
  let comando: "prepare" | "merge" | "validate" | "apply" | "reproject" | "deactivate" | "report" = "prepare";
  let raiz = process.cwd();
  let taxonomia = TAXONOMIA_PADRAO;
  let mapa = MAPA_PADRAO;
  let diretorio = DIRETORIO_PADRAO;
  let tamanhoLote = TAMANHO_LOTE_PADRAO;

  for (let i = 0; i < argv.length; i += 1) {
    const valor = argv[i] ?? "";
    if (["prepare", "merge", "validate", "apply", "reproject", "deactivate", "report"].includes(valor)) {
      comando = valor as typeof comando;
      continue;
    }
    if (valor === "--root") raiz = argv[++i] ?? raiz;
    else if (valor === "--taxonomia") taxonomia = argv[++i] ?? taxonomia;
    else if (valor === "--mapa") mapa = argv[++i] ?? mapa;
    else if (valor === "--dir") diretorio = argv[++i] ?? diretorio;
    else if (valor === "--lote") tamanhoLote = Number(argv[++i] ?? tamanhoLote);
    else throw new Error(`uso: grupo3-classificacao [prepare|merge|validate|apply|report] [opções]; argumento: ${valor}`);
  }

  return {
    comando,
    raiz,
    taxonomia: caminhoAbsoluto(raiz, taxonomia),
    mapa: caminhoAbsoluto(raiz, mapa),
    diretorio: caminhoAbsoluto(raiz, diretorio),
    tamanhoLote,
  };
}

async function preparar(opcoes: ReturnType<typeof argumentos>, ambiente: Record<string, string | undefined>): Promise<void> {
  const taxonomia = lerTaxonomia(opcoes.taxonomia);
  const cliente = clienteDoBanco(ambiente);
  await cliente.connect();
  try {
    const resultado = await cliente.query(CONSULTA_QUESTOES);
    const questoes: QuestaoParaClassificar[] = resultado.rows.map((row, index) => ({
      ordem: index + 1,
      id: String(row.id),
      sourceId: String(row.source_id ?? row.id),
      numero: row.numero === null ? null : Number(row.numero),
      enunciado: String(row.enunciado),
      alternativas: row.alternativas,
      imagens: row.imagens,
      materiaAtual: row.materia_atual === null ? null : String(row.materia_atual),
      topicoAtual: row.topico_atual === null ? null : String(row.topico_atual),
    }));
    const tentativas = await cliente.query(CONSULTA_TENTATIVAS_DIGEST);
    const lotes = particionar(questoes, opcoes.tamanhoLote);
    const baseline = {
      criadoEm: new Date().toISOString(),
      questoes: questoes.map((questao) => questao.id),
      tentativas: {
        total: Number(tentativas.rows[0]?.total ?? 0),
        digest: String(tentativas.rows[0]?.digest ?? ""),
      },
    };
    const manifesto: Manifesto = {
      versao: 1,
      criadoEm: new Date().toISOString(),
      total: questoes.length,
      tamanhoLote: opcoes.tamanhoLote,
      questoes: "questoes.json",
      baseline: "baseline.json",
      lotes: lotes.map(({ numero, inicio, fim, resultado: nomeResultado, questoes: itens }) => ({
        numero,
        inicio,
        fim,
        questoes: itens,
        resultado: nomeResultado,
      })),
    };
    escreverJson(path.join(opcoes.diretorio, "taxonomia.json"), taxonomia);
    escreverJson(path.join(opcoes.diretorio, "questoes.json"), questoes);
    escreverJson(path.join(opcoes.diretorio, "baseline.json"), baseline);
    escreverJson(path.join(opcoes.diretorio, "manifesto.json"), manifesto);
    for (const lote of lotes) {
      escreverJson(path.join(opcoes.diretorio, `lote-${String(lote.numero).padStart(2, "0")}.json`), lote);
    }
    console.log(JSON.stringify({ total: questoes.length, lotes: lotes.length, tamanhoLote: opcoes.tamanhoLote }, null, 2));
  } finally {
    await cliente.end().catch(() => {});
  }
}

function lerManifesto(diretorio: string): Manifesto {
  const manifesto = lerJson<Manifesto>(path.join(diretorio, "manifesto.json"));
  if (manifesto.versao !== 1 || !Array.isArray(manifesto.lotes)) throw new Error("manifesto inválido");
  return manifesto;
}

function lerResultado(arquivo: string): Mapa {
  const bruto = lerJson<unknown>(arquivo);
  if (typeof bruto !== "object" || bruto === null || Array.isArray(bruto)) {
    throw new Error(`resultado não é um objeto JSON: ${arquivo}`);
  }
  const registro = bruto as Record<string, unknown>;
  const mapa = registro.mapa !== undefined ? registro.mapa : bruto;
  if (typeof mapa !== "object" || mapa === null || Array.isArray(mapa)) {
    throw new Error(`resultado não contém mapa: ${arquivo}`);
  }
  return mapa as Mapa;
}

function idsDoLote(lote: Lote): string[] {
  return lote.questoes.map((questao) => questao.id);
}

export function consolidarResultados(
  manifesto: Manifesto,
  diretorio: string,
  taxonomia: Taxonomia,
): Mapa {
  const final: Mapa = {};
  const todosIds = manifesto.lotes.flatMap(idsDoLote);
  for (const lote of manifesto.lotes) {
    const arquivo = path.join(diretorio, lote.resultado);
    if (!existsSync(arquivo)) throw new Error(`resultado ausente do lote ${lote.numero}: ${arquivo}`);
    const mapa = lerResultado(arquivo);
    validarMapa(mapa, idsDoLote(lote), taxonomia);
    for (const [id, item] of Object.entries(mapa)) {
      if (final[id] !== undefined) throw new Error(`ID duplicado entre lotes: ${id}`);
      final[id] = item;
    }
  }
  validarMapa(final, todosIds, taxonomia);
  return Object.fromEntries(todosIds.map((id) => [id, final[id]]));
}

async function validarNoBanco(
  opcoes: ReturnType<typeof argumentos>,
  ambiente: Record<string, string | undefined>,
  mapa: Mapa,
): Promise<{ total: number; topicos: number; tentativas: { total: number; digest: string } }> {
  const manifesto = lerManifesto(opcoes.diretorio);
  const taxonomia = lerTaxonomia(opcoes.taxonomia);
  validarMapa(mapa, manifesto.lotes.flatMap(idsDoLote), taxonomia);
  const cliente = clienteDoBanco(ambiente);
  await cliente.connect();
  try {
    const questoes = await cliente.query(`
      select q.id::text
        from public.questoes q
        join public.topicos t on t.id = q.topico_id
        join public.materias m on m.id = t.materia_id
       where q.vigente and t.ativo and m.ativa
       order by q.id
    `);
    const idsAtuais = questoes.rows.map((row) => String(row.id));
    validarMapa(mapa, idsAtuais, taxonomia);
    const catalogo = await cliente.query(`
      select t.nome as topico, m.nome as materia
        from public.topicos t
        join public.materias m on m.id = t.materia_id
       where t.ativo and m.ativa
    `);
    const catalogoPermitido = new Set(catalogo.rows.map((row) => `${row.materia}\u0000${row.topico}`));
    for (const item of Object.values(mapa)) {
      if (!catalogoPermitido.has(`${item.materia}\u0000${item.topico}`)) {
        throw new Error(`tópico do mapa não está ativo no banco: ${item.materia}/${item.topico}`);
      }
    }
    const tentativas = await cliente.query(CONSULTA_TENTATIVAS_DIGEST);
    return {
      total: idsAtuais.length,
      topicos: catalogo.rows.length,
      tentativas: {
        total: Number(tentativas.rows[0]?.total ?? 0),
        digest: String(tentativas.rows[0]?.digest ?? ""),
      },
    };
  } finally {
    await cliente.end().catch(() => {});
  }
}

async function aplicar(opcoes: ReturnType<typeof argumentos>, ambiente: Record<string, string | undefined>): Promise<void> {
  const taxonomia = lerTaxonomia(opcoes.taxonomia);
  const manifesto = lerManifesto(opcoes.diretorio);
  const mapa = lerJson<Mapa>(opcoes.mapa);
  const antes = await validarNoBanco(opcoes, ambiente, mapa);
  const cliente = clienteDoBanco(ambiente);
  await cliente.connect();
  let alteradas = 0;
  try {
    const catalogo = await cliente.query(`
      select t.id::text as id, t.nome as topico, m.nome as materia
        from public.topicos t
        join public.materias m on m.id = t.materia_id
       where t.ativo and m.ativa
    `);
    const idsPorNome = new Map(catalogo.rows.map((row) => [`${row.materia}\u0000${row.topico}`, String(row.id)]));
    for (const lote of manifesto.lotes) {
      await cliente.query("begin");
      try {
        let loteAlteradas = 0;
        for (const questao of lote.questoes) {
          const item = mapa[questao.id];
          if (item === undefined) throw new Error(`mapa sem questão ${questao.id}`);
          const topicoId = idsPorNome.get(`${item.materia}\u0000${item.topico}`);
          if (topicoId === undefined) throw new Error(`tópico não localizado: ${item.materia}/${item.topico}`);
          const resultado = await cliente.query(
            `update public.questoes
                set topico_id = $1
              where id = $2 and vigente
              returning id`,
            [topicoId, questao.id],
          );
          if (resultado.rowCount !== 1) throw new Error(`questão não atualizada: ${questao.id}`);
          loteAlteradas += 1;
        }
        await cliente.query("commit");
        alteradas += loteAlteradas;
        console.log(JSON.stringify({ lote: lote.numero, alteradas: loteAlteradas }));
      } catch (erro) {
        await cliente.query("rollback").catch(() => {});
        throw erro;
      }
    }
  } finally {
    await cliente.end().catch(() => {});
  }

  const depois = await validarNoBanco(opcoes, ambiente, mapa);
  if (antes.tentativas.total !== depois.tentativas.total || antes.tentativas.digest !== depois.tentativas.digest) {
    throw new Error("invariante violada: tentativas mudou durante a aplicação");
  }
  console.log(JSON.stringify({ total: manifesto.total, alteradas, tentativas: depois.tentativas }, null, 2));
}

async function reprojetar(ambiente: Record<string, string | undefined>): Promise<void> {
  const cliente = clienteDoBanco(ambiente);
  await cliente.connect();
  try {
    await cliente.query("begin");
    try {
      const raiox = await cliente.query("select public.recalcula_raiox(current_date) as linhas");
      const projecoes = await cliente.query("select public.recalcula_projecoes(null) as linhas");
      await cliente.query("commit");
      console.log(JSON.stringify({
        raiox: Number(raiox.rows[0]?.linhas ?? 0),
        projecoes: Number(projecoes.rows[0]?.linhas ?? 0),
      }, null, 2));
    } catch (erro) {
      await cliente.query("rollback").catch(() => {});
      throw erro;
    }
  } finally {
    await cliente.end().catch(() => {});
  }
}

async function desativar(ambiente: Record<string, string | undefined>): Promise<void> {
  const cliente = clienteDoBanco(ambiente);
  await cliente.connect();
  try {
    await cliente.query("begin");
    try {
      const topicos = await cliente.query(`
        update public.topicos t
           set ativo = false
         where t.ativo
           and not exists (
             select 1 from public.questoes q
              where q.topico_id = t.id and q.vigente
           )
        returning t.id
      `);
      const materias = await cliente.query(`
        update public.materias m
           set ativa = false
         where m.ativa
           and not exists (
             select 1 from public.topicos t
              where t.materia_id = m.id and t.ativo
           )
        returning m.id
      `);
      await cliente.query("commit");
      console.log(JSON.stringify({
        topicosDesativados: topicos.rowCount ?? 0,
        materiasDesativadas: materias.rowCount ?? 0,
      }, null, 2));
    } catch (erro) {
      await cliente.query("rollback").catch(() => {});
      throw erro;
    }
  } finally {
    await cliente.end().catch(() => {});
  }
}

async function relatorio(opcoes: ReturnType<typeof argumentos>, ambiente: Record<string, string | undefined>): Promise<void> {
  const cliente = clienteDoBanco(ambiente);
  await cliente.connect();
  try {
    const materias = await cliente.query("select nome, ordem, ativa from public.materias order by ordem");
    const distribuicao = await cliente.query(`
        select m.nome as materia, count(*)::integer as total,
               count(*) filter (where t.nome = 'Geral')::integer as geral,
               round(100.0 * count(*) filter (where t.nome = 'Geral') / count(*), 1) as percentual_geral
          from public.questoes q
          join public.topicos t on t.id = q.topico_id
          join public.materias m on m.id = t.materia_id
         where q.vigente and t.ativo and m.ativa
         group by m.nome
         order by percentual_geral desc, m.nome
      `);
    const total = await cliente.query("select count(*)::integer as total from public.questoes where vigente");
    const escopo = await cliente.query(`
      select count(*)::integer as total
        from public.questoes q
        join public.topicos t on t.id = q.topico_id
        join public.materias m on m.id = t.materia_id
       where q.vigente and t.ativo and m.ativa
    `);
    const topicosForaDeMateriasAtivas = await cliente.query(`
      select m.nome as materia, t.nome as topico
        from public.topicos t
        join public.materias m on m.id = t.materia_id
       where t.ativo and not m.ativa
       order by m.nome, t.nome
    `);
    const semTopico = await cliente.query(`
        select q.status::text as status, q.origem::text as origem, count(*)::integer as total
          from public.questoes q
         where q.vigente and q.topico_id is null
         group by q.status, q.origem
         order by q.status, q.origem
      `);
    const porStatus = await cliente.query(`
        select q.status::text as status, count(*)::integer as total
          from public.questoes q
         where q.vigente
         group by q.status
         order by q.status
      `);
    const tentativas = await cliente.query(CONSULTA_TENTATIVAS_DIGEST);
    const raiox = await cliente.query(`
        select t.nome as topico, m.nome as materia, r.peso, r.n_questoes
          from public.raiox_projecoes r
          join public.topicos t on t.id = r.topico_id
          join public.materias m on m.id = t.materia_id
         order by r.peso desc
         limit 20
      `);
    console.log(JSON.stringify({
      materias: materias.rows,
      distribuicao: distribuicao.rows,
      questoesVigentes: Number(total.rows[0]?.total ?? 0),
      questoesGrupo3: Number(escopo.rows[0]?.total ?? 0),
      questoesForaDoEscopo: Number(total.rows[0]?.total ?? 0) - Number(escopo.rows[0]?.total ?? 0),
      topicosAtivosForaDeMateriasAtivas: topicosForaDeMateriasAtivas.rows,
      questoesSemTopico: semTopico.rows,
      questoesPorStatus: porStatus.rows,
      tentativas: tentativas.rows[0],
      maioresLinhasRaiox: raiox.rows,
    }, null, 2));
  } finally {
    await cliente.end().catch(() => {});
  }
}

export async function executar(argv: readonly string[], raiz = process.cwd()): Promise<number> {
  const opcoes = argumentos(argv);
  const ambiente = ambienteDoScript(raiz);
  try {
    if (opcoes.comando === "prepare") await preparar(opcoes, ambiente);
    else if (opcoes.comando === "merge") {
      const taxonomia = lerTaxonomia(opcoes.taxonomia);
      const mapa = consolidarResultados(lerManifesto(opcoes.diretorio), opcoes.diretorio, taxonomia);
      escreverJson(opcoes.mapa, mapa);
      console.log(JSON.stringify({ classificadas: Object.keys(mapa).length, mapa: opcoes.mapa }, null, 2));
    } else if (opcoes.comando === "validate") {
      const mapa = lerJson<Mapa>(opcoes.mapa);
      console.log(JSON.stringify(await validarNoBanco(opcoes, ambiente, mapa), null, 2));
    } else if (opcoes.comando === "apply") await aplicar(opcoes, ambiente);
    else if (opcoes.comando === "reproject") await reprojetar(ambiente);
    else if (opcoes.comando === "deactivate") await desativar(ambiente);
    else await relatorio(opcoes, ambiente);
    return 0;
  } catch (erro) {
    console.error(`[grupo3] ${erro instanceof Error ? erro.stack ?? erro.message : String(erro)}`);
    return 1;
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(await executar(process.argv.slice(2)));
}
