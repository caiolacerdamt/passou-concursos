#!/usr/bin/env node
/** Importa o NDJSON oficial sem passar pelo gateway de IA. */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";

import type { ClienteSql } from "@/modules/ia";

import { lerEnv } from "../alvo-do-banco.mjs";

const LETRAS = ["A", "B", "C", "D", "E"] as const;
const LETRAS_CE = ["C", "E"] as const;

type Letra = (typeof LETRAS)[number];
type TipoResposta = "multipla_escolha" | "certo_errado";

export type BlocoJson = {
  tipo: string;
  texto?: unknown;
  dados?: unknown;
  legenda?: unknown;
  arquivo?: unknown;
};

export type QuestaoJson = {
  id: string;
  natureza: "real";
  instituicao: string;
  banca: string;
  concurso?: string;
  ano: number;
  cargo: string;
  disciplina: string;
  caderno_tipo: string;
  numero_original: number;
  enunciado: string;
  blocos: BlocoJson[];
  tipo_resposta: TipoResposta;
  alternativas: { rotulo: string; texto: string; imagem?: string }[];
  gabarito_definitivo: string;
  fonte: {
    source_id: string;
    arquivo_local: string;
    url_oficial?: string;
    url_gabarito_oficial?: string;
    url_resposta_recursos?: string;
    pagina?: number;
  };
};

export type Taxonomia = {
  materias: { nome: string; ordem: number; topicos: string[] }[];
};

export type MapaItem = { materia: string; topico: string };
export type Mapa = Record<string, MapaItem>;

export type ArquivosAuditados = {
  pdfs: string[];
  imagens: string[];
  imagensAusentes: string[];
};

export type Preparacao = {
  questoes: QuestaoJson[];
  taxonomia: Taxonomia;
  mapa: Mapa;
  arquivos: ArquivosAuditados;
};

export type RelatorioProva = {
  prova: string;
  sourceId: string;
  lidas: number;
  inseridas: number;
  jaExistentes: number;
  anuladas: number;
  semClassificacao: number;
  recusadas: number;
  imagensAusentes: string[];
  gabaritosPreenchidos: number;
  conflitos: string[];
};

export type Relatorio = {
  total: Omit<RelatorioProva, "prova" | "sourceId" | "imagensAusentes" | "conflitos"> & {
    provas: number;
    imagensAusentes: number;
    conflitos: number;
  };
  provas: RelatorioProva[];
  arquivos: { pdfs: number; imagens: number; imagensAusentes: number };
};

export type SubidorDeImagem = (
  bucket: string,
  caminho: string,
  arquivo: string,
) => Promise<void>;

export type Argumentos = {
  json: string;
  taxonomia: string;
  mapa: string;
  dryRun: boolean;
};

export const USO =
  "uso: importar-questoes-json [--json questoes.json] " +
  "[--taxonomia scripts/data/taxonomia-concursos-bancarios.json] " +
  "[--mapa scripts/data/mapeamento-questoes.json] [--dry-run]";

function texto(value: unknown, campo: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${campo} obrigatorio`);
  }
  return value.trim();
}

function objeto(value: unknown, campo: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${campo} precisa ser um objeto`);
  }
  return value as Record<string, unknown>;
}

function numero(value: unknown, campo: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${campo} precisa ser um inteiro positivo`);
  }
  return value;
}

function lista(value: unknown, campo: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${campo} precisa ser uma lista`);
  return value;
}

function provaKey(q: Pick<QuestaoJson, "banca" | "ano" | "instituicao" | "cargo" | "caderno_tipo">): string {
  return [q.banca, q.ano, q.instituicao, q.cargo, q.caderno_tipo].join(" | ");
}

function normalizarGabarito(value: unknown): string {
  return texto(value, "gabarito_definitivo").toUpperCase();
}

