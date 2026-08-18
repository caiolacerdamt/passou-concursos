import type { SupabaseClient } from "@supabase/supabase-js";
import { type Card, type Grade, createEmptyCard, fsrs } from "ts-fsrs";

import { clienteDeServico } from "@/lib/db/servidor";
import { getParams } from "@/modules/config";

import {
  type Algoritmo,
  type EntradaRevisao,
  NOTA,
  type Nota,
  type ResultadoRevisao,
  RevisaoRecusada,
} from "./contrato";

/**
 * Converte o desempenho de um bloco Revisar na data da proxima revisao
 * (ALUNO-09).
 *
 * Roda **dentro da requisicao**, quando o aluno fecha o bloco — 1 aluno x 1
 * topico, em milissegundos. Nao e job. Isso resolve o impasse que o design do M4
 * levantou: o INFRA-03 manda job leve rodar em `pg_cron`, dentro do Postgres, e
 * o FSRS e biblioteca TypeScript que nao existe em plpgsql. Nao e preciso
 * escolher, porque o job da madrugada nao precisa do algoritmo — so compara
 * `due <= hoje`.
 */
export async function agendarRevisao(
  entrada: EntradaRevisao,
  cliente: SupabaseClient = clienteDeServico(),
): Promise<ResultadoRevisao> {
  const { percentualAcerto } = entrada;
  if (
    !Number.isFinite(percentualAcerto) ||
    percentualAcerto < 0 ||
    percentualAcerto > 1
  ) {
    throw new RevisaoRecusada(
      `Percentual de acerto '${percentualAcerto}' esta fora de 0 a 1.`,
    );
  }

  const [algoritmo, faixas, passosCurtos, reguaDias] = await getParams(
    "param.m4.algoritmo_revisao",
    "param.m4.fsrs_faixas_nota",
    "param.m4.fsrs_passos_curtos",
    "param.m4.regua_fixa_dias",
  );

  const nota = notaDoPercentual(percentualAcerto, faixas);
  const agora = entrada.agora ?? new Date();
  const anterior = await lerAgenda(cliente, entrada.userId, entrada.topicoId);

  const calculado =
    algoritmo === "regua_fixa"
      ? porReguaFixa(nota, agora, anterior?.regua_passo ?? null, reguaDias)
      : porFsrs(nota, agora, anterior?.fsrs_card ?? null, passosCurtos);

  const { data, error } = await cliente.rpc("registrar_revisao", {
    p_user_id: entrada.userId,
    p_topico_id: entrada.topicoId,
    p_algoritmo: algoritmo,
    p_due: emDataLocal(calculado.due),
    p_nota: nota,
    p_percentual: percentualAcerto,
    p_fsrs_card: calculado.card,
    p_regua_passo: calculado.reguaPasso,
  });

  if (error) throw error;

  const linha = (Array.isArray(data) ? data[0] : data) as
    | { due: string }
    | undefined;
  if (!linha) {
    throw new Error("registrar_revisao nao devolveu linha — estado inesperado do banco.");
  }

  // O banco e quem manda: a data que vale e a que ficou gravada, nao a que o
  // algoritmo calculou. Se as duas divergirem, e o banco que o plano vai ler.
  return { due: new Date(`${linha.due}T00:00:00Z`), nota, algoritmo };
}

/**
 * Percentual do bloco -> `Rating` 1 a 4 (ALUNO-09 AC2).
 *
 * **E adaptacao, nao uso padrao do FSRS** (AD-072): a biblioteca foi desenhada
 * para o aluno avaliar item a item, e aqui a unidade e o assunto. Por isso as
 * faixas moram em configuracao e `revisao_evento` guarda **percentual e nota** —
 * recalibrar depois exige o numero cru, que a nota sozinha ja teria perdido.
 *
 * As bordas sao inclusivas embaixo: exatamente 50% e `dificil`, nao `errei`.
 */
export function notaDoPercentual(
  percentual: number,
  faixas: { errei: number; dificil: number; bom: number },
): Nota {
  if (percentual < faixas.errei) return NOTA.errei;
  if (percentual < faixas.dificil) return NOTA.dificil;
  if (percentual < faixas.bom) return NOTA.bom;
  return NOTA.facil;
}

