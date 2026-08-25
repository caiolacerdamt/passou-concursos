#!/usr/bin/env node
/** Carrega o lote curto de explicações geradas pelo Codex, sem provedor externo. */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { Client } from "pg";

import { lerEnv } from "../alvo-do-banco.mjs";

type QuestaoJson = {
  id: string;
  natureza: string;
  gabarito_definitivo: string;
  fonte: { source_id: string };
};

type ExplicacaoCodex = {
  id: string;
  source_id: string;
  numero: number;
  alternativa_correta: string;
  texto: string;
  fontes_citadas: unknown[];
};

type QuestaoBanco = {
  id: string;
  questao_versao: number;
  resposta_correta: string | null;
  anulada: boolean;
  status: string;
};

const ARQUIVOS = [1, 2, 3, 4].map((numero) =>
  path.resolve(`scripts/data/explanacoes-codex-0${numero}.jsonl`),
);

function lerJsonl<T>(arquivo: string): T[] {
  return readFileSync(arquivo, "utf8")
    .split(/\r?\n/)
    .filter((linha) => linha.trim() !== "")
    .map((linha, indice) => {
      try {
        return JSON.parse(linha) as T;
      } catch {
        throw new Error(`JSON inválido em ${arquivo}:${indice + 1}`);
      }
    });
}

function questoesDoLote(): Map<string, QuestaoJson> {
  const questoes = readFileSync(path.resolve("questoes.json"), "utf8")
    .split(/\r?\n/)
    .filter((linha) => linha.trim() !== "")
    .map((linha) => JSON.parse(linha) as QuestaoJson)
    .filter((questao) => questao.gabarito_definitivo !== "ANULADA")
    .slice(0, 100);
  return new Map(questoes.map((questao) => [`${questao.fonte.source_id}#${questao.id}`, questao]));
}

function chave(explicacao: Pick<ExplicacaoCodex, "source_id" | "numero">): string {
  return `${explicacao.source_id}#${explicacao.numero}`;
}

function carregarExplicacoes(): ExplicacaoCodex[] {
  const esperadas = questoesDoLote();
  const explicacoes = ARQUIVOS.flatMap((arquivo) => lerJsonl<ExplicacaoCodex>(arquivo));
  if (explicacoes.length !== 100) {
    throw new Error(`o lote Codex precisa ter 100 linhas; recebeu ${explicacoes.length}`);
  }

  const vistas = new Set<string>();
  for (const explicacao of explicacoes) {
    const questao = [...esperadas.values()].find(
      (item) => item.fonte.source_id === explicacao.source_id && item.id === explicacao.id,
    );
    if (questao === undefined) throw new Error(`explicação fora do lote: ${explicacao.id}`);
    const id = chave(explicacao);
    if (vistas.has(id)) throw new Error(`explicação duplicada: ${id}`);
    vistas.add(id);
    if (explicacao.numero <= 0 || explicacao.alternativa_correta !== questao.gabarito_definitivo) {
      throw new Error(`gabarito divergente na explicação ${id}`);
    }
    if (explicacao.texto.trim().length < 20) throw new Error(`explicação curta demais: ${id}`);
    if (!Array.isArray(explicacao.fontes_citadas) || explicacao.fontes_citadas.length === 0) {
      throw new Error(`explicação sem fonte: ${id}`);
    }
  }

  const esperadasChaves = new Set(
    [...esperadas.values()].map((questao) => `${questao.fonte.source_id}#${questao.id}`),
  );
  const chavesRecebidas = new Set(explicacoes.map((explicacao) => `${explicacao.source_id}#${explicacao.id}`));
  if (esperadasChaves.size !== chavesRecebidas.size || [...esperadasChaves].some((id) => !chavesRecebidas.has(id))) {
    throw new Error("o lote Codex não corresponde exatamente às primeiras 100 questões não anuladas");
  }
  return explicacoes;
}

function partir<T>(itens: T[], tamanho: number): T[][] {
  const lotes: T[][] = [];
  for (let indice = 0; indice < itens.length; indice += tamanho) {
    lotes.push(itens.slice(indice, indice + tamanho));
  }
  return lotes;
}

