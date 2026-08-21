import { z } from "zod";

import type { ClienteSql } from "@/modules/ia";

import { LETRAS } from "./contrato";

/**
 * O gabarito definitivo (BANCO-04).
 *
 * A regra de fundo e o invariante nº4: **a verdade e o gabarito oficial**, nunca
 * o que o modelo achou. Por isso o gabarito e um arquivo separado, lido de um
 * ato oficial da banca, e entra por um caminho que a extracao nao alcanca.
 *
 * `gabarito_versao` nao e enfeite: e o que distingue o preliminar do definitivo
 * e o que registra a retificacao. Gabarito sem versao e recusado — sem ela, uma
 * retificacao seria indistinguivel de rodar o mesmo arquivo duas vezes.
 */

const RESPOSTAS = [...LETRAS, "C", "E"] as const;

export type ItemDoGabarito = {
  numero: number;
  /** `null` quando a questao foi anulada e a banca nao publicou letra. */
  resposta: string | null;
  anulada: boolean;
};

export type Gabarito = {
  versao: string;
  itens: ItemDoGabarito[];
};

/** O arquivo nao serve. Parada visivel: gabarito errado ensina errado. */
export class GabaritoInvalido extends Error {
  constructor(motivo: string) {
    super(`gabarito recusado: ${motivo}`);
    this.name = "GabaritoInvalido";
  }
}

const itemSchema = z
  .object({
    numero: z.number().int().positive(),
    resposta: z.enum(RESPOSTAS).nullable().optional(),
    anulada: z.boolean().optional(),
  })
  .transform((item) => ({
    numero: item.numero,
    resposta: item.resposta ?? null,
    anulada: item.anulada ?? false,
  }))
  .refine(
    (item) => item.anulada || item.resposta !== null,
    "questao nao anulada precisa de resposta",
  );

const arquivoJsonSchema = z.object({
  versao: z.string().trim().min(1).optional(),
  itens: z.array(z.unknown()),
});

/**
 * Le o arquivo de gabarito, em JSON ou CSV.
 *
 * Os dois formatos existem porque a banca publica PDF e alguem transcreve: CSV
 * e o que sai de uma planilha em trinta segundos, e JSON e o que um script
 * produz. Recusar um dos dois so faria a transcricao acontecer num editor de
 * texto, que e onde o erro mora.
 *
 * @throws {GabaritoInvalido} sem versao, sem item, ou com item fora do contrato
 */
export function lerGabarito(
  conteudo: string,
  versaoDeclarada?: string,
): Gabarito {
  const bruto = conteudo.trim();
  if (bruto === "") throw new GabaritoInvalido("o arquivo esta vazio");

  const { versao, itensCrus } = bruto.startsWith("{")
    ? lerJson(bruto, versaoDeclarada)
    : { versao: versaoDeclarada, itensCrus: lerCsv(bruto) };

  if (versao === undefined || versao.trim() === "") {
    throw new GabaritoInvalido(
      "falta a versao do gabarito. E ela que distingue o preliminar do definitivo " +
        "e o que registra uma retificacao (BANCO-04 AC1)",
    );
  }

  const itens: ItemDoGabarito[] = [];
  const vistos = new Set<number>();

  for (const cru of itensCrus) {
    const conferido = itemSchema.safeParse(cru);
    if (!conferido.success) {
      throw new GabaritoInvalido(
        `item fora do contrato: ${conferido.error.issues[0]?.message ?? "invalido"}`,
      );
    }
    // Numero repetido no arquivo e erro de transcricao, e o ultimo venceria em
    // silencio. Metade do acervo com o gabarito errado comeca assim.
    if (vistos.has(conferido.data.numero)) {
      throw new GabaritoInvalido(
        `a questao ${conferido.data.numero} aparece duas vezes no arquivo`,
      );
    }
    vistos.add(conferido.data.numero);
    itens.push(conferido.data);
  }

  if (itens.length === 0) throw new GabaritoInvalido("nenhum item no arquivo");
  return { versao: versao.trim(), itens };
}

function lerJson(
  bruto: string,
  versaoDeclarada?: string,
): { versao: string | undefined; itensCrus: unknown[] } {
  let objeto: unknown;
  try {
    objeto = JSON.parse(bruto);
  } catch {
    throw new GabaritoInvalido("o arquivo comeca com { mas nao e JSON valido");
  }

  const conferido = arquivoJsonSchema.safeParse(objeto);
  if (!conferido.success) {
    throw new GabaritoInvalido('o JSON precisa ter { versao, itens: [...] }');
  }

  return {
    versao: conferido.data.versao ?? versaoDeclarada,
    itensCrus: conferido.data.itens,
  };
}

/** `numero,resposta,anulada` — com ou sem cabecalho, com `#` como comentario. */
function lerCsv(bruto: string): unknown[] {
  const linhas = bruto
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter((linha) => linha !== "" && !linha.startsWith("#"));

  return linhas
    .filter((linha, indice) => !(indice === 0 && /^numero\b/i.test(linha)))
    .map((linha) => {
      const [numero, resposta, anulada] = linha.split(",").map((c) => c.trim());
      return {
        numero: Number(numero),
        resposta: resposta === "" || resposta === undefined ? null : resposta.toUpperCase(),
        anulada: /^(true|sim|1|x)$/i.test(anulada ?? ""),
      };
    });
}

// ── Aplicacao ───────────────────────────────────────────────────────────────

export type ResumoDoCruzamento = {
  /** Questao que ainda nao tinha gabarito. */
  preenchidas: number;
  /** Ja tinha, e o arquivo diz a mesma coisa. Rodar de novo cai aqui. */
  inalteradas: number;
  /** Retificacao: o gabarito mudou e nasceu uma versao nova da questao. */
  versionadas: number;
  anuladas: number;
  /** O gabarito chegou antes da extracao: a questao ainda nao existe. */
  semQuestao: number;
};

/**
 * Cruza o gabarito com as questoes da prova.
 *
 * O trabalho de verdade acontece em `cruzar_gabarito()` no banco, e nao aqui.
 * Nao e gosto: a retificacao precisa ler a versao vigente, copiar os campos que
 * nao mudaram, inserir a versao nova e apagar o selo da anterior — tudo dentro
 * da **mesma transacao**. Feito em TypeScript, seriam quatro idas ao banco por
 * questao com uma janela entre elas em que a questao nao tem versao vigente
 * nenhuma.
 */
export async function cruzarGabarito(
  cliente: ClienteSql,
  provaId: string,
  gabarito: Gabarito,
): Promise<ResumoDoCruzamento> {
  const { rows } = await cliente.query(
    "select public.cruzar_gabarito($1, $2::jsonb, $3) as resumo",
    [provaId, JSON.stringify(gabarito.itens), gabarito.versao],
  );

  const resumo = (rows[0]?.resumo ?? {}) as Record<string, unknown>;
  return {
    preenchidas: Number(resumo.preenchidas ?? 0),
    inalteradas: Number(resumo.inalteradas ?? 0),
    versionadas: Number(resumo.versionadas ?? 0),
    anuladas: Number(resumo.anuladas ?? 0),
    semQuestao: Number(resumo.sem_questao ?? 0),
  };
}
