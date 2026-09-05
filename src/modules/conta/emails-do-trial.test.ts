import { describe, expect, it } from "vitest";

import {
  contextoDoEmail,
  montarEmailDoTrial,
  type ContextoDoEmail,
  type TipoDeEmailDoTrial,
} from "./emails-do-trial";

const TIPOS: TipoDeEmailDoTrial[] = ["dia_0", "dia_3", "dia_6", "dia_8"];
const SITE = "https://exemplo.test";

const COM_NUMERO: ContextoDoEmail = {
  questoes: 84,
  acertos: 51,
  dias: 6,
  assuntos: 12,
  caderno: 7,
  revisoes: 9,
};

const SEM_NADA: ContextoDoEmail = {
  questoes: 0,
  acertos: 0,
  dias: 0,
  assuntos: 0,
  caderno: 0,
  revisoes: 0,
};

describe("contextoDoEmail", () => {
  it("jsonb ilegivel vira zeros, e nao NaN no corpo do e-mail", () => {
    expect(contextoDoEmail(null)).toEqual(SEM_NADA);
    expect(contextoDoEmail("nao e objeto")).toEqual(SEM_NADA);
    expect(contextoDoEmail({ questoes: "muitas" })).toEqual(SEM_NADA);
  });

  it("le os numeros que existem", () => {
    expect(contextoDoEmail({ questoes: 84, acertos: 51 }).questoes).toBe(84);
  });
});

describe("os quatro e-mails do trial", () => {
  /**
   * Invariante nº14 do AGENTS.md, e o mais facil de quebrar sem perceber: e
   * exatamente o vocabulario que todo e-mail de trial do mercado usa.
   */
  it("nenhum deles fabrica urgencia", () => {
    for (const tipo of TIPOS) {
      const { assunto, texto } = montarEmailDoTrial(tipo, COM_NUMERO, SITE);
      const tudo = `${assunto} ${texto}`;

      expect(tudo).not.toMatch(
        /última chance|ultima chance|não perca|corre|só hoje|expira em|acaba em \d|oferta relâmpago|desconto/i,
      );
    }
  });

  /**
   * Estes quatro sao execucao do servico que a pessoa pediu, nao marketing.
   * Novidade, promocao e conteudo exigem opt-in (invariante nº9), e misturar as
   * duas coisas na mesma lista e o que faz a base inteira virar marketing.
   */
  it("nenhum deles carrega novidade, promocao ou conteudo", () => {
    for (const tipo of TIPOS) {
      const { texto } = montarEmailDoTrial(tipo, COM_NUMERO, SITE);

      expect(texto).not.toMatch(/newsletter|novidades|blog|cupom|promoção/i);
    }
  });

  it("o dia 0 leva direto ao plano de hoje", () => {
    const { texto } = montarEmailDoTrial("dia_0", SEM_NADA, SITE);

    expect(texto).toContain(`${SITE}/app`);
    expect(texto).toContain("7 dias");
    expect(texto).toContain("sem cartão");
  });

  it("o dia 3 conta o que o proprio aluno construiu", () => {
    const { texto } = montarEmailDoTrial("dia_3", COM_NUMERO, SITE);

    expect(texto).toContain("84 questões respondidas, 61% de acerto");
    expect(texto).toContain("7 assuntos no seu caderno de erros");
    expect(texto).toContain("9 revisões agendadas");
  });

  /** Zero nao vira linha: uma parede de zeros soa como cobranca. */
  it("aluno sem nenhuma resposta recebe a versao sem numeros", () => {
    const { assunto, texto } = montarEmailDoTrial("dia_3", SEM_NADA, SITE);

    expect(assunto).not.toContain("veja o que");
    expect(texto).not.toContain("0 questões");
    expect(texto).toContain("nenhuma resposta");
  });

  it("o dia 6 avisa o fim sem prometer prazo que nao existe", () => {
    const { assunto, texto } = montarEmailDoTrial("dia_6", COM_NUMERO, SITE);

    expect(assunto).toContain("Amanhã");
    expect(texto).toContain("Este é o aviso, não uma oferta com prazo");
    expect(texto).toContain("não é apagado");
  });

  it("o dia 8 diz o que ficou e para onde ir", () => {
    const { texto } = montarEmailDoTrial("dia_8", COM_NUMERO, SITE);

    expect(texto).toContain("Nada disso foi apagado");
    expect(texto).toContain(`${SITE}/checkout`);
  });

  /** Conteudo de questao e acervo, e acervo e o que fecha. */
  it("nenhum deles carrega enunciado, alternativa ou gabarito", () => {
    for (const tipo of TIPOS) {
      const { texto } = montarEmailDoTrial(tipo, COM_NUMERO, SITE);

      expect(texto).not.toMatch(/enunciado|alternativa|gabarito/i);
    }
  });

  it("os quatro assuntos sao distintos entre si", () => {
    const assuntos = TIPOS.map(
      (tipo) => montarEmailDoTrial(tipo, COM_NUMERO, SITE).assunto,
    );

    expect(new Set(assuntos).size).toBe(4);
  });
});
