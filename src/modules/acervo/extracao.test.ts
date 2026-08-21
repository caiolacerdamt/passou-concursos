import { describe, expect, it } from "vitest";

import {
  INSTRUCAO,
  SCHEMA_DA_EXTRACAO,
  validarBloco,
} from "./extracao";

function questao(campos: Record<string, unknown> = {}) {
  return {
    numero: 12,
    tipo_questao: "multipla_escolha",
    enunciado: "Qual e o montante de R$ 1.000,00 a 10% ao ano por 2 anos?",
    alternativas: [
      { letra: "A", texto: "R$ 1.100,00" },
      { letra: "B", texto: "R$ 1.210,00" },
    ],
    texto_base_id: null,
    materia_sugerida: "Matematica Financeira",
    topico_sugerido: "Juros Compostos",
    dificuldade: 3,
    confianca_ia: 0.92,
    tem_imagem: false,
    pagina: 4,
    truncada: false,
    ...campos,
  };
}

describe("SCHEMA_DA_EXTRACAO — o que o modelo pode devolver", () => {
  const itens = (SCHEMA_DA_EXTRACAO.properties as Record<string, { items: Record<string, unknown> }>)
    .questoes.items;
  const propriedades = Object.keys(itens.properties as Record<string, unknown>);

  it("nao tem campo de status: `publicada` nao e alcancavel pela extracao", () => {
    // BANCO-03 AC6: a questao nasce rascunho ou em_revisao, **nunca** publicada.
    // A forma mais barata de garantir isso e o modelo nao ter onde escrever.
    expect(propriedades).not.toContain("status");
    expect(JSON.stringify(SCHEMA_DA_EXTRACAO)).not.toContain("publicada");
  });

  it("nao tem campo de gabarito: a IA nao decide a alternativa correta", () => {
    // Invariante nº4. A verdade e o gabarito oficial (BANCO-04).
    expect(propriedades).not.toContain("resposta_correta");
    expect(propriedades).not.toContain("gabarito");
  });

  it("exige os campos que a questao precisa ter para existir", () => {
    expect(itens.required).toEqual(expect.arrayContaining([
      "numero",
      "enunciado",
      "tipo_questao",
      "confianca_ia",
    ]));
    // `strict` da Responses API: todo campo declarado tem que estar em required
    // e nenhum campo extra e aceito.
    expect(itens.additionalProperties).toBe(false);
    expect((itens.required as string[]).sort()).toEqual([...propriedades].sort());
  });

  it("a instrucao manda preservar o numero oficial da banca", () => {
    // Edge case do M1: prova com numeracao fora de ordem ou em duas colunas.
    expect(INSTRUCAO).toContain("oficial impresso");
    expect(INSTRUCAO).toContain("nunca a ordem de leitura");
  });
});


