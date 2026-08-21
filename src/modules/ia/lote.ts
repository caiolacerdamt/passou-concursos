import {
  type PedidoDeIa,
  clienteDaOpenAI,
  montarLinhaDeLote,
  tetoDeSaidaDe,
} from "./adaptador-openai";
import { TarefaNaoEhDeLote, montarChaveDeDedup } from "./gateway";
import { type DestinoDeIa, perfilDaTarefa, principalDe } from "./matriz";
import type { Tarefa } from "./tarefas";

/**
 * O envio e a colheita da **Batch API** (IA-02 AC9).
 *
 * A SPEC 08 montou a linha JSONL e parou ali de proposito: quem tem volume para
 * exercitar o lote e a extracao de prova, que e esta spec. O desconto de 50% da
 * Batch API e o que torna o acervo pagavel — uma prova sao dezenas de milhares
 * de tokens de entrada, e sao 3-4 provas so no primeiro lote.
 *
 * O cliente do provedor e **injetavel** pela mesma razao do adapter: sem isso,
 * nenhum destes caminhos teria teste sem chave e sem rede (AD-083).
 */

/** O que o codigo precisa saber fazer no provedor, e nada alem disso. */
export type ClienteDeLote = {
  /** Sobe o JSONL e devolve o id do arquivo. */
  subirArquivo(jsonl: string): Promise<string>;
  criarLote(arquivoId: string): Promise<string>;
  estadoDoLote(loteId: string): Promise<EstadoDoLote>;
  baixarArquivo(arquivoId: string): Promise<string>;
};

export type EstadoDoLote = {
  /** O vocabulario e do provedor; o codigo so compara com os tres abaixo. */
  status: string;
  arquivoDeSaida: string | null;
  arquivoDeErro: string | null;
};

/** O endpoint do lote. E o mesmo da chamada sincrona (AD-074). */
export const ENDPOINT_DO_LOTE = "/v1/responses";

/** Estados do provedor em que nao ha mais nada a esperar. */
const TERMINOU_BEM = "completed";
const TERMINOU_MAL = ["failed", "expired", "cancelled"];

const clientePadrao: ClienteDeLote = {
  async subirArquivo(jsonl) {
    const arquivo = await clienteDaOpenAI().files.create({
      file: new File([jsonl], "lote.jsonl", { type: "application/jsonl" }),
      purpose: "batch",
    });
    return arquivo.id;
  },

  async criarLote(arquivoId) {
    const lote = await clienteDaOpenAI().batches.create({
      input_file_id: arquivoId,
      endpoint: ENDPOINT_DO_LOTE as "/v1/responses",
      completion_window: "24h",
    });
    return lote.id;
  },

  async estadoDoLote(loteId) {
    const lote = await clienteDaOpenAI().batches.retrieve(loteId);
    return {
      status: lote.status,
      arquivoDeSaida: lote.output_file_id ?? null,
      arquivoDeErro: lote.error_file_id ?? null,
    };
  },

  async baixarArquivo(arquivoId) {
    const conteudo = await clienteDaOpenAI().files.content(arquivoId);
    return conteudo.text();
  },
};

let cliente: ClienteDeLote = clientePadrao;

/** Seam de teste e de job. Em producao o cliente e um so (AD-074). */
export function definirClienteDeLote(novo: ClienteDeLote): void {
  cliente = novo;
}

export function restaurarClienteDeLotePadrao(): void {
  cliente = clientePadrao;
}

// ── Montagem ────────────────────────────────────────────────────────────────

/** Um pedido pronto para virar uma linha do arquivo de lote. */
export type PedidoDeLote = {
  /** O `custom_id`. E ele que liga a resposta de volta ao bloco que a pediu. */
  idDaLinha: string;
  pedido: PedidoDeIa;
};

export type LoteMontado = {
  jsonl: string;
  destino: DestinoDeIa;
  /** Quantas linhas o arquivo tem. Conferido contra o que voltou na colheita. */
  linhas: number;
};

/**
 * Monta o arquivo de lote de uma tarefa, com o modelo que a configuracao mandar.
 *
 * O `custom_id` de cada linha e a **chave de dedup** do gateway (IA-14). Nao e
 * economia de campo: e o que faz a resposta que volta 20 horas depois saber
 * exatamente que bloco de que prova ela responde, sem depender de a ordem das
 * linhas ter sido preservada.
 *
 * @throws {TarefaSemPerfil} a tarefa nao esta na matriz de configuracao
 * @throws {TarefaNaoEhDeLote} a tarefa esta marcada `batch: false`
 */