function validarAlternativas(value: unknown, tipo: TipoResposta): QuestaoJson["alternativas"] {
  const itens = lista(value, "alternativas").map((item, index) => {
    const row = objeto(item, `alternativas[${index}]`);
    const rotulo = texto(row.rotulo, `alternativas[${index}].rotulo`).toUpperCase();
    const imagem = typeof row.imagem === "string" && row.imagem.trim() !== "" ? row.imagem.trim() : undefined;
    const textoAlternativa = typeof row.texto === "string" ? row.texto.trim() : "";
    if (textoAlternativa === "" && imagem === undefined) {
      throw new Error(`alternativas[${index}].texto obrigatorio`);
    }
    return {
      rotulo,
      texto: textoAlternativa || `Imagem da alternativa ${rotulo}`,
      imagem,
    };
  });

  const rotulos = new Set(itens.map((item) => item.rotulo));
  if (rotulos.size !== itens.length) throw new Error("alternativas possuem rotulo repetido");

  if (tipo === "certo_errado") {
    if (
      itens.length !== 2 ||
      !itens.every((item) => (LETRAS_CE as readonly string[]).includes(item.rotulo))
    ) {
      throw new Error("questao certo/errado precisa ter somente C e E na entrada");
    }
    return itens;
  }

  if (itens.length < 2 || itens.length > LETRAS.length) {
    throw new Error("questao de multipla escolha precisa ter de 2 a 5 alternativas");
  }
  if (!itens.every((item) => (LETRAS as readonly string[]).includes(item.rotulo))) {
    throw new Error("alternativa fora de A-E");
  }
  return itens;
}

function validarQuestao(value: unknown, linha: number): QuestaoJson {
  const row = objeto(value, `linha ${linha}`);
  const tipo = texto(row.tipo_resposta, `linha ${linha}.tipo_resposta`) as TipoResposta;
  if (tipo !== "multipla_escolha" && tipo !== "certo_errado") {
    throw new Error(`linha ${linha}: tipo_resposta invalido`);
  }

  const gabarito = normalizarGabarito(row.gabarito_definitivo);
  const respostas = tipo === "multipla_escolha" ? LETRAS : LETRAS_CE;
  if (gabarito !== "ANULADA" && !(respostas as readonly string[]).includes(gabarito)) {
    throw new Error(`linha ${linha}: gabarito definitivo invalido`);
  }

  const fonte = objeto(row.fonte, `linha ${linha}.fonte`);
  const q: QuestaoJson = {
    id: texto(row.id, `linha ${linha}.id`),
    natureza: texto(row.natureza, `linha ${linha}.natureza`) as "real",
    instituicao: texto(row.instituicao, `linha ${linha}.instituicao`),
    banca: texto(row.banca, `linha ${linha}.banca`),
    concurso: typeof row.concurso === "string" ? row.concurso : undefined,
    ano: numero(row.ano, `linha ${linha}.ano`),
    cargo: texto(row.cargo, `linha ${linha}.cargo`),
    disciplina: texto(row.disciplina, `linha ${linha}.disciplina`),
    caderno_tipo: texto(row.caderno_tipo, `linha ${linha}.caderno_tipo`),
    numero_original: numero(row.numero_original, `linha ${linha}.numero_original`),
    enunciado: texto(row.enunciado, `linha ${linha}.enunciado`),
    blocos: lista(row.blocos, `linha ${linha}.blocos`) as BlocoJson[],
    tipo_resposta: tipo,
    alternativas: validarAlternativas(row.alternativas, tipo),
    gabarito_definitivo: gabarito,
    fonte: {
      source_id: texto(fonte.source_id, `linha ${linha}.fonte.source_id`),
      arquivo_local: texto(fonte.arquivo_local, `linha ${linha}.fonte.arquivo_local`),
      url_oficial: typeof fonte.url_oficial === "string" ? fonte.url_oficial : undefined,
      url_gabarito_oficial:
        typeof fonte.url_gabarito_oficial === "string" ? fonte.url_gabarito_oficial : undefined,
      url_resposta_recursos:
        typeof fonte.url_resposta_recursos === "string" ? fonte.url_resposta_recursos : undefined,
      pagina: typeof fonte.pagina === "number" ? fonte.pagina : undefined,
    },
  };

  if (q.natureza !== "real") throw new Error(`linha ${linha}: natureza precisa ser real`);
  return q;
}

