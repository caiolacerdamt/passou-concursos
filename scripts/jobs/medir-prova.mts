#!/usr/bin/env node
/**
 * A medicao de uma prova: PDF -> grade declarada + itens + etiquetas
 * (BANCO-14, BANCO-15, BANCO-16 · AD-138).
 *
 * Nao substitui a ingestao. A `ingestao-de-prova` monta **acervo** — enunciado,
 * alternativas, gabarito cruzado, explicacao — e custa o preco disso. Este
 * comando responde a outra pergunta, muito mais barata: *o que esta banca
 * cobra?* Para isso bastam `(prova, numero do item, assunto)`.
 *
 * Sao tres acoes, na ordem crescente de custo, e cada uma so acontece porque a
 * anterior nao bastou:
 *
 *   `grade`     le a grade que a prova declara de si mesma. Custo zero.
 *   `separar`   separa os itens por regra de texto. Custo zero. Quando fecha com
 *               a grade, **nenhuma chamada a modelo acontece** (BANCO-16 AC2);
 *               quando nao fecha, a reserva por modelo entra e fica registrada.
 *   `etiquetar` a unica chamada de modelo do caminho feliz: ~R$ 0,02 por prova.
 *   `relatorio` so le e imprime.
 *
 * **Nenhuma linha de PDF vai para a saida.** O agente que dispara este comando
 * le contagem e veredito; a prova fica no disco do runner (AD-140). E por isso
 * que ele roda em **GitHub Actions**, nunca em funcao da Vercel (AD-035/036).
 *
 * Retomavel: rodar de novo nao duplica etiqueta (a chave e `(prova, numero)`) e
 * nao apaga correcao humana (BANCO-14 AC4).
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { Client } from "pg";

import {
  type Conferencia,
  type EtiquetaCasada,
  type GradeDeclarada,
  type ItemSeparado,
  type TopicoCanonico,
  INSTRUCAO_DA_SEPARACAO,
  NOME_DO_FORMATO_DA_ETIQUETA,
  NOME_DO_FORMATO_DA_SEPARACAO,
  SCHEMA_DA_ETIQUETA,
  SCHEMA_DA_SEPARACAO,
  blocosParaOBanco,
  casarEtiquetas,
  conferirComGrade,
  cortarPorTrechos,
  entradaDoPedido,
  etiquetasParaOBanco,
  etiquetasSugeridasSchema,
  instrucaoComCatalogo,
  itensSeparadosPorModeloSchema,
  lerCatalogo,
  lerGradeDeclarada,
  lerPdf,
  lotesDeItens,
  marcarProva,
  nomearBlocos,
  separarItens,
} from "@/modules/acervo";
import { definirLeitorDeConfig, getParam } from "@/modules/config";
import {
  type ClienteSql,
  definirRepositorioDeIa,
  executarTarefa,
  leitorDeConfigPorPg,
  perfilDaTarefa,
  principalDe,
  repositorioPorPg,
} from "@/modules/ia";

import { lerEnv } from "../alvo-do-banco.mjs";

import { encerrar, iniciarSentry, reportar } from "./sentry-node.mjs";

export type Acao = "grade" | "separar" | "etiquetar" | "relatorio";

const ACOES: readonly Acao[] = ["grade", "separar", "etiquetar", "relatorio"];

export const USO =
  "uso: medir-prova --acao grade|separar|etiquetar|relatorio " +
  "--prova <uuid> [--pdf <arquivo.pdf>]   (relatorio dispensa --pdf)";

export type Argumentos = { provaId: string; pdf: string; acao: Acao };

export function lerArgumentos(argv: readonly string[]): Argumentos {
  const valores = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const chave = argv[i];
    if (chave.startsWith("--")) valores.set(chave.slice(2), argv[i + 1] ?? "");
  }

  const provaId = valores.get("prova")?.trim() ?? "";
  const pdf = valores.get("pdf")?.trim() ?? "";
  const acao = (valores.get("acao")?.trim() ?? "") as Acao;

  if (!ACOES.includes(acao)) throw new Error(USO);
  if (provaId === "") throw new Error(USO);
  if (acao !== "relatorio" && pdf === "") throw new Error(USO);

  return { provaId, pdf, acao };
}

// ── Acao `grade` ────────────────────────────────────────────────────────────

export type ResumoDaGrade = {
  status: "ausente" | "lida" | "inconsistente";
  blocos: number;
  itensDeclarados: number | null;
  somaDosBlocos: number;
  precisaOcr: boolean;
};

/**
 * Le a grade e grava o veredito.
 *
 * PDF sem camada de texto **nao e separado por regra nenhuma**: vai para a fila
 * `precisa_ocr` que ja existe desde o BANCO-12, e para (BANCO-16 AC4).
 */
