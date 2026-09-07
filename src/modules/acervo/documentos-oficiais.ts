import { createHash } from "node:crypto";

import { z } from "zod";

import { getParam } from "@/modules/config";
import { reportarErro } from "@/modules/observabilidade";

/**
 * A fronteira entre o que a sessao do agente **achou** e o que o produto
 * **aceita** como fonte legal (BANCO-01, BANCO-02, AD-003).
 *
 * Este arquivo **nao pesquisa nada**. A pesquisa acontece na sessao do Codex ou
 * do Claude Code, com a ferramenta e o limite daquela sessao (AD-145); o que
 * chega aqui e um manifesto JSON que o agente escreveu, e manifesto escrito por
 * agente e **entrada nao confiavel** — tao nao confiavel quanto formulario de
 * navegador. Por isso nada dele e usado antes de passar por:
 *
 *   1. schema fechado, sem campo extra;
 *   2. HTTPS, sem credencial embutida, sem porta, sem host literal de IP;
 *   3. allowlist de `param.m1.dominios_oficiais`, por host exato ou subdominio.
 *
 * O que nao passa **nao aparece**: nao vira linha, nao vira log e nao vira item
 * de lista de aprovacao. Vira `+1` no contador de descartados. A razao e o
 * AD-003: agregador tem a maior parte das provas antigas indexada, e exibir o
 * link seria convidar o operador a aprovar o que e ilegal aqui.
 *
 * Config ilegivel **fecha** o fluxo. Nao existe caminho em que uma allowlist
 * quebrada vire "aceite tudo".
 */

// ── O manifesto que o agente entrega ────────────────────────────────────────

export const TIPOS_DE_DOCUMENTO = ["edital", "prova"] as const;
export type TipoDeDocumento = (typeof TIPOS_DE_DOCUMENTO)[number];

/**
 * `.strict()` de proposito: campo que o schema nao conhece **derruba** o
 * manifesto em vez de ser ignorado. Manifesto com campo a mais e sinal de que o
 * agente entendeu outra coisa, e seguir em frente com metade certa e pior do
 * que parar.
 */
export const candidatoSchema = z
  .object({
    tipo: z.enum(TIPOS_DE_DOCUMENTO),
    url: z.string().min(1).max(2048),
    titulo: z.string().min(1).max(300),
    metadados: z
      .object({
        banca: z.string().min(1).max(120).optional(),
        ano: z.number().int().min(1990).max(2100).optional(),
        orgao: z.string().min(1).max(200).optional(),
        cargo: z.string().min(1).max(200).optional(),
        caderno: z.string().min(1).max(60).optional(),
      })
      .strict()
      .default({}),
  })
  .strict();

export const manifestoSchema = z
  .object({
    candidatos: z.array(candidatoSchema).max(200),
    /** O que o agente procurou e nao achou em fonte oficial. */
    faltantes: z.array(z.string().min(1).max(300)).max(200).default([]),
  })
  .strict();

export type Candidato = z.infer<typeof candidatoSchema>;
export type Manifesto = z.infer<typeof manifestoSchema>;

export class ManifestoInvalido extends Error {
  constructor(motivo: string) {
    super(`manifesto de candidatos recusado: ${motivo}`);
    this.name = "ManifestoInvalido";
  }
}

export class ConfiguracaoDaBuscaIlegivel extends Error {
  constructor(motivo: string) {
    super(`a lista de dominios oficiais nao esta utilizavel: ${motivo}`);
    this.name = "ConfiguracaoDaBuscaIlegivel";
  }
}

export function lerManifesto(bruto: unknown): Manifesto {
  const lido = manifestoSchema.safeParse(bruto);
  if (!lido.success) {
    throw new ManifestoInvalido(lido.error.issues.map((i) => i.path.join(".")).join(", "));
  }
  return lido.data;
}

// ── A allowlist ─────────────────────────────────────────────────────────────

/**
 * Normaliza a lista e recusa a operacao inteira quando ela nao serve.
 *
 * Lista vazia **nao** e "sem restricao": e busca desligada. Fica separada de
 * `lerDominiosOficiais` para ser testavel sem passar pelo leitor de config — e
 * porque e ela que segura o dia em que alguem esvaziar o default do catalogo.
 */