export function lerQuestoesNdjson(conteudo: string): QuestaoJson[] {
  const questoes: QuestaoJson[] = [];
  const ids = new Set<string>();
  const numerosPorProva = new Map<string, Set<number>>();

  for (const [indice, linha] of conteudo.split(/\r?\n/).entries()) {
    if (linha.trim() === "") continue;
    let bruto: unknown;
    try {
      bruto = JSON.parse(linha);
    } catch {
      throw new Error(`linha ${indice + 1}: JSON invalido`);
    }
    const q = validarQuestao(bruto, indice + 1);
    if (ids.has(q.id)) throw new Error(`id duplicado: ${q.id}`);
    ids.add(q.id);

    const chave = provaKey(q);
    const numeros = numerosPorProva.get(chave) ?? new Set<number>();
    if (numeros.has(q.numero_original)) {
      throw new Error(`numero ${q.numero_original} repetido na prova ${chave}`);
    }
    numeros.add(q.numero_original);
    numerosPorProva.set(chave, numeros);
    questoes.push(q);
  }

  if (questoes.length === 0) throw new Error("questoes.json vazio");
  return questoes;
}

export function lerTaxonomia(conteudo: string): Taxonomia {
  const bruto = objeto(JSON.parse(conteudo), "taxonomia");
  const materias = lista(bruto.materias, "taxonomia.materias").map((item, index) => {
    const row = objeto(item, `taxonomia.materias[${index}]`);
    const topicos = lista(row.topicos, `taxonomia.materias[${index}].topicos`).map((topico, topicoIndex) =>
      texto(topico, `taxonomia.materias[${index}].topicos[${topicoIndex}]`),
    );
    if (new Set(topicos).size !== topicos.length) throw new Error("topico duplicado na taxonomia");
    return {
      nome: texto(row.nome, `taxonomia.materias[${index}].nome`),
      ordem: numero(row.ordem, `taxonomia.materias[${index}].ordem`),
      topicos,
    };
  });
  if (materias.length === 0 || new Set(materias.map((item) => item.nome)).size !== materias.length) {
    throw new Error("taxonomia precisa ter materias unicas");
  }
  return { materias };
}

export function lerMapa(conteudo: string): Mapa {
  const bruto = objeto(JSON.parse(conteudo), "mapa");
  const mapa: Mapa = {};
  for (const [id, value] of Object.entries(bruto)) {
    const row = objeto(value, `mapa.${id}`);
    mapa[id] = {
      materia: texto(row.materia, `mapa.${id}.materia`),
      topico: texto(row.topico, `mapa.${id}.topico`),
    };
  }
  return mapa;
}

function caminhoSeguro(raiz: string, relativo: string): string {
  const base = path.resolve(raiz);
  const destino = path.resolve(base, relativo);
  const rel = path.relative(base, destino);
  if (rel === "" || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
    throw new Error(`caminho local fora da raiz: ${relativo}`);
  }
  return destino;
}

export function auditarArquivos(questoes: QuestaoJson[], raiz: string): ArquivosAuditados {
  const pdfs = new Set<string>();
  const imagens = new Set<string>();
  const imagensAusentes = new Set<string>();

  for (const q of questoes) {
    const pdf = caminhoSeguro(raiz, q.fonte.arquivo_local);
    if (!existsSync(pdf)) throw new Error(`arquivo de prova ausente: ${q.fonte.arquivo_local}`);
    pdfs.add(q.fonte.arquivo_local);

    for (const imagem of imagensDaQuestao(q)) {
      const arquivo = imagem.arquivo;
      caminhoSeguro(raiz, arquivo);
      imagens.add(arquivo);
      if (!existsSync(path.resolve(raiz, arquivo))) imagensAusentes.add(arquivo);
    }
  }

  return { pdfs: [...pdfs], imagens: [...imagens], imagensAusentes: [...imagensAusentes] };
}

