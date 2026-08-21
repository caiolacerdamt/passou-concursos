import { inflateSync } from "node:zlib";

/**
 * O leitor **minimo** de PDF da fabrica (BANCO-12 AC3, BANCO-11 AC4).
 *
 * Ele responde a tres perguntas, e a nenhuma outra:
 *
 * 1. **Este PDF tem texto nativo?** E a pergunta do BANCO-12: sem texto nativo a
 *    prova cai em `precisa_ocr` e nao e extraida no MVP. So da para responder
 *    isso tentando ler — nao existe atalho.
 * 2. **Qual e o texto de cada pagina?** E o que vai ao modelo, fatiado em blocos
 *    (IA-17). Pagina e a unidade porque e a unica fronteira que o PDF entrega de
 *    graca; a fronteira de questao quem enxerga e o modelo.
 * 3. **Que imagens esta pagina carrega?** So `DCTDecode` (JPEG), cujo `stream` ja
 *    e um arquivo JPEG pronto. Bitmap inflado exigiria um codificador PNG, e o
 *    M1 ja diz o que fazer quando a imagem nao sai: a questao vai para revisao.
 *
 * **Nao ha dependencia nova.** Um parser de PDF de verdade seria uma industria
 * no caminho critico de um produto que ingere 3-4 provas. O que este arquivo
 * cobre e o PDF que uma banca publica: objetos diretos, `FlateDecode` ou sem
 * filtro, arvore de paginas normal.
 *
 * **Limite conhecido e aceito:** o texto sai decodificado como Latin-1, que e o
 * que `WinAnsiEncoding` produz na pratica. Fonte com codificacao propria sai com
 * acento torto — e o modelo, que le a prova inteira, corrige no enunciado. Fonte
 * assim inteira viraria "sem texto nativo" e cairia em `precisa_ocr`, que e o
 * lado seguro do erro.
 */

/** Uma pagina lida. `numero` e 1-based, como o leitor humano conta. */
export type PaginaDoPdf = {
  numero: number;
  texto: string;
  imagens: ImagemDoPdf[];
};

export type ImagemDoPdf = {
  /** O nome do XObject no PDF (`Im0`), so para rastrear de onde saiu. */
  nome: string;
  /** Bytes de um arquivo JPEG completo. */
  jpeg: Buffer;
};

export type PdfLido = {
  paginas: PaginaDoPdf[];
  /** Quantas paginas o PDF declarou, mesmo as que nao deram texto. */
  totalDePaginas: number;
  /**
   * Alguma pagina entregou texto? `false` = escaneada, e o job para em
   * `precisa_ocr` sem chamar modelo nenhum (BANCO-12 AC3).
   */
  temTextoNativo: boolean;
};

/** O PDF nao e um PDF, ou esta cortado. Parada visivel, nunca "zero paginas". */
export class PdfIlegivel extends Error {
  constructor(motivo: string) {
    super(`nao deu para ler o PDF: ${motivo}`);
    this.name = "PdfIlegivel";
  }
}

type ObjetoBruto = { dicionario: string; conteudo: Buffer | null };

const ASSINATURA = "%PDF-";

/**
 * Todo objeto `N 0 obj ... endobj` do arquivo, por numero.
 *
 * A varredura e sequencial e ignora a tabela `xref` de proposito: `xref`
 * quebrado e o defeito mais comum de PDF gerado por scanner ou por ferramenta
 * de recorte, e nada aqui precisa dela.
 */
function indexarObjetos(bruto: Buffer): Map<number, ObjetoBruto> {
  const texto = bruto.toString("latin1");
  const objetos = new Map<number, ObjetoBruto>();
  const abertura = /(\d+)\s+(\d+)\s+obj\b/g;

  let achado: RegExpExecArray | null;
  while ((achado = abertura.exec(texto)) !== null) {
    const numero = Number(achado[1]);
    const inicio = achado.index + achado[0].length;
    const fim = texto.indexOf("endobj", inicio);
    if (fim === -1) continue;

    const corpo = texto.slice(inicio, fim);
    const marcaDoStream = corpo.indexOf("stream");

    if (marcaDoStream === -1) {
      objetos.set(numero, { dicionario: corpo, conteudo: null });
      continue;
    }

    const dicionario = corpo.slice(0, marcaDoStream);
    // Depois de `stream` vem CRLF ou LF, e o byte seguinte ja e conteudo.
    let comeco = inicio + marcaDoStream + "stream".length;
    if (texto[comeco] === "\r") comeco += 1;
    if (texto[comeco] === "\n") comeco += 1;

    // `/Length` primeiro: um `stream` binario pode conter os bytes de
    // "endstream" por acaso, e ai procurar pelo texto cortaria a imagem no meio.
    // Mas `/Length` so vale **conferido**: um valor errado no dicionario e
    // defeito comum de PDF remontado, e confiar nele cortaria o conteudo no meio
    // sem nenhum sinal. Vale quando o que vem logo depois e mesmo `endstream`.
    const declarado = Number(/\/Length\s+(\d+)\b/.exec(dicionario)?.[1] ?? NaN);
    const porBusca = texto.indexOf("endstream", comeco);
    const confere =
      Number.isFinite(declarado) &&
      /^\s*endstream/.test(texto.slice(comeco + declarado, comeco + declarado + 12));

    const fimDoStream = confere
      ? comeco + declarado
      : porBusca === -1
        ? fim
        : porBusca;

    const conteudo = bruto.subarray(comeco, fimDoStream);

    objetos.set(numero, { dicionario, conteudo: aplicarFiltro(dicionario, conteudo) });
  }

  return objetos;
}