type Calculado = {
  due: Date;
  card: Record<string, unknown> | null;
  reguaPasso: number;
};

/**
 * FSRS com os 21 pesos padrao da biblioteca, desde o dia 1 (AD-072).
 *
 * `enable_short_term: false` e a AD-092: com o default, um cartao novo avaliado
 * `bom` volta a vencer **10 minutos depois**, porque o FSRS usa passos de
 * aprendizado em minutos. Aqui a unidade e o topico e o aluno o ve no maximo uma
 * vez por dia — um `due` de 10 minutos faria todo topico revisado nascer
 * "devendo revisao" no mesmo dia, e o motor de prioridade nunca sairia do lugar.
 * O que se desliga e o passo de minutos, nao o algoritmo.
 */
function porFsrs(
  nota: Nota,
  agora: Date,
  cardGravado: unknown,
  passosCurtos: boolean,
): Calculado {
  const scheduler = fsrs({ enable_short_term: passosCurtos });
  const card = cardGravado ? reidratarCard(cardGravado) : createEmptyCard(agora);
  const { card: novo } = scheduler.next(card, agora, nota as Grade);

  return {
    due: novo.due,
    card: JSON.parse(JSON.stringify(novo)) as Record<string, unknown>,
    reguaPasso: 0,
  };
}

/**
 * O plano B do AC4: 1/3/7/14/30, na **mesma coluna `due`**.
 *
 * Nota 1 (errei) volta ao primeiro degrau; qualquer outra avanca um, parando no
 * ultimo. O degrau vem de `revisao_agenda.regua_passo` e nao de contar eventos:
 * contar daria o numero errado justamente depois de um erro, que e quando a
 * regua precisa recomecar.
 *
 * `passoAnterior === null` e "nunca revisou": a primeira revisao usa o **primeiro**
 * degrau (1 dia), nao o segundo. Tratar ausencia de linha como passo 0 pularia o
 * degrau de abertura da regua inteira.
 */
function porReguaFixa(
  nota: Nota,
  agora: Date,
  passoAnterior: number | null,
  dias: readonly number[],
): Calculado {
  const passo =
    passoAnterior === null || nota === NOTA.errei
      ? 0
      : Math.min(passoAnterior + 1, dias.length - 1);
  const due = new Date(agora);
  due.setUTCDate(due.getUTCDate() + dias[passo]);

  // `card` nulo de proposito: `registrar_revisao` preserva o `Card` que ja
  // estiver gravado, para o aluno que voltar ao FSRS nao recomecar do zero.
  return { due, card: null, reguaPasso: passo };
}

/**
 * O `Card` volta do `jsonb` com as datas em texto, e o `ts-fsrs` faz aritmetica
 * de data em cima delas. Sem esta conversao o calculo sai errado em silencio.
 */
function reidratarCard(gravado: unknown): Card {
  const bruto = gravado as Record<string, unknown>;
  return {
    ...(bruto as unknown as Card),
    due: new Date(bruto.due as string),
    last_review: bruto.last_review
      ? new Date(bruto.last_review as string)
      : undefined,
  };
}

async function lerAgenda(
  cliente: SupabaseClient,
  userId: string,
  topicoId: string,
): Promise<{ fsrs_card: unknown; regua_passo: number } | null> {
  const { data, error } = await cliente
    .from("revisao_agenda")
    .select("fsrs_card, regua_passo")
    .eq("user_id", userId)
    .eq("topico_id", topicoId)
    .maybeSingle();

  if (error) throw new Error(`falha ao ler revisao_agenda: ${error.message}`);
  return (data as { fsrs_card: unknown; regua_passo: number } | null) ?? null;
}

/**
 * `due` e `date`, nao `timestamptz`: a unidade da agenda e o dia.
 *
 * O corte e em UTC, o mesmo fuso em que os jobs da madrugada comparam
 * `due <= current_date`. Multi-fuso nao e escopo do lancamento (AD-077, produto
 * nacional) e esta registrado no design do M4 como risco conhecido: quem estuda
 * perto da virada pode ver o plano trocar.
 */
function emDataLocal(data: Date): string {
  const ano = data.getUTCFullYear();
  const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(data.getUTCDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export type { Algoritmo };