export function validarMapa(questoes: QuestaoJson[], taxonomia: Taxonomia, mapa: Mapa): void {
  const porMateria = new Map(taxonomia.materias.map((materia) => [materia.nome, new Set(materia.topicos)]));
  const ids = new Set(questoes.map((q) => q.id));
  for (const q of questoes) {
    const item = mapa[q.id];
    if (item === undefined) throw new Error(`mapa ausente para ${q.id}`);
    if (!porMateria.get(item.materia)?.has(item.topico)) {
      throw new Error(`mapa aponta para materia/topico inexistente: ${q.id}`);
    }
  }
  for (const id of Object.keys(mapa)) {
    if (!ids.has(id)) throw new Error(`mapa tem id que nao esta no JSON: ${id}`);
  }
}

export function prepararImportacao(
  json: string,
  taxonomiaJson: string,
  mapaJson: string,
  raiz: string,
): Preparacao {
  const questoes = lerQuestoesNdjson(json);
  const taxonomia = lerTaxonomia(taxonomiaJson);
  const mapa = lerMapa(mapaJson);
  validarMapa(questoes, taxonomia, mapa);
  const arquivos = auditarArquivos(questoes, raiz);
  return { questoes, taxonomia, mapa, arquivos };
}

function textoDoBloco(bloco: BlocoJson): string | null {
  if (bloco.tipo === "texto_base" || bloco.tipo === "paragrafo" || bloco.tipo === "formula") {
    const valor = typeof bloco.texto === "string" ? bloco.texto.trim() : "";
    return valor === "" ? null : bloco.tipo === "formula" ? `Fórmula: ${valor}` : valor;
  }
  if (bloco.tipo !== "tabela") return null;
  const dados = Array.isArray(bloco.dados) ? bloco.dados : [];
  const linhas = dados.map((linha) =>
    Array.isArray(linha) ? linha.map((celula) => String(celula ?? "")).join(" | ") : String(linha),
  );
  const legenda = typeof bloco.legenda === "string" ? bloco.legenda.trim() : "";
  const resultado = [legenda, ...linhas].filter((item) => item.trim() !== "").join("\n");
  return resultado === "" ? null : `Tabela:\n${resultado}`;
}

export function enunciadoComBlocos(q: QuestaoJson): string {
  const partes: string[] = [];
  for (const bloco of q.blocos) {
    const parte = textoDoBloco(bloco);
    if (parte !== null && !partes.some((existente) => existente === parte || existente.includes(parte.slice(0, 80)))) {
      partes.push(parte);
    }
  }
  if (!partes.some((parte) => parte === q.enunciado || parte.includes(q.enunciado.slice(0, 80)))) {
    partes.push(q.enunciado);
  }
  return partes.join("\n\n");
}

function imagensDaQuestao(q: QuestaoJson): { arquivo: string; legenda: string; posicao: string }[] {
  const blocos = q.blocos
    .filter((bloco) => bloco.tipo === "imagem")
    .map((bloco) => ({
      arquivo: texto(bloco.arquivo, `imagem da questao ${q.id}`),
      legenda:
        typeof bloco.legenda === "string" && bloco.legenda.trim() !== ""
          ? bloco.legenda.trim()
          : `Figura da questão ${q.numero_original}`,
      posicao: "enunciado",
    }));
  const alternativas = q.alternativas
    .filter((alternativa) => alternativa.imagem !== undefined)
    .map((alternativa) => ({
      arquivo: alternativa.imagem as string,
      legenda: `Imagem da alternativa ${alternativa.rotulo}`,
      posicao: `alternativa_${alternativa.rotulo}`,
    }));
  return [...blocos, ...alternativas];
}

function alternativaDb(q: QuestaoJson): { letra: Letra; texto: string }[] | null {
  if (q.tipo_resposta === "certo_errado") return null;
  return q.alternativas.map((alternativa) => ({
    letra: alternativa.rotulo as Letra,
    texto: alternativa.texto,
  }));
}

