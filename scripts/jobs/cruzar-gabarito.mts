#!/usr/bin/env node
/**
 * O cruzamento do gabarito definitivo (BANCO-04).
 *
 * Job separado da extracao de proposito, e nao por arrumacao: o gabarito
 * definitivo sai da banca **dias** depois da prova, e as vezes e retificado
 * semanas depois. Amarrar as duas coisas num comando so obrigaria a reextrair a
 * prova para aplicar uma retificacao de uma letra.
 *
 * **Nao chama IA.** A verdade e o gabarito oficial (invariante nº4), entao este
 * job nao precisa de `OPENAI_API_KEY` e roda mesmo com a IA fora do ar.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { Client } from "pg";

import { cruzarGabarito, lerGabarito, lerProva, marcarProva } from "@/modules/acervo";
import { definirLeitorDeConfig } from "@/modules/config";
import { type ClienteSql, leitorDeConfigPorPg } from "@/modules/ia";

import { lerEnv } from "../alvo-do-banco.mjs";

import { encerrar, iniciarSentry, reportar } from "./sentry-node.mjs";

export type Argumentos = {
  provaId: string;
  arquivo: string;
  /** Opcional: o JSON pode trazer a versao dentro dele. */
  versao: string | undefined;
};

export function lerArgumentos(argv: readonly string[]): Argumentos {
  const valores = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith("--")) valores.set(argv[i].slice(2), argv[i + 1] ?? "");
  }

  const provaId = valores.get("prova")?.trim() ?? "";
  const arquivo = valores.get("gabarito")?.trim() ?? "";
  const versao = valores.get("versao")?.trim();

  if (provaId === "" || arquivo === "") {
    throw new Error(
      "uso: cruzar-gabarito --prova <uuid> --gabarito <arquivo.json|.csv> [--versao <rotulo>]",
    );
  }
  return { provaId, arquivo, versao: versao === "" ? undefined : versao };
}

export function ambienteDoScript(
  raiz: string = process.cwd(),
): Record<string, string | undefined> {
  const caminho = path.join(raiz, ".env");
  if (!existsSync(caminho)) return { ...process.env };
  return { ...process.env, ...lerEnv(readFileSync(caminho, "utf8")) };
}

export function motivoDeParada(
  ambiente: Record<string, string | undefined>,
): string | null {
  if (!ambiente.DATABASE_URL?.trim()) {
    return "DATABASE_URL nao esta definida. Ver docs/SEGREDOS.md.";
  }
  return null;
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
    lerArquivo?: (caminho: string) => string;
  } = {},
): Promise<number> {
  const motivo = motivoDeParada(ambiente);
  if (motivo !== null) {
    console.error(`[gabarito] ${motivo}`);
    return 1;
  }

  let argumentos: Argumentos;
  let conteudo: string;
  try {
    argumentos = lerArgumentos(argv);
    const ler = opcoes.lerArquivo ?? ((caminho: string) => readFileSync(caminho, "utf8"));
    conteudo = ler(argumentos.arquivo);
  } catch (erro) {
    console.error(`[gabarito] ${String(erro)}`);
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

    // O gabarito e recusado **antes** de qualquer escrita: gabarito errado
    // ensina errado, e meio arquivo aplicado seria pior do que nenhum.
    const gabarito = lerGabarito(conteudo, argumentos.versao);
    await lerProva(cliente, argumentos.provaId);

    const resumo = await cruzarGabarito(cliente, argumentos.provaId, gabarito);

    console.log(
      `[gabarito] versao "${gabarito.versao}": ${resumo.preenchidas} preenchidas, ` +
        `${resumo.versionadas} retificadas (versao nova), ${resumo.inalteradas} inalteradas, ` +
        `${resumo.anuladas} anuladas, ${resumo.semQuestao} ainda sem questao extraida.`,
    );

    // A prova so muda de estado quando o gabarito alcancou tudo que existe.
    // Sobrou item sem questao? A extracao ainda nao terminou, e o cruzamento
    // roda de novo depois — e idempotente (AD-036).
    if (resumo.semQuestao === 0) {
      await marcarProva(cliente, argumentos.provaId, "gabarito_cruzado");
    } else {
      console.warn(
        `[gabarito] a prova continua em ${resumo.semQuestao} item(ns) sem questao: ` +
          "rode de novo depois que a extracao terminar.",
      );
    }

    await encerrar();
    return 0;
  } catch (erro) {
    await reportar(erro, {
      origem: "cruzar-gabarito",
      motivo: "o cruzamento do gabarito parou antes de terminar",
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
  if (ambiente.NEXT_PUBLIC_SENTRY_DSN) {
    process.env.NEXT_PUBLIC_SENTRY_DSN = ambiente.NEXT_PUBLIC_SENTRY_DSN;
  }
  process.exit(await executar(ambiente, process.argv.slice(2)));
}
