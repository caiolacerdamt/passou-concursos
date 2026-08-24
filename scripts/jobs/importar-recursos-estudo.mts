#!/usr/bin/env node
/** Carga idempotente da curadoria de links; não busca a web nem chama IA. */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { Client } from "pg";

import {
  lerRecursosEstudo,
  type RecursoParaCarga,
} from "@/modules/acervo";
import type { ClienteSql } from "@/modules/ia";

import { lerEnv } from "../alvo-do-banco.mjs";

export type Argumentos = {
  arquivo: string;
  formato: "csv" | "json" | null;
  dryRun: boolean;
};

export type RelatorioDaCargaDeRecursos = {
  lidas: number;
  inseridas: number;
  atualizadas: number;
};

export const USO =
  "uso: importar-recursos-estudo --arquivo recursos.csv|recursos.json " +
  "[--formato csv|json] [--dry-run]";

function extensao(arquivo: string): "csv" | "json" {
  return path.extname(arquivo).toLowerCase() === ".json" ? "json" : "csv";
}

export function lerArgumentos(argv: readonly string[]): Argumentos {
  let dryRun = false;
  let arquivo = "";
  let formato: "csv" | "json" | null = null;
  for (let indice = 0; indice < argv.length; indice += 1) {
    const argumento = argv[indice];
    if (argumento === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (argumento === "--csv" || argumento === "--json") {
      formato = argumento.slice(2) as "csv" | "json";
      continue;
    }
    if (argumento === "--arquivo") {
      arquivo = argv[indice + 1] ?? "";
      indice += 1;
      continue;
    }
    if (argumento === "--formato") {
      const valor = argv[indice + 1] ?? "";
      indice += 1;
      if (valor !== "csv" && valor !== "json") throw new Error(USO);
      formato = valor;
      continue;
    }
    throw new Error(USO);
  }
  if (arquivo.trim() === "") throw new Error(USO);
  return { arquivo, formato, dryRun };
}

function resultadoDe(
  linha: RecursoParaCarga,
  topicoId: string,
  cliente: ClienteSql,
): Promise<{ inserido: boolean }> {
  return (async () => {
    const existente = await cliente.query(
      `select id
         from public.recursos_estudo
        where topico_id = $1 and url = $2
        for update`,
      [topicoId, linha.url],
    );
    const inserido = existente.rows.length === 0;
    await cliente.query(
      `insert into public.recursos_estudo
         (id, topico_id, titulo, url, tipo, duracao_minutos, ordem, ativo)
       values (coalesce($1::uuid, gen_random_uuid()), $2, $3, $4,
               $5::public.tipo_recurso_estudo, $6, $7, $8)
       on conflict (topico_id, url) do update
         set titulo = excluded.titulo,
             tipo = excluded.tipo,
             duracao_minutos = excluded.duracao_minutos,
             ordem = excluded.ordem,
             ativo = excluded.ativo,
             atualizado_em = now()`,
      [linha.id ?? null, topicoId, linha.titulo, linha.url, linha.tipo,
        linha.duracaoMinutos, linha.ordem, linha.ativo],
    );
    return { inserido };
  })();
}

/**
 * Resolve o vínculo canônico matéria/tópico e faz upsert pela URL. A consulta
 * anterior à escrita torna o relatório legível e a chave única do banco torna
 * a repetição segura mesmo depois de uma interrupção.
 */
export async function importarRecursosEstudo(
  cliente: ClienteSql,
  recursos: readonly RecursoParaCarga[],
  opcoes: { transacao?: boolean } = {},
): Promise<RelatorioDaCargaDeRecursos> {
  const propriaTransacao = opcoes.transacao !== false;
  if (propriaTransacao) await cliente.query("begin");
  try {
    const relatorio: RelatorioDaCargaDeRecursos = {
      lidas: recursos.length,
      inseridas: 0,
      atualizadas: 0,
    };
    for (const recurso of recursos) {
      const topico = await cliente.query(
        `select t.id
           from public.topicos as t
           join public.materias as m on m.id = t.materia_id
          where m.nome = $1 and t.nome = $2`,
        [recurso.materia, recurso.topico],
      );
      const topicoId = String(topico.rows[0]?.id ?? "");
      if (topicoId === "") {
        throw new Error(`topico nao encontrado: ${recurso.materia}/${recurso.topico}`);
      }
      const resultado = await resultadoDe(recurso, topicoId, cliente);
      if (resultado.inserido) relatorio.inseridas += 1;
      else relatorio.atualizadas += 1;
    }
    if (propriaTransacao) await cliente.query("commit");
    return relatorio;
  } catch (erro) {
    if (propriaTransacao) await cliente.query("rollback").catch(() => {});
    throw erro;
  }
}

export function ambienteDoScript(raiz: string = process.cwd()): Record<string, string | undefined> {
  const arquivo = path.join(raiz, ".env");
  if (!existsSync(arquivo)) return { ...process.env };
  return { ...process.env, ...lerEnv(readFileSync(arquivo, "utf8")) };
}

export async function executar(
  ambiente: Record<string, string | undefined>,
  argv: readonly string[],
  opcoes: {
    abrirConexao?: () => ClienteSql & { connect(): Promise<void>; end(): Promise<void> };
    lerArquivo?: (arquivo: string) => string;
    raiz?: string;
  } = {},
): Promise<number> {
  try {
    const argumentos = lerArgumentos(argv);
    const raiz = opcoes.raiz ?? process.cwd();
    const arquivo = path.resolve(raiz, argumentos.arquivo);
    const ler = opcoes.lerArquivo ?? ((alvo: string) => readFileSync(alvo, "utf8"));
    const recursos = lerRecursosEstudo(
      ler(arquivo),
      argumentos.formato ?? extensao(argumentos.arquivo),
    );
    if (argumentos.dryRun) {
      console.log(JSON.stringify({ lidas: recursos.length }, null, 2));
      return 0;
    }
    if (!ambiente.DATABASE_URL?.trim()) {
      console.error("[importar-recursos] DATABASE_URL nao esta definida.");
      return 1;
    }
    const abrir = opcoes.abrirConexao ?? (() => new Client({ connectionString: ambiente.DATABASE_URL }) as never);
    const cliente = abrir();
    try {
      await cliente.connect();
      const relatorio = await importarRecursosEstudo(cliente, recursos);
      console.log(JSON.stringify(relatorio, null, 2));
      return 0;
    } finally {
      await cliente.end().catch(() => {});
    }
  } catch (erro) {
    console.error(`[importar-recursos] ${erro instanceof Error ? erro.stack ?? erro.message : String(erro)}`);
    return 1;
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(await executar(ambienteDoScript(), process.argv.slice(2), { raiz: process.cwd() }));
}
