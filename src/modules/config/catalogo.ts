import { z } from "zod";

/**
 * Catalogo de chaves de configuracao (INFRA-11 AC8, AD-078).
 *
 * O banco guarda **override**; este arquivo guarda a **verdade sobre o que a
 * chave e** — tipo, valor padrao, modulo dono e descricao. Chave sem linha no
 * banco vale o default daqui, e e assim que o sistema sobe num banco vazio.
 *
 * Este catalogo e a **unica** forma de criar chave nova. Chave que existe no
 * banco e nao existe aqui e orfa: erro, nao configuracao.
 */

export const MODULOS = [
  "m1",
  "m2",
  "m3",
  "m4",
  "m5",
  "m6",
  "m7",
  "m8",
  "m9",
] as const;

export type ModuloDono = (typeof MODULOS)[number];

/**
 * Mesmo padrao do `CHECK chave_com_prefixo_valido` da migracao. Duplicado de
 * proposito: o banco recusa a linha, e o catalogo recusa a declaracao — as duas
 * pontas seguram, e o teste confere que continuam iguais.
 */
export const PADRAO_DA_CHAVE = /^(flag|param)\.m[1-9]\.[a-z0-9_]+$/;

type Definicao<T extends z.ZodType> = {
  /** Valida o jsonb que vem do banco. */
  tipo: T;
  /** Vale quando nao ha linha, ou quando a leitura falha. */
  padrao: z.infer<T>;
  moduloDono: ModuloDono;
  /** Aparece na tela de administracao. */
  descricao: string;
};

/**
 * Amarra `padrao` ao `tipo` da propria chave: default do formato errado vira
 * erro de compilacao, nao surpresa em producao. O que o tipo do TypeScript nao
 * alcanca — `.int()`, `.positive()`, faixa — o teste do catalogo pega.
 */
function chave<T extends z.ZodType>(definicao: Definicao<T>): Definicao<T> {
  return definicao;
}

/**
 * Um lado de uma chamada de IA: qual modelo, em que versao, com quanto esforco.
 *
 * **Nenhum valor aqui e conhecido pelo codigo** — sao `string` porque o codigo
 * repassa o que a configuracao mandar. Fixar `z.enum([...])` com os nomes de
 * hoje seria exatamente o acoplamento que o IA-02 AC1 proibe.
 */
const DESTINO_DE_IA = z.object({
  modelo: z.string().min(1),
  /** Versao **fixada**, nunca apelido flutuante (IA-02 AC4). */
  versao: z.string().min(1),
  esforco: z.string().min(1),
});

const PERFIL_DE_TAREFA = DESTINO_DE_IA.extend({
  /** `true` = a tarefa vai para a Batch API; chamada sincrona e recusada. */
  batch: z.boolean(),
  /** Prompt caching no trecho estavel do pedido (IA-02 AC9). */
  cache: z.boolean(),
  /** Para onde ir quando o principal falha (IA-02 AC5). `null` = nao ha para onde. */
  fallback: DESTINO_DE_IA.nullable(),
  /** Teto de tokens de saida. Ausente = o que o provedor decidir. */
  teto_de_saida: z.number().int().positive().optional(),
});

/** Preco em USD por 1 milhao de tokens. */
const PRECO_DE_MODELO = z.object({
  entrada: z.number().nonnegative(),
  saida: z.number().nonnegative(),
  entrada_cacheada: z.number().nonnegative().optional(),
});

