/**
 * A redação dos quatro e-mails do trial (AD-133 · item 6 do TRIAL-2).
 *
 * Mora em `src/modules`, e não dentro do job, por um motivo: **é texto que vai
 * para o aluno**, e texto que vai para o aluno é testável sem banco e sem rede.
 * O job só transporta.
 *
 * Regras que não são negociáveis, e que os testes guardam:
 *
 *   · **Nada de urgência falsa** (invariante nº14). Sem "última chance", sem
 *     desconto que aparece e some, sem prazo que não é verdade. O dia 6 diz que
 *     amanhã o acesso fecha porque amanhã o acesso fecha.
 *   · **Números, do próprio aluno.** O que convence não é o produto, é o que ele
 *     construiu. Aluno sem nenhuma resposta recebe uma versão sem números — e
 *     não uma parede de zeros, que soa como cobrança.
 *   · **Não é marketing.** Estes quatro são execução do serviço que a pessoa
 *     pediu. Qualquer e-mail além destes exige opt-in (invariante nº9), e por
 *     isso nenhum deles carrega novidade, promoção ou conteúdo.
 */

export type TipoDeEmailDoTrial = "dia_0" | "dia_3" | "dia_6" | "dia_8";

export type ContextoDoEmail = {
  questoes: number;
  acertos: number;
  dias: number;
  assuntos: number;
  caderno: number;
  revisoes: number;
};

export type EmailDoTrial = { assunto: string; texto: string };

const CONTEXTO_VAZIO: ContextoDoEmail = {
  questoes: 0,
  acertos: 0,
  dias: 0,
  assuntos: 0,
  caderno: 0,
  revisoes: 0,
};

export function contextoDoEmail(bruto: unknown): ContextoDoEmail {
  if (bruto === null || typeof bruto !== "object") return CONTEXTO_VAZIO;
  const objeto = bruto as Record<string, unknown>;

  const numero = (chave: keyof ContextoDoEmail): number => {
    const valor = Number(objeto[chave]);
    return Number.isFinite(valor) && valor >= 0 ? Math.trunc(valor) : 0;
  };

  return {
    questoes: numero("questoes"),
    acertos: numero("acertos"),
    dias: numero("dias"),
    assuntos: numero("assuntos"),
    caderno: numero("caderno"),
    revisoes: numero("revisoes"),
  };
}

function plural(n: number, um: string, muitos: string): string {
  return `${n} ${n === 1 ? um : muitos}`;
}

/** As linhas de número que existem. Zero não vira linha — vira silêncio. */
function oQueFoiConstruido(ctx: ContextoDoEmail): string[] {
  const linhas: string[] = [];

  if (ctx.questoes > 0) {
    const taxa = Math.round((ctx.acertos / ctx.questoes) * 100);
    linhas.push(
      `- ${plural(ctx.questoes, "questão respondida", "questões respondidas")}, ${taxa}% de acerto`,
    );
  }
  if (ctx.dias > 0) {
    linhas.push(`- ${plural(ctx.dias, "dia de estudo", "dias de estudo")}`);
  }
  if (ctx.assuntos > 0) {
    linhas.push(`- ${plural(ctx.assuntos, "assunto mapeado", "assuntos mapeados")}`);
  }
  if (ctx.caderno > 0) {
    linhas.push(
      `- ${plural(ctx.caderno, "assunto", "assuntos")} no seu caderno de erros`,
    );
  }
  if (ctx.revisoes > 0) {
    linhas.push(
      `- ${plural(ctx.revisoes, "revisão agendada", "revisões agendadas")}`,
    );
  }

  return linhas;
}

const ASSINATURA = "\n\nPassou Concursos";

export function montarEmailDoTrial(
  tipo: TipoDeEmailDoTrial,
  contexto: ContextoDoEmail,
  site: string,
): EmailDoTrial {
  const app = `${site}/app`;
  const matricula = `${site}/checkout`;
  const construido = oQueFoiConstruido(contexto);
  const temNumero = construido.length > 0;

  if (tipo === "dia_0") {
    return {
      assunto: "Sua conta está pronta — comece pelo plano de hoje",
      texto:
        "Sua conta no Passou Concursos está aberta pelos próximos 7 dias, sem cartão.\n\n" +
        "O que fazer hoje: abrir o plano do dia e responder o primeiro bloco. " +
        "Não precisa escolher o que estudar — o plano já vem montado, e ele se " +
        "ajusta ao que você acerta e erra.\n\n" +
        `Começar agora: ${app}\n\n` +
        "Cada resposta registra o assunto, o acerto e, quando você erra, o " +
        "motivo. É disso que nascem o seu caderno de erros e a agenda de " +
        "revisão." +
        ASSINATURA,
    };
  }

  if (tipo === "dia_3") {
    return {
      assunto: temNumero
        ? "Três dias de teste: veja o que você já construiu"
        : "Seu teste está no terceiro dia",
      texto: temNumero
        ? "Três dias de teste. Isto é o que a sua conta já produziu:\n\n" +
          `${construido.join("\n")}\n\n` +
          "Nada disso é um resumo do produto — é o seu histórico, e ele é o que " +
          "faz o plano de amanhã ser diferente do de ontem.\n\n" +
          `Continuar: ${app}` +
          ASSINATURA
        : "Seu teste está no terceiro dia e ainda não há nenhuma resposta " +
          "registrada na sua conta.\n\n" +
          "O produto começa a existir na primeira questão: é ela que monta o " +
          "seu histórico, o caderno de erros e a agenda de revisão.\n\n" +
          `Abrir o plano de hoje: ${app}` +
          ASSINATURA,
    };
  }

  if (tipo === "dia_6") {
    return {
      assunto: "Amanhã seu teste grátis termina",
      texto:
        "Amanhã o acesso ao acervo de questões fecha. Este é o aviso, não uma " +
        "oferta com prazo.\n\n" +
        (temNumero
          ? `O que fica guardado na sua conta:\n\n${construido.join("\n")}\n\n`
          : "") +
        "Seu histórico não é apagado quando o teste acaba. Se você fizer a " +
        "matrícula depois, ele volta inteiro, do ponto exato onde parou.\n\n" +
        `Usar o dia de hoje: ${app}\n` +
        `Ver a matrícula: ${matricula}` +
        ASSINATURA,
    };
  }

  return {
    assunto: "Seu teste terminou — o que ficou guardado",
    texto:
      "O acesso ao acervo fechou. O que você construiu continua na sua conta.\n\n" +
      (temNumero ? `${construido.join("\n")}\n\n` : "") +
      "Nada disso foi apagado. Com a matrícula, você volta exatamente de onde " +
      "parou: o mesmo caderno de erros, a mesma agenda de revisão, sem " +
      "recomeço e sem teto diário.\n\n" +
      `Ver a matrícula: ${matricula}` +
      ASSINATURA,
  };
}
