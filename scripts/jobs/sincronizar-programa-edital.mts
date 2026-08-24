#!/usr/bin/env node
/**
 * Alinha o programa do edital ativo com o acervo realmente publicado e recalcula
 * o Raio-X em seguida.
 *
 * O motor do plano só enxerga tópico que está no `programa_edital` do perfil
 * ativo **e** tem peso positivo na projeção. Tópico de demonstração, tópico de
 * teste e tópico sem questão apta viram bloco vazio na tela do aluno — por isso
 * o programa passa a ser derivado do que existe publicado, não de uma lista
 * escrita à mão. A regra continua determinística: nenhuma IA participa.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { Client } from "pg";

import type { ClienteSql } from "@/modules/ia";

import { lerEnv } from "../alvo-do-banco.mjs";

/** Matérias que existem para demonstração ou teste e nunca entram no edital. */
export const MATERIAS_FORA_DO_EDITAL = [
  "Demonstração do Raio-X",
  "TESTE-PAYWALL matematica",
];

export type Argumentos = { dryRun: boolean };

export type RelatorioDoEdital = {
  topicosNoEdital: number;
  materias: string[];
  removidos: string[];
  linhasDoRaiox: number;
};

export const USO = "uso: sincronizar-programa-edital [--dry-run]";

export function lerArgumentos(argv: readonly string[]): Argumentos {
  let dryRun = false;
  for (const argumento of argv) {
    if (argumento === "--dry-run") {
      dryRun = true;
      continue;
    }
    throw new Error(USO);
  }
  return { dryRun };
}

/** Tópico elegível: ativo, fora das matérias de demonstração e com questão apta. */
export const CONSULTA_DE_TOPICOS_ELEGIVEIS = `
  select t.id::text as topico_id, m.nome as materia
    from public.topicos t
    join public.materias m on m.id = t.materia_id
   where t.ativo
     and not (m.nome = any($1::text[]))
     and exists (
       select 1 from public.questoes q
        where q.topico_id = t.id and q.vigente
          and q.status = 'publicada' and not q.anulada
     )
   order by m.nome, t.nome
`;

export async function sincronizarProgramaEdital(
  cliente: ClienteSql,
  opcoes: { transacao?: boolean; dryRun?: boolean } = {},
): Promise<RelatorioDoEdital> {
  const propriaTransacao = opcoes.transacao !== false;
  const dryRun = opcoes.dryRun === true;
  if (propriaTransacao) await cliente.query("begin");
  try {
    const perfil = await cliente.query(
      "select id, programa_edital from public.perfil_concurso where ativo",
    );
    if (perfil.rows.length === 0) throw new Error("nenhum perfil de concurso ativo");
    if (perfil.rows.length > 1) throw new Error("mais de um perfil de concurso ativo");
    const atual = perfil.rows[0] as { id: string; programa_edital: string[] };

    const elegiveis = await cliente.query(CONSULTA_DE_TOPICOS_ELEGIVEIS, [
      MATERIAS_FORA_DO_EDITAL,
    ]);
    const linhas = elegiveis.rows as { topico_id: string; materia: string }[];
    if (linhas.length === 0) throw new Error("nenhum tópico publicado para compor o edital");

    const novos = linhas.map((linha) => linha.topico_id);
    const relatorio: RelatorioDoEdital = {
      topicosNoEdital: novos.length,
      materias: [...new Set(linhas.map((linha) => linha.materia))],
      removidos: (atual.programa_edital ?? []).filter((topico) => !novos.includes(topico)),
      linhasDoRaiox: 0,
    };

    if (!dryRun) {
      await cliente.query(
        `update public.perfil_concurso
            set programa_edital = $2::jsonb, atualizado_em = now()
          where id = $1`,
        [atual.id, JSON.stringify(novos)],
      );
      const raiox = await cliente.query("select public.recalcula_raiox() as linhas");
      relatorio.linhasDoRaiox = Number((raiox.rows[0] as { linhas: number }).linhas);
    }

    if (propriaTransacao) await cliente.query(dryRun ? "rollback" : "commit");
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
  } = {},
): Promise<number> {
  try {
    const argumentos = lerArgumentos(argv);
    if (!ambiente.DATABASE_URL?.trim()) {
      console.error("[edital] DATABASE_URL nao esta definida.");
      return 1;
    }
    const abrir =
      opcoes.abrirConexao ??
      (() => new Client({ connectionString: ambiente.DATABASE_URL }) as never);
    const cliente = abrir();
    try {
      await cliente.connect();
      const relatorio = await sincronizarProgramaEdital(cliente, { dryRun: argumentos.dryRun });
      console.log(JSON.stringify({ dryRun: argumentos.dryRun, ...relatorio }, null, 2));
      return 0;
    } finally {
      await cliente.end().catch(() => {});
    }
  } catch (erro) {
    console.error(`[edital] ${erro instanceof Error ? erro.stack ?? erro.message : String(erro)}`);
    return 1;
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(await executar(ambienteDoScript(), process.argv.slice(2)));
}
