import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

/** Tipos fechados da curadoria inicial; o aluno não escolhe o tipo. */
export const TIPOS_RECURSO_ESTUDO = ["video", "artigo", "pdf"] as const;
export type TipoRecursoEstudo = (typeof TIPOS_RECURSO_ESTUDO)[number];

export type RecursoParaCarga = {
  id?: string;
  materia: string;
  topico: string;
  titulo: string;
  url: string;
  tipo: TipoRecursoEstudo;
  duracaoMinutos: number;
  ordem: number;
  ativo: boolean;
};

export type RecursoDeEstudo = {
  id: string;
  topicoId: string;
  titulo: string;
  url: string;
  tipo: TipoRecursoEstudo;
  duracaoMinutos: number;
  ordem: number;
  ativo: boolean;
};

const entradaSchema = z.object({
  id: z.string().uuid().optional(),
  materia: z.string().trim().min(1),
  topico: z.string().trim().min(1),
  titulo: z.string().trim().min(1),
  url: z.string().trim().refine((valor) => /^https:\/\/[^\s]+$/i.test(valor), {
    message: "url_do_recurso_invalida",
  }),
  tipo: z.enum(TIPOS_RECURSO_ESTUDO),
  duracaoMinutos: z.number().int().positive(),
  ordem: z.number().int().positive(),
  ativo: z.boolean(),
});

function objeto(valor: unknown, indice: number): Record<string, unknown> {
  if (valor === null || typeof valor !== "object" || Array.isArray(valor)) {
    throw new Error(`recurso ${indice}: objeto obrigatorio`);
  }
  return valor as Record<string, unknown>;
}

function primeiro(
  linha: Record<string, unknown>,
  ...chaves: readonly string[]
): unknown {
  for (const chave of chaves) {
    if (linha[chave] !== undefined && linha[chave] !== null) return linha[chave];
  }
  return undefined;
}

function texto(valor: unknown, campo: string, indice: number): string {
  if (typeof valor !== "string" || valor.trim() === "") {
    throw new Error(`recurso ${indice}: ${campo} obrigatorio`);
  }
  return valor.trim();
}

function inteiro(valor: unknown, campo: string, indice: number): number {
  const numero = typeof valor === "number" ? valor : Number(valor);
  if (!Number.isInteger(numero) || numero <= 0) {
    throw new Error(`recurso ${indice}: ${campo} precisa ser inteiro positivo`);
  }
  return numero;
}

function booleano(valor: unknown, campo: string, indice: number): boolean {
  if (typeof valor === "boolean") return valor;
  if (typeof valor === "number" && (valor === 0 || valor === 1)) return valor === 1;
  if (typeof valor === "string") {
    const normalizado = valor.trim().toLowerCase();
    if (["true", "1", "sim", "s", "ativo"].includes(normalizado)) return true;
    if (["false", "0", "nao", "não", "n", "inativo"].includes(normalizado)) return false;
  }
  throw new Error(`recurso ${indice}: ${campo} precisa ser booleano`);
}

function normalizarEntrada(valor: unknown, indice: number): RecursoParaCarga {
  const linha = objeto(valor, indice);
  const materia = texto(primeiro(linha, "materia", "matéria"), "materia", indice);
  const topico = texto(primeiro(linha, "topico", "tópico"), "topico", indice);
  const titulo = texto(primeiro(linha, "titulo", "título"), "titulo", indice);
  const url = texto(primeiro(linha, "url"), "url", indice);
  const tipo = texto(primeiro(linha, "tipo"), "tipo", indice).toLowerCase();
  if (!(TIPOS_RECURSO_ESTUDO as readonly string[]).includes(tipo)) {
    throw new Error(`recurso ${indice}: tipo invalido`);
  }

  const duracaoMinutos = inteiro(
    primeiro(linha, "duracaoMinutos", "duracao_minutos", "duracao", "duracao_estimada_minutos"),
    "duracao_minutos",
    indice,
  );
  const ordem = inteiro(primeiro(linha, "ordem"), "ordem", indice);
  const ativo = booleano(primeiro(linha, "ativo"), "ativo", indice);
  const id = primeiro(linha, "id");
  const resultado = entradaSchema.safeParse({
    id: id === undefined || id === null || id === "" ? undefined : id,
    materia,
    topico,
    titulo,
    url,
    tipo,
    duracaoMinutos,
    ordem,
    ativo,
  });
  if (!resultado.success) {
    const mensagem = resultado.error.issues[0]?.message ?? "entrada_invalida";
    throw new Error(`recurso ${indice}: ${mensagem}`);
  }
  return resultado.data;
}

/**
 * CSV RFC-4180 pequeno e determinístico, sem qualquer chamada de rede. Aspas
 * permitem vírgula, quebra de linha e aspas duplicadas no título.
 */
function lerLinhasCsv(conteudo: string): string[][] {
  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = "";
  let entreAspas = false;

  for (let indice = 0; indice < conteudo.length; indice += 1) {
    const caractere = conteudo[indice];
    if (caractere === '"') {
      if (entreAspas && conteudo[indice + 1] === '"') {
        campo += '"';
        indice += 1;
      } else {
        entreAspas = !entreAspas;
      }
      continue;
    }
    if (!entreAspas && caractere === ",") {
      linha.push(campo);
      campo = "";
      continue;
    }
    if (!entreAspas && (caractere === "\n" || caractere === "\r")) {
      if (caractere === "\r" && conteudo[indice + 1] === "\n") indice += 1;
      linha.push(campo);
      campo = "";
      if (linha.some((valor) => valor.trim() !== "")) linhas.push(linha);
      linha = [];
      continue;
    }
    campo += caractere;
  }

  if (entreAspas) throw new Error("csv com aspas nao fechadas");
  linha.push(campo);
  if (linha.some((valor) => valor.trim() !== "")) linhas.push(linha);
  return linhas;
}

