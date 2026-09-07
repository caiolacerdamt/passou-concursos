import { describe, expect, it } from "vitest";

import type { TopicoCanonico } from "./classificacao";
import type { PaginaDoPdf } from "./pdf";
import {
  LIMITE_DE_PAGINAS,
  LIMITE_DO_TRECHO,
  TETO_DE_CANDIDATOS,
  extrairPrograma,
  quaseDuplicatas,
  similaridade,
} from "./programa-edital";

function pagina(numero: number, texto: string): PaginaDoPdf {
  return { numero, texto, imagens: [] };
}

const EDITAL = [
  pagina(1, "EDITAL Nº 1 — ABERTURA DE INSCRIÇÕES\nDAS DISPOSIÇÕES PRELIMINARES\n"),
  pagina(2, "DAS VAGAS\nTabela de vagas por localidade.\n"),
  pagina(3, "ANEXO I — CONTEÚDO PROGRAMÁTICO\nLÍNGUA PORTUGUESA: 1 Crase. 2 Regência.\n"),
  pagina(4, "MATEMÁTICA FINANCEIRA: 1 Juros simples. 2 Juros compostos.\n"),
  pagina(5, "CRONOGRAMA PREVISTO\nInscrições: 10/01 a 30/01.\n"),
  pagina(6, "MODELO DE REQUERIMENTO\n"),
];

describe("o corte do programa do edital", () => {
  it("recorta do conteudo programatico ate a pagina antes do cronograma", () => {
    const programa = extrairPrograma(EDITAL);

    expect(programa.confiavel).toBe(true);
    if (!programa.confiavel) return;

    expect(programa.paginaInicial).toBe(3);
    expect(programa.paginaFinal).toBe(4);
    expect(programa.trecho).toContain("Crase");
    expect(programa.trecho).toContain("Juros compostos");

    // O que nao e programa fica FORA — e essa a metade do AD-140 que este
    // corte existe para cumprir.
    expect(programa.trecho).not.toContain("Tabela de vagas");
    expect(programa.trecho).not.toContain("CRONOGRAMA");
    expect(programa.trecho).not.toContain("REQUERIMENTO");
  });

  it("nao casa o fim com a ocorrencia que vem ANTES do programa", () => {
    // "Disposicoes finais" aparece cedo em quase todo edital. Casar com aquela
    // ocorrencia cortaria o programa inteiro.
    const comArmadilha = [
      pagina(1, "DAS DISPOSIÇÕES FINAIS E TRANSITÓRIAS\ntexto do comeco\n"),
      pagina(2, "ANEXO I — CONTEÚDO PROGRAMÁTICO\nLÍNGUA PORTUGUESA: 1 Crase.\n"),
      pagina(3, "CONHECIMENTOS BANCÁRIOS: 1 Produtos.\n"),
    ];
    const programa = extrairPrograma(comArmadilha);

    expect(programa.confiavel).toBe(true);
    if (!programa.confiavel) return;
    expect(programa.paginaInicial).toBe(2);
    expect(programa.paginaFinal).toBe(3);
    expect(programa.trecho).toContain("Produtos");
  });

  it("sem inicio reconhecivel vira PENDENCIA, e nao o documento inteiro", () => {
    const semPrograma = [pagina(1, "EDITAL\nDAS VAGAS\n"), pagina(2, "DAS INSCRIÇÕES\n")];
    const programa = extrairPrograma(semPrograma);

    expect(programa.confiavel).toBe(false);
    if (programa.confiavel) return;
    expect(programa.motivo).toMatch(/nao achei o inicio/);
    // Nenhum texto do edital sai junto com a pendencia.
    expect(JSON.stringify(programa)).not.toContain("INSCRIÇÕES");
  });

  it("PDF sem texto vira pendencia em vez de trecho vazio", () => {
    expect(extrairPrograma([])).toEqual({
      confiavel: false,
      motivo: "o PDF nao deu texto",
    });
  });

  it("trecho que estoura o limite de paginas e recusado, nao truncado em silencio", () => {
    const gigante = [
      pagina(1, "CONTEÚDO PROGRAMÁTICO\nassunto\n"),
      ...Array.from({ length: LIMITE_DE_PAGINAS + 5 }, (_, i) =>
        pagina(i + 2, `pagina ${i + 2} sem marcador de fim\n`),
      ),
    ];
    const programa = extrairPrograma(gigante);

    expect(programa.confiavel).toBe(false);
    if (programa.confiavel) return;
    expect(programa.motivo).toMatch(/acima do limite/);
  });

  it("trecho longo demais em caracteres e cortado no teto, e o corte fica visivel", () => {
    const denso = [
      pagina(1, `CONTEÚDO PROGRAMÁTICO\n${"a".repeat(LIMITE_DO_TRECHO + 500)}`),
      pagina(2, "CRONOGRAMA PREVISTO\n"),
    ];
    const programa = extrairPrograma(denso);

    expect(programa.confiavel).toBe(true);
    if (!programa.confiavel) return;
    expect(programa.caracteres).toBe(LIMITE_DO_TRECHO);
    expect(programa.truncado).toBe(true);
  });
});