export function normalizarDominios(lista: readonly string[]): string[] {
  const limpos = lista.map((host) => host.trim().toLowerCase()).filter((host) => host !== "");
  if (limpos.length === 0) {
    throw new ConfiguracaoDaBuscaIlegivel("a lista esta vazia");
  }
  return limpos;
}

/**
 * Le a allowlist da configuracao (AD-078).
 *
 * Config ilegivel nunca abre a fronteira: `getParam` valida contra o tipo do
 * catalogo e, quando o valor do banco nao passa, cai no **default semeado** —
 * que e restritivo. O caminho "config quebrada, aceite tudo" nao existe.
 */
export async function lerDominiosOficiais(): Promise<string[]> {
  return normalizarDominios(await getParam("param.m1.dominios_oficiais"));
}

/** Rotulo `host` sem parte vazia, sem IP e sem caractere fora de LDH. */
function hostBemFormado(host: string): boolean {
  if (host.length === 0 || host.length > 253) return false;
  if (!/^[a-z0-9.-]+$/.test(host)) return false;
  const rotulos = host.split(".");
  if (rotulos.length < 2) return false;
  if (rotulos.some((r) => r === "" || r.startsWith("-") || r.endsWith("-") || r.length > 63)) {
    return false;
  }
  // TLD alfabetico: e o que separa `cesgranrio.org.br` de `127.0.0.1`.
  return /^[a-z]{2,}$/.test(rotulos[rotulos.length - 1]);
}

/**
 * O host esta na allowlist?
 *
 * Casa host **exato** ou subdominio dele — `provas.cesgranrio.org.br` passa por
 * `cesgranrio.org.br`, e `cesgranrio.org.br.exemplo.com` nao. A comparacao e
 * por rotulo, e nao por `endsWith`, porque `endsWith` deixaria passar
 * `falsocesgranrio.org.br`.
 */
export function hostPermitido(host: string, dominios: readonly string[]): boolean {
  const alvo = host.trim().toLowerCase().replace(/\.$/, "");
  if (!hostBemFormado(alvo)) return false;
  return dominios.some((dominio) => {
    const d = dominio.trim().toLowerCase();
    return alvo === d || alvo.endsWith(`.${d}`);
  });
}

export type MotivoDeRecusa =
  | "url_ilegivel"
  | "esquema_nao_https"
  | "credencial_na_url"
  | "porta_explicita"
  | "host_mal_formado"
  | "fora_da_allowlist";

export type Veredito =
  | { ok: true; url: string; host: string }
  | { ok: false; motivo: MotivoDeRecusa };

/**
 * O unico juiz de URL do fluxo.
 *
 * Roda no registro do candidato **e de novo** em cada redirecionamento do
 * download: um `302` de `cesgranrio.org.br` para um agregador nao pode virar
 * download so porque o primeiro salto era legal (SEC-01).
 */
export function avaliarUrl(bruta: string, dominios: readonly string[]): Veredito {
  let url: URL;
  try {
    url = new URL(bruta.trim());
  } catch {
    return { ok: false, motivo: "url_ilegivel" };
  }

  if (url.protocol !== "https:") return { ok: false, motivo: "esquema_nao_https" };
  // `https://cesgranrio.org.br@agregador.com/p.pdf` aponta para o agregador. O
  // navegador sabe disso; a leitura humana da lista de aprovacao, nao.
  if (url.username !== "" || url.password !== "") {
    return { ok: false, motivo: "credencial_na_url" };
  }
  // Porta explicita nao acrescenta nada numa fonte oficial e abre a porta para
  // apontar um host permitido a um servico interno.
  if (url.port !== "") return { ok: false, motivo: "porta_explicita" };
  if (!hostBemFormado(url.hostname)) return { ok: false, motivo: "host_mal_formado" };
  if (!hostPermitido(url.hostname, dominios)) return { ok: false, motivo: "fora_da_allowlist" };

  return { ok: true, url: url.toString(), host: url.hostname };
}

export type Triagem = {
  /** Os que viraram linha e vao a primeira confirmacao. */
  aceitos: (Candidato & { url: string; host: string })[];
  /**
   * Quantos cairam fora. **Numero, nunca URL**: o link recusado nao entra em
   * banco, em log nem na conversa (AD-003).
   */
  descartados: number;
  faltantes: string[];
};

