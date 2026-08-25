#!/usr/bin/env node
/**
 * Publica um lote curado de questões já importadas, distribuindo o acervo por
 * matéria sem nenhuma chamada a provedor externo.
 *
 * O lote pode trazer explicação curada por operador ou rascunho gerado fora do
 * produto. A aprovação automática não é uma revisão: em regra, o operador deve
 * revisar o arquivo antes de rodar. O Grupo 4 registra uma exceção operacional
 * para este lote, mas a verdade continua sendo o gabarito do banco: se a letra
 * divergir da coluna `resposta_correta`, o job para e não publica nada.
 * A IA não decide alternativa correta aqui.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { Client } from "pg";

import type { ClienteSql } from "@/modules/ia";

import { lerEnv } from "../alvo-do-banco.mjs";

export type FonteCitada = { doc_id: string; trecho: string };

export type ExplicacaoCurada = {
  lote: string;
  source_id: string;
  numero: number;
  alternativa_correta: string;
  texto: string;
  fontes_citadas: FonteCitada[];
};

export type Argumentos = { arquivo: string; dryRun: boolean };

export type RelatorioDaPublicacao = {
  lidas: number;
  explicacoesInseridas: number;
  reaproveitadas: number;
  publicadas: number;
  porMateria: { materia: string; publicadas: number }[];
};

export const USO =
  "uso: publicar-lote-curado --arquivo scripts/data/<lote>.jsonl [--dry-run]";

/** Uma explicação curta demais não sustenta a publicação de uma questão. */
export const MINIMO_DE_CARACTERES = 120;

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

function chave(explicacao: Pick<ExplicacaoCurada, "source_id" | "numero">): string {
  return `${explicacao.source_id}#${explicacao.numero}`;
}

/**
 * Lê e valida o arquivo inteiro antes de encostar no banco. Toda recusa nomeia a
 * linha, porque quem corrige o lote é o operador, não o job.
 */
export function lerLoteCurado(conteudo: string): ExplicacaoCurada[] {
  const linhas = conteudo
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter((linha) => linha !== "");
  if (linhas.length === 0) throw new Error("lote vazio");

  const vistas = new Set<string>();
  return linhas.map((linha, indice) => {
    const posicao = indice + 1;
    let bruto: unknown;
    try {
      bruto = JSON.parse(linha);
    } catch {
      throw new Error(`linha ${posicao}: JSON inválido`);
    }
    if (bruto === null || typeof bruto !== "object" || Array.isArray(bruto)) {
      throw new Error(`linha ${posicao}: objeto obrigatório`);
    }
    const item = bruto as Record<string, unknown>;
    const lote = typeof item.lote === "string" ? item.lote.trim() : "";
    const sourceId = typeof item.source_id === "string" ? item.source_id.trim() : "";
    const numero = typeof item.numero === "number" ? item.numero : Number.NaN;
    const alternativa =
      typeof item.alternativa_correta === "string" ? item.alternativa_correta.trim() : "";
    const texto = typeof item.texto === "string" ? item.texto.trim() : "";
    const fontes = item.fontes_citadas;

    if (lote === "") throw new Error(`linha ${posicao}: lote obrigatório`);
    if (sourceId === "") throw new Error(`linha ${posicao}: source_id obrigatório`);
    if (!Number.isInteger(numero) || numero <= 0) {
      throw new Error(`linha ${posicao}: numero precisa ser inteiro positivo`);
    }
    if (!/^[A-E]$/.test(alternativa) && !/^[CE]$/.test(alternativa)) {
      throw new Error(`linha ${posicao}: alternativa_correta invalida`);
    }
    if (texto.length < MINIMO_DE_CARACTERES) {
      throw new Error(`linha ${posicao}: explicação curta demais`);
    }
    if (!Array.isArray(fontes) || fontes.length === 0) {
      throw new Error(`linha ${posicao}: explicação sem fonte`);
    }
    for (const fonte of fontes) {
      const valida =
        fonte !== null &&
        typeof fonte === "object" &&
        typeof (fonte as FonteCitada).doc_id === "string" &&
        typeof (fonte as FonteCitada).trecho === "string" &&
        (fonte as FonteCitada).doc_id.trim() !== "" &&
        (fonte as FonteCitada).trecho.trim() !== "";
      if (!valida) throw new Error(`linha ${posicao}: fonte sem doc_id ou trecho`);
      const docId = (fonte as FonteCitada).doc_id.trim();
      const trecho = (fonte as FonteCitada).trecho.trim();
      if (
        docId.startsWith("curado:") &&
        /^Gabarito oficial da questão \d+: [A-E]$/.test(trecho)
      ) {
        throw new Error(`linha ${posicao}: fonte auto-referente não é aceita`);
      }
    }

    const explicacao: ExplicacaoCurada = {
      lote,
      source_id: sourceId,
      numero,
      alternativa_correta: alternativa,
      texto,
      fontes_citadas: fontes as FonteCitada[],
    };
    const id = chave(explicacao);
    if (vistas.has(id)) throw new Error(`linha ${posicao}: questão repetida no lote (${id})`);
    vistas.add(id);
    return explicacao;
  });
}