function relatorioVazio(preparacao: Preparacao): Relatorio {
  return {
    total: {
      provas: new Set(preparacao.questoes.map(provaKey)).size,
      lidas: preparacao.questoes.length,
      inseridas: 0,
      jaExistentes: 0,
      anuladas: preparacao.questoes.filter((q) => q.gabarito_definitivo === "ANULADA").length,
      semClassificacao: 0,
      recusadas: 0,
      gabaritosPreenchidos: 0,
      conflitos: 0,
      imagensAusentes: preparacao.arquivos.imagensAusentes.length,
    },
    provas: [],
    arquivos: {
      pdfs: preparacao.arquivos.pdfs.length,
      imagens: preparacao.arquivos.imagens.length,
      imagensAusentes: preparacao.arquivos.imagensAusentes.length,
    },
  };
}

export function relatorioDoDryRun(preparacao: Preparacao): Relatorio {
  const relatorio = relatorioVazio(preparacao);
  for (const [chave, grupo] of agruparPorProva(preparacao.questoes)) {
    relatorio.provas.push({
      prova: chave,
      sourceId: grupo[0].fonte.source_id,
      lidas: grupo.length,
      inseridas: 0,
      jaExistentes: 0,
      anuladas: grupo.filter((q) => q.gabarito_definitivo === "ANULADA").length,
      semClassificacao: 0,
      recusadas: 0,
      imagensAusentes: grupo.flatMap((q) =>
        imagensDaQuestao(q)
          .filter((imagem) => preparacao.arquivos.imagensAusentes.includes(imagem.arquivo))
          .map((imagem) => imagem.arquivo),
      ),
      gabaritosPreenchidos: 0,
      conflitos: [],
    });
  }
  return relatorio;
}

function agruparPorProva(questoes: QuestaoJson[]): Map<string, QuestaoJson[]> {
  const grupos = new Map<string, QuestaoJson[]>();
  for (const q of questoes) grupos.set(provaKey(q), [...(grupos.get(provaKey(q)) ?? []), q]);
  return grupos;
}

async function catalogarTaxonomia(cliente: ClienteSql, taxonomia: Taxonomia): Promise<Map<string, string>> {
  const topicos = new Map<string, string>();
  for (const materia of taxonomia.materias) {
    await cliente.query(
      `insert into public.materias (nome, ordem, ativa)
       values ($1, $2, true)
       on conflict (nome) do nothing`,
      [materia.nome, materia.ordem],
    );
    const materiaResult = await cliente.query("select id, ativa from public.materias where nome = $1", [materia.nome]);
    const materiaId = String(materiaResult.rows[0]?.id ?? "");
    if (materiaId === "" || materiaResult.rows[0]?.ativa === false) {
      throw new Error(`materia indisponivel: ${materia.nome}`);
    }
    for (let ordem = 0; ordem < materia.topicos.length; ordem += 1) {
      const nome = materia.topicos[ordem];
      await cliente.query(
        `insert into public.topicos (materia_id, nome, ordem, ativo)
         values ($1, $2, $3, true)
         on conflict (materia_id, nome) do nothing`,
        [materiaId, nome, ordem + 1],
      );
      const topico = await cliente.query(
        "select id, ativo from public.topicos where materia_id = $1 and nome = $2",
        [materiaId, nome],
      );
      if (topico.rows[0]?.ativo === false || topico.rows[0]?.id === undefined) {
        throw new Error(`topico indisponivel: ${materia.nome}/${nome}`);
      }
      topicos.set(`${materia.nome}\u0000${nome}`, String(topico.rows[0].id));
    }
  }
  return topicos;
}

