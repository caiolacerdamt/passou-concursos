import { normalizarNome } from "./classificacao";
import type { TopicoCanonico } from "./classificacao";
import type { PaginaDoPdf } from "./pdf";

/**
 * O trecho do programa do edital, e as quase-duplicatas do que ele nomeia
 * (RAIOX-07 · AD-140 · AD-145).
 *
 * Duas regras moram aqui, e as duas existem para que o agente veja **pouco**:
 *
 * 1. **So o programa vai a conversa.** O edital inteiro tem cronograma, regras
 *    de recurso, tabela de vagas e cem paginas que nao interessam — e cada uma
 *    delas seria reenviada a cada turno da sessao. O corte e local e por regra;
 *    quando a regra nao acha o programa com confianca, o fluxo marca pendencia
 *    em vez de mandar o documento todo "para o agente se virar".
 *
 * 2. **A quase-duplicata e calculada por codigo.** O agente propoe nomes; quem
 *    diz "isto se parece com o que ja existe" e uma conta deterministica, com
 *    limiar em configuracao. Fundir continua sendo decisao humana — o numero so
 *    escolhe o que vira pergunta.
 *
 * Nenhuma funcao deste arquivo chama modelo.
 */

// ── O corte do programa ─────────────────────────────────────────────────────

/**
 * Onde o programa comeca. Sao as formas que as bancas usam de fato — e nao um
 * padrao generico, que casaria com o sumario da capa.
 */
const INICIO_DO_PROGRAMA = [
  /conte[uú]do\s+program[aá]tico/i,
  /programa\s+das\s+disciplinas/i,
  /objetos?\s+de\s+conhecimento/i,
  /conhecimentos?\s+(b[aá]sicos|espec[ií]ficos)\s*[:\n]/i,
];

/**
 * Onde ele acaba. O fim e mais importante que o comeco: sem ele o "trecho"
 * viraria "do meio ate a ultima pagina", que e o documento inteiro de novo.
 */
const FIM_DO_PROGRAMA = [
  /cronograma\s+(previsto|do\s+concurso)/i,
  /dos?\s+recursos?\s*\n/i,
  /modelo\s+de\s+(requerimento|declara[cç][aã]o)/i,
  /disposi[cç][oõ]es\s+finais/i,
];

/** Teto do trecho, em caracteres. Programa real de banca cabe folgado. */
export const LIMITE_DO_TRECHO = 60_000;

/** Teto de paginas do trecho. Passou disto, o corte errou e nao vale. */
export const LIMITE_DE_PAGINAS = 40;

export type ProgramaExtraido =
  | {
      confiavel: true;
      trecho: string;
      paginaInicial: number;
      paginaFinal: number;
      caracteres: number;
      truncado: boolean;
    }
  | { confiavel: false; motivo: string };

/**
 * Recorta o programa do edital.
 *
 * Devolve `confiavel: false` — e nenhum texto — quando nao acha o inicio, ou
 * quando o que achou passa dos tetos. Nesses casos a pendencia e humana: alguem
 * abre o PDF e diz as paginas. E o lado seguro do erro, porque o lado inseguro
 * seria despejar o edital inteiro na conversa.
 */