export const CATALOGO = {
  // ── M4 · coluna vertebral do aluno ────────────────────────────────────────
  // Nenhum destes numeros esta confirmado: sao [provisorio] nas Assumptions da
  // spec do M4. Estao aqui com default porque o AD-078 exige default declarado
  // em codigo; calibram sem deploy.
  "param.m4.algoritmo_revisao": chave({
    tipo: z.enum(["fsrs", "regua_fixa"]),
    padrao: "fsrs",
    moduloDono: "m4",
    descricao:
      "Qual algoritmo agenda a revisao. 'regua_fixa' e o plano B (1/3/7/14/30) e grava na mesma coluna, entao a troca nao perde agendamento.",
  }),
  "param.m4.fsrs_faixas_nota": chave({
    tipo: z.object({
      errei: z.number().min(0).max(1),
      dificil: z.number().min(0).max(1),
      bom: z.number().min(0).max(1),
    }),
    padrao: { errei: 0.5, dificil: 0.7, bom: 0.9 },
    moduloDono: "m4",
    descricao:
      "Converte percentual de acerto do bloco em Rating 1-4 do FSRS. Adaptacao registrada na AD-072; recalibravel olhando revisao_evento.",
  }),
  "param.m4.fsrs_passos_curtos": chave({
    tipo: z.boolean(),
    padrao: false,
    moduloDono: "m4",
    descricao:
      "Passos de aprendizado em minutos do FSRS. Desligado (AD-092): a unidade aqui e o topico, visto no maximo 1x/dia, e um `due` de 10 minutos faria todo topico revisado nascer vencido no mesmo dia.",
  }),
  "param.m4.regua_fixa_dias": chave({
    tipo: z.array(z.number().int().positive()).min(1),
    padrao: [1, 3, 7, 14, 30],
    moduloDono: "m4",
    descricao:
      "Os degraus da regua fixa, o plano B do ALUNO-09 AC4. Em configuracao para nao existir numero solto em codigo.",
  }),
  "param.m4.questoes_por_bloco": chave({
    tipo: z.number().int().positive(),
    padrao: 10,
    moduloDono: "m4",
    descricao:
      "Quantas questoes tem um bloco do plano do dia. Multiplicado por `minutos_por_questao` da o tempo estimado do bloco.",
  }),
  "param.m4.fraqueza_por_nivel": chave({
    tipo: z.object({
      iniciante: z.number().min(0).max(1),
      intermediario: z.number().min(0).max(1),
      avancado: z.number().min(0).max(1),
    }),
    padrao: { iniciante: 0.9, intermediario: 0.6, avancado: 0.35 },
    moduloDono: "m4",
    descricao:
      "Semente do retrato frio: a fraqueza que vale enquanto o aluno nao tem historico no topico. E o que faz o plano do 1o dia existir para quem pulou o diagnostico (ALUNO-05 AC1).",
  }),
  "param.m4.retencao_historico_cron_dias": chave({
    tipo: z.number().int().positive(),
    padrao: 30,
    moduloDono: "m4",
    descricao:
      "Por quantos dias `cron.job_run_details` e guardado. O pg_cron nao poda esse historico sozinho e ele cresceria para sempre.",
  }),
  "param.m4.minutos_por_questao": chave({
    tipo: z.number().positive(),
    padrao: 2,
    moduloDono: "m4",
    descricao:
      "Converte o tempo que o aluno declara em tamanho de bloco do plano do dia.",
  }),
  "param.m4.diagnostico_n_questoes": chave({
    tipo: z.number().int().positive(),
    padrao: 20,
    moduloDono: "m4",
    descricao: "Quantas questoes tem o diagnostico inicial. Sempre pulavel.",
  }),
  "param.m4.dias_sem_repetir_questao": chave({
    tipo: z.number().int().positive(),
    padrao: 30,
    moduloDono: "m4",
    descricao:
      "Janela em que a mesma questao nao volta no Treinar, para o aluno nao decorar a alternativa.",
  }),
  "param.m4.peso_devendo_revisao": chave({
    tipo: z.number().positive(),
    padrao: 1.5,
    moduloDono: "m4",
    descricao:
      "Multiplicador do topico com revisao vencida no motor de prioridade do plano.",
  }),
  "param.m4.fsrs_limiar_otimizacao": chave({
    tipo: z.number().int().positive(),
    padrao: 1000,
    moduloDono: "m4",
    descricao:
      "Quantas revisoes registradas antes de ligar o computeParameters do FSRS. Fast-follow.",
  }),
  "flag.m4.diagnostico_adaptativo": chave({
    tipo: z.boolean(),
    padrao: false,
    moduloDono: "m4",
    descricao:
      "Diagnostico adaptativo por questoes. Desligada no lancamento (AD-076): o aluno so declara o nivel.",
  }),
  "flag.m4.simulado_semanal": chave({
    tipo: z.boolean(),
    padrao: false,
    moduloDono: "m4",
    descricao: "Simulado semanal. P3, nasce desligada.",
  }),
  "flag.m4.caderno_erros": chave({
    tipo: z.boolean(),
    padrao: true,
    moduloDono: "m4",
    descricao:
      "Caderno de erros. Nasce ligada: faz parte de 'progresso', uma das 4 superficies do lancamento (AD-076).",
  }),

  // ── M2 · camada de IA ─────────────────────────────────────────────────────
  // **Os tres defaults abaixo sao vazios de proposito** e isso e o desenho, nao
  // esquecimento (SPEC 08). O `AGENTS.md` proibe nome de modelo em codigo; o
  // AD-078 exige default declarado em codigo. Os dois so cabem juntos se o
  // default for "nao ha matriz": a matriz de verdade e linha na tabela
  // `configuracoes`, e trocar de modelo nunca encosta em codigo (IA-02 AC1).
  // Tarefa sem perfil e recusa visivel do gateway, nunca um modelo adivinhado.
  // Os valores vigentes hoje estao escritos em `docs/IA.md` — documento pode
  // citar o default (AD-068).
  "param.m2.matriz_de_modelos": chave({
    tipo: z.record(z.string(), PERFIL_DE_TAREFA),
    padrao: {},
    moduloDono: "m2",
    descricao:
      "tarefa -> (modelo, versao fixada, esforco, batch, cache, fallback). E a unica fonte do nome do modelo em todo o projeto (IA-02 AC1, AD-073). Vazia = nenhuma tarefa de IA roda, e o produto continua de pe sem elas.",
  }),
  "param.m2.precos_por_modelo": chave({
    tipo: z.record(z.string(), PRECO_DE_MODELO),
    padrao: {},
    moduloDono: "m2",
    descricao:
      "modelo -> preco em USD por 1 milhao de tokens (entrada, saida, entrada cacheada). Serve so para somar o gasto (IA-12); preco ausente nao impede a chamada.",
  }),
  "param.m2.teto_gasto_mensal_usd": chave({
    tipo: z.number().positive(),
    padrao: 60,
    moduloDono: "m2",
    descricao:
      "Acima disto o time e alertado uma vez no mes. SHALL NOT desligar nada sozinho (IA-12 / decisao de 2026-07-23).",
  }),

  // ── M9 · infra e operacoes ────────────────────────────────────────────────
  "flag.m9.rota_de_erro_proposital": chave({
    tipo: z.boolean(),
    padrao: false,
    moduloDono: "m9",
    descricao:
      "Libera /api/erro-proposital, que lanca de proposito para conferir se o erro chega ao Sentry com alerta (INFRA-09). Nasce desligada: com ela ligada, qualquer um derruba uma rota de producao.",
  }),
} as const;

/** Toda chave que existe. Ler chave fora daqui e erro de compilacao. */
export type Chave = keyof typeof CATALOGO;

/** Feature flag: em qualquer duvida vale `false`. */
export type ChaveFlag = Extract<Chave, `flag.${string}`>;

/** Parametro de regra de negocio: em qualquer duvida vale o default. */
export type ChaveParam = Extract<Chave, `param.${string}`>;

/** O tipo que a chave devolve, derivado do proprio schema declarado. */
export type TipoDe<K extends Chave> = z.infer<(typeof CATALOGO)[K]["tipo"]>;

export const CHAVES = Object.keys(CATALOGO) as Chave[];

export function existeNoCatalogo(chave: string): chave is Chave {
  return Object.prototype.hasOwnProperty.call(CATALOGO, chave);
}

/**
 * Quais das chaves vindas do banco nao existem no catalogo (AC8).
 * Chave orfa nao e configuracao: e lixo que ninguem sabe ler.
 */
export function chavesOrfas(chavesDoBanco: readonly string[]): string[] {
  return chavesDoBanco.filter((chave) => !existeNoCatalogo(chave));
}