async function catalogarProva(cliente: ClienteSql, q: QuestaoJson): Promise<string> {
  const observacao = JSON.stringify({
    source_id: q.fonte.source_id,
    concurso: q.concurso ?? null,
    arquivo_local: q.fonte.arquivo_local,
    url_oficial: q.fonte.url_oficial ?? null,
    url_gabarito_oficial: q.fonte.url_gabarito_oficial ?? null,
    url_resposta_recursos: q.fonte.url_resposta_recursos ?? null,
  });
  await cliente.query(
    `insert into public.provas (banca, ano, orgao, cargo, caderno, status, observacao)
     values ($1, $2, $3, $4, $5, 'catalogada', $6)
     on conflict (banca, ano, orgao, cargo, coalesce(caderno, '')) do update
       set observacao = case
         when nullif(btrim(public.provas.observacao), '') is null then excluded.observacao
         else public.provas.observacao
       end`,
    [q.banca, q.ano, q.instituicao, q.cargo, q.caderno_tipo, observacao],
  );
  const result = await cliente.query(
    `select id from public.provas
      where banca = $1 and ano = $2 and orgao = $3 and cargo = $4
        and coalesce(caderno, '') = coalesce($5, '')`,
    [q.banca, q.ano, q.instituicao, q.cargo, q.caderno_tipo],
  );
  const id = String(result.rows[0]?.id ?? "");
  if (id === "") throw new Error(`prova nao catalogada: ${provaKey(q)}`);
  return id;
}

async function cruzarGabarito(
  cliente: ClienteSql,
  provaId: string,
  grupo: QuestaoJson[],
): Promise<{ preenchidas: number; versionadas: number; anuladas: number }> {
  const itens = grupo.map((q) => ({
    numero: q.numero_original,
    resposta: q.gabarito_definitivo === "ANULADA" ? null : q.gabarito_definitivo,
    anulada: q.gabarito_definitivo === "ANULADA",
  }));
  const versao = `json-definitivo:${grupo[0].fonte.source_id}`;
  const result = await cliente.query(
    "select public.cruzar_gabarito($1, $2::jsonb, $3) as resumo",
    [provaId, JSON.stringify(itens), versao],
  );
  const resumo = (result.rows[0]?.resumo ?? {}) as Record<string, unknown>;
  const atual = await cliente.query(
    `select numero, resposta_correta, anulada
       from public.questoes
      where prova_id = $1 and vigente and numero = any($2::integer[])`,
    [provaId, grupo.map((q) => q.numero_original)],
  );
  const porNumero = new Map(atual.rows.map((row) => [Number(row.numero), row]));
  const conflitos: string[] = [];
  for (const item of itens) {
    const row = porNumero.get(item.numero);
    if (row === undefined || row.anulada !== item.anulada || row.resposta_correta !== item.resposta) {
      conflitos.push(`questao ${item.numero}`);
    }
  }
  if (conflitos.length > 0 || Number(resumo.sem_questao ?? 0) > 0) {
    throw new Error(`conflito de gabarito na prova ${provaId}: ${conflitos.join(", ") || "questao ausente"}`);
  }
  return {
    preenchidas: Number(resumo.preenchidas ?? 0),
    versionadas: Number(resumo.versionadas ?? 0),
    anuladas: Number(resumo.anuladas ?? 0),
  };
}

