import type { ReactNode } from "react";

/**
 * O enunciado do acervo é texto com marcação, não HTML.
 *
 * O importador junta os blocos da prova (`texto_base`, parágrafos, tabela) e o
 * comando da questão num campo só, separados por linha em branco — e o texto
 * original da banca traz `**negrito**` no título do texto de apoio e no trecho
 * em destaque. Até aqui a tela imprimia a marcação crua ("**Povos da
 * floresta.**"), que é o mesmo que não formatar.
 *
 * A correção é um **conjunto fechado** de marcas, interpretado por este módulo
 * e renderizado como elemento React. Não entra biblioteca de markdown e não
 * existe `dangerouslySetInnerHTML`: enunciado de prova é dado de terceiro que
 * atravessa OCR e IA, e liberar HTML aí é abrir injeção numa superfície que o
 * aluno lê logado. O que estiver fora da lista sai como texto literal, que é o
 * pior caso aceitável — nunca uma tag executada.
 *
 * A lista:
 *
 *   - `**negrito**` e `*itálico*`;
 *   - linha em branco separa parágrafo;
 *   - `- ` (ou `• `) abre lista com marcador;
 *   - `1.` / `I.` abre lista numerada — o formato de asserção da Cesgranrio.
 *
 * `* ` **não** abre lista: colidiria com o itálico, e o acervo usa `- `.
 */

const MARCADOR = /^[-•]\s+/;
const NUMERADA = /^(\d{1,2}|[IVX]{1,5})[.)]\s+/;

export type EnunciadoSeparado = {
  /** Blocos que vieram antes do comando: texto de apoio, tabela, fórmula. */
  apoio: readonly string[];
  /** A pergunta em si — sempre o último bloco. */
  comando: string;
};

/**
 * Separa o texto de apoio do comando.
 *
 * O importador (`enunciadoComBlocos`) empilha os blocos e coloca o comando da
 * banca por último, com linha em branco entre eles. É por isso que "o último
 * parágrafo é a pergunta" não é chute: é o formato que a nossa própria
 * ingestão grava. Questão sem texto de apoio tem um bloco só, e aí `apoio` vem
 * vazio — não existe apoio vazio para esconder.
 */
export function separarEnunciado(enunciado: string): EnunciadoSeparado {
  const blocos = enunciado
    .split(/\n\s*\n/)
    .map((bloco) => bloco.trim())
    .filter((bloco) => bloco !== "");

  if (blocos.length === 0) return { apoio: [], comando: enunciado.trim() };
  const comando = blocos[blocos.length - 1] as string;
  return { apoio: blocos.slice(0, -1), comando };
}

/** Renderiza um trecho de enunciado com as marcas da lista fechada. */
export function TextoFormatado({
  texto,
  className,
}: {
  texto: string;
  className?: string;
}) {
  const blocos = blocosDoTexto(texto);
  if (blocos.length === 0) return null;

  return (
    <div className={className ?? "grid gap-3"}>
      {blocos.map((bloco, indice) => (
        <Bloco key={indice} bloco={bloco} />
      ))}
    </div>
  );
}

type Bloco =
  | { tipo: "paragrafo"; linhas: readonly string[] }
  | { tipo: "marcador" | "numerada"; itens: readonly string[] };

function Bloco({ bloco }: { bloco: Bloco }) {
  if (bloco.tipo === "paragrafo") {
    return (
      <p>
        {bloco.linhas.map((linha, indice) => (
          <span key={indice}>
            {indice > 0 ? <br /> : null}
            <Inline texto={linha} />
          </span>
        ))}
      </p>
    );
  }

  const itens = bloco.itens.map((item, indice) => (
    <li key={indice} className="pl-1">
      <Inline texto={item} />
    </li>
  ));

  return bloco.tipo === "marcador" ? (
    <ul className="grid list-disc gap-1.5 pl-5">{itens}</ul>
  ) : (
    <ol className="grid list-decimal gap-1.5 pl-5">{itens}</ol>
  );
}

function blocosDoTexto(texto: string): readonly Bloco[] {
  const blocos: Bloco[] = [];

  for (const pedaco of texto.split(/\n\s*\n/)) {
    const linhas = pedaco.split("\n").map((linha) => linha.trim()).filter((linha) => linha !== "");
    if (linhas.length === 0) continue;

    let acumulado: string[] = [];
    let lista: { tipo: "marcador" | "numerada"; itens: string[] } | null = null;

    const fecharParagrafo = () => {
      if (acumulado.length === 0) return;
      blocos.push({ tipo: "paragrafo", linhas: acumulado });
      acumulado = [];
    };
    const fecharLista = () => {
      if (lista === null) return;
      blocos.push({ tipo: lista.tipo, itens: lista.itens });
      lista = null;
    };

    for (const linha of linhas) {
      const tipo = MARCADOR.test(linha) ? "marcador" : NUMERADA.test(linha) ? "numerada" : null;

      if (tipo === null) {
        fecharLista();
        acumulado.push(linha);
        continue;
      }

      fecharParagrafo();
      const item = linha.replace(tipo === "marcador" ? MARCADOR : NUMERADA, "");
      if (lista !== null && lista.tipo === tipo) {
        lista.itens.push(item);
      } else {
        fecharLista();
        lista = { tipo, itens: [item] };
      }
    }

    fecharParagrafo();
    fecharLista();
  }

  return blocos;
}

/**
 * Negrito e itálico dentro da linha.
 *
 * O varredor anda uma vez pelo texto e trata `**` antes de `*`, senão
 * `**negrito**` viraria itálico de um asterisco solto. Marca aberta e não
 * fechada permanece literal: um asterisco perdido no OCR não pode engolir o
 * resto do enunciado.
 */
function Inline({ texto }: { texto: string }) {
  const partes: ReactNode[] = [];
  let resto = texto;
  let chave = 0;

  while (resto !== "") {
    const negrito = resto.match(/\*\*([\s\S]+?)\*\*/);
    const italico = resto.match(/(?<!\*)\*(?!\*)([\s\S]+?)(?<!\*)\*(?!\*)/);
    const inicio = (marca: RegExpMatchArray | null): number =>
      marca === null || marca.index === undefined ? Number.POSITIVE_INFINITY : marca.index;
    const eNegrito = inicio(negrito) <= inicio(italico);
    const escolhido = eNegrito ? negrito : italico;

    if (escolhido === null || escolhido.index === undefined) {
      partes.push(resto);
      break;
    }

    if (escolhido.index > 0) partes.push(resto.slice(0, escolhido.index));
    const conteudo = escolhido[1] as string;
    partes.push(
      eNegrito ? (
        <strong key={chave} className="font-semibold">
          {conteudo}
        </strong>
      ) : (
        <em key={chave}>{conteudo}</em>
      ),
    );
    chave += 1;
    resto = resto.slice(escolhido.index + escolhido[0].length);
  }

  return <>{partes}</>;
}
