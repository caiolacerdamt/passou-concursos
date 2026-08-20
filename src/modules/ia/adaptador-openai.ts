import OpenAI from "openai";

import type { DestinoDeIa, PerfilDeTarefa } from "./matriz";

/**
 * O **unico** adapter de producao (IA-16 / AD-074).
 *
 * SDK nativo da OpenAI, Responses API. A OpenRouter SHALL NOT ser usada na
 * fabrica nem no tutor — ela existe so no eval cego trimestral (SPEC 30), com
 * chave separada. Acrescentar um segundo adapter aqui exige AD nova.
 *
 * Este arquivo **nao conhece nenhum modelo**: recebe o destino que a matriz de
 * configuracao resolveu e repassa. E por isso que trocar de modelo nao muda
 * codigo.
 */

/** O pedido, na forma que o gateway entrega — provedor-agnostica. */
export type PedidoDeIa = {
  /**
   * O trecho **estavel** do pedido: instrucao e documento de referencia. Vai
   * separado porque e ele que o prompt caching reaproveita a 0,1x da entrada
   * (IA-02 AC9) — misturado com a parte variavel, o cache nunca acerta.
   */
  instrucao: string;
  /** A parte que muda a cada chamada. */
  entrada: string;
  /** Saida estruturada, quando a tarefa exige (IA-02 / AD-075). */
  formato?: { nome: string; schema: Record<string, unknown> };
};

export type RespostaDeIa = {
  texto: string;
  /** Preenchido so quando o pedido trouxe `formato`. */
  estruturado?: unknown;
  tokensEntrada: number | null;
  tokensCacheados: number | null;
  tokensSaida: number | null;
};

/**
 * A forma que o gateway chama. Trocar por um duplo em teste e o que permite
 * provar fallback, dedup e refaz sem tocar na rede (AD-083).
 */
export type Adaptador = (
  destino: DestinoDeIa,
  pedido: PedidoDeIa,
  opcoes: { cache: boolean; tetoDeSaida?: number },
) => Promise<RespostaDeIa>;

/**
 * O identificador que vai para o provedor.
 *
 * `versao` **e** o id fixado (o snapshot datado que a OpenAI publica), e
 * `modelo` e o rotulo da familia, usado para achar o preco e para ler o
 * relatorio. O IA-02 AC4 exige versao fixada, nunca apelido flutuante — mandar
 * `modelo` para a API seria mandar o apelido.
 */
export function idDoProvedor(destino: DestinoDeIa): string {
  return destino.versao;
}

/** O corpo do pedido, identico no sincrono e na linha de lote. */
export function corpoDoPedido(
  destino: DestinoDeIa,
  pedido: PedidoDeIa,
  opcoes: { tetoDeSaida?: number } = {},
): Record<string, unknown> {
  const corpo: Record<string, unknown> = {
    model: idDoProvedor(destino),
    reasoning: { effort: destino.esforco },
    input: [
      // A instrucao vem primeiro e inteira: prompt caching so aproveita
      // prefixo, entao o estavel tem que estar na frente do variavel.
      { role: "system", content: pedido.instrucao },
      { role: "user", content: pedido.entrada },
    ],
  };

  if (opcoes.tetoDeSaida !== undefined) {
    corpo.max_output_tokens = opcoes.tetoDeSaida;
  }

  if (pedido.formato !== undefined) {
    corpo.text = {
      format: {
        type: "json_schema",
        name: pedido.formato.nome,
        strict: true,
        schema: pedido.formato.schema,
      },
    };
  }

  return corpo;
}

/**
 * Uma linha do arquivo de lote (`/v1/responses` em JSONL).
 *
 * O gateway **monta** a linha; quem envia o arquivo e colhe o resultado e a
 * SPEC 09, que e a spec com volume para exercitar isso. Montar aqui garante que
 * a chamada em lote e a sincrona sao o mesmo pedido — se divergirem, a
 * explicacao gerada em lote nao seria a mesma que o eval aprovou.
 */
