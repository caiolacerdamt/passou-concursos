import { deflateSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { PdfIlegivel, lerPdf, textoDoConteudo } from "./pdf";

/**
 * Os PDFs deste teste sao montados aqui, byte a byte.
 *
 * Nao ha PDF de prova real no repositorio — as provas oficiais ainda nao estao
 * na mao (pendencia externa da spec) e, quando estiverem, arquivo binario de
 * prova nao entra no git. O que precisa ser testado tambem nao e "uma prova":
 * e o formato PDF. Montar o arquivo aqui deixa cada teste escolher exatamente o
 * defeito que quer provar — sem texto, comprimido, arvore de paginas invertida.
 */

type ObjetoDeTeste = { numero: number; corpo: string; stream?: Buffer };

function montarPdf(objetos: ObjetoDeTeste[], raiz = 1): Buffer {
  const pedacos: Buffer[] = [Buffer.from("%PDF-1.7\n", "latin1")];

  for (const objeto of objetos) {
    pedacos.push(Buffer.from(`${objeto.numero} 0 obj\n${objeto.corpo}\n`, "latin1"));
    if (objeto.stream !== undefined) {
      pedacos.push(Buffer.from("stream\n", "latin1"));
      pedacos.push(objeto.stream);
      pedacos.push(Buffer.from("\nendstream\n", "latin1"));
    }
    pedacos.push(Buffer.from("endobj\n", "latin1"));
  }

  pedacos.push(Buffer.from(`trailer\n<< /Root ${raiz} 0 R >>\n%%EOF\n`, "latin1"));
  return Buffer.concat(pedacos);
}

/** Um fluxo de conteudo que escreve as linhas dadas. */
function conteudo(linhas: string[]): Buffer {
  const corpo = linhas
    .map((linha) => `BT /F1 12 Tf (${linha.replace(/([()\\])/g, "\\$1")}) Tj ET`)
    .join("\n");
  return Buffer.from(corpo, "latin1");
}

/** Uma prova de N paginas, cada uma com o texto que se pediu. */
function provaDeTeste(
  paginas: string[][],
  opcoes: { comprimir?: boolean } = {},
): Buffer {
  const objetos: ObjetoDeTeste[] = [];
  const idsDasPaginas = paginas.map((_, indice) => 3 + indice * 2);

  objetos.push({ numero: 1, corpo: "<< /Type /Catalog /Pages 2 0 R >>" });
  objetos.push({
    numero: 2,
    corpo: `<< /Type /Pages /Count ${paginas.length} /Kids [${idsDasPaginas
      .map((id) => `${id} 0 R`)
      .join(" ")}] >>`,
  });

  paginas.forEach((linhas, indice) => {
    const idDaPagina = idsDasPaginas[indice];
    const idDoConteudo = idDaPagina + 1;
    const cru = conteudo(linhas);
    const stream = opcoes.comprimir ? deflateSync(cru) : cru;

    objetos.push({
      numero: idDaPagina,
      corpo: `<< /Type /Page /Parent 2 0 R /Contents ${idDoConteudo} 0 R >>`,
    });
    objetos.push({
      numero: idDoConteudo,
      corpo: `<< /Length ${stream.length}${opcoes.comprimir ? " /Filter /FlateDecode" : ""} >>`,
      stream,
    });
  });

  return montarPdf(objetos);
}

describe("lerPdf — texto nativo (BANCO-12 AC3)", () => {
  it("le o texto de cada pagina, na ordem da arvore de paginas", () => {
    const pdf = provaDeTeste([
      ["QUESTAO 1", "Qual e o valor do montante?"],
      ["QUESTAO 2", "Assinale a alternativa correta."],
    ]);

    const lido = lerPdf(pdf);

    expect(lido.totalDePaginas).toBe(2);
    expect(lido.temTextoNativo).toBe(true);
    expect(lido.paginas[0].numero).toBe(1);
    expect(lido.paginas[0].texto).toContain("QUESTAO 1");
    expect(lido.paginas[0].texto).toContain("Qual e o valor do montante?");
    expect(lido.paginas[1].texto).toContain("QUESTAO 2");
    // A pagina 2 nao vaza para a 1: fatiar depende de a fronteira ser real.
    expect(lido.paginas[0].texto).not.toContain("QUESTAO 2");
  });

  it("le stream comprimido com Flate igual ao sem compressao", () => {
    const cru = lerPdf(provaDeTeste([["QUESTAO 7", "Juros compostos"]]));
    const comprimido = lerPdf(
      provaDeTeste([["QUESTAO 7", "Juros compostos"]], { comprimir: true }),
    );

    expect(comprimido.paginas[0].texto).toBe(cru.paginas[0].texto);
    expect(comprimido.temTextoNativo).toBe(true);
  });

  it("PDF sem operador de texto nenhum e escaneado", () => {
    // Uma pagina que so desenha um retangulo: e o que um scanner produz quando
    // a imagem cobre a folha inteira.
    const semTexto = montarPdf([
      { numero: 1, corpo: "<< /Type /Catalog /Pages 2 0 R >>" },
      { numero: 2, corpo: "<< /Type /Pages /Count 1 /Kids [3 0 R] >>" },
      { numero: 3, corpo: "<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>" },
      {
        numero: 4,
        corpo: "<< /Length 30 >>",
        stream: Buffer.from("0 0 612 792 re f", "latin1"),
      },
    ]);

    const lido = lerPdf(semTexto);

    expect(lido.totalDePaginas).toBe(1);
    expect(lido.temTextoNativo).toBe(false);
    expect(lido.paginas[0].texto).toBe("");
  });

  it("segue a arvore de paginas mesmo com os objetos fora de ordem no arquivo", () => {
    // Os objetos aparecem invertidos no arquivo; `/Kids` diz a ordem certa.
    const conteudoA = conteudo(["PAGINA A"]);
    const conteudoB = conteudo(["PAGINA B"]);
    const pdf = montarPdf([
      { numero: 1, corpo: "<< /Type /Catalog /Pages 2 0 R >>" },
      { numero: 2, corpo: "<< /Type /Pages /Count 2 /Kids [7 0 R 5 0 R] >>" },
      { numero: 5, corpo: "<< /Type /Page /Parent 2 0 R /Contents 6 0 R >>" },
      { numero: 6, corpo: "<< /Length 1 >>", stream: conteudoB },
      { numero: 7, corpo: "<< /Type /Page /Parent 2 0 R /Contents 8 0 R >>" },
      { numero: 8, corpo: "<< /Length 1 >>", stream: conteudoA },
    ]);

    const lido = lerPdf(pdf);

    expect(lido.paginas.map((p) => p.texto.trim())).toEqual([
      "PAGINA A",
      "PAGINA B",
    ]);
  });

  it("arquivo que nao e PDF e parada visivel, nao documento vazio", () => {
    expect(() => lerPdf(Buffer.from("nao sou um pdf", "latin1"))).toThrow(
      PdfIlegivel,
    );
    // Um PDF de verdade, mas sem pagina nenhuma, tambem para: devolver zero
    // paginas em silencio faria a prova ser marcada como extraida sem questao.
    expect(() =>
      lerPdf(montarPdf([{ numero: 1, corpo: "<< /Type /Catalog >>" }])),
    ).toThrow(PdfIlegivel);
  });
});

describe("lerPdf — imagens (BANCO-11 AC4)", () => {
  /** Um JPEG minimo: assinatura, marcador de fim. So os bytes importam aqui. */
  const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]);

  function provaComImagem(filtro: string): Buffer {
    const fluxo = conteudo(["QUESTAO 3 — observe o grafico"]);
    return montarPdf([
      { numero: 1, corpo: "<< /Type /Catalog /Pages 2 0 R >>" },
      { numero: 2, corpo: "<< /Type /Pages /Count 1 /Kids [3 0 R] >>" },
      {
        numero: 3,
        corpo:
          "<< /Type /Page /Parent 2 0 R /Contents 4 0 R /Resources 5 0 R >>",
      },
      { numero: 4, corpo: "<< /Length 1 >>", stream: fluxo },
      { numero: 5, corpo: "<< /XObject << /Im0 6 0 R >> >>" },
      {
        numero: 6,
        corpo: `<< /Type /XObject /Subtype /Image /Width 10 /Height 10 /Filter /${filtro} /Length ${JPEG.length} >>`,
        stream: JPEG,
      },
    ]);
  }

  it("entrega o JPEG da pagina pronto para subir ao Storage", () => {
    const lido = lerPdf(provaComImagem("DCTDecode"));

    expect(lido.paginas[0].imagens).toHaveLength(1);
    expect(lido.paginas[0].imagens[0].nome).toBe("Im0");
    expect(lido.paginas[0].imagens[0].jpeg.subarray(0, 2)).toEqual(
      Buffer.from([0xff, 0xd8]),
    );
    // O texto da pagina continua saindo: imagem nao substitui enunciado.
    expect(lido.paginas[0].texto).toContain("QUESTAO 3");
  });

  it("stream binario que contem os bytes de 'endstream' nao e cortado no meio", () => {
    // Um JPEG de verdade tem bytes arbitrarios; a sequencia pode aparecer por
    // acaso. Cortar ali entregaria meia imagem ao Storage sem nenhum sinal.
    const traicoeiro = Buffer.concat([
      Buffer.from([0xff, 0xd8]),
      Buffer.from("endstream", "latin1"),
      Buffer.from([0xff, 0xd9]),
    ]);
    const pdf = montarPdf([
      { numero: 1, corpo: "<< /Type /Catalog /Pages 2 0 R >>" },
      { numero: 2, corpo: "<< /Type /Pages /Count 1 /Kids [3 0 R] >>" },
      {
        numero: 3,
        corpo: "<< /Type /Page /Parent 2 0 R /Contents 4 0 R /Resources 5 0 R >>",
      },
      { numero: 4, corpo: "<< /Length 1 >>", stream: conteudo(["QUESTAO 3"]) },
      { numero: 5, corpo: "<< /XObject << /Im0 6 0 R >> >>" },
      {
        numero: 6,
        corpo: `<< /Type /XObject /Subtype /Image /Filter /DCTDecode /Length ${traicoeiro.length} >>`,
        stream: traicoeiro,
      },
    ]);

    expect(lerPdf(pdf).paginas[0].imagens[0].jpeg).toEqual(traicoeiro);
  });

  it("imagem que nao e JPEG nao sai da lista", () => {
    // Bitmap inflado precisaria de um codificador PNG. A questao que dependia
    // dele vai para revisao — quem decide isso e `ingestao.ts`, e a entrada
    // dessa decisao e esta lista vir vazia.
    const lido = lerPdf(provaComImagem("FlateDecode"));
    expect(lido.paginas[0].imagens).toEqual([]);
  });
});

describe("textoDoConteudo", () => {
  it("junta os pedacos de um array TJ numa palavra so", () => {
    // `TJ` parte a palavra para ajustar espacamento; juntar com separador
    // devolveria "MON TAN TE" ao modelo.
    const fluxo = Buffer.from("BT [(MON) -20 (TAN) -20 (TE)] TJ ET", "latin1");
    expect(textoDoConteudo(fluxo)).toBe("MONTANTE");
  });

  it("decodifica string hexadecimal e escape de parentese", () => {
    expect(textoDoConteudo(Buffer.from("<48656C6C6F> Tj", "latin1"))).toBe("Hello");
    expect(textoDoConteudo(Buffer.from("(a \\(b\\) c) Tj", "latin1"))).toBe("a (b) c");
  });

  it("fluxo sem operador de texto devolve string vazia", () => {
    expect(textoDoConteudo(Buffer.from("1 0 0 1 50 700 cm", "latin1"))).toBe("");
  });
});