describe("a similaridade que escolhe o que vira pergunta", () => {
  it("da 1 para o mesmo nome, sem ligar para acento nem caixa", () => {
    expect(similaridade("Crase", "crase")).toBe(1);
    expect(similaridade("Regência Verbal", "REGENCIA  VERBAL")).toBe(1);
  });

  it("da zero para nome vazio e para assuntos sem nada em comum", () => {
    expect(similaridade("", "Crase")).toBe(0);
    expect(similaridade("Crase", "Juros Compostos")).toBeLessThan(0.2);
  });

  it("poe o quase-igual acima do parecido, e o parecido acima do diferente", () => {
    const quase = similaridade("Regencia Verbal", "Regencia verbal e nominal");
    const parecido = similaridade("Juros Simples", "Juros Compostos");
    const diferente = similaridade("Crase", "Politica Monetaria");

    expect(quase).toBeGreaterThan(parecido);
    expect(parecido).toBeGreaterThan(diferente);
    expect(quase).toBeGreaterThan(0.6);
  });

  it("e simetrica e estavel: a mesma dupla da o mesmo numero", () => {
    expect(similaridade("Crase", "Crase e acento grave")).toBe(
      similaridade("Crase e acento grave", "Crase"),
    );
  });

  it("registra o que o limiar de 0,78 deixa passar e o que ele barra", () => {
    // **Medicao, nao decoracao.** O default de `param.m1.limiar_quase_duplicata`
    // entrou em 0,78 sem nada medido (Assumptions da SPEC 40). Estes numeros
    // sao os de duplas reais de nome de assunto, e mostram onde 0,78 cai:
    // ele pega a variacao de plural e DEIXA PASSAR os dois casos que mais
    // interessam ao operador. Quem calibrar a chave mexe no numero da
    // configuracao, sem deploy — e este teste diz o que muda quando mexer.
    const medidas = {
      pluralDaMesmaCoisa: similaridade("Politica Monetaria", "Politicas Monetarias"),
      umEstendeOOutro: similaridade("Produtos Bancarios", "Produtos e Servicos Bancarios"),
      mesmaRaizMaisEscopo: similaridade("Regencia Verbal", "Regencia Verbal e Nominal"),
      irmaosDiferentes: similaridade("Regencia Verbal", "Regencia Nominal"),
      semParentesco: similaridade("Juros Simples", "Juros Compostos"),
    };

    expect(medidas.pluralDaMesmaCoisa).toBeCloseTo(0.8, 2);
    expect(medidas.umEstendeOOutro).toBeCloseTo(0.776, 2);
    expect(medidas.mesmaRaizMaisEscopo).toBeCloseTo(0.762, 2);
    expect(medidas.irmaosDiferentes).toBeCloseTo(0.606, 2);
    expect(medidas.semParentesco).toBeCloseTo(0.4, 2);

    // A ordem entre elas e o que precisa continuar valendo, mesmo que os
    // numeros mudem: o parentesco forte fica acima do fraco.
    expect(medidas.pluralDaMesmaCoisa).toBeGreaterThan(medidas.irmaosDiferentes);
    expect(medidas.irmaosDiferentes).toBeGreaterThan(medidas.semParentesco);
  });
});

describe("as quase-duplicatas sao pergunta, nunca decisao", () => {
  const catalogo: TopicoCanonico[] = [
    { id: "t1", nome: "Regência Verbal", materiaId: "m1", materiaNome: "Português" },
    { id: "t2", nome: "Regência Nominal", materiaId: "m1", materiaNome: "Português" },
    { id: "t3", nome: "Crase", materiaId: "m1", materiaNome: "Português" },
    { id: "t4", nome: "Juros Compostos", materiaId: "m2", materiaNome: "Matemática" },
  ];

  it("devolve os parecidos acima do limiar, do mais parecido para o menos", () => {
    const achados = quaseDuplicatas("Regencia verbal e nominal", catalogo, 0.4);

    expect(achados.length).toBeGreaterThanOrEqual(2);
    expect(achados[0].topicoId).toBe("t1");
    expect(achados.map((a) => a.topicoId)).toContain("t2");
    expect(achados.map((a) => a.topicoId)).not.toContain("t4");
    // Ordenada de verdade, e nao pela ordem do catalogo.
    for (let i = 1; i < achados.length; i += 1) {
      expect(achados[i - 1].similaridade).toBeGreaterThanOrEqual(achados[i].similaridade);
    }
  });

  it("nao devolve o casamento EXATO: aquele e mapeamento, nao fusao", () => {
    // "Crase" ja casa por `casarTopico`; oferecer fusao com ele seria oferecer
    // ao operador fundir um assunto nele mesmo.
    expect(quaseDuplicatas("crase", catalogo, 0.4).map((a) => a.nome)).not.toContain("Crase");
  });

  it("limiar alto nao devolve nada — e isso e uma resposta, nao um erro", () => {
    expect(quaseDuplicatas("Regencia verbal e nominal", catalogo, 0.99)).toEqual([]);
  });

  it("nunca devolve mais candidatos do que um humano compara numa linha", () => {
    const muitos: TopicoCanonico[] = Array.from({ length: 30 }, (_, i) => ({
      id: `t${i}`,
      nome: `Regência Verbal ${i}`,
      materiaId: "m1",
      materiaNome: "Português",
    }));
    expect(quaseDuplicatas("Regencia Verbal", muitos, 0.3).length).toBeLessThanOrEqual(
      TETO_DE_CANDIDATOS,
    );
  });
});
