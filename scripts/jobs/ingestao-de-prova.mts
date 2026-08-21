#!/usr/bin/env node
/**
 * A ingestao de uma prova oficial: PDF -> questoes (BANCO-03, BANCO-11, BANCO-12).
 *
 * Roda em **GitHub Actions**, nunca em funcao da Vercel (AD-036/INFRA-02): e
 * trabalho longo, com Batch API de janela de 24 horas, e serverless nao e o
 * lugar disso.
 *
 * Sao **dois comandos** e nao um, porque o lote e assincrono:
 *
 *   `enviar` — le o PDF, decide se ha texto nativo, fatia em blocos e manda os
 *              que ainda nao foram mandados.
 *   `colher` — pega o que ja voltou do provedor e grava as questoes.
 *
 * Os dois sao **retomaveis**: rodar de novo nao remonta bloco que ja tem linha
 * em `prova_lote` e nao insere questao que ja existe. E o AD-036 inteiro.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";

import {
  type ImagemDoPdf,
  type SubidorDeImagem,
  INSTRUCAO_DA_EXTRACAO,
  NOME_DO_FORMATO,
  SCHEMA_DA_EXTRACAO,
  fatiarEmBlocos,
  gravarQuestoes,
  lerCatalogo,
  lerPdf,
  lerProva,
  marcarProva,
  orcamentoVigente,
  registrarBlocos,
  validarBloco,
} from "@/modules/acervo";
import { definirLeitorDeConfig, getParam } from "@/modules/config";
import {
  type ClienteSql,
  chaveDoBloco,
  colherLote,
  enviarLote,
  geracaoJaExiste,
  definirRepositorioDeIa,
  leitorDeConfigPorPg,
  montarLote,
  registrarGeracaoDeLote,
  repositorioPorPg,
} from "@/modules/ia";
import { reportarErro } from "@/modules/observabilidade";

import { lerEnv } from "../alvo-do-banco.mjs";

import { encerrar, iniciarSentry, reportar } from "./sentry-node.mjs";

const TAREFA = "extracao_pdf" as const;

export type Acao = "enviar" | "colher";

export type Argumentos = {
  provaId: string;
  pdf: string;
  acao: Acao;
};

/** `--prova <uuid> --pdf <arquivo> --acao enviar|colher`. */
export function lerArgumentos(argv: readonly string[]): Argumentos {
  const valores = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const chave = argv[i];
    if (chave.startsWith("--")) valores.set(chave.slice(2), argv[i + 1] ?? "");
  }

  const provaId = valores.get("prova")?.trim() ?? "";
  const pdf = valores.get("pdf")?.trim() ?? "";
  const acao = (valores.get("acao")?.trim() ?? "") as Acao;

  if (provaId === "" || pdf === "" || (acao !== "enviar" && acao !== "colher")) {
    throw new Error(
      "uso: ingestao-de-prova --prova <uuid> --pdf <arquivo.pdf> --acao enviar|colher",
    );
  }
  return { provaId, pdf, acao };
}

export type ResumoDoEnvio = {
  paginas: number;
  blocos: number;
  enviados: number;
  precisaOcr: boolean;
};

/**
 * Le o PDF e manda os blocos que ainda nao foram mandados.
 *
 * A **primeira** decisao e a do BANCO-12, e ela vem antes de qualquer gasto: PDF
 * sem texto nativo cai em `precisa_ocr` e o job termina ali, sem chamar modelo
 * nenhum. Extrair questao de imagem sem OCR e o que produz acervo errado, e
 * acervo errado e pior do que acervo pequeno.
 */