export async function acaoGrade(
  cliente: ClienteSql,
  provaId: string,
  bruto: Buffer,
): Promise<ResumoDaGrade> {
  const pdf = lerPdf(bruto);
  if (!pdf.temTextoNativo) {
    await marcarProva(cliente, provaId, "precisa_ocr");
    return {
      status: "ausente",
      blocos: 0,
      itensDeclarados: null,
      somaDosBlocos: 0,
      precisaOcr: true,
    };
  }

  const grade = lerGradeDeclarada(pdf.paginas);
  // O nome do bloco sai do corpo, e nao da tabela da capa: la os nomes vem
  // colados ou quebrados, e separa-los por regra seria chute.
  const { nomesPorItemInicial } = separarItens(pdf.paginas);
  const blocos = nomearBlocos(grade.blocos, nomesPorItemInicial);

  const { rows } = await cliente.query(
    "select public.registrar_grade_declarada($1, $2, $3::jsonb) as status",
    [provaId, grade.totalDeclarado, JSON.stringify(blocosParaOBanco(blocos))],
  );

  return {
    // O veredito que vale e o do banco: ele reconta a soma e olha sobreposicao.
    status: String(rows[0]?.status ?? grade.status) as ResumoDaGrade["status"],
    blocos: blocos.length,
    itensDeclarados: grade.totalDeclarado,
    somaDosBlocos: grade.somaDosBlocos,
    precisaOcr: false,
  };
}

// ── Acao `separar` ──────────────────────────────────────────────────────────

export type ResumoDaSeparacao = {
  via: "deterministica" | "modelo" | null;
  itens: number;
  conferencia: Conferencia;
  chamouModelo: boolean;
  custoUsd: number | null;
};

/** A grade que o banco guardou, que e a que a conferencia usa. */
async function gradeGravada(
  cliente: ClienteSql,
  provaId: string,
): Promise<GradeDeclarada> {
  const { rows: prova } = await cliente.query(
    "select itens_declarados, grade_status from public.provas where id = $1",
    [provaId],
  );
  const { rows: blocos } = await cliente.query(
    `select ordem, nome_impresso, item_inicial, item_final, pontuacao_por_item, base
       from public.prova_blocos where prova_id = $1 order by ordem`,
    [provaId],
  );

  return {
    totalDeclarado:
      prova[0]?.itens_declarados === null || prova[0]?.itens_declarados === undefined
        ? null
        : Number(prova[0].itens_declarados),
    status: (prova[0]?.grade_status ?? "ausente") as GradeDeclarada["status"],
    somaDosBlocos: blocos.reduce(
      (soma, b) => soma + (Number(b.item_final) - Number(b.item_inicial) + 1),
      0,
    ),
    blocos: blocos.map((b) => ({
      ordem: Number(b.ordem),
      nomeImpresso: b.nome_impresso === null ? null : String(b.nome_impresso),
      itemInicial: Number(b.item_inicial),
      itemFinal: Number(b.item_final),
      pontuacaoPorItem: b.pontuacao_por_item === null ? null : Number(b.pontuacao_por_item),
      base: b.base as "pontos" | "itens",
    })),
  };
}

/**
 * Separa os itens, com a reserva por modelo so quando o codigo nao fecha.
 *
 * Os itens separados **nao sao gravados**: a etiqueta e que persiste, e ela
 * nasce do texto que este passo devolve. Guardar o texto do item seria guardar
 * meia questao — a questao inteira e da SPEC 09, com todas as travas dela.
 */