export async function montarLote(
  tarefa: Tarefa,
  pedidos: readonly PedidoDeLote[],
): Promise<LoteMontado> {
  const perfil = await perfilDaTarefa(tarefa);
  if (!perfil.batch) throw new TarefaNaoEhDeLote(tarefa);

  const destino = principalDe(perfil);
  const jsonl = pedidos
    .map((item) =>
      JSON.stringify(
        montarLinhaDeLote(item.idDaLinha, destino, item.pedido, {
          tetoDeSaida: tetoDeSaidaDe(perfil),
        }),
      ),
    )
    .join("\n");

  return { jsonl, destino, linhas: pedidos.length };
}

/** A chave de dedup de um bloco de prova, que tambem e o `custom_id`. */
export function chaveDoBloco(
  tarefa: Tarefa,
  provaId: string,
  bloco: number,
): string {
  // `montarChaveDeDedup` ja embute a versao do prompt: mudar a instrucao muda a
  // chave, e a retomada deixa de achar que o bloco ja estava feito.
  const chave = montarChaveDeDedup(tarefa, {
    livre: `prova:${provaId}:bloco:${bloco}`,
  });
  if (chave === null) {
    throw new Error("chave de dedup do bloco saiu nula com alvo preenchido");
  }
  return chave;
}

// ── Envio ───────────────────────────────────────────────────────────────────

/** Sobe o arquivo e cria o lote. Devolve o id do lote no provedor. */
export async function enviarLote(lote: LoteMontado): Promise<string> {
  const arquivoId = await cliente.subirArquivo(lote.jsonl);
  return cliente.criarLote(arquivoId);
}

// ── Colheita ────────────────────────────────────────────────────────────────

export type LinhaColhida = {
  idDaLinha: string;
  /** `null` quando a linha falhou no provedor. */
  estruturado: unknown;
  texto: string;
  erro: string | null;
  tokensEntrada: number | null;
  tokensCacheados: number | null;
  tokensSaida: number | null;
};

export type Colheita =
  | { pronto: false; status: string }
  | { pronto: true; status: string; linhas: LinhaColhida[] };

/** O lote acabou mal no provedor. Nao ha resultado parcial a aproveitar. */
export class LoteFalhou extends Error {
  constructor(loteId: string, status: string) {
    super(`o lote ${loteId} terminou com status "${status}" no provedor`);
    this.name = "LoteFalhou";
  }
}

/**
 * Colhe um lote, se ele terminou.
 *
 * Lote ainda rodando **nao e erro**: e o estado normal de um trabalho com janela
 * de 24 horas. Devolve `pronto: false` e o job tenta de novo mais tarde — sair
 * vermelho aqui pintaria de falha o funcionamento correto.
 *
 * @throws {LoteFalhou} o provedor encerrou o lote sem entregar
 */
export async function colherLote(loteId: string): Promise<Colheita> {
  const estado = await cliente.estadoDoLote(loteId);

  if (TERMINOU_MAL.includes(estado.status)) {
    throw new LoteFalhou(loteId, estado.status);
  }
  if (estado.status !== TERMINOU_BEM || estado.arquivoDeSaida === null) {
    return { pronto: false, status: estado.status };
  }

  const bruto = await cliente.baixarArquivo(estado.arquivoDeSaida);
  return { pronto: true, status: estado.status, linhas: lerSaida(bruto) };
}

/**
 * Le o JSONL de saida.
 *
 * **Uma linha ruim nao contamina as outras.** O lote e a unidade de cobranca,
 * nao a unidade de verdade: se o bloco 3 de sete deu erro no provedor, os outros
 * seis foram pagos e sao bons. A linha ruim volta com `erro` preenchido, e quem
 * decide o que fazer com ela e o chamador.
 */
export function lerSaida(bruto: string): LinhaColhida[] {
  return bruto
    .split("\n")
    .map((linha) => linha.trim())
    .filter((linha) => linha.length > 0)
    .map(lerLinha);
}