export async function enviar(
  cliente: ClienteSql,
  argumentos: Argumentos,
  bruto: Buffer,
): Promise<ResumoDoEnvio> {
  await lerProva(cliente, argumentos.provaId);
  const pdf = lerPdf(bruto);

  if (!pdf.temTextoNativo) {
    await marcarProva(
      cliente,
      argumentos.provaId,
      "precisa_ocr",
      `PDF sem texto nativo em nenhuma das ${pdf.totalDePaginas} paginas (BANCO-12).`,
    );
    return {
      paginas: pdf.totalDePaginas,
      blocos: 0,
      enviados: 0,
      precisaOcr: true,
    };
  }

  const blocos = fatiarEmBlocos(pdf.paginas, await orcamentoVigente());
  const novos = await registrarBlocos(
    cliente,
    argumentos.provaId,
    blocos,
    (bloco) => chaveDoBloco(TAREFA, argumentos.provaId, bloco),
  );

  if (novos.length === 0) {
    return {
      paginas: pdf.totalDePaginas,
      blocos: blocos.length,
      enviados: 0,
      precisaOcr: false,
    };
  }

  const lote = await montarLote(
    TAREFA,
    novos.map((indice) => ({
      idDaLinha: chaveDoBloco(TAREFA, argumentos.provaId, indice),
      pedido: {
        instrucao: INSTRUCAO_DA_EXTRACAO,
        entrada: blocos[indice].texto,
        formato: { nome: NOME_DO_FORMATO, schema: SCHEMA_DA_EXTRACAO },
      },
    })),
  );

  const loteProvedor = await enviarLote(lote);

  // O destino vai gravado junto: a colheita acontece ate 24 horas depois, e ate
  // la a matriz de configuracao pode ter mudado de modelo sem deploy (AD-078).
  // Registrar na auditoria o modelo de **hoje** diria que o bloco nasceu de um
  // modelo que nao o produziu.
  await cliente.query(
    `update public.prova_lote
        set status = 'enviado', lote_provedor = $3, destino = $4::jsonb
      where prova_id = $1 and bloco = any($2)`,
    [argumentos.provaId, novos, loteProvedor, JSON.stringify(lote.destino)],
  );
  await marcarProva(cliente, argumentos.provaId, "extraindo");

  return {
    paginas: pdf.totalDePaginas,
    blocos: blocos.length,
    enviados: novos.length,
    precisaOcr: false,
  };
}

export type ResumoDaColheita = {
  blocosProntos: number;
  blocosEsperando: number;
  questoesInseridas: number;
  questoesRecusadas: number;
  provaCompleta: boolean;
};

export const CONSULTA_DOS_LOTES_EM_VOO = `
  select bloco, chave_dedup, lote_provedor, destino
    from public.prova_lote
   where prova_id = $1 and status = 'enviado'
   order by bloco
`;

/**
 * Colhe os blocos que ja voltaram e grava as questoes.
 *
 * O PDF e lido de novo aqui — e nao guardado entre os dois comandos — porque as
 * imagens moram nele. Guardar o texto no banco duplicaria a prova inteira numa
 * coluna para evitar reler um arquivo local que o operador ja tem na mao.
 */
export async function colher(
  cliente: ClienteSql,
  argumentos: Argumentos,
  bruto: Buffer,
  subirImagem: SubidorDeImagem,
): Promise<ResumoDaColheita> {
  const prova = await lerProva(cliente, argumentos.provaId);
  const pdf = lerPdf(bruto);
  const catalogo = await lerCatalogo(cliente);
  const bucket = await getParam("param.m1.bucket_de_imagens");

  const imagensPorPagina = new Map<number, ImagemDoPdf[]>(
    pdf.paginas.map((pagina) => [pagina.numero, pagina.imagens]),
  );

  const { rows: emVoo } = await cliente.query(CONSULTA_DOS_LOTES_EM_VOO, [
    argumentos.provaId,
  ]);

  const resumo: ResumoDaColheita = {
    blocosProntos: 0,
    blocosEsperando: 0,
    questoesInseridas: 0,
    questoesRecusadas: 0,
    provaCompleta: false,
  };

  // Um lote pode carregar varios blocos; colher uma vez por lote evita baixar o
  // mesmo arquivo de saida uma vez por bloco.
  const porLote = new Map<string, BlocoEmVoo[]>();
  for (const linha of emVoo) {
    const lote = String(linha.lote_provedor);
    const lista = porLote.get(lote) ?? [];
    lista.push({
      bloco: Number(linha.bloco),
      chave: String(linha.chave_dedup),
      destino: destinoGravado(linha.destino),
    });
    porLote.set(lote, lista);
  }

  for (const [lote, blocos] of porLote) {
    let colheita;
    try {
      colheita = await colherLote(lote);
    } catch (erro) {
      // O lote morreu no provedor. Os blocos dele voltam para a fila como
      // `falhou`, e o operador reenvia — nao ha resultado parcial a aproveitar.
      await marcarBlocos(cliente, argumentos.provaId, blocos, "falhou", String(erro));
      reportarErro(erro, {
        modulo: "acervo",
        job: "ingestao-de-prova",
        prova_id: argumentos.provaId,
        motivo: "o lote de extracao terminou mal no provedor",
      });
      continue;
    }

    if (!colheita.pronto) {
      resumo.blocosEsperando += blocos.length;
      continue;
    }

    const porChave = new Map(colheita.linhas.map((linha) => [linha.idDaLinha, linha]));

    for (const bloco of blocos) {
      const linha = porChave.get(bloco.chave);
      if (linha === undefined || linha.erro !== null) {
        await marcarBlocos(
          cliente,
          argumentos.provaId,
          [bloco],
          "falhou",
          linha?.erro ?? "o lote voltou sem a linha deste bloco",
        );
        continue;
      }

      try {
        const validado = validarBloco(linha.estruturado);

        // Antes de gravar: se esta chave ja esta em `ia_geracoes`, este bloco ja
        // foi colhido numa execucao anterior. Somar o custo de novo mentiria na
        // conta do mes (IA-14).
        if (!(await geracaoJaExiste(bloco.chave))) {
          await registrarGeracaoDeLote({
            tarefa: TAREFA,
            chaveDedup: bloco.chave,
            destino: bloco.destino,
            resultado: linha.estruturado,
            tokensEntrada: linha.tokensEntrada,
            tokensCacheados: linha.tokensCacheados,
            tokensSaida: linha.tokensSaida,
          });
        }

        const gravado = await gravarQuestoes(cliente, validado.aceitas, {
          prova,
          catalogo,
          imagensPorPagina,
          subirImagem,
          bucket,
        });

        resumo.blocosProntos += 1;
        resumo.questoesInseridas += gravado.inseridas;
        resumo.questoesRecusadas += validado.recusadas.length;

        for (const recusada of validado.recusadas) {
          console.warn(
            `[ingestao] bloco ${bloco.bloco}: questao ${recusada.numero ?? "?"} recusada — ${recusada.motivo}`,
          );
        }

        await cliente.query(
          `update public.prova_lote
              set status = 'colhido', questoes_aceitas = $3, questoes_recusadas = $4
            where prova_id = $1 and bloco = $2`,
          [
            argumentos.provaId,
            bloco.bloco,
            validado.aceitas.length,
            validado.recusadas.length,
          ],
        );
      } catch (erro) {
        // A falha de um bloco nao derruba os outros: o lote ja foi pago inteiro.
        await marcarBlocos(cliente, argumentos.provaId, [bloco], "falhou", String(erro));
        reportarErro(erro, {
          modulo: "acervo",
          job: "ingestao-de-prova",
          prova_id: argumentos.provaId,
          bloco: bloco.bloco,
          motivo: "nao deu para gravar as questoes deste bloco",
        });
      }
    }
  }

  const { rows: pendentes } = await cliente.query(
    `select count(*)::int as total from public.prova_lote
      where prova_id = $1 and status <> 'colhido'`,
    [argumentos.provaId],
  );
  const { rows: total } = await cliente.query(
    "select count(*)::int as total from public.prova_lote where prova_id = $1",
    [argumentos.provaId],
  );

  resumo.provaCompleta =
    Number(total[0]?.total ?? 0) > 0 && Number(pendentes[0]?.total ?? 0) === 0;
  if (resumo.provaCompleta) {
    await marcarProva(cliente, argumentos.provaId, "extraida");
  }

  return resumo;
}

