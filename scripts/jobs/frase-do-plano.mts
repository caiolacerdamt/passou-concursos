#!/usr/bin/env node
/**
 * A frase de abertura de cada plano do dia (ALUNO-12).
 *
 * **E a primeira tarefa real que passa pelo gateway** — a SPEC 08 entrega as
 * duas juntas de proposito, para o gateway nascer provado por um uso, e nao por
 * um teste que ele mesmo desenhou.
 *
 * O que a IA faz aqui e **escrever uma frase, e nada mais**. O que estudar hoje
 * foi decidido por regra/SQL em `gera_plano_do_dia()` (invariante nº6). Se esta
 * chamada falhar, o plano continua valido: `frase` fica nula e a tela nao mostra
 * abertura nenhuma (ALUNO-05 AC4, invariante nº7).
 *
 * Roda em **GitHub Actions**, nunca em funcao da Vercel (AD-036/INFRA-02), e
 * **sincrona**, nunca em Batch (AD-080): a frase tem hora marcada.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { Client } from "pg";

import { definirLeitorDeConfig } from "@/modules/config";
import {
  type ClienteSql,
  GatewayParou,
  TarefaSemPerfil,
  definirRepositorioDeIa,
  executarTarefa,
  leitorDeConfigPorPg,
  repositorioPorPg,
} from "@/modules/ia";
import { reportarErro } from "@/modules/observabilidade";

import { lerEnv } from "../alvo-do-banco.mjs";

import { encerrar, iniciarSentry, reportar } from "./sentry-node.mjs";

/**
 * O trecho **estavel** do pedido — o mesmo para todos os alunos, todo dia.
 *
 * Estavel importa por dois motivos: e o que o prompt caching reaproveita, e e o
 * que faz duas frases do mesmo dia terem o mesmo tom. Mudou este texto? Suba
 * `VERSAO_DO_PROMPT.frase_do_plano`.
 */
export const INSTRUCAO = [
  "Voce escreve a frase de abertura do plano de estudo do dia de um aluno que",
  "se prepara para concurso bancario. Regras:",
  "- uma frase so, no maximo 20 palavras, em portugues do Brasil;",
  "- diga o que o dia tem, sem prometer resultado e sem elogio vazio;",
  "- nao invente materia, numero, prazo ou meta que nao esteja na lista abaixo;",
  "- nao use emoji, nao use exclamacao, nao trate o aluno por apelido;",
  "- responda apenas a frase, sem aspas e sem comentario.",
].join("\n");

export type BlocoDoPlano = {
  tipo: string;
  topico: string | null;
  motivo: string | null;
};

export type PlanoSemFrase = {
  id: string;
  minutosPorDia: number | null;
  blocos: BlocoDoPlano[];
};

/** A parte variavel do pedido: o que o SQL decidiu para este aluno hoje. */
export function entradaDoPedido(plano: PlanoSemFrase): string {
  const linhas = plano.blocos.map((bloco) => {
    const alvo = bloco.topico ?? "assuntos misturados";
    const porque = bloco.motivo ? ` (${bloco.motivo})` : "";
    return `- ${bloco.tipo}: ${alvo}${porque}`;
  });

  const tempo =
    plano.minutosPorDia === null
      ? "tempo declarado: nao informado"
      : `tempo declarado: ${plano.minutosPorDia} minutos`;

  return [tempo, "blocos de hoje:", ...linhas].join("\n");
}

/** Uma frase de mais de uma linha quebraria a tela; corta antes de gravar. */
export function limparFrase(bruta: string): string | null {
  const limpa = bruta.trim().split(/\r?\n/)[0]?.trim().replace(/^["'"]|["'"]$/g, "");
  return limpa ? limpa : null;
}

export const CONSULTA_DOS_PLANOS = `
  select pd.id, pe.minutos_por_dia
    from public.plano_dia pd
    left join public.perfil_estudo pe on pe.user_id = pd.user_id
   where pd.data = current_date
     and pd.frase is null
   order by pd.id
`;

export const CONSULTA_DOS_BLOCOS = `
  select pb.plano_dia_id, pb.tipo::text as tipo, pb.motivo, t.nome as topico
    from public.plano_bloco pb
    left join public.topicos t on t.id = pb.topico_id
   where pb.plano_dia_id = any($1)
     and pb.nivel = 'meta_cheia'
   order by pb.plano_dia_id, pb.ordem
`;

/** Le os planos de hoje que ainda nao tem frase, com os blocos de cada um. */
export async function planosSemFrase(
  cliente: ClienteSql,
): Promise<PlanoSemFrase[]> {
  const { rows: planos } = await cliente.query(CONSULTA_DOS_PLANOS);
  if (planos.length === 0) return [];

  const ids = planos.map((linha) => String(linha.id));
  const { rows: blocos } = await cliente.query(CONSULTA_DOS_BLOCOS, [ids]);

  const porPlano = new Map<string, BlocoDoPlano[]>();
  for (const bloco of blocos) {
    const id = String(bloco.plano_dia_id);
    const lista = porPlano.get(id) ?? [];
    lista.push({
      tipo: String(bloco.tipo),
      topico: bloco.topico === null ? null : String(bloco.topico),
      motivo: bloco.motivo === null ? null : String(bloco.motivo),
    });
    porPlano.set(id, lista);
  }

  return planos.map((linha) => ({
    id: String(linha.id),
    minutosPorDia:
      linha.minutos_por_dia === null ? null : Number(linha.minutos_por_dia),
    blocos: porPlano.get(String(linha.id)) ?? [],
  }));
}

export type Resumo = { escritas: number; falhadas: number; total: number };

