#!/usr/bin/env node
/**
 * Versiona as explicacoes auto-referentes do lote 02.
 *
 * O texto aprovado anterior fica congelado: a correcao alterna apenas `vigente`
 * e insere uma linha nova com `explicacao_versao` maior. Este job nao publica
 * questoes nem decide gabarito; ele recebe a letra do acervo e a preserva.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { Client } from "pg";

import type { ClienteSql } from "@/modules/ia";

import { lerEnv } from "../alvo-do-banco.mjs";

import {
  lerLoteCurado,
  type ExplicacaoCurada,
} from "./publicar-lote-curado.mts";

export type Argumentos = { arquivo: string; dryRun: boolean };

export type RelatorioDaCorrecao = {
  lidas: number;
  corrigidas: number;
  reaproveitadas: number;
  questoes: string[];
};

type ExplicacaoVigente = {
  id: string;
  questao_id: string;
  questao_versao: number;
  explicacao_versao: number;
  chave_dedup: string;
  resposta_correta: string | null;
};

export const USO =
  "uso: corrigir-explicacoes-grupo4 --arquivo scripts/data/<correcoes>.jsonl [--dry-run]";

export function lerArgumentos(argv: readonly string[]): Argumentos {
  let arquivo = "";
  let dryRun = false;
  for (let indice = 0; indice < argv.length; indice += 1) {
    const argumento = argv[indice];
    if (argumento === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (argumento === "--arquivo") {
      arquivo = argv[indice + 1] ?? "";
      indice += 1;
      continue;
    }
    throw new Error(USO);
  }
  if (arquivo.trim() === "") throw new Error(USO);
  return { arquivo, dryRun };
}

function chaveNova(explicacao: ExplicacaoCurada, versao: number): string {
  return `curado:grupo4-correcao:${explicacao.source_id}:${explicacao.numero}:v${versao}`;
}

async function localizarExplicacaoVigente(
  cliente: ClienteSql,
  explicacao: ExplicacaoCurada,
): Promise<ExplicacaoVigente> {
  const resultado = await cliente.query(
    `select e.id, e.questao_id, e.questao_versao, e.explicacao_versao,
            e.chave_dedup, q.resposta_correta
       from public.explicacoes e
       join public.questoes q
         on q.id = e.questao_id and q.questao_versao = e.questao_versao
       join public.provas p on p.id = q.prova_id
      where e.vigente
        and p.observacao like $1
        and q.numero = $2
        and (
          e.chave_dedup like 'curado:lote-02-distribuicao:%'
          or e.chave_dedup like 'curado:grupo4-correcao:%'
        )
      order by e.explicacao_versao desc, q.vigente desc
      limit 1`,
    [`%"source_id":"${explicacao.source_id}"%`, explicacao.numero],
  );
  const linha = resultado.rows[0] as ExplicacaoVigente | undefined;
  if (linha === undefined) {
    throw new Error(
      `explicação vigente do lote 02 não encontrada: ` +
        `${explicacao.source_id}#${explicacao.numero}`,
    );
  }
  if (linha.resposta_correta !== explicacao.alternativa_correta) {
    throw new Error(
      `gabarito divergente em ${explicacao.source_id}#${explicacao.numero}: ` +
        `banco=${linha.resposta_correta ?? "nulo"} lote=${explicacao.alternativa_correta}`,
    );
  }
  return linha;
}

/** Corrige apenas a explicação vigente; não publica nem altera o texto antigo. */
export async function corrigirExplicacoesGrupo4(
  cliente: ClienteSql,
  explicacoes: readonly ExplicacaoCurada[],
  opcoes: { transacao?: boolean; dryRun?: boolean } = {},
): Promise<RelatorioDaCorrecao> {
  const propriaTransacao = opcoes.transacao !== false;
  const dryRun = opcoes.dryRun === true;
  if (propriaTransacao) await cliente.query("begin");

  try {
    const relatorio: RelatorioDaCorrecao = {
      lidas: explicacoes.length,
      corrigidas: 0,
      reaproveitadas: 0,
      questoes: [],
    };

    for (const explicacao of explicacoes) {
      const atual = await localizarExplicacaoVigente(cliente, explicacao);
      const versao = atual.explicacao_versao + 1;
      const dedup = chaveNova(explicacao, versao);
      const identificador = `${explicacao.source_id}#${explicacao.numero}`;

      if (atual.chave_dedup === dedup || atual.chave_dedup.startsWith("curado:grupo4-correcao:")) {
        relatorio.reaproveitadas += 1;
        relatorio.questoes.push(identificador);
        continue;
      }
      if (!atual.chave_dedup.startsWith("curado:lote-02-distribuicao:")) {
        throw new Error(`explicação fora do lote 02: ${identificador}`);
      }
      if (dryRun) {
        relatorio.questoes.push(identificador);
        continue;
      }

      await cliente.query(
        `update public.explicacoes
            set vigente = false
          where id = $1 and vigente`,
        [atual.id],
      );
      await cliente.query(
        `insert into public.explicacoes
           (questao_id, questao_versao, explicacao_versao, vigente, status,
            texto, alternativa_correta, fontes_citadas, base_referencia_id, chave_dedup)
         values ($1, $2, $3, true, 'aprovada', $4, $5, $6::jsonb, null, $7)`,
        [
          atual.questao_id,
          atual.questao_versao,
          versao,
          explicacao.texto,
          explicacao.alternativa_correta,
          JSON.stringify(explicacao.fontes_citadas),
          dedup,
        ],
      );
      relatorio.corrigidas += 1;
      relatorio.questoes.push(identificador);
    }

    if (propriaTransacao) await cliente.query(dryRun ? "rollback" : "commit");
    return relatorio;
  } catch (erro) {
    if (propriaTransacao) await cliente.query("rollback").catch(() => {});
    throw erro;
  }
}

export function ambienteDoScript(
  raiz: string = process.cwd(),
): Record<string, string | undefined> {
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
    const ler = opcoes.lerArquivo ?? ((alvo: string) => readFileSync(alvo, "utf8"));
    const explicacoes = lerLoteCurado(ler(path.resolve(raiz, argumentos.arquivo)));
    if (!ambiente.DATABASE_URL?.trim()) {
      console.error("[corrigir-explicacoes] DATABASE_URL nao esta definida.");
      return 1;
    }
    const abrir =
      opcoes.abrirConexao ??
      (() => new Client({ connectionString: ambiente.DATABASE_URL }) as never);
    const cliente = abrir();
    try {
      await cliente.connect();
      const relatorio = await corrigirExplicacoesGrupo4(cliente, explicacoes, {
        dryRun: argumentos.dryRun,
      });
      console.log(JSON.stringify({ dryRun: argumentos.dryRun, ...relatorio }, null, 2));
      return 0;
    } finally {
      await cliente.end().catch(() => {});
    }
  } catch (erro) {
    console.error(
      `[corrigir-explicacoes] ${erro instanceof Error ? erro.stack ?? erro.message : String(erro)}`,
    );
    return 1;
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(await executar(ambienteDoScript(), process.argv.slice(2), { raiz: process.cwd() }));
}