async function executar(): Promise<void> {
  const ambiente = {
    ...process.env,
    ...(existsSync(path.resolve(".env")) ? lerEnv(readFileSync(path.resolve(".env"), "utf8")) : {}),
  };
  if (!ambiente.DATABASE_URL) throw new Error("DATABASE_URL não definida");
  const explicacoes = carregarExplicacoes();
  const cliente = new Client({ connectionString: ambiente.DATABASE_URL });
  await cliente.connect();
  let iniciou = false;
  try {
    await cliente.query("begin");
    iniciou = true;

    const operador = await cliente.query<{ operador_id: string }>(
      "select operador_id from public.operadores where ativo order by criado_em limit 1",
    );
    if (operador.rows[0]?.operador_id === undefined) {
      throw new Error("nenhum operador ativo para aprovar o lote");
    }
    const operadorId = operador.rows[0].operador_id;
    const questoes: QuestaoBanco[] = [];
    let inseridas = 0;
    let reaproveitadas = 0;

    for (const explicacao of explicacoes) {
      const prova = `%"source_id":"${explicacao.source_id}"%`;
      const resultado = await cliente.query<QuestaoBanco>(
        `select q.id, q.questao_versao, q.resposta_correta, q.anulada, q.status::text
           from public.questoes q
           join public.provas p on p.id = q.prova_id
          where p.observacao like $1 and q.numero = $2 and q.vigente`,
        [prova, explicacao.numero],
      );
      const questao = resultado.rows[0];
      if (questao === undefined) throw new Error(`questão não encontrada: ${chave(explicacao)}`);
      if (questao.anulada || questao.resposta_correta !== explicacao.alternativa_correta) {
        throw new Error(`gabarito do banco diverge: ${chave(explicacao)}`);
      }
      questoes.push(questao);

      const insercao = await cliente.query(
        `insert into public.explicacoes
           (questao_id, questao_versao, explicacao_versao, vigente, status,
            texto, alternativa_correta, fontes_citadas, base_referencia_id, chave_dedup)
         values ($1, $2, 1, true, 'aprovada', $3, $4, $5::jsonb, null, $6)
         on conflict (chave_dedup) do nothing
         returning id`,
        [
          questao.id,
          questao.questao_versao,
          explicacao.texto.trim(),
          explicacao.alternativa_correta,
          JSON.stringify(explicacao.fontes_citadas),
          `codex:lote-100:${explicacao.source_id}:${explicacao.numero}:v1`,
        ],
      );
      if ((insercao.rowCount ?? 0) > 0) inseridas += 1;
      else reaproveitadas += 1;
    }

    const ids = questoes.map((questao) => questao.id);
    const revisoes = await cliente.query<{ id: string; questao_id: string }>(
      `select id, questao_id
         from public.questao_revisoes
        where questao_id = any($1::uuid[]) and status = 'pendente'`,
      [ids],
    );
    for (const lote of partir(revisoes.rows.map((revisao) => Number(revisao.id)), 50)) {
      await cliente.query(
        `select public.decidir_revisoes_em_lote($1::bigint[], 'aprovada', $2::uuid, $3)`,
        [lote, operadorId, "aprovação do lote Codex de 100 questões"],
      );
    }

    const semRevisao = questoes.filter((questao) => !revisoes.rows.some((revisao) => revisao.questao_id === questao.id));
    for (const questao of semRevisao) {
      await cliente.query("select public.publicar_questao($1::uuid, $2::integer)", [questao.id, questao.questao_versao]);
    }

    await cliente.query("commit");
    iniciou = false;
    const status = await cliente.query<{ status: string; total: string }>(
      `select status::text, count(*)::text as total
         from public.questoes
        where id = any($1::uuid[]) and vigente
        group by status::text
        order by status::text`,
      [ids],
    );
    console.log(JSON.stringify({ total: 100, explicacoesInseridas: inseridas, reaproveitadas, revisoesAprovadas: revisoes.rowCount ?? 0, status: status.rows }, null, 2));
  } catch (erro) {
    if (iniciou) await cliente.query("rollback").catch(() => {});
    throw erro;
  } finally {
    await cliente.end();
  }
}

executar().catch((erro) => {
  console.error(`[codex-100] ${erro instanceof Error ? erro.stack ?? erro.message : String(erro)}`);
  process.exitCode = 1;
});