/**
 * Escreve a frase de cada plano.
 *
 * **A falha de um aluno nao derruba os outros** (ALUNO-05 AC4). Cada volta do
 * laco tem o proprio `try`, e o que sobra de uma falha e `frase = null` — que e
 * exatamente o estado em que o plano ja estava.
 */
export async function escreverFrases(
  cliente: ClienteSql,
  planos: PlanoSemFrase[],
): Promise<Resumo> {
  let escritas = 0;
  let falhadas = 0;

  for (const plano of planos) {
    try {
      const resultado = await executarTarefa({
        tarefa: "frase_do_plano",
        pedido: { instrucao: INSTRUCAO, entrada: entradaDoPedido(plano) },
        // Sem alvo: a frase e texto do aluno. Nao entra no dedup e nao e
        // guardada em `ia_geracoes` — a idempotencia do job e `frase is null`.
        alvo: null,
      });

      const frase = limparFrase(resultado.texto);
      if (frase === null) {
        falhadas += 1;
        continue;
      }

      // `frase is null` de novo aqui: se outra execucao escreveu no meio, a
      // dela vale. Duas execucoes simultaneas nao produzem duas frases.
      const escrita = await cliente.query(
        `update public.plano_dia set frase = $1 where id = $2 and frase is null`,
        [frase, plano.id],
      );

      // Contar sem olhar `rowCount` inflaria o resumo justamente no caso que o
      // `and frase is null` existe para tratar: a linha nao foi escrita porque
      // outra execucao chegou antes. `null`/`undefined` = o cliente nao informou,
      // e ai nao da para afirmar que nao escreveu.
      if (escrita.rowCount === 0) {
        falhadas += 1;
        continue;
      }
      escritas += 1;
    } catch (erro) {
      falhadas += 1;
      reportarErro(erro, {
        modulo: "ia",
        job: "frase-do-plano",
        plano_dia_id: plano.id,
        motivo:
          "nao deu para escrever a frase deste aluno; o plano dele vale sem ela",
      });
    }
  }

  return { escritas, falhadas, total: planos.length };
}

/** Ambiente do script: o do processo, com o `.env` por cima quando existe. */
export function ambienteDoScript(
  raiz: string = process.cwd(),
): Record<string, string | undefined> {
  const caminho = path.join(raiz, ".env");
  if (!existsSync(caminho)) return { ...process.env };
  return { ...process.env, ...lerEnv(readFileSync(caminho, "utf8")) };
}

/**
 * O que impede o job de rodar, e se isso e falha ou so ausencia.
 *
 * `parar: false` com motivo e o caso do "IA fora do ar": nao ha o que fazer, e
 * **isso nao e um erro** — o plano ja esta entregue pelo SQL e vale sem frase.
 * Sair vermelho aqui pintaria de falha o estado normal de quem ainda nao
 * provisionou a chave.
 */
export function motivoDeParada(ambiente: Record<string, string | undefined>): {
  parar: boolean;
  motivo: string | null;
} {
  if (!ambiente.DATABASE_URL?.trim()) {
    return {
      parar: true,
      motivo:
        "DATABASE_URL nao esta definida: sem ela o job nao acha plano nenhum. Ver docs/SEGREDOS.md.",
    };
  }
  if (!ambiente.OPENAI_API_KEY?.trim()) {
    return {
      parar: false,
      motivo:
        "OPENAI_API_KEY nao esta definida: nenhuma frase sera escrita hoje, e os planos valem sem ela.",
    };
  }
  return { parar: false, motivo: null };
}

/** @returns codigo de saida */
export async function executar(
  ambiente: Record<string, string | undefined>,
  abrirConexao: () => ClienteSql & { connect(): Promise<void>; end(): Promise<void> } = () =>
    new Client({ connectionString: ambiente.DATABASE_URL }) as never,
): Promise<number> {
  const { parar, motivo } = motivoDeParada(ambiente);
  if (motivo !== null) {
    console[parar ? "error" : "warn"](`[frase-do-plano] ${motivo}`);
    if (parar) return 1;
    return 0;
  }

  await iniciarSentry();

  const cliente = abrirConexao();
  try {
    await cliente.connect();

    definirLeitorDeConfig(leitorDeConfigPorPg(cliente) as never);
    definirRepositorioDeIa(repositorioPorPg(cliente));

    const planos = await planosSemFrase(cliente);
    if (planos.length === 0) {
      console.log("[frase-do-plano] nenhum plano de hoje esta sem frase.");
      await encerrar();
      return 0;
    }

    const resumo = await escreverFrases(cliente, planos);
    console.log(
      `[frase-do-plano] ${resumo.escritas} de ${resumo.total} frases escritas; ${resumo.falhadas} sem frase.`,
    );

    await encerrar();
    // Falha de aluno nao pinta o job de vermelho: o alerta dela ja saiu pelo
    // reporte, e o plano continua entregue. Vermelho aqui seria alarme diario
    // por um aluno cuja frase nao saiu.
    return 0;
  } catch (erro) {
    // Aqui e outra coisa: nao deu para nem olhar. A tarefa sem perfil e a
    // parada do gateway sao os dois casos que precisam ser vistos.
    const conhecido = erro instanceof TarefaSemPerfil || erro instanceof GatewayParou;
    await reportar(erro, {
      origem: "frase-do-plano",
      motivo: conhecido
        ? "o gateway de IA nao conseguiu rodar a tarefa"
        : "o job falhou antes de escrever qualquer frase",
    });
    await encerrar();
    return 1;
  } finally {
    await cliente.end().catch(() => {});
  }
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const ambiente = ambienteDoScript();
  for (const chave of ["NEXT_PUBLIC_SENTRY_DSN", "OPENAI_API_KEY"]) {
    if (ambiente[chave]) process.env[chave] = ambiente[chave];
  }
  process.exit(await executar(ambiente));
}