type QuestaoAlvo = {
  id: string;
  questao_versao: number;
  resposta_correta: string | null;
  anulada: boolean;
  status: string;
  materia: string;
};

async function localizar(
  cliente: ClienteSql,
  explicacao: ExplicacaoCurada,
): Promise<QuestaoAlvo> {
  const resultado = await cliente.query(
    `select q.id, q.questao_versao, q.resposta_correta, q.anulada,
            q.status::text as status, m.nome as materia
       from public.questoes q
       join public.provas p on p.id = q.prova_id
       join public.topicos t on t.id = q.topico_id
       join public.materias m on m.id = t.materia_id
      where p.observacao like $1 and q.numero = $2 and q.vigente`,
    [`%"source_id":"${explicacao.source_id}"%`, explicacao.numero],
  );
  const questao = resultado.rows[0] as QuestaoAlvo | undefined;
  if (questao === undefined) throw new Error(`questão não encontrada: ${chave(explicacao)}`);
  if (questao.anulada) throw new Error(`questão anulada não publica: ${chave(explicacao)}`);
  if (questao.resposta_correta !== explicacao.alternativa_correta) {
    throw new Error(
      `gabarito do banco diverge em ${chave(explicacao)}: ` +
        `banco=${questao.resposta_correta ?? "nulo"} lote=${explicacao.alternativa_correta}`,
    );
  }
  return questao;
}

/**
 * Escreve a explicação aprovada e publica a questão. Idempotente: `chave_dedup`
 * recusa a segunda inserção e `publicar_questao` já é seguro em questão
 * publicada, então repetir o lote depois de uma interrupção não duplica nada.
 */
export async function publicarLoteCurado(
  cliente: ClienteSql,
  explicacoes: readonly ExplicacaoCurada[],
  opcoes: { transacao?: boolean; dryRun?: boolean } = {},
): Promise<RelatorioDaPublicacao> {
  const propriaTransacao = opcoes.transacao !== false;
  const dryRun = opcoes.dryRun === true;
  if (propriaTransacao) await cliente.query("begin");
  try {
    const operador = await cliente.query(
      "select operador_id from public.operadores where ativo order by criado_em limit 1",
    );
    const operadorId = (operador.rows[0] as { operador_id?: string } | undefined)?.operador_id;
    if (operadorId === undefined) throw new Error("nenhum operador ativo para aprovar o lote");

    const relatorio: RelatorioDaPublicacao = {
      lidas: explicacoes.length,
      explicacoesInseridas: 0,
      reaproveitadas: 0,
      publicadas: 0,
      porMateria: [],
    };
    const porMateria = new Map<string, number>();

    for (const explicacao of explicacoes) {
      const questao = await localizar(cliente, explicacao);
      porMateria.set(questao.materia, (porMateria.get(questao.materia) ?? 0) + 1);
      if (dryRun) continue;

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
          explicacao.texto,
          explicacao.alternativa_correta,
          JSON.stringify(explicacao.fontes_citadas),
          `curado:${explicacao.lote}:${explicacao.source_id}:${explicacao.numero}:v1`,
        ],
      );
      if ((insercao.rowCount ?? 0) > 0) relatorio.explicacoesInseridas += 1;
      else relatorio.reaproveitadas += 1;

      const revisoes = await cliente.query(
        `select id from public.questao_revisoes
          where questao_id = $1 and status = 'pendente'`,
        [questao.id],
      );
      const pendentes = (revisoes.rows as { id: string | number }[]).map((linha) =>
        Number(linha.id),
      );
      if (pendentes.length > 0) {
        await cliente.query(
          "select public.decidir_revisoes_em_lote($1::bigint[], 'aprovada', $2::uuid, $3)",
          [pendentes, operadorId, `publicação do lote curado ${explicacao.lote}`],
        );
      } else if (questao.status !== "publicada") {
        await cliente.query("select public.publicar_questao($1::uuid, $2::integer)", [
          questao.id,
          questao.questao_versao,
        ]);
      }
      relatorio.publicadas += 1;
    }

    relatorio.porMateria = [...porMateria.entries()]
      .map(([materia, publicadas]) => ({ materia, publicadas }))
      .sort((um, outro) => um.materia.localeCompare(outro.materia));

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
      console.error("[publicar-lote] DATABASE_URL nao esta definida.");
      return 1;
    }
    const abrir =
      opcoes.abrirConexao ??
      (() => new Client({ connectionString: ambiente.DATABASE_URL }) as never);
    const cliente = abrir();
    try {
      await cliente.connect();
      const relatorio = await publicarLoteCurado(cliente, explicacoes, {
        dryRun: argumentos.dryRun,
      });
      console.log(JSON.stringify({ dryRun: argumentos.dryRun, ...relatorio }, null, 2));
      return 0;
    } finally {
      await cliente.end().catch(() => {});
    }
  } catch (erro) {
    console.error(
      `[publicar-lote] ${erro instanceof Error ? erro.stack ?? erro.message : String(erro)}`,
    );
    return 1;
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(await executar(ambienteDoScript(), process.argv.slice(2), { raiz: process.cwd() }));
}