function lerLinha(cru: string): LinhaColhida {
  const vazia: LinhaColhida = {
    idDaLinha: "",
    estruturado: null,
    texto: "",
    erro: null,
    tokensEntrada: null,
    tokensCacheados: null,
    tokensSaida: null,
  };

  let linha: Record<string, unknown>;
  try {
    linha = JSON.parse(cru) as Record<string, unknown>;
  } catch {
    return { ...vazia, erro: "a linha de saida do lote nao e JSON" };
  }

  const id = typeof linha.custom_id === "string" ? linha.custom_id : "";
  const resposta = linha.response as
    | { status_code?: number; body?: Record<string, unknown> }
    | null
    | undefined;

  if (linha.error != null || resposta?.body === undefined) {
    return {
      ...vazia,
      idDaLinha: id,
      erro: descreverErro(linha.error) ?? "a linha voltou sem corpo de resposta",
    };
  }
  if (typeof resposta.status_code === "number" && resposta.status_code >= 400) {
    return {
      ...vazia,
      idDaLinha: id,
      erro: `o provedor devolveu status ${resposta.status_code} nesta linha`,
    };
  }

  // O provedor pode encerrar a geracao no meio e ainda devolver 200: e o
  // `status: "incomplete"`, com o motivo em `incomplete_details`. Sem ler isso,
  // a falha chega ao operador como "a resposta e inaproveitavel", que manda ele
  // procurar no lugar errado — foi o que aconteceu com o filtro de conteudo na
  // pagina de Lingua Inglesa da Prova C do BB 2021.
  const incompleto = motivoDeIncompletude(resposta.body);
  if (incompleto !== null) {
    return {
      ...vazia,
      idDaLinha: id,
      erro: `o provedor encerrou a geracao no meio: ${incompleto}`,
      ...tokensDe(resposta.body.usage),
    };
  }

  const texto = textoDaResposta(resposta.body);
  return {
    idDaLinha: id,
    texto,
    estruturado: comoJson(texto),
    erro: null,
    ...tokensDe(resposta.body.usage),
  };
}

/** `null` quando a geracao terminou inteira. */
function motivoDeIncompletude(corpo: Record<string, unknown>): string | null {
  if (corpo.status !== "incomplete") return null;
  const detalhes = corpo.incomplete_details as { reason?: unknown } | undefined;
  const motivo = detalhes?.reason;
  return typeof motivo === "string" ? motivo : "sem motivo declarado";
}

function descreverErro(erro: unknown): string | null {
  if (erro == null) return null;
  if (typeof erro === "string") return erro;
  const mensagem = (erro as { message?: unknown }).message;
  return typeof mensagem === "string" ? mensagem : JSON.stringify(erro);
}

/**
 * O texto de uma resposta da Responses API, como ela vem **crua** no lote.
 *
 * O `output_text` do SDK e conveniencia do cliente, e no arquivo de saida do
 * lote ele pode simplesmente nao existir: o que existe sempre e o array
 * `output`, com os blocos de conteudo. Ler os dois e o que faz este codigo nao
 * depender de qual das duas formas o provedor mandou.
 */
export function textoDaResposta(corpo: Record<string, unknown>): string {
  if (typeof corpo.output_text === "string") return corpo.output_text;

  const saida = Array.isArray(corpo.output) ? corpo.output : [];
  const pedacos: string[] = [];

  for (const item of saida) {
    const conteudo = (item as { content?: unknown }).content;
    if (!Array.isArray(conteudo)) continue;
    for (const parte of conteudo) {
      const texto = (parte as { text?: unknown }).text;
      if (typeof texto === "string") pedacos.push(texto);
    }
  }

  return pedacos.join("");
}

function comoJson(texto: string): unknown {
  try {
    return semCaracteresDeControle(JSON.parse(texto));
  } catch {
    return null;
  }
}

/**
 * Tira os caracteres de controle do que o modelo devolveu.
 *
 * **Isto nao e higiene: e o que impede o bloco inteiro de ser perdido.** O
 * `jsonb` do Postgres **recusa** `\u0000` — `unsupported Unicode escape
 * sequence` — e a recusa derruba a gravacao das dezenas de questoes daquele
 * bloco, todas ja pagas. Medido na Prova B do BB 2021: o bloco das paginas 5-8
 * voltou inteiro e correto, com 17 questoes, e morreu no INSERT por causa de 8
 * bytes nulos perdidos no meio do texto.
 *
 * Os outros controles (`\u000b`, `\u0010`, `\u000e`) o `jsonb` aceita, mas eles
 * nao sao enunciado: sao ruido que o PDF carregou. Saem junto.
 *
 * Tabulacao, quebra de linha e retorno **ficam**: sao formatacao de enunciado.
 */
export function semCaracteresDeControle<T>(valor: T): T {
  if (typeof valor === "string") {
     
    return valor.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "") as T;
  }
  if (Array.isArray(valor)) {
    return valor.map((item) => semCaracteresDeControle(item)) as T;
  }
  if (valor !== null && typeof valor === "object") {
    return Object.fromEntries(
      Object.entries(valor).map(([chave, item]) => [
        chave,
        semCaracteresDeControle(item),
      ]),
    ) as T;
  }
  return valor;
}

function tokensDe(uso: unknown) {
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