/** Um bloco que foi enviado e ainda nao foi colhido. */
type BlocoEmVoo = {
  bloco: number;
  chave: string;
  destino: { modelo: string; versao: string; esforco: string };
};

/**
 * O destino que a matriz resolveu **no envio**, lido de volta de `prova_lote`.
 *
 * Linha antiga, gravada antes de a coluna existir, cai no rotulo generico. Nao e
 * um modelo inventado — e a afirmacao honesta de que aquele registro nao sabe
 * qual modelo foi, que e o unico valor que o `AGENTS.md` permite escrever aqui.
 */
function destinoGravado(bruto: unknown) {
  const d = bruto as Record<string, unknown> | null;
  if (
    d === null ||
    typeof d?.modelo !== "string" ||
    typeof d?.versao !== "string" ||
    typeof d?.esforco !== "string"
  ) {
    return { modelo: "desconhecido", versao: "desconhecido", esforco: "desconhecido" };
  }
  return { modelo: d.modelo, versao: d.versao, esforco: d.esforco };
}

async function marcarBlocos(
  cliente: ClienteSql,
  provaId: string,
  blocos: readonly { bloco: number }[],
  status: string,
  erro: string,
): Promise<void> {
  await cliente.query(
    `update public.prova_lote
        set status = $3::status_bloco, erro = $4
      where prova_id = $1 and bloco = any($2)`,
    [provaId, blocos.map((b) => b.bloco), status, erro.slice(0, 2000)],
  );
}

// ── Provisionamento ─────────────────────────────────────────────────────────

/** Ambiente do script: o do processo, com o `.env` por cima quando existe. */
export function ambienteDoScript(
  raiz: string = process.cwd(),
): Record<string, string | undefined> {
  const caminho = path.join(raiz, ".env");
  if (!existsSync(caminho)) return { ...process.env };
  return { ...process.env, ...lerEnv(readFileSync(caminho, "utf8")) };
}

/**
 * O que impede o job de rodar.
 *
 * Aqui, **toda ausencia para** — ao contrario da frase do plano, que sai limpa
 * sem a chave. A diferenca e o que se perde: la, um plano sem frase de abertura;
 * aqui, uma prova que o operador acha que foi ingerida e nao foi.
 */