export async function importarDados(
  cliente: ClienteSql,
  preparacao: Preparacao,
  opcoes: { bucket?: string; subirImagem?: SubidorDeImagem; transacao?: boolean; raiz?: string } = {},
): Promise<Relatorio> {
  const propriaTransacao = opcoes.transacao !== false;
  if (propriaTransacao) await cliente.query("begin");
  try {
    const relatorio = relatorioVazio(preparacao);
    const topicos = await catalogarTaxonomia(cliente, preparacao.taxonomia);
    const raiz = opcoes.raiz ?? process.cwd();

    for (const [chave, grupo] of agruparPorProva(preparacao.questoes)) {
      const provaId = await catalogarProva(cliente, grupo[0]);
      const linha: RelatorioProva = {
        prova: chave,
        sourceId: grupo[0].fonte.source_id,
        lidas: grupo.length,
        inseridas: 0,
        jaExistentes: 0,
        anuladas: grupo.filter((q) => q.gabarito_definitivo === "ANULADA").length,
        semClassificacao: 0,
        recusadas: 0,
        imagensAusentes: [],
        gabaritosPreenchidos: 0,
        conflitos: [],
      };

      for (const q of grupo) {
        const mapa = preparacao.mapa[q.id];
        const topicoId = topicos.get(`${mapa.materia}\u0000${mapa.topico}`);
        if (topicoId === undefined) throw new Error(`topico nao localizado para ${q.id}`);

        const existente = await cliente.query(
          `select id from public.questoes where prova_id = $1 and numero = $2 and vigente`,
          [provaId, q.numero_original],
        );
        if (existente.rows.length > 0) {
          linha.jaExistentes += 1;
          continue;
        }

        const imagens = [] as { storage_path: string; posicao: string; alt_text: string }[];
        let temProblemaVisual = false;
        for (const imagem of imagensDaQuestao(q)) {
          const destino = path.resolve(raiz, imagem.arquivo);
          if (!existsSync(destino)) {
            temProblemaVisual = true;
            linha.imagensAusentes.push(imagem.arquivo);
            continue;
          }
          if (opcoes.subirImagem === undefined) throw new Error("subidor de imagem nao configurado");
          const nome = path.basename(imagem.arquivo).replace(/[^A-Za-z0-9._-]/g, "_");
          const caminho = `json/${q.fonte.source_id}/${nome}`;
          await opcoes.subirImagem(opcoes.bucket ?? "questoes", caminho, imagem.arquivo);
          imagens.push({
            storage_path: `${opcoes.bucket ?? "questoes"}/${caminho}`,
            posicao: imagem.posicao,
            alt_text: imagem.legenda,
          });
        }

        const status = imagensDaQuestao(q).length > 0 || temProblemaVisual ? "em_revisao" : "rascunho";
        const inserido = await cliente.query(
          `insert into public.questoes
             (prova_id, numero, origem, fonte_citacao, topico_id, tipo_questao,
              enunciado, alternativas, imagens, dificuldade, confianca_ia, status)
           values ($1, $2, 'real', $3::jsonb, $4, $5::tipo_questao,
                   $6, $7::jsonb, $8::jsonb, null, null, $9::status_questao)
           on conflict (prova_id, numero) where vigente and prova_id is not null
           do nothing returning id`,
          [
            provaId,
            q.numero_original,
            JSON.stringify({ banca: q.banca, ano: q.ano, orgao: q.instituicao, cargo: q.cargo, numero: q.numero_original }),
            topicoId,
            q.tipo_resposta,
            enunciadoComBlocos(q),
            q.tipo_resposta === "certo_errado" ? null : JSON.stringify(alternativaDb(q)),
            JSON.stringify(imagens),
            status,
          ],
        );
        if (inserido.rows.length > 0) linha.inseridas += 1;
        else linha.jaExistentes += 1;
      }

      const gabarito = await cruzarGabarito(cliente, provaId, grupo);
      linha.gabaritosPreenchidos = gabarito.preenchidas + gabarito.versionadas;
      await cliente.query(
        `update public.provas set status = 'gabarito_cruzado'
          where id = $1 and status <> 'concluida'`,
        [provaId],
      );
      linha.imagensAusentes = [...new Set(linha.imagensAusentes)];
      relatorio.provas.push(linha);
      relatorio.total.inseridas += linha.inseridas;
      relatorio.total.jaExistentes += linha.jaExistentes;
      relatorio.total.gabaritosPreenchidos += linha.gabaritosPreenchidos;
    }

    if (propriaTransacao) await cliente.query("commit");
    return relatorio;
  } catch (erro) {
    if (propriaTransacao) await cliente.query("rollback").catch(() => {});
    throw erro;
  }
}

export function lerArgumentos(argv: readonly string[]): Argumentos {
  let dryRun = false;
  const valores = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (!argv[i].startsWith("--")) throw new Error(USO);
    valores.set(argv[i].slice(2), argv[i + 1] ?? "");
    i += 1;
  }
  return {
    json: valores.get("json") ?? "questoes.json",
    taxonomia: valores.get("taxonomia") ?? "scripts/data/taxonomia-concursos-bancarios.json",
    mapa: valores.get("mapa") ?? "scripts/data/mapeamento-questoes.json",
    dryRun,
  };
}