/**
 * Separa o que e fonte legal do que nao e.
 *
 * Candidato repetido na mesma lista conta uma vez: o agente as vezes acha a
 * mesma URL por dois caminhos, e isso nao e dois documentos.
 */
export function triarCandidatos(
  manifesto: Manifesto,
  dominios: readonly string[],
): Triagem {
  const aceitos: Triagem["aceitos"] = [];
  const vistos = new Set<string>();
  let descartados = 0;

  for (const candidato of manifesto.candidatos) {
    const veredito = avaliarUrl(candidato.url, dominios);
    if (!veredito.ok) {
      descartados += 1;
      continue;
    }
    if (vistos.has(veredito.url)) continue;
    vistos.add(veredito.url);
    aceitos.push({ ...candidato, url: veredito.url, host: veredito.host });
  }

  return { aceitos, descartados, faltantes: manifesto.faltantes };
}

// ── O download ──────────────────────────────────────────────────────────────

export class DownloadRecusado extends Error {
  readonly motivo: string;
  constructor(motivo: string) {
    super(`download recusado: ${motivo}`);
    this.name = "DownloadRecusado";
    this.motivo = motivo;
  }
}

/** `fetch` sem seguir redirect: quem segue e este modulo, um salto por vez. */
export type BuscadorHttp = (url: string) => Promise<Response>;

export type PdfBaixado = {
  url: string;
  /** A URL final, depois dos redirecionamentos — e ela que vira proveniencia. */
  urlFinal: string;
  bytes: number;
  sha256: string;
  conteudo: Buffer;
};

export const MAXIMO_DE_REDIRECTS = 5;

const ASSINATURA_PDF = Buffer.from("%PDF-");

function ehPdf(conteudo: Buffer): boolean {
  // A assinatura pode vir depois de algum lixo de cabecalho em PDF gerado por
  // ferramenta ruim; a norma admite ate 1024 bytes de folga.
  return conteudo.subarray(0, 1024).includes(ASSINATURA_PDF);
}

function tipoAceitavel(contentType: string | null): boolean {
  if (contentType === null) return true; // servidor calado: decide a assinatura
  const tipo = contentType.split(";")[0].trim().toLowerCase();
  return tipo === "application/pdf" || tipo === "application/octet-stream" || tipo === "";
}

/**
 * Baixa **um** documento ja aprovado.
 *
 * O que este codigo garante e o que o AD-003 e o ASVS pedem juntos:
 *
 *   * cada salto de redirecionamento e reavaliado contra a allowlist;
 *   * o corpo para no teto de `param.m1.tamanho_maximo_pdf_mib`, lendo em
 *     pedaco — nao adianta conferir `Content-Length`, que o servidor escolhe;
 *   * `Content-Type` e a assinatura `%PDF-` precisam concordar com o que se
 *     pediu;
 *   * o nome do arquivo **nunca** vem do servidor: quem nomeia e o comando, a
 *     partir do ID do documento.
 *
 * Nada disso confia no que o agente disse. O agente entregou a URL; o resto e
 * conferido aqui.
 */