/**
 * Descomprime o `stream` quando o filtro e o Flate.
 *
 * Filtro desconhecido devolve `null`: melhor a pagina nao dar texto — e a prova
 * cair em `precisa_ocr` — do que mandar bytes comprimidos ao modelo como se
 * fossem enunciado.
 */
function aplicarFiltro(dicionario: string, conteudo: Buffer): Buffer | null {
  const filtro = /\/Filter\s*\/(\w+)/.exec(dicionario)?.[1];

  if (filtro === undefined) return conteudo;
  if (filtro === "FlateDecode") {
    try {
      return inflateSync(conteudo);
    } catch {
      return null;
    }
  }
  // DCTDecode e imagem: o `stream` ja e o JPEG, e quem cuida dele e
  // `imagensDaPagina`. Aqui devolver cru e o certo.
  if (filtro === "DCTDecode") return conteudo;
  return null;
}

function referencia(dicionario: string, chave: string): number | null {
  const achado = new RegExp(`/${chave}\\s+(\\d+)\\s+\\d+\\s+R`).exec(dicionario);
  return achado === null ? null : Number(achado[1]);
}

function referenciasDoArray(trecho: string): number[] {
  return [...trecho.matchAll(/(\d+)\s+\d+\s+R/g)].map((achado) => Number(achado[1]));
}

/**
 * As paginas na ordem em que o documento as declara.
 *
 * A ordem sai da arvore `/Root -> /Pages -> /Kids`, e nao da ordem dos objetos
 * no arquivo: PDF montado por juncao de arquivos costuma ter os objetos fora de
 * ordem, e o edge case do M1 ("numeracao fora de ordem") ja e problema demais
 * para a ordem das paginas tambem estar errada. Sem arvore legivel, a ordem dos
 * objetos e o melhor palpite que sobra.
 */
function ordemDasPaginas(
  bruto: Buffer,
  objetos: Map<number, ObjetoBruto>,
): number[] {
  const texto = bruto.toString("latin1");
  const raiz = referencia(texto.slice(texto.lastIndexOf("trailer")), "Root");
  const paginasDoCatalogo =
    raiz === null ? null : referencia(objetos.get(raiz)?.dicionario ?? "", "Pages");

  const ordenadas: number[] = [];
  const visitados = new Set<number>();

  const descer = (numero: number): void => {
    if (visitados.has(numero)) return;
    visitados.add(numero);

    const objeto = objetos.get(numero);
    if (objeto === undefined) return;

    if (/\/Type\s*\/Page\b/.test(objeto.dicionario)) {
      ordenadas.push(numero);
      return;
    }

    const kids = /\/Kids\s*\[([^\]]*)\]/.exec(objeto.dicionario);
    if (kids === null) return;
    for (const filho of referenciasDoArray(kids[1])) descer(filho);
  };

  if (paginasDoCatalogo !== null) descer(paginasDoCatalogo);
  if (ordenadas.length > 0) return ordenadas;

  return [...objetos.entries()]
    .filter(([, objeto]) => /\/Type\s*\/Page\b/.test(objeto.dicionario))
    .map(([numero]) => numero)
    .sort((a, b) => a - b);
}

/** Os operadores de texto do PDF: `Tj`, `TJ`, `'` e `"`. */
const OPERADOR_DE_TEXTO = /\((?:\\.|[^\\()])*\)|<[0-9A-Fa-f\s]*>|\bT[jJ]\b|'|"/g;

function decodificarLiteral(cru: string): string {
  return cru
    .slice(1, -1)
    .replace(/\\([nrtbf()\\]|\d{1,3})/g, (inteiro, escape: string) => {
      const simples: Record<string, string> = {
        n: "\n",
        r: "\r",
        t: "\t",
        b: "\b",
        f: "\f",
        "(": "(",
        ")": ")",
        "\\": "\\",
      };
      if (escape in simples) return simples[escape];
      const octal = Number.parseInt(escape, 8);
      return Number.isNaN(octal) ? inteiro : String.fromCharCode(octal);
    });
}