function normalizarCabecalho(valor: string): string {
  return valor
    .replace(/^\uFEFF/, "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function lerRecursosCsv(conteudo: string): RecursoParaCarga[] {
  const linhas = lerLinhasCsv(conteudo);
  const cabecalho = linhas[0]?.map(normalizarCabecalho) ?? [];
  if (cabecalho.length === 0 || cabecalho.some((valor) => valor === "")) {
    throw new Error("csv sem cabecalho valido");
  }
  if (new Set(cabecalho).size !== cabecalho.length) {
    throw new Error("csv com coluna duplicada");
  }
  const obrigatorias = ["materia", "topico", "titulo", "url", "tipo", "ordem"];
  for (const coluna of obrigatorias) {
    if (!cabecalho.includes(coluna)) throw new Error(`csv sem coluna ${coluna}`);
  }
  if (
    !["duracao_minutos", "duracao", "duracao_estimada_minutos"].some((coluna) =>
      cabecalho.includes(coluna),
    )
  ) {
    throw new Error("csv sem coluna duracao_minutos");
  }
  if (!cabecalho.includes("ativo")) throw new Error("csv sem coluna ativo");
  if (linhas.length === 1) throw new Error("csv sem recursos");

  return linhas.slice(1).map((valores, indice) => {
    if (valores.length !== cabecalho.length) {
      throw new Error(`csv linha ${indice + 2}: numero de colunas invalido`);
    }
    const linha: Record<string, unknown> = {};
    for (const [posicao, coluna] of cabecalho.entries()) linha[coluna] = valores[posicao] ?? "";
    return normalizarEntrada(linha, indice + 1);
  });
}

export function lerRecursosJson(conteudo: string): RecursoParaCarga[] {
  let bruto: unknown;
  try {
    bruto = JSON.parse(conteudo.replace(/^\uFEFF/, ""));
  } catch {
    throw new Error("json de recursos invalido");
  }
  const itens = Array.isArray(bruto)
    ? bruto
    : objeto(bruto, 0).recursos;
  if (!Array.isArray(itens) || itens.length === 0) {
    throw new Error("json de recursos precisa ter uma lista nao vazia");
  }
  return itens.map((item, indice) => normalizarEntrada(item, indice + 1));
}

/** Lê JSON (array ou `{ recursos: [...] }`) ou CSV conforme a extensão. */
export function lerRecursosEstudo(
  conteudo: string,
  formato: "csv" | "json" = (() => {
    const semBOM = conteudo.replace(/^\uFEFF/, "").trimStart();
    return semBOM.startsWith("[") || semBOM.startsWith("{") ? "json" : "csv";
  })(),
): RecursoParaCarga[] {
  const recursos = formato === "json" ? lerRecursosJson(conteudo) : lerRecursosCsv(conteudo);
  const chaves = new Set<string>();
  for (const recurso of recursos) {
    const chave = `${recurso.materia}\u0000${recurso.topico}\u0000${recurso.url}`;
    if (chaves.has(chave)) throw new Error(`recurso duplicado no arquivo: ${recurso.url}`);
    chaves.add(chave);
  }
  return recursos;
}

type LinhaDeRecurso = {
  id: string;
  topico_id: string;
  titulo: string;
  url: string;
  tipo: string;
  duracao_minutos: number;
  ordem: number;
  ativo: boolean;
};

function mapearRecurso(linha: LinhaDeRecurso): RecursoDeEstudo {
  if (!(TIPOS_RECURSO_ESTUDO as readonly string[]).includes(linha.tipo)) {
    throw new Error("tipo_de_recurso_invalido_no_banco");
  }
  return {
    id: String(linha.id),
    topicoId: String(linha.topico_id),
    titulo: linha.titulo,
    url: linha.url,
    tipo: linha.tipo as TipoRecursoEstudo,
    duracaoMinutos: Number(linha.duracao_minutos),
    ordem: Number(linha.ordem),
    ativo: Boolean(linha.ativo),
  };
}

/**
 * Consulta somente a curadoria ativa. O cliente é recebido pelo chamador para
 * preservar a RLS do aluno; esta função não importa IA, `fetch` ou qualquer
 * resolvedor de URL.
 */
export async function consultarRecursosDoTopico(
  cliente: SupabaseClient,
  topicoId: string,
): Promise<readonly RecursoDeEstudo[]> {
  const { data, error } = await cliente
    .from("recursos_estudo")
    .select("id, topico_id, titulo, url, tipo, duracao_minutos, ordem, ativo")
    .eq("topico_id", topicoId)
    .eq("ativo", true)
    .order("ordem", { ascending: true })
    .order("titulo", { ascending: true });
  if (error) throw new Error(`falha ao ler recursos de estudo: ${error.message}`);
  return ((data ?? []) as LinhaDeRecurso[]).map(mapearRecurso);
}

export async function consultarRecursosAtivos(
  cliente: SupabaseClient,
): Promise<readonly RecursoDeEstudo[]> {
  const { data, error } = await cliente
    .from("recursos_estudo")
    .select("id, topico_id, titulo, url, tipo, duracao_minutos, ordem, ativo")
    .eq("ativo", true)
    .order("topico_id", { ascending: true })
    .order("ordem", { ascending: true })
    .order("titulo", { ascending: true });
  if (error) throw new Error(`falha ao ler recursos de estudo: ${error.message}`);
  return ((data ?? []) as LinhaDeRecurso[]).map(mapearRecurso);
}