export function montarLinhaDeLote(
  idDaLinha: string,
  destino: DestinoDeIa,
  pedido: PedidoDeIa,
  opcoes: { tetoDeSaida?: number } = {},
): Record<string, unknown> {
  return {
    custom_id: idDaLinha,
    method: "POST",
    url: "/v1/responses",
    body: corpoDoPedido(destino, pedido, opcoes),
  };
}

/** Ausencia de chave e falha de operacao, nao de codigo — e tem que dizer isso. */
export class SemChaveDaOpenAI extends Error {
  constructor() {
    super(
      "OPENAI_API_KEY nao esta definida: nenhuma tarefa de IA roda sem ela. " +
        "Ver .env.example e docs/SEGREDOS.md.",
    );
    this.name = "SemChaveDaOpenAI";
  }
}

let clienteMemorizado: OpenAI | null = null;

/**
 * Cliente preguicoso de proposito: construir no `import` faria qualquer arquivo
 * que apenas mencione o adapter explodir num ambiente sem chave — inclusive o
 * `next build`.
 */
export function clienteDaOpenAI(): OpenAI {
  const chave = process.env.OPENAI_API_KEY?.trim();
  if (!chave) throw new SemChaveDaOpenAI();

  clienteMemorizado ??= new OpenAI({ apiKey: chave });
  return clienteMemorizado;
}

/** Esquece o cliente. Existe para o teste, e para quando a chave e rotacionada. */
export function esquecerClienteDaOpenAI(): void {
  clienteMemorizado = null;
}

/**
 * `usage` da Responses API, na forma que o registro de gasto consome. O SDK
 * tipa isso como opcional, e um `undefined` aqui vira custo `null` la — nunca
 * um zero, que mentiria dizendo que a chamada foi de graca.
 */
function tokensDe(uso: unknown): Pick<
  RespostaDeIa,
  "tokensEntrada" | "tokensCacheados" | "tokensSaida"
> {
  const u = uso as
    | {
        input_tokens?: number;
        output_tokens?: number;
        input_tokens_details?: { cached_tokens?: number };
      }
    | undefined;

  return {
    tokensEntrada: u?.input_tokens ?? null,
    tokensCacheados: u?.input_tokens_details?.cached_tokens ?? null,
    tokensSaida: u?.output_tokens ?? null,
  };
}

/** O adapter de producao. */
export const adaptadorDaOpenAI: Adaptador = async (destino, pedido, opcoes) => {
  const cliente = clienteDaOpenAI();

  // `cache` nao vira parametro: o prompt caching da OpenAI e automatico por
  // prefixo. O que a flag governa e a **forma do pedido** — com ela ligada o
  // trecho estavel e mantido intacto e na frente, que e o que faz o desconto
  // acontecer. Deixar de honra-la seria pagar 10x pela entrada repetida.
  const corpo = corpoDoPedido(destino, pedido, {
    tetoDeSaida: opcoes.tetoDeSaida,
  });

  const resposta = await cliente.responses.create(
    corpo as Parameters<typeof cliente.responses.create>[0],
  );

  const texto = (resposta as { output_text?: string }).output_text ?? "";
  const uso = tokensDe((resposta as { usage?: unknown }).usage);

  if (pedido.formato === undefined) {
    return { texto, ...uso };
  }

  // Saida estruturada que nao volta como JSON e falha, nao "resposta estranha":
  // quem pediu schema vai indexar campo dela logo em seguida.
  let estruturado: unknown;
  try {
    estruturado = JSON.parse(texto);
  } catch {
    throw new Error(
      `a tarefa pediu saida estruturada "${pedido.formato.nome}" e a resposta nao e JSON`,
    );
  }

  return { texto, estruturado, ...uso };
};

/** O teto de saida do perfil, quando a matriz declarou um. */
export function tetoDeSaidaDe(perfil: PerfilDeTarefa): number | undefined {
  return perfil.teto_de_saida;
}