function decodificarHex(cru: string): string {
  const digitos = cru.slice(1, -1).replace(/\s/g, "");
  const pares = digitos.match(/.{1,2}/g) ?? [];
  return pares
    .map((par) => String.fromCharCode(Number.parseInt(par.padEnd(2, "0"), 16)))
    .join("");
}

/**
 * O texto que os operadores de exibicao do fluxo de conteudo mostram.
 *
 * Sem posicionamento: nao interessa **onde** na pagina o texto esta, interessa
 * **o que** esta escrito. Quem monta a questao a partir disso e o modelo, e ele
 * le a pagina inteira de uma vez.
 */
export function textoDoConteudo(conteudo: Buffer): string {
  const fluxo = conteudo.toString("latin1");
  const pendentes: string[] = [];
  const saida: string[] = [];

  for (const achado of fluxo.matchAll(OPERADOR_DE_TEXTO)) {
    const pedaco = achado[0];

    if (pedaco.startsWith("(")) {
      pendentes.push(decodificarLiteral(pedaco));
      continue;
    }
    if (pedaco.startsWith("<")) {
      pendentes.push(decodificarHex(pedaco));
      continue;
    }
    if (pendentes.length === 0) continue;

    // `TJ` recebe um array com os pedacos e os ajustes de espacamento; juntar
    // sem separador e o que reconstroi a palavra que o ajuste partiu.
    saida.push(pendentes.join(""));
    pendentes.length = 0;
    // `'` e `"` comecam linha nova.
    if (pedaco === "'" || pedaco === '"') saida.push("\n");
  }

  return saida.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function conteudoDaPagina(
  dicionario: string,
  objetos: Map<number, ObjetoBruto>,
): Buffer {
  const direta = referencia(dicionario, "Contents");
  const numeros =
    direta !== null
      ? [direta]
      : referenciasDoArray(/\/Contents\s*\[([^\]]*)\]/.exec(dicionario)?.[1] ?? "");

  const pedacos = numeros
    .map((numero) => objetos.get(numero)?.conteudo)
    .filter((pedaco): pedaco is Buffer => pedaco != null);

  return Buffer.concat(pedacos.length === 0 ? [Buffer.alloc(0)] : pedacos);
}

function imagensDaPagina(
  dicionario: string,
  objetos: Map<number, ObjetoBruto>,
): ImagemDoPdf[] {
  const recursos = referencia(dicionario, "Resources");
  const textoDosRecursos =
    recursos === null
      ? dicionario
      : (objetos.get(recursos)?.dicionario ?? dicionario);

  const bloco = /\/XObject\s*<<([^>]*)>>/.exec(textoDosRecursos);
  if (bloco === null) return [];

  const imagens: ImagemDoPdf[] = [];
  for (const achado of bloco[1].matchAll(/\/(\w+)\s+(\d+)\s+\d+\s+R/g)) {
    const objeto = objetos.get(Number(achado[2]));
    if (objeto === undefined || objeto.conteudo === null) continue;
    if (!/\/Subtype\s*\/Image\b/.test(objeto.dicionario)) continue;
    // So JPEG. Qualquer outro filtro sai desta lista, e a questao que dependia
    // dele cai em revisao — que e o que o M1 manda fazer com imagem que nao saiu.
    if (!/\/Filter\s*\/DCTDecode\b/.test(objeto.dicionario)) continue;

    imagens.push({ nome: achado[1], jpeg: Buffer.from(objeto.conteudo) });
  }
  return imagens;
}

/**
 * Le um PDF inteiro.
 *
 * @throws {PdfIlegivel} nao comeca com `%PDF-`, ou nao tem pagina nenhuma
 */
export function lerPdf(bruto: Buffer): PdfLido {
  if (bruto.subarray(0, ASSINATURA.length).toString("latin1") !== ASSINATURA) {
    throw new PdfIlegivel("o arquivo nao comeca com %PDF-");
  }

  const objetos = indexarObjetos(bruto);
  const ordem = ordemDasPaginas(bruto, objetos);
  if (ordem.length === 0) {
    throw new PdfIlegivel("nenhuma pagina foi encontrada no documento");
  }

  const paginas = ordem.map((numeroDoObjeto, indice) => {
    const dicionario = objetos.get(numeroDoObjeto)?.dicionario ?? "";
    return {
      numero: indice + 1,
      texto: textoDoConteudo(conteudoDaPagina(dicionario, objetos)),
      imagens: imagensDaPagina(dicionario, objetos),
    };
  });

  return {
    paginas,
    totalDePaginas: paginas.length,
    temTextoNativo: paginas.some((pagina) => pagina.texto.length > 0),
  };
}
