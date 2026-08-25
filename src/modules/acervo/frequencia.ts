import { unstable_cache } from "next/cache";

import { clienteDeServico } from "@/lib/db/servidor";
import { reportarErro } from "@/modules/observabilidade/reporte";

import {
  ANOS_DO_EXTRATO,
  PROVAS_DO_EXTRATO,
  TOPICOS_DO_EXTRATO,
} from "./frequencia-extrato";

/** Um tópico do edital e quantas questões de prova real ele já rendeu. */
export type TopicoFrequente = {
  topico: string;
  materia: string;
  questoes: number;
};

/**
 * O retrato que a landing mostra: a lista inteira, ordenada, mais os números
 * que a copy cita. Nada aqui é estimado — todo campo sai da mesma contagem.
 */
export type FrequenciaReal = {
  /** Todos os tópicos com pelo menos uma questão real, do maior para o menor. */
  topicos: readonly TopicoFrequente[];
  totalQuestoes: number;
  totalTopicos: number;
  totalProvas: number;
  /** Primeiro e último ano de prova lida. */
  primeiroAno: number;
  ultimoAno: number;
  /** Os doze primeiros: quanto somam e que fatia da prova são. */
  topQuestoes: number;
  topPercentual: number;
  /** A cauda: quantos tópicos rendem no máximo `TETO_DA_CAUDA` questões. */
  caudaTopicos: number;
  caudaQuestoes: number;
  caudaPercentual: number;
  /** De onde vieram estes números. A tela não muda; o relatório de erro sim. */
  fonte: "banco" | "extrato";
};

/** Quantos tópicos ganham rótulo e número no gráfico do pico. */
export const TOPO_DO_RAIOX = 12;

/** Até quantas questões um tópico rende para ser lido como cauda. */
export const TETO_DA_CAUDA = 5;

/** Janela de cache da consulta. A frequência muda quando uma prova entra. */
export const JANELA_DE_CACHE_SEGUNDOS = 3600;

/**
 * A consulta, escrita como SQL para ficar auditável mesmo que o cliente use o
 * PostgREST. É a mesma coisa que a view `inventario_acervo` já calcula:
 *
 * ```sql
 * select t.nome, m.nome as materia, count(*) as n
 *   from questoes q
 *   join topicos t on t.id = q.topico_id
 *   join materias m on m.id = t.materia_id
 *  where q.vigente and q.origem = 'real' and m.nome not like 'TESTE-%'
 *  group by t.nome, m.nome
 *  order by n desc;
 * ```
 *
 * **`origem = 'real'` não é opcional** (invariante 3 do `AGENTS.md`): questão
 * inédita nunca entra na taxa de frequência. Na view essa cláusula é a coluna
 * `importadas`, que conta exatamente `origem = 'real'` entre as vigentes — por
 * isso lemos `importadas` e não `total`.
 */
export const CONSULTA_DA_FREQUENCIA_REAL = `
  select topico, materia, importadas
    from public.inventario_acervo
   where importadas > 0
   order by importadas desc
`;

/** Matéria de fixture. Existe no banco de desenvolvimento, não na prova. */
const PREFIXO_DE_FIXTURE = "TESTE-";

type LinhaDoInventario = {
  topico: string;
  materia: string;
  importadas: number | string;
};

/**
 * Fecha o retrato a partir da lista de tópicos e dos anos das provas.
 *
 * Separada da leitura de propósito: é aqui que moram as contas que a copy cita,
 * e conta que a tela repete é conta que diverge. A função é pura, então o teste
 * exercita os números sem precisar de banco.
 */