export async function baixarDocumentoOficial(
  url: string,
  dominios: readonly string[],
  opcoes: { buscar?: BuscadorHttp; tetoMib?: number } = {},
): Promise<PdfBaixado> {
  const buscar = opcoes.buscar ?? ((alvo: string) => fetch(alvo, { redirect: "manual" }));
  const tetoMib = opcoes.tetoMib ?? (await getParam("param.m1.tamanho_maximo_pdf_mib"));
  const tetoBytes = tetoMib * 1024 * 1024;

  let atual = url;
  for (let salto = 0; salto <= MAXIMO_DE_REDIRECTS; salto += 1) {
    // Revalidacao a cada salto: e este `if` que impede o `302` para agregador.
    const veredito = avaliarUrl(atual, dominios);
    if (!veredito.ok) throw new DownloadRecusado(`redirecionamento ${veredito.motivo}`);

    const resposta = await buscar(veredito.url);

    if (resposta.status >= 300 && resposta.status < 400) {
      const destino = resposta.headers.get("location");
      if (destino === null) throw new DownloadRecusado("redirecionamento sem destino");
      // Relativo resolve contra o atual; absoluto substitui. Os dois voltam ao
      // topo do laco e passam pela allowlist de novo.
      atual = new URL(destino, veredito.url).toString();
      continue;
    }

    if (!resposta.ok) throw new DownloadRecusado(`resposta ${resposta.status}`);
    if (!tipoAceitavel(resposta.headers.get("content-type"))) {
      throw new DownloadRecusado("content-type nao e PDF");
    }

    const conteudo = await lerCorpoLimitado(resposta, tetoBytes);
    if (!ehPdf(conteudo)) throw new DownloadRecusado("o corpo nao comeca com %PDF-");

    return {
      url,
      urlFinal: veredito.url,
      bytes: conteudo.length,
      sha256: createHash("sha256").update(conteudo).digest("hex"),
      conteudo,
    };
  }

  throw new DownloadRecusado("redirecionamentos demais");
}

/**
 * Le o corpo em pedacos e para **no** teto.
 *
 * `Content-Length` nao serve de trava: o servidor escolhe o numero, e um
 * servidor hostil declara 1 KiB e manda 4 GiB. O que segura e contar o que
 * chega.
 */
async function lerCorpoLimitado(resposta: Response, tetoBytes: number): Promise<Buffer> {
  const corpo = resposta.body;
  if (corpo === null) throw new DownloadRecusado("resposta sem corpo");

  const pedacos: Buffer[] = [];
  let total = 0;
  const leitor = corpo.getReader();
  try {
    for (;;) {
      const { done, value } = await leitor.read();
      if (done) break;
      total += value.byteLength;
      if (total > tetoBytes) {
        throw new DownloadRecusado(`maior que o teto de ${tetoBytes} bytes`);
      }
      pedacos.push(Buffer.from(value));
    }
  } finally {
    await leitor.cancel().catch(() => {});
  }

  return Buffer.concat(pedacos);
}

/**
 * Nome interno do arquivo. **Nunca** o nome que o servidor sugeriu.
 *
 * `Content-Disposition` e texto de terceiro: aceita-lo seria deixar a origem
 * escolher onde o arquivo cai no disco do runner.
 */
export function nomeInternoDoDocumento(
  documentoId: string,
  tipo: TipoDeDocumento,
): string {
  if (!/^[0-9a-f-]{36}$/i.test(documentoId)) {
    throw new DownloadRecusado("identificador de documento invalido");
  }
  return `${tipo}-${documentoId.toLowerCase()}.pdf`;
}

/**
 * Baixa a lista aprovada, seguindo em frente quando um item falha.
 *
 * Uma URL que saiu do ar nao pode derrubar a abertura inteira: o que ela deixa
 * e uma falha registrada e um documento sem `baixado_em`, que o `relatorio`
 * mostra como pendencia.
 */
export async function baixarAprovados(
  aprovados: readonly { id: string; url: string; tipo: TipoDeDocumento }[],
  dominios: readonly string[],
  opcoes: { buscar?: BuscadorHttp; tetoMib?: number } = {},
): Promise<{
  baixados: (PdfBaixado & { id: string; nomeInterno: string })[];
  falhas: { id: string; motivo: string }[];
}> {
  const baixados: (PdfBaixado & { id: string; nomeInterno: string })[] = [];
  const falhas: { id: string; motivo: string }[] = [];

  for (const documento of aprovados) {
    try {
      const pdf = await baixarDocumentoOficial(documento.url, dominios, opcoes);
      baixados.push({
        ...pdf,
        id: documento.id,
        nomeInterno: nomeInternoDoDocumento(documento.id, documento.tipo),
      });
    } catch (erro) {
      const motivo = erro instanceof DownloadRecusado ? erro.motivo : "falha de rede";
      // O contexto leva o ID, nunca a URL nem o corpo: log de abertura nao
      // guarda documento (SEC-05).
      reportarErro(erro, {
        modulo: "acervo",
        motivo: "download de documento oficial falhou",
        documento_id: documento.id,
      });
      falhas.push({ id: documento.id, motivo });
    }
  }

  return { baixados, falhas };
}