export async function acaoSeparar(
  cliente: ClienteSql,
  provaId: string,
  bruto: Buffer,
): Promise<ResumoDaSeparacao & { itensSeparados: ItemSeparado[] }> {
  const pdf = lerPdf(bruto);
  if (!pdf.temTextoNativo) {
    await marcarProva(cliente, provaId, "precisa_ocr");
    throw new Error(
      "a prova nao tem camada de texto: foi para precisa_ocr e SHALL NOT ser separada por regra (BANCO-16 AC4)",
    );
  }

  const grade = await gradeGravada(cliente, provaId);
  const tolerancia = await getParam("param.m1.tolerancia_grade");

  const { itens } = separarItens(pdf.paginas);
  let conferencia = conferirComGrade(itens, grade, tolerancia);
  let escolhidos = itens;
  let via: "deterministica" | "modelo" = "deterministica";
  let custoUsd: number | null = null;
  let chamouModelo = false;

  if (!conferencia.fecha && grade.status === "lida") {
    // BANCO-16 AC3: o codigo nao fechou, entao a reserva entra — e fica escrita
    // na prova. Grade nao lida **nao** aciona a reserva: sem grade nao ha contra
    // o que conferir, e pagar o modelo para produzir um numero que ninguem pode
    // checar e o oposto do desenho.
    chamouModelo = true;
    const resultado = await executarTarefa({
      tarefa: "separacao_de_itens",
      alvo: { livre: `separacao:${provaId}` },
      pedido: {
        instrucao: INSTRUCAO_DA_SEPARACAO,
        entrada: pdf.paginas.map((p) => p.texto).join("\n"),
        formato: { nome: NOME_DO_FORMATO_DA_SEPARACAO, schema: SCHEMA_DA_SEPARACAO },
      },
    });
    custoUsd = resultado.custoUsd;

    const apontados = itensSeparadosPorModeloSchema.parse(
      resultado.estruturado ?? JSON.parse(resultado.texto),
    );
    const doModelo = cortarPorTrechos(pdf.paginas, apontados.itens);
    const conferenciaDoModelo = conferirComGrade(doModelo, grade, tolerancia);

    // A reserva so ganha se melhorar. Modelo que devolve menos item que o
    // separador de texto nao vira a verdade da prova.
    if (conferenciaDoModelo.itensSeparados > conferencia.itensSeparados) {
      escolhidos = doModelo;
      conferencia = conferenciaDoModelo;
      via = "modelo";
    }
  }

  await cliente.query(
    `update public.provas
        set separacao_via     = $2::separacao_via,
            conferencia_motivo = $3,
            atualizada_em     = now()
      where id = $1`,
    [provaId, via, conferencia.fecha ? null : conferencia.motivo],
  );

  return {
    via,
    itens: escolhidos.length,
    itensSeparados: escolhidos,
    conferencia,
    chamouModelo,
    custoUsd,
  };
}

// ── Acao `etiquetar` ────────────────────────────────────────────────────────

export type ResumoDaEtiquetagem = {
  pedidos: number;
  casadas: number;
  naoCasadas: number;
  gravadas: number;
  preservadas: number;
  alinhadas: number;
  custoUsd: number;
};

export async function acaoEtiquetar(
  cliente: ClienteSql,
  provaId: string,
  itens: readonly ItemSeparado[],
): Promise<ResumoDaEtiquetagem> {
  const catalogo: TopicoCanonico[] = await lerCatalogo(cliente);
  const porPedido = await getParam("param.m1.itens_por_pedido_de_etiqueta");
  const instrucao = instrucaoComCatalogo(catalogo);

  // A versao **fixada** do modelo, lida da matriz de configuracao. Nome de
  // modelo nao mora em codigo (AD-068); e este valor que vai para a coluna
  // `modelo_versao` de cada etiqueta.
  const perfil = await perfilDaTarefa("etiqueta_de_item");
  const modeloVersao = principalDe(perfil).versao;

  const casadas: EtiquetaCasada[] = [];
  let naoCasadas = 0;
  let custoUsd = 0;
  const lotes = lotesDeItens(itens, porPedido);

  for (const [indice, lote] of lotes.entries()) {
    const resultado = await executarTarefa({
      tarefa: "etiqueta_de_item",
      // A dedup do IA-14: reexecutar a prova nao paga de novo pelo lote que ja
      // voltou. O indice entra na chave porque o lote e a unidade que se repete.
      alvo: { livre: `etiqueta:${provaId}:${indice}` },
      pedido: {
        instrucao,
        entrada: entradaDoPedido(lote),
        formato: { nome: NOME_DO_FORMATO_DA_ETIQUETA, schema: SCHEMA_DA_ETIQUETA },
      },
    });
    custoUsd += resultado.custoUsd ?? 0;

    const sugestoes = etiquetasSugeridasSchema.parse(
      resultado.estruturado ?? JSON.parse(resultado.texto),
    );
    const casamento = casarEtiquetas(
      sugestoes.etiquetas,
      catalogo,
      lote.map((i) => i.numero),
    );
    casadas.push(...casamento.casadas);
    naoCasadas += casamento.naoCasadas.length;
  }

  const { rows } = await cliente.query(
    "select * from public.gravar_etiquetas_ia($1, $2::jsonb, $3)",
    [provaId, JSON.stringify(etiquetasParaOBanco(casadas)), modeloVersao],
  );

  return {
    pedidos: lotes.length,
    casadas: casadas.length,
    naoCasadas,
    gravadas: Number(rows[0]?.gravadas ?? 0),
    preservadas: Number(rows[0]?.preservadas ?? 0),
    alinhadas: Number(rows[0]?.alinhadas ?? 0),
    custoUsd,
  };
}

