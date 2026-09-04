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
  // ── M1 · acervo e ingestão ─────────────────────────────────────
  "param.m1.teto_tokens_por_pedido": chave({
    tipo: z.number().int().positive(),
    padrao: 272_000,
    moduloDono: "m1",
    descricao:
      "Teto de tokens de um pedido da fabrica (IA-17). Acima disto a OpenAI cobra 2x a entrada e 1,5x a saida, o que anula o desconto do modelo (AD-073). Vive em configuracao porque o degrau e do fornecedor, nao nosso.",
  }),
  "param.m1.margem_do_teto": chave({
    tipo: z.number().min(0).max(0.5),
    padrao: 0.2,
    moduloDono: "m1",
    descricao:
      "Quanto do teto fica de folga, porque a contagem de tokens do lado de ca e estimativa. 0.2 = usa no maximo 80% do teto.",
  }),
  "param.m1.chars_por_token": chave({
    tipo: z.number().positive(),
    padrao: 3.5,
    moduloDono: "m1",
    descricao:
      "Quantos caracteres de portugues valem um token, para estimar o tamanho de um bloco sem chamar o tokenizador do fornecedor. Calibra medindo uma prova real contra o `usage` que voltou.",
  }),
  "param.m1.paginas_por_bloco": chave({
    tipo: z.number().int().positive(),
    padrao: 4,
    moduloDono: "m1",
    descricao:
      "Teto de paginas por bloco de extracao. Existe porque o teto de tokens sozinho nunca corta uma prova real: as provas do BB 2021 tem ~19 mil tokens contra um teto util de ~218 mil, e sem este limite a prova inteira iria num pedido so — o que o BANCO-03 AC2 proibe. Bloco menor tambem falha menor: um bloco ruim custa 4 paginas, nao a prova.",
  }),
  "param.m1.bucket_de_imagens": chave({
    tipo: z.string().min(1),
    padrao: "questoes",
    moduloDono: "m1",
    descricao:
      "Bucket do Supabase Storage onde a imagem de uma questao e guardada (BANCO-11/AD-041).",
  }),
  "param.m1.piso_confianca_ia": chave({
    tipo: z.number().min(0).max(1),
    padrao: 0.95,
    moduloDono: "m1",
    descricao:
      "Piso de confianca da extracao que manda a questao real para revisao humana (BANCO-07 AC1).",
  }),
  "param.m1.amostra_qa_real": chave({
    tipo: z.number().min(0).max(1),
    padrao: 0.1,
    moduloDono: "m1",
    descricao:
      "Fracao deterministica de questoes reais de alta confianca que recebe revisao por amostra (BANCO-07 AC3).",
  }),

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
  "param.m4.percentual_avancar": chave({
    tipo: z.number().min(0).max(1),
    padrao: 0.5,
    moduloDono: "m4",
    descricao:
      "Fracao-alvo da capacidade diaria reservada para avancar no edital. A capacidade nao usada por uma categoria pode ser redistribuida sem ultrapassar os minutos declarados.",
  }),
  "param.m4.percentual_praticar": chave({
    tipo: z.number().min(0).max(1),
    padrao: 0.3,
    moduloDono: "m4",
    descricao:
      "Fracao-alvo da capacidade diaria reservada para praticar. Vive em configuracao para calibrar o equilibrio do ciclo sem deploy.",
  }),
  "param.m4.percentual_revisar": chave({
    tipo: z.number().min(0).max(1),
    padrao: 0.2,
    moduloDono: "m4",
    descricao:
      "Fracao-alvo da capacidade diaria reservada para revisoes vencidas. A revisao nunca pode consumir mais que a capacidade total.",
  }),
  "param.m4.teto_revisoes_dia": chave({
    tipo: z.number().int().positive(),
    padrao: 2,
    moduloDono: "m4",
    descricao:
      "Quantidade maxima de blocos de revisao por dia. Evita que a fila vencida paralise o avanco do edital.",
  }),
  "param.m4.cooldown_materia_dias": chave({
    tipo: z.number().int().min(0),
    padrao: 2,
    moduloDono: "m4",
    descricao:
      "Quantidade de dias de cooldown depois de tocar uma materia, para favorecer a rotacao do ciclo.",
  }),
  "param.m4.teto_semanal_materia": chave({
    tipo: z.number().int().positive(),
    padrao: 3,
    moduloDono: "m4",
    descricao:
      "Teto de blocos concluidos por materia na semana para impedir monopolio; a janela maxima pode quebrar o teto para evitar abandono.",
  }),
  "param.m4.limite_sem_toque_materia_dias": chave({
    tipo: z.number().int().positive(),
    padrao: 7,
    moduloDono: "m4",
    descricao:
      "Janela maxima sem tocar uma materia relevante. Ao vencer, a materia volta a ser elegivel mesmo que o teto semanal esteja cheio.",
  }),
  "param.m4.fracao_minutos_versao_curta": chave({
    tipo: z.number().min(0.01).max(1),
    padrao: 0.5,
    moduloDono: "m4",
    descricao:
      "Fracao dos minutos da versao cheia usada na versao curta. A operacao e idempotente e nunca reduz abaixo de um minuto.",
  }),
  "param.m4.fracao_questoes_versao_curta": chave({
    tipo: z.number().min(0.01).max(1),
    padrao: 0.5,
    moduloDono: "m4",
    descricao:
      "Fracao das questoes da versao cheia usada na versao curta. A quantidade minima e uma questao.",
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
  "flag.m4.trajetoria": chave({
    tipo: z.boolean(),
    padrao: false,
    moduloDono: "m4",
    descricao:
      "Cobertura do edital e previsao de termino no Progresso e em Hoje. Nasce desligada: e evolucao, nao uma das 4 superficies do lancamento (AD-076).",
  }),
  "flag.m4.caderno_erros": chave({
    tipo: z.boolean(),
    padrao: true,
    moduloDono: "m4",
    descricao:
      "Caderno de erros. Nasce ligada: faz parte de 'progresso', uma das 4 superficies do lancamento (AD-076).",
  }),

  // ── M5 · Raio-X da banca ─────────────────────────────────────────────────
  "flag.m5.raiox": chave({
    tipo: z.boolean(),
    padrao: false,
    moduloDono: "m5",
    descricao:
      "Tela de leitura do Raio-X. Nasce desligada (AD-076): a projeção é construída antes de a superfície ser ligada.",
  }),
  "param.m5.bancas": chave({
    tipo: z.array(z.string().min(1)).min(1),
    padrao: ["Cesgranrio", "FGV", "Cebraspe"],
    moduloDono: "m5",
    descricao:
      "Bancas que compõem o escopo combinado quando o perfil ainda está indefinido. Banca nova entra por configuração.",
  }),
  "param.m5.meia_vida_decaimento_anos": chave({
    tipo: z.number().positive(),
    padrao: 5,
    moduloDono: "m5",
    descricao:
      "Meia-vida em anos do peso de uma questão real. Nenhum ano é descartado; o valor só calibra a queda gradual.",
  }),
  "param.m5.amortecimento_k": chave({
    tipo: z.number().positive(),
    padrao: 10,
    moduloDono: "m5",
    descricao:
      "Constante da força de amortecimento para puxar amostras pequenas em direção à média da banca.",
  }),
  "param.m5.piso_amostra_baixa": chave({
    tipo: z.number().int().positive(),
    padrao: 10,
    moduloDono: "m5",
    descricao:
      "Número mínimo de questões reais para uma linha deixar de receber o rótulo de pouca amostra.",
  }),
  "param.m5.periodo_tendencia_recente_anos": chave({
    tipo: z.number().int().positive(),
    padrao: 3,
    moduloDono: "m5",
    descricao:
      "Tamanho, em anos, da janela recente usada para apontar a direção da frequência.",
  }),
  "param.m5.periodo_tendencia_anterior_anos": chave({
    tipo: z.number().int().positive(),
    padrao: 3,
    moduloDono: "m5",
    descricao:
      "Tamanho, em anos, da janela anterior comparada com a janela recente da tendência.",
  }),

  // ── M6 · gamificação solo ─────────────────────────────────────────────────
  // A flag é global e nasce desligada. Os pontos e as metas ficam em
  // configuração versionada para que a calibragem não exija deploy nem espalhe
  // números pelo contrato que a tela consome.
  "flag.m6.gamificacao": chave({
    tipo: z.boolean(),
    padrao: false,
    moduloDono: "m6",
    descricao:
      "Contrato de gamificação solo: anel, pontos, missão e conquistas. Nasce desligado até a onda visual ligar a superfície com segurança.",
  }),
  "param.m6.pontos_estudo_prioritario": chave({
    tipo: z.number().int().nonnegative(),
    padrao: 10,
    moduloDono: "m6",
    descricao:
      "Pontos de um bloco prioritário do piso concluído com respostas reais. O evento é único por bloco e não premia sessão vazia.",
  }),
  "param.m6.pontos_conclusao": chave({
    tipo: z.number().int().nonnegative(),
    padrao: 20,
    moduloDono: "m6",
    descricao:
      "Pontos de um bloco da meta cheia concluído com respostas reais. O valor é congelado no evento de origem.",
  }),
  "param.m6.pontos_revisao_no_prazo": chave({
    tipo: z.number().int().nonnegative(),
    padrao: 15,
    moduloDono: "m6",
    descricao:
      "Pontos de uma revisão do plano concluída com respostas reais. A presença no plano de hoje é a prova server-trusted do prazo.",
  }),
  "param.m6.pontos_recuperacao_erro": chave({
    tipo: z.number().int().nonnegative(),
    padrao: 25,
    moduloDono: "m6",
    descricao:
      "Pontos da primeira resposta correta posterior a um erro na mesma questão. Cada tentativa é uma origem auditável e única.",
  }),
  "param.m6.meta_missao_questoes": chave({
    tipo: z.number().int().positive(),
    padrao: 10,
    moduloDono: "m6",
    descricao:
      "Meta configurável da missão de questões quando o plano não emite um piso prioritário.",
  }),
  "param.m6.meta_conquista_sequencia": chave({
    tipo: z.number().int().positive(),
    padrao: 7,
    moduloDono: "m6",
    descricao:
      "Quantidade de dias cumpridos necessária para a conquista pessoal de sequência.",
  }),
  "param.m6.meta_conquista_questoes": chave({
    tipo: z.number().int().positive(),
    padrao: 100,
    moduloDono: "m6",
    descricao:
      "Quantidade acumulada de questões respondidas necessária para a conquista pessoal de volume.",
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

  "param.m7.retencao_trial_meses": chave({
    tipo: z.number().int().positive(),
    padrao: 6,
    moduloDono: "m7",
    descricao:
      "Janela de retencao do lead que teve trial e NUNCA pagou (AD-133). Separada dos 24 meses do AD-045: quem testou uma semana nao justifica o mesmo risco. Provisorio — falar com o advogado junto do resto da LGPD.",
  }),

  // ── M8 · negocio e pagamentos ────────────────────────────────────────────
  "param.m8.preco_anual_centavos": chave({
    tipo: z.number().int().positive(),
    padrao: 19_700,
    moduloDono: "m8",
    descricao:
      "Preco anual parcelado em centavos de BRL. O valor e lido da configuracao no checkout e congelado no pagamento criado.",
  }),
  "param.m8.desconto_a_vista_percentual": chave({
    tipo: z.number().min(0).max(1),
    padrao: 0.1,
    moduloDono: "m8",
    descricao:
      "Desconto aplicado ao preco anual quando o aluno escolhe Pix ou boleto. Percentual entre 0 e 1, exibido como preco final.",
  }),
  "param.m8.garantia_dias": chave({
    tipo: z.number().int().positive(),
    padrao: 7,
    moduloDono: "m8",
    descricao:
      "Quantidade de dias corridos da garantia contados a partir da confirmacao do pagamento.",
  }),
  // Trial gratuito (AD-133). A flag nasce desligada: com ela assim, o produto
  // e identico ao de hoje e o checkout continua sendo a unica porta.
  "flag.m8.trial_gratuito": chave({
    tipo: z.boolean(),
    padrao: false,
    moduloDono: "m8",
    descricao:
      "Conta gratuita com trial de 7 dias, sem cartao (AD-133). Desligada, /criar-conta recusa e nenhuma matricula de trial nasce. O prazo NAO mora aqui: e produtos.dias_de_acesso.",
  }),
  "param.m8.trial_questoes_por_dia": chave({
    tipo: z.number().int().positive(),
    padrao: 10,
    moduloDono: "m8",
    descricao:
      "Teto diario de questoes durante o trial. Vale so para matricula tipo='trial'; quem pagou nao tem teto. Provisorio: depende de contar o acervo publicado.",
  }),
  "param.m8.dominios_bloqueados_no_trial": chave({
    tipo: z.array(z.string().min(1)),
    padrao: [],
    moduloDono: "m8",
    descricao:
      "Dominios de e-mail descartavel recusados no cadastro gratuito. Minusculas, sem @. Vazia = nenhum bloqueio, que e o default: e lista de exclusao, e lista de exclusao vazia nao fecha nada por engano.",
  }),
  "param.m8.pagamento_pendente_expira_horas": chave({
    tipo: z.number().int().positive(),
    padrao: 48,
    moduloDono: "m8",
    descricao:
      "Horas sem confirmação externa depois das quais uma tentativa pendente pode ser expirada pelo job de reconciliação.",
  }),

  // ── M9 · infra e operacoes ────────────────────────────────────────────────
  "flag.m9.rota_de_erro_proposital": chave({
    tipo: z.boolean(),
    padrao: false,
    moduloDono: "m9",
    descricao:
      "Libera /api/erro-proposital, que lanca de proposito para conferir se o erro chega ao Sentry com alerta (INFRA-09). Nasce desligada: com ela ligada, qualquer um derruba uma rota de producao.",
  }),
  "flag.m9.analytics_logado": chave({
    tipo: z.boolean(),
    padrao: false,
    moduloDono: "m9",
    descricao:
      "Analytics da superficie logada. Nasce desligada: o funil pre-login e a unica coleta desta spec.",
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