export function resumirFrequencia(
  topicos: readonly TopicoFrequente[],
  provas: { total: number; anos: readonly number[] },
  fonte: FrequenciaReal["fonte"],
): FrequenciaReal {
  const ordenados = [...topicos].sort((a, b) => b.questoes - a.questoes);
  const totalQuestoes = ordenados.reduce((soma, t) => soma + t.questoes, 0);

  const topo = ordenados.slice(0, TOPO_DO_RAIOX);
  const topQuestoes = topo.reduce((soma, t) => soma + t.questoes, 0);

  const cauda = ordenados.filter((t) => t.questoes <= TETO_DA_CAUDA);
  const caudaQuestoes = cauda.reduce((soma, t) => soma + t.questoes, 0);

  const fatia = (parte: number) =>
    totalQuestoes > 0 ? (parte / totalQuestoes) * 100 : 0;

  const anos = provas.anos.filter((ano) => Number.isFinite(ano));

  return {
    topicos: ordenados,
    totalQuestoes,
    totalTopicos: ordenados.length,
    totalProvas: provas.total,
    primeiroAno: anos.length ? Math.min(...anos) : ANOS_DO_EXTRATO.primeiro,
    ultimoAno: anos.length ? Math.max(...anos) : ANOS_DO_EXTRATO.ultimo,
    topQuestoes,
    topPercentual: fatia(topQuestoes),
    caudaTopicos: cauda.length,
    caudaQuestoes,
    caudaPercentual: fatia(caudaQuestoes),
    fonte,
  };
}

/** O retrato do extrato congelado, para quando o banco não responde. */
export function frequenciaDoExtrato(): FrequenciaReal {
  return resumirFrequencia(
    TOPICOS_DO_EXTRATO,
    {
      total: PROVAS_DO_EXTRATO,
      anos: [ANOS_DO_EXTRATO.primeiro, ANOS_DO_EXTRATO.ultimo],
    },
    "extrato",
  );
}

/** Leitura crua: dois round-trips, a contagem por tópico e os anos de prova. */
async function lerDoBanco(): Promise<FrequenciaReal> {
  const cliente = clienteDeServico();

  const [inventario, provas] = await Promise.all([
    cliente
      .from("inventario_acervo")
      .select("topico, materia, importadas")
      .gt("importadas", 0)
      .order("importadas", { ascending: false }),
    cliente.from("provas").select("ano"),
  ]);

  if (inventario.error) {
    throw new Error(`falha ao ler inventario_acervo: ${inventario.error.message}`);
  }
  if (provas.error) {
    throw new Error(`falha ao ler provas: ${provas.error.message}`);
  }

  /*
   * A matéria de fixture sai aqui e não na consulta porque `TESTE-%` é higiene
   * do banco de desenvolvimento, não parte do recorte do Raio-X. O recorte que
   * é invariante — `origem = 'real'` — já veio de dentro da view.
   */
  const topicos = (inventario.data ?? [])
    .map((linha) => linha as LinhaDoInventario)
    .filter((linha) => !linha.materia.startsWith(PREFIXO_DE_FIXTURE))
    .map((linha) => ({
      topico: linha.topico,
      materia: linha.materia,
      questoes: Number(linha.importadas),
    }));

  if (topicos.length === 0) {
    throw new Error("inventario_acervo devolveu zero tópico com questão real");
  }

  const anos = (provas.data ?? []).map((linha) => Number(linha.ano));

  return resumirFrequencia(topicos, { total: anos.length, anos }, "banco");
}

const lerComCache = unstable_cache(lerDoBanco, ["frequencia-real-do-acervo"], {
  revalidate: JANELA_DE_CACHE_SEGUNDOS,
});

/**
 * A frequência real do acervo, para a landing.
 *
 * Cai no extrato congelado em qualquer falha — banco fora, credencial ausente,
 * consulta vazia. A landing não pode ficar sem gráfico e **não pode inventar
 * número**: o extrato é o único valor verdadeiro disponível quando a leitura
 * falha, e a falha vai para o Sentry em vez de sumir.
 *
 * `unstable_cache` só vale dentro de uma requisição do Next; fora dela (teste
 * unitário, script) a chamada falha e a queda direta assume — que é o mesmo
 * arranjo que `modules/config` já usa.
 */
export async function consultarFrequenciaReal(): Promise<FrequenciaReal> {
  try {
    return await lerComCache();
  } catch (erroDoCache) {
    try {
      return await lerDoBanco();
    } catch (erro) {
      reportarErro(erro ?? erroDoCache, {
        modulo: "acervo",
        operacao: "consultar_frequencia_real",
      });
      return frequenciaDoExtrato();
    }
  }
}

/** Percentual em pt-BR com uma casa: `40,6`. A landing escreve o `%`. */
export function percentualEmPtBr(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(valor);
}

/** Inteiro em pt-BR com ponto de milhar: `1.395`. */
export function inteiroEmPtBr(valor: number): string {
  return new Intl.NumberFormat("pt-BR").format(valor);
}
