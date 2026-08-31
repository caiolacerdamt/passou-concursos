/* ==========================================================================
   PLACEHOLDER — os três planos do movimento assinatura ("o dia que se refaz").

   **Nada aqui vem do banco.** São números fictícios e genéricos, escritos à
   mão, que existem para a seção ter peso visual e para o dono trocar depois,
   linha por linha. Toda a rodada de landing v2 corre assim (`PLANO.md`), e
   este arquivo é o lugar único onde esses números moram: o ato 4 renderiza o
   plano padrão no servidor a partir daqui, e `assinatura.ts` refaz a lista a
   partir daqui quando o dial muda.

   Duas fontes para a mesma lista seria a forma mais barata de a página passar
   a mentir — o servidor mostrando um plano e o clique mostrando outro.

   Quando o plano do dia de verdade existir (SPEC 10), o que substitui isto é
   a consulta; o formato de `BlocoDoPlano` já é o que a tela precisa.
   ========================================================================== */

/** Um bloco do plano do dia, como ele aparece na folha do ato 4. */
export type BlocoDoPlano = {
  /** A ação que abre o bloco: avançar, estudar ou revisar. */
  acao: "AVANÇAR" | "ESTUDAR" | "REVISAR";
  /** Assunto que a pessoa verá ao abrir o bloco. */
  topico: string;
  /** Por que este bloco está aqui. É a frase curta que acompanha o assunto. */
  descricao: string;
  questoes: number;
  /** Bloco de revisão espaçada ganha selo e desce por cima dos outros. */
  revisao?: boolean;
};

/** Um dos três tempos do dial. O número é o rótulo e a chave. */
export type TempoDoDia = 30 | 60 | 120;

export type PlanoDoDia = {
  minutos: TempoDoDia;
  /** O que o dial mostra no botão. */
  rotulo: string;
  blocos: readonly BlocoDoPlano[];
};

/**
 * O padrão. É este que o servidor renderiza, e o que volta se o dial sumir.
 *
 * 2 h e não 1 h: o dial existe para a pessoa ver o dia se REFAZER, e um dia
 * cheio que encolhe mostra isso melhor do que um dia médio que cresce um
 * bloco. O plano de 120 min tem cinco blocos, então a folha do ato 4 já nasce
 * com peso — e é por causa dele que a seção foi apertada em `landing.css`
 * para caber inteira em uma tela.
 */
export const TEMPO_PADRAO: TempoDoDia = 120;

/**
 * PLACEHOLDER. Os motivos do plano de 1 h são os do `COPY.md`; os outros dois
 * seguem o mesmo tom porque o dial precisa ter o que mostrar, e o `COPY.md` só
 * escreveu o do meio.
 */
export const PLANOS: readonly PlanoDoDia[] = [
  {
    minutos: 30,
    rotulo: "30 min",
    blocos: [
      {
        acao: "AVANÇAR",
        topico: "Interpretação de textos",
        descricao: "Continue de onde você parou",
        questoes: 12,
      },
      {
        acao: "REVISAR",
        topico: "Segurança da informação",
        descricao: "Revisão programada",
        questoes: 6,
        revisao: true,
      },
    ],
  },
  {
    minutos: 60,
    rotulo: "1 h",
    blocos: [
      {
        acao: "AVANÇAR",
        topico: "Interpretação de textos",
        descricao: "Continue de onde você parou",
        questoes: 12,
      },
      {
        acao: "ESTUDAR",
        topico: "Porcentagem",
        descricao: "Próximo tópico do seu plano",
        questoes: 14,
      },
      {
        acao: "REVISAR",
        topico: "Segurança da informação",
        descricao: "Revisão programada",
        questoes: 6,
        revisao: true,
      },
    ],
  },
  {
    minutos: 120,
    rotulo: "2 h",
    blocos: [
      {
        acao: "AVANÇAR",
        topico: "Interpretação de textos",
        descricao: "Continue de onde você parou",
        questoes: 12,
      },
      {
        acao: "ESTUDAR",
        topico: "Porcentagem",
        descricao: "Próximo tópico do seu plano",
        questoes: 14,
      },
      {
        acao: "ESTUDAR",
        topico: "Direito Administrativo",
        descricao: "Tópico programado para hoje",
        questoes: 8,
      },
      {
        acao: "REVISAR",
        topico: "Segurança da informação",
        descricao: "Revisão programada",
        questoes: 6,
        revisao: true,
      },
      {
        acao: "REVISAR",
        topico: "Concordância verbal",
        descricao: "Revisão programada",
        questoes: 9,
        revisao: true,
      },
    ],
  },
];

export function planoDe(minutos: TempoDoDia): PlanoDoDia {
  return (
    PLANOS.find((p) => p.minutos === minutos) ??
    /* O fallback é o padrão, não uma posição do array: com índice fixo, mudar
       `TEMPO_PADRAO` deixava o caminho de erro apontando para outro plano. */
    PLANOS.find((p) => p.minutos === TEMPO_PADRAO) ??
    PLANOS[0]
  );
}

/** Quantas questões o dia inteiro tem. A tela cita este número em dois lugares. */
export function totalDeQuestoes(plano: PlanoDoDia): number {
  return plano.blocos.reduce((soma, b) => soma + b.questoes, 0);
}

/**
 * PLACEHOLDER — a fila de revisão do ato 6.
 *
 * O dial reordena esta fila: com menos tempo, o que estava marcado para hoje
 * escorrega para os intervalos seguintes. `dias` é o marco da linha do tempo em
 * que o item cai.
 */
export type ItemDaFila = { topico: string; dias: number };

export const FILA_DE_REVISAO: Readonly<Record<TempoDoDia, readonly ItemDaFila[]>> = {
  30: [
    { topico: "Juros compostos", dias: 3 },
    { topico: "Concordância verbal", dias: 9 },
    { topico: "Sigilo bancário", dias: 21 },
  ],
  60: [
    { topico: "Juros compostos", dias: 3 },
    { topico: "Concordância verbal", dias: 3 },
    { topico: "Sigilo bancário", dias: 9 },
    { topico: "Mercado de capitais", dias: 21 },
  ],
  120: [
    { topico: "Juros compostos", dias: 3 },
    { topico: "Concordância verbal", dias: 3 },
    { topico: "Sigilo bancário", dias: 3 },
    { topico: "Mercado de capitais", dias: 9 },
    { topico: "Regime de competência", dias: 21 },
  ],
};

/** Os quatro marcos da linha do tempo do ato 6. PLACEHOLDER. */
export const MARCOS_DA_REVISAO = [
  { rotulo: "hoje", dias: 0 },
  { rotulo: "3 dias", dias: 3 },
  { rotulo: "9 dias", dias: 9 },
  { rotulo: "21 dias", dias: 21 },
] as const;