export function motivoDeParada(
  ambiente: Record<string, string | undefined>,
): string | null {
  if (!ambiente.DATABASE_URL?.trim()) {
    return "DATABASE_URL nao esta definida. Ver docs/SEGREDOS.md.";
  }
  if (!ambiente.OPENAI_API_KEY?.trim()) {
    return "OPENAI_API_KEY nao esta definida: nenhuma prova e extraida sem ela.";
  }
  if (!ambiente.NEXT_PUBLIC_SUPABASE_URL?.trim() || !ambiente.SUPABASE_SECRET_KEY?.trim()) {
    return (
      "NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY sao obrigatorias: " +
      "a imagem da questao vai para o Supabase Storage (BANCO-11)."
    );
  }
  return null;
}

/** Sobe a imagem ao bucket, com a chave de servico. */
export function subidorDoStorage(
  ambiente: Record<string, string | undefined>,
  bucket: string,
): SubidorDeImagem {
  const supabase = createClient(
    ambiente.NEXT_PUBLIC_SUPABASE_URL ?? "",
    ambiente.SUPABASE_SECRET_KEY ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  return async (caminho, jpeg) => {
    const { error } = await supabase.storage
      .from(bucket)
      .upload(caminho, jpeg, { contentType: "image/jpeg", upsert: true });
    if (error !== null) throw error;
  };
}

/** @returns codigo de saida */
export async function executar(
  ambiente: Record<string, string | undefined>,
  argv: readonly string[],
  opcoes: {
    abrirConexao?: () => ClienteSql & {
      connect(): Promise<void>;
      end(): Promise<void>;
    };
    lerArquivo?: (caminho: string) => Buffer;
    subirImagem?: SubidorDeImagem;
  } = {},
): Promise<number> {
  const motivo = motivoDeParada(ambiente);
  if (motivo !== null) {
    console.error(`[ingestao] ${motivo}`);
    return 1;
  }

  let argumentos: Argumentos;
  try {
    argumentos = lerArgumentos(argv);
  } catch (erro) {
    console.error(`[ingestao] ${String(erro)}`);
    return 1;
  }

  const lerArquivo = opcoes.lerArquivo ?? readFileSync;
  let bruto: Buffer;
  try {
    bruto = lerArquivo(argumentos.pdf);
  } catch {
    console.error(`[ingestao] nao achei o PDF em ${argumentos.pdf}`);
    return 1;
  }

  await iniciarSentry();

  const abrir =
    opcoes.abrirConexao ??
    (() => new Client({ connectionString: ambiente.DATABASE_URL }) as never);
  const cliente = abrir();

  try {
    await cliente.connect();
    definirLeitorDeConfig(leitorDeConfigPorPg(cliente) as never);
    definirRepositorioDeIa(repositorioPorPg(cliente));

    if (argumentos.acao === "enviar") {
      const resumo = await enviar(cliente, argumentos, bruto);
      if (resumo.precisaOcr) {
        console.warn(
          `[ingestao] a prova nao tem texto nativo: ${resumo.paginas} paginas em precisa_ocr, ` +
            "nenhuma chamada ao modelo (BANCO-12).",
        );
      } else {
        console.log(
          `[ingestao] ${resumo.paginas} paginas em ${resumo.blocos} blocos; ` +
            `${resumo.enviados} enviados agora.`,
        );
      }
    } else {
      const bucket = await getParam("param.m1.bucket_de_imagens");
      const subir = opcoes.subirImagem ?? subidorDoStorage(ambiente, bucket);
      const resumo = await colher(cliente, argumentos, bruto, subir);
      console.log(
        `[ingestao] ${resumo.blocosProntos} blocos colhidos, ` +
          `${resumo.blocosEsperando} ainda no provedor; ` +
          `${resumo.questoesInseridas} questoes inseridas, ` +
          `${resumo.questoesRecusadas} recusadas.` +
          (resumo.provaCompleta ? " Prova extraida." : ""),
      );
    }

    await encerrar();
    return 0;
  } catch (erro) {
    await reportar(erro, {
      origem: "ingestao-de-prova",
      motivo: "a ingestao parou antes de terminar",
    });
    await encerrar();
    return 1;
  } finally {
    await cliente.end().catch(() => {});
  }
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const ambiente = ambienteDoScript();
  for (const chave of [
    "NEXT_PUBLIC_SENTRY_DSN",
    "OPENAI_API_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SECRET_KEY",
  ]) {
    if (ambiente[chave]) process.env[chave] = ambiente[chave];
  }
  process.exit(await executar(ambiente, process.argv.slice(2)));
}