export function ambienteDoScript(raiz: string = process.cwd()): Record<string, string | undefined> {
  const arquivo = path.join(raiz, ".env");
  if (!existsSync(arquivo)) return { ...process.env };
  return { ...process.env, ...lerEnv(readFileSync(arquivo, "utf8")) };
}

export function argumentosDaExecucao(
  argv: readonly string[],
  ambiente: Record<string, string | undefined> = process.env,
): string[] {
  if (ambiente.npm_config_dry_run === "true" && !argv.includes("--dry-run")) {
    return [...argv, "--dry-run"];
  }
  return [...argv];
}

export function motivoDeParada(ambiente: Record<string, string | undefined>): string | null {
  if (!ambiente.DATABASE_URL?.trim()) return "DATABASE_URL nao esta definida. Ver docs/SEGREDOS.md.";
  if (!ambiente.NEXT_PUBLIC_SUPABASE_URL?.trim() || !ambiente.SUPABASE_SECRET_KEY?.trim()) {
    return "NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY sao obrigatorias para as imagens.";
  }
  return null;
}

export function subidorDoStorage(ambiente: Record<string, string | undefined>): SubidorDeImagem {
  const supabase = createClient(ambiente.NEXT_PUBLIC_SUPABASE_URL ?? "", ambiente.SUPABASE_SECRET_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return async (bucket, caminho, arquivo) => {
    const bytes = readFileSync(arquivo);
    const { error } = await supabase.storage.from(bucket).upload(caminho, bytes, {
      contentType: "image/png",
      upsert: true,
    });
    if (error !== null) throw error;
  };
}

async function lerBucket(cliente: ClienteSql): Promise<string> {
  const result = await cliente.query(
    `select valor #>> '{}' as valor from public.configuracoes_vigentes
      where chave = 'param.m1.bucket_de_imagens'`,
  );
  return String(result.rows[0]?.valor ?? "questoes").trim() || "questoes";
}

export async function executar(
  ambiente: Record<string, string | undefined>,
  argv: readonly string[],
  opcoes: {
    abrirConexao?: () => ClienteSql & { connect(): Promise<void>; end(): Promise<void> };
    lerArquivo?: (arquivo: string) => string;
    subirImagem?: SubidorDeImagem;
    raiz?: string;
  } = {},
): Promise<number> {
  let args: Argumentos;
  try {
    args = lerArgumentos(argv);
    const raiz = opcoes.raiz ?? process.cwd();
    const ler = opcoes.lerArquivo ?? ((arquivo: string) => readFileSync(arquivo, "utf8"));
    const preparacao = prepararImportacao(
      ler(path.resolve(raiz, args.json)),
      ler(path.resolve(raiz, args.taxonomia)),
      ler(path.resolve(raiz, args.mapa)),
      raiz,
    );
    if (args.dryRun) {
      console.log(JSON.stringify(relatorioDoDryRun(preparacao), null, 2));
      return 0;
    }

    const motivo = motivoDeParada(ambiente);
    if (motivo !== null) {
      console.error(`[importar-json] ${motivo}`);
      return 1;
    }

    const abrir = opcoes.abrirConexao ?? (() => new Client({ connectionString: ambiente.DATABASE_URL }) as never);
    const cliente = abrir();
    try {
      await cliente.connect();
      const bucket = await lerBucket(cliente);
      const relatorio = await importarDados(cliente, preparacao, {
        bucket,
        subirImagem: opcoes.subirImagem ?? subidorDoStorage(ambiente),
        raiz,
      });
      console.log(JSON.stringify(relatorio, null, 2));
      return relatorio.total.conflitos === 0 ? 0 : 1;
    } finally {
      await cliente.end().catch(() => {});
    }
  } catch (erro) {
    console.error(`[importar-json] ${erro instanceof Error ? erro.stack ?? erro.message : String(erro)}`);
    return 1;
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const raiz = process.cwd();
  const argumentos = argumentosDaExecucao(process.argv.slice(2), process.env);
  const ambiente = argumentos.includes("--dry-run") ? {} : ambienteDoScript(raiz);
  process.exit(await executar(ambiente, argumentos, { raiz }));
}