describe("texto-base — transcrito uma vez, juntado por nos", () => {
  it("junta o texto-base ao enunciado de cada questao que aponta para ele", () => {
    // A v2 mandava o modelo repetir o texto dentro de cada questao. Numa pagina
    // de Lingua Inglesa da Prova C do BB 2021 isso fez o filtro de conteudo do
    // provedor cortar a geracao, e o bloco inteiro morria — sempre no mesmo
    // lugar. Agora o texto vem uma vez e a juncao acontece aqui.
    const { aceitas } = validarBloco({
      textos_base: [{ id: "T1", conteudo: "Reportagem sobre aparicoes aereas." }],
      questoes: [
        questao({ numero: 11, texto_base_id: "T1", enunciado: "One of the purposes of the text is" }),
        questao({ numero: 12, texto_base_id: "T1", enunciado: "The word who refers to" }),
      ],
    });

    expect(aceitas).toHaveLength(2);
    for (const q of aceitas) {
      expect(q.enunciado).toContain("Reportagem sobre aparicoes aereas.");
    }
    // O comando da questao continua inteiro e depois do texto.
    expect(aceitas[0].enunciado.endsWith("One of the purposes of the text is")).toBe(true);
  });

  it("questao sem texto-base fica exatamente como veio", () => {
    const { aceitas } = validarBloco({
      textos_base: [{ id: "T1", conteudo: "Um texto qualquer." }],
      questoes: [questao({ enunciado: "Quanto e 2 + 2?" })],
    });
    expect(aceitas[0].enunciado).toBe("Quanto e 2 + 2?");
  });

  it("id que nao existe nao derruba a questao: ela entra sem o texto", () => {
    // O comando continua sendo o que a banca escreveu. Jogar fora o que ja foi
    // pago por causa de um rotulo errado seria pior.
    const { aceitas, recusadas } = validarBloco({
      textos_base: [],
      questoes: [questao({ texto_base_id: "T9", enunciado: "Comando da questao" })],
    });
    expect(recusadas).toEqual([]);
    expect(aceitas[0].enunciado).toBe("Comando da questao");
  });

  it("modelo que repetiu o texto assim mesmo nao gera enunciado com ele duas vezes", () => {
    const base = "Este e o texto-base completo da questao de interpretacao.";
    const { aceitas } = validarBloco({
      textos_base: [{ id: "T1", conteudo: base }],
      questoes: [questao({ texto_base_id: "T1", enunciado: base + " Qual a ideia central?" })],
    });
    expect(aceitas[0].enunciado.split("texto-base completo").length - 1).toBe(1);
  });

  it("resposta sem `textos_base` continua valendo", () => {
    // Bloco de pagina sem texto de leitura nenhum.
    const { aceitas } = validarBloco({ questoes: [questao()] });
    expect(aceitas).toHaveLength(1);
  });
});
describe("validarBloco — o conteudo que a saida estruturada nao garante", () => {
  it("aceita a questao inteira e a devolve tipada", () => {
    const { aceitas, recusadas } = validarBloco({ questoes: [questao()] });

    expect(recusadas).toEqual([]);
    expect(aceitas).toHaveLength(1);
    expect(aceitas[0].numero).toBe(12);
    expect(aceitas[0].topico_sugerido).toBe("Juros Compostos");
  });

  it("uma questao ruim nao derruba as irmas do mesmo bloco", () => {
    // O bloco ja foi pago. Descartar as boas por causa de uma torta jogaria
    // dinheiro fora e adiaria o acervo.
    const { aceitas, recusadas } = validarBloco({
      questoes: [
        questao({ numero: 1 }),
        questao({ numero: 2, confianca_ia: 4 }),
        questao({ numero: 3 }),
      ],
    });

    expect(aceitas.map((q) => q.numero)).toEqual([1, 3]);
    expect(recusadas).toHaveLength(1);
    expect(recusadas[0].numero).toBe(2);
    expect(recusadas[0].motivo).toContain("confianca_ia");
  });

  it("recusa certo-errado que veio com alternativas", () => {
    const { aceitas, recusadas } = validarBloco({
      questoes: [questao({ tipo_questao: "certo_errado" })],
    });

    expect(aceitas).toEqual([]);
    expect(recusadas[0].motivo).toContain("alternativas");
  });

  it("aceita certo-errado sem alternativas", () => {
    const { aceitas } = validarBloco({
      questoes: [questao({ tipo_questao: "certo_errado", alternativas: null })],
    });
    expect(aceitas).toHaveLength(1);
  });

  it("recusa letra de alternativa repetida", () => {
    // O CHECK do banco nao pega isto, e na tela seriam duas alternativas "A".
    const { recusadas } = validarBloco({
      questoes: [
        questao({
          alternativas: [
            { letra: "A", texto: "um" },
            { letra: "A", texto: "outro" },
          ],
        }),
      ],
    });
    expect(recusadas[0].motivo).toContain("repetida");
  });

  it("recusa questao truncada: meia questao no acervo parece inteira", () => {
    const { aceitas, recusadas } = validarBloco({
      questoes: [questao({ truncada: true })],
    });

    expect(aceitas).toEqual([]);
    expect(recusadas[0].motivo).toContain("truncada");
  });

  it("recusa numero zero ou negativo, e mantem o rastro de qual questao era", () => {
    const { recusadas } = validarBloco({ questoes: [questao({ numero: 0 })] });
    expect(recusadas[0].numero).toBe(0);
  });

  it("bloco sem questao nenhuma e resultado valido, nao erro", () => {
    // Pagina de instrucoes gerais no comeco da prova nao tem questao.
    expect(validarBloco({ questoes: [] })).toEqual({ aceitas: [], recusadas: [] });
  });

  it("resposta fora da forma { questoes: [...] } derruba o bloco inteiro", () => {
    // Aqui nao ha o que aproveitar: o bloco volta para a fila.
    expect(() => validarBloco({ texto: "nao consegui" })).toThrow(/inaproveitavel/);
    expect(() => validarBloco(null)).toThrow();
  });
});