export function extrairPrograma(paginas: readonly PaginaDoPdf[]): ProgramaExtraido {
  if (paginas.length === 0) return { confiavel: false, motivo: "o PDF nao deu texto" };

  const inicio = paginas.findIndex((pagina) =>
    INICIO_DO_PROGRAMA.some((padrao) => padrao.test(pagina.texto)),
  );
  if (inicio === -1) {
    return {
      confiavel: false,
      motivo: "nao achei o inicio do conteudo programatico por regra de texto",
    };
  }

  // O fim e procurado **depois** do inicio: "disposicoes finais" tambem aparece
  // no comeco do edital, e casar com aquela ocorrencia cortaria tudo.
  let fim = paginas.length - 1;
  for (let i = inicio + 1; i < paginas.length; i += 1) {
    if (FIM_DO_PROGRAMA.some((padrao) => padrao.test(paginas[i].texto))) {
      fim = i - 1 < inicio ? inicio : i - 1;
      break;
    }
  }

  if (fim - inicio + 1 > LIMITE_DE_PAGINAS) {
    return {
      confiavel: false,
      motivo: `o trecho ficou com ${fim - inicio + 1} paginas, acima do limite de ${LIMITE_DE_PAGINAS}`,
    };
  }

  const bruto = paginas
    .slice(inicio, fim + 1)
    .map((pagina) => pagina.texto)
    .join("\n");

  const truncado = bruto.length > LIMITE_DO_TRECHO;
  const trecho = truncado ? bruto.slice(0, LIMITE_DO_TRECHO) : bruto;

  if (trecho.trim().length === 0) {
    return { confiavel: false, motivo: "o trecho saiu vazio" };
  }

  return {
    confiavel: true,
    trecho,
    paginaInicial: paginas[inicio].numero,
    paginaFinal: paginas[fim].numero,
    caracteres: trecho.length,
    truncado,
  };
}

// ── A quase-duplicata ───────────────────────────────────────────────────────

/**
 * Similaridade de Dice sobre trigramas de caractere, no nome normalizado.
 *
 * Deterministica e sem dependencia: a mesma dupla de nomes da o mesmo numero
 * hoje e daqui a um ano, o que importa porque este numero decide o que vai a
 * pergunta do operador. "Regencia Verbal" x "Regencia verbal e nominal" fica
 * alto; "Crase" x "Juros Compostos" fica em zero.
 */
export function similaridade(a: string, b: string): number {
  const x = normalizarNome(a);
  const y = normalizarNome(b);
  if (x === "" || y === "") return 0;
  if (x === y) return 1;

  const trigramas = (texto: string): string[] => {
    // As bordas fazem nome curto ter trigrama: sem elas "crase" e "case"
    // comparariam quase nada.
    const acolchoado = `  ${texto} `;
    const saida: string[] = [];
    for (let i = 0; i < acolchoado.length - 2; i += 1) {
      saida.push(acolchoado.slice(i, i + 3));
    }
    return saida;
  };

  const deA = trigramas(x);
  const deB = new Map<string, number>();
  for (const t of trigramas(y)) deB.set(t, (deB.get(t) ?? 0) + 1);

  let comuns = 0;
  for (const t of deA) {
    const quantos = deB.get(t) ?? 0;
    if (quantos > 0) {
      comuns += 1;
      deB.set(t, quantos - 1);
    }
  }

  return (2 * comuns) / (deA.length + trigramas(y).length);
}

export type QuaseDuplicata = {
  topicoId: string;
  nome: string;
  materiaNome: string;
  similaridade: number;
};

/**
 * Os assuntos canonicos parecidos o bastante para virarem pergunta.
 *
 * O casamento **exato** e tratado antes, por `casarTopico`; o que sobra aqui e
 * o "quase". A lista sai ordenada da mais parecida para a menos, e limitada:
 * cinco candidatos ja e mais do que um humano compara numa linha.
 */
export const TETO_DE_CANDIDATOS = 5;

export function quaseDuplicatas(
  nomeProposto: string,
  catalogo: readonly TopicoCanonico[],
  limiar: number,
): QuaseDuplicata[] {
  return catalogo
    .map((topico) => ({
      topicoId: topico.id,
      nome: topico.nome,
      materiaNome: topico.materiaNome,
      similaridade: similaridade(nomeProposto, topico.nome),
    }))
    .filter((candidato) => candidato.similaridade >= limiar && candidato.similaridade < 1)
    .sort((a, b) => b.similaridade - a.similaridade || a.nome.localeCompare(b.nome))
    .slice(0, TETO_DE_CANDIDATOS);
}
