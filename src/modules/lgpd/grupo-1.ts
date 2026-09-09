/**
 * O inventario do **grupo 1** — dado pessoal identificado (AD-027).
 *
 * Por que existe agora, e nao na SPEC 14 junto da rotina de apagamento: o
 * contrato nº 9 do `STATE.md` diz que **tabela nova com `user_id` tem que fazer
 * um teste falhar**, não passar em silêncio. Uma lista que nasce junto da
 * rotina nasce tarde — as oito tabelas abaixo já existiam antes de alguém
 * escrever a primeira linha de apagamento, e é exatamente nesse intervalo que
 * uma tabela some do radar.
 *
 * Isto é um **inventário**, não a rotina. Quem apaga é a SPEC 14; o que este
 * arquivo garante é que ela não vai ter o que descobrir sozinha.
 */

/** Tabelas com `user_id` próprio. A rotina da SPEC 14 varre cada uma por ele. */
export const TABELAS_GRUPO_1 = [
  "caderno_erros",
  "dominio_topico",
  "folgas_programadas",
  "gamificacao_conquistas",
  "gamificacao_dia",
  "gamificacao_missao_dia",
  "gamificacao_ponto_evento",
  "gamificacao_pontos",
  "gamificacao_pontos_dia",
  "matriculas",
  "perfil_estudo",
  "plano_dia",
  "recurso_visto",
  "revisao_agenda",
  "revisao_evento",
  "solicitacoes_esquecimento",
  // Registro de que o titular pediu a exportacao (LGPD art. 18, II). Guarda
  // `user_id` e diz que aquela pessoa existiu e exerceu um direito — e dado
  // identificado como qualquer outro, e o esquecimento tem de alcanca-lo.
  "solicitacoes_exportacao",
  "sequencia_dia",
  "sessoes",
  "tentativa_causa_simulado",
  "tentativas",
  // Fila dos e-mails do trial (AD-133). Ela guarda o e-mail do titular em
  // coluna propria, alem do user_id — e dado identificado, e o apagamento tem
  // de alcanca-la. O `on delete cascade` da FK ja cobriria a linha se o
  // apagamento passasse por `auth.users`, mas a rotina varre por `user_id`
  // tabela a tabela, e o que ela nao conhece ela nao apaga.
  "trial_emails_pendentes",
] as const;

/**
 * Tabelas que **não** têm `user_id` e mesmo assim guardam dado de uma pessoa
 * só, alcançadas por quem as referencia. Ficam listadas à parte porque a
 * varredura automática não as encontra — e uma rotina que só siga `user_id`
 * deixaria as duas para trás.
 */
export const TABELAS_GRUPO_1_INDIRETAS = [
  {
    tabela: "plano_bloco",
    alcancada_por: "plano_dia.id",
    // A coluna do lado de ca, escrita e nao deduzida. Derivar
    // `plano_dia.id` -> `plano_dia_id` funcionaria hoje e quebraria calado no
    // dia em que uma tabela indireta nova nao seguir a convencao: a exportacao
    // consultaria uma coluna inexistente e o titular receberia a tabela vazia.
    coluna_local: "plano_dia_id",
  },
] as const;

/**
 * Tabelas com `user_id` que **não** entram no apagamento, cada uma com o
 * motivo escrito. Pagamentos e seus registros financeiros ficam aqui porque o
 * PAG-06 AC9 manda retê-los pelo prazo fiscal, e eles SHALL sobreviver ao
 * DELETE-por-esquecimento (DADOS-04). Sem este campo, a única saída seria
 * esquecer de listá-los.
 */
export const EXCECOES_DO_APAGAMENTO: { tabela: string; motivo: string }[] = [
  {
    tabela: "pagamentos",
    motivo: "Registro financeiro e fiscal sobrevive ao esquecimento pelo prazo legal.",
  },
  {
    tabela: "pagamento_aceites",
    motivo: "Prova do aceite contratual fica ligada ao pagamento retido.",
  },
  {
    tabela: "pagamento_eventos",
    motivo: "Idempotência e diagnóstico do gateway exigem retenção do evento mínimo.",
  },
  {
    tabela: "pagamento_transicoes",
    motivo: "Histórico financeiro append-only precisa sobreviver ao apagamento.",
  },
  {
    tabela: "faturas",
    motivo: "Referência fiscal e nota emitida permanecem pelo prazo legal.",
  },
  {
    tabela: "pagamento_pendencias",
    motivo: "Fila operacional ligada ao pagamento permanece para auditoria e retry.",
  },
];