// ── Acao `relatorio` ────────────────────────────────────────────────────────

export type LinhaDoRelatorio = {
  banca: string;
  ano: number;
  orgao: string;
  cargo: string;
  caderno: string | null;
  gradeStatus: string;
  separacaoVia: string | null;
  conferenciaMotivo: string | null;
  cadernoIrmaoDe: string | null;
  itensDeclarados: number | null;
  itensIngeridos: number;
  cobertura: number | null;
  blocos: { nome: string | null; inicial: number; final: number; peso: number; base: string }[];
};

export async function lerRelatorio(
  cliente: ClienteSql,
  provaId: string,
): Promise<LinhaDoRelatorio | null> {
  const { rows } = await cliente.query(
    "select * from public.cobertura_da_prova where prova_id = $1",
    [provaId],
  );
  if (rows.length === 0) return null;

  const { rows: blocos } = await cliente.query(
    `select nome_impresso, item_inicial, item_final, base,
            public.peso_do_bloco(b.*) as peso
       from public.prova_blocos b where prova_id = $1 order by ordem`,
    [provaId],
  );

  const linha = rows[0];
  return {
    banca: String(linha.banca),
    ano: Number(linha.ano),
    orgao: String(linha.orgao),
    cargo: String(linha.cargo),
    caderno: linha.caderno === null ? null : String(linha.caderno),
    gradeStatus: String(linha.grade_status),
    separacaoVia: linha.separacao_via === null ? null : String(linha.separacao_via),
    conferenciaMotivo:
      linha.conferencia_motivo === null ? null : String(linha.conferencia_motivo),
    cadernoIrmaoDe: linha.caderno_irmao_de === null ? null : String(linha.caderno_irmao_de),
    itensDeclarados: linha.itens_declarados === null ? null : Number(linha.itens_declarados),
    itensIngeridos: Number(linha.itens_ingeridos),
    cobertura: linha.cobertura === null ? null : Number(linha.cobertura),
    blocos: blocos.map((b) => ({
      nome: b.nome_impresso === null ? null : String(b.nome_impresso),
      inicial: Number(b.item_inicial),
      final: Number(b.item_final),
      peso: Number(b.peso),
      base: String(b.base),
    })),
  };
}

/**
 * O relatorio que o agente le.
 *
 * Contagem e veredito. **Nenhum trecho de prova entra aqui** — e a metade do
 * AD-140 que este comando existe para cumprir: o PDF nao passa pela conversa,
 * onde seria reenviado a cada turno.
 */
export function formatarRelatorio(linha: LinhaDoRelatorio): string {
  const partes = [
    `${linha.banca} ${linha.ano} · ${linha.orgao} · ${linha.cargo}` +
      (linha.caderno ? ` · caderno ${linha.caderno}` : ""),
    `grade: ${linha.gradeStatus}` +
      (linha.itensDeclarados === null ? "" : ` (${linha.itensDeclarados} itens declarados)`),
    `separacao: ${linha.separacaoVia ?? "nao rodou"}`,
    `etiquetas: ${linha.itensIngeridos}` +
      (linha.cobertura === null
        ? ""
        : ` · cobertura ${(linha.cobertura * 100).toFixed(1)}%`),
  ];

  if (linha.cadernoIrmaoDe !== null) {
    partes.push("caderno irmao: registrado, NAO soma peso ao ano (BANCO-16 AC6)");
  }
  if (linha.conferenciaMotivo !== null) {
    partes.push(`conferencia humana pendente: ${linha.conferenciaMotivo}`);
  }
  for (const bloco of linha.blocos) {
    partes.push(
      `  ${bloco.nome ?? "(sem nome impresso)"} · itens ${bloco.inicial}-${bloco.final} · ` +
        `peso ${bloco.peso} em ${bloco.base}`,
    );
  }

  return partes.join("\n");
}

// ── Provisionamento ─────────────────────────────────────────────────────────

export function ambienteDoScript(
  raiz: string = process.cwd(),
): Record<string, string | undefined> {
  const caminho = path.join(raiz, ".env");
  if (!existsSync(caminho)) return { ...process.env };
  return { ...process.env, ...lerEnv(readFileSync(caminho, "utf8")) };
}

/**
 * O que impede o comando de rodar.
 *
 * `grade`, `separar` e `relatorio` nao precisam de chave de modelo: as duas
 * primeiras so chamam modelo na reserva, e a reserva sem chave para com a recusa
 * do gateway, que e visivel. Exigir a chave delas impediria medir a grade de uma
 * prova nova antes de provisionar nada — que e justamente quando isso e util.
 */
export function motivoDeParada(
  ambiente: Record<string, string | undefined>,
  acao: Acao = "grade",
): string | null {
  if (!ambiente.DATABASE_URL?.trim()) {
    return "DATABASE_URL nao esta definida. Ver docs/SEGREDOS.md.";
  }
  if (acao === "etiquetar" && !ambiente.OPENAI_API_KEY?.trim()) {
    return "OPENAI_API_KEY nao esta definida: nenhuma prova e etiquetada sem ela.";
  }
  return null;
}

/** @returns codigo de saida */
export async function executar(
  ambiente: Record<string, string | undefined>,
  argv: readonly string[],
  opcoes: {
    abrirConexao?: () => ClienteSql & { connect(): Promise<void>; end(): Promise<void> };
    lerArquivo?: (caminho: string) => Buffer;
  } = {},
): Promise<number> {
  let argumentos: Argumentos;
  try {
    argumentos = lerArgumentos(argv);
  } catch (erro) {
    console.error(`[medicao] ${String(erro)}`);
    return 1;
  }

  const motivo = motivoDeParada(ambiente, argumentos.acao);
  if (motivo !== null) {
    console.error(`[medicao] ${motivo}`);
    return 1;
  }

  const lerArquivo = opcoes.lerArquivo ?? readFileSync;
  let bruto: Buffer = Buffer.alloc(0);
  if (argumentos.acao !== "relatorio") {
    try {
      bruto = lerArquivo(argumentos.pdf);
    } catch {
      console.error(`[medicao] nao achei o PDF em ${argumentos.pdf}`);
      return 1;
    }
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

    if (argumentos.acao === "grade") {
      const resumo = await acaoGrade(cliente, argumentos.provaId, bruto);
      if (resumo.precisaOcr) {
        console.warn(
          "[medicao] a prova nao tem camada de texto: foi para precisa_ocr, " +
            "nenhuma regra de texto rodou (BANCO-16 AC4).",
        );
      } else {
        console.log(
          `[medicao] grade ${resumo.status}: ${resumo.blocos} blocos somando ` +
            `${resumo.somaDosBlocos} itens contra ${resumo.itensDeclarados ?? "?"} declarados.`,
        );
      }
    } else if (argumentos.acao === "separar") {
      const resumo = await acaoSeparar(cliente, argumentos.provaId, bruto);
      console.log(
        `[medicao] ${resumo.itens} itens por via ${resumo.via}; ` +
          (resumo.chamouModelo
            ? `reserva por modelo acionada (custo ${(resumo.custoUsd ?? 0).toFixed(4)} USD).`
            : "nenhuma chamada a modelo.") +
          (resumo.conferencia.fecha ? " Fecha com a grade." : ` ${resumo.conferencia.motivo}`),
      );
    } else if (argumentos.acao === "etiquetar") {
      const separacao = await acaoSeparar(cliente, argumentos.provaId, bruto);
      const resumo = await acaoEtiquetar(cliente, argumentos.provaId, separacao.itensSeparados);
      console.log(
        `[medicao] ${resumo.pedidos} pedidos; ${resumo.casadas} etiquetas casadas, ` +
          `${resumo.naoCasadas} assuntos fora da taxonomia; ${resumo.gravadas} gravadas, ` +
          `${resumo.preservadas} correcoes humanas preservadas, ` +
          `${resumo.alinhadas} alinhadas com questao publicada. ` +
          `Custo ${resumo.custoUsd.toFixed(4)} USD.`,
      );
    } else {
      const linha = await lerRelatorio(cliente, argumentos.provaId);
      if (linha === null) {
        console.error("[medicao] prova nao encontrada.");
        await encerrar();
        return 1;
      }
      console.log(formatarRelatorio(linha));
    }

    await encerrar();
    return 0;
  } catch (erro) {
    await reportar(erro, {
      origem: "medir-prova",
      motivo: "a medicao parou antes de terminar",
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
  for (const chave of ["NEXT_PUBLIC_SENTRY_DSN", "OPENAI_API_KEY"]) {
    if (ambiente[chave]) process.env[chave] = ambiente[chave];
  }
  process.exit(await executar(ambiente, process.argv.slice(2)));
}
