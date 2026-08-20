#!/usr/bin/env node
/**
 * Mostra qual matriz de modelos esta valendo agora (IA-02 AC1).
 *
 * **So le.** Provisionar e trocar a matriz e INSERT na tabela `configuracoes`,
 * feito por uma pessoa, com autor e motivo registrados (INFRA-11 AC7) — o SQL
 * pronto esta em `docs/IA.md`. Um script que escrevesse por conta propria
 * apagaria justamente o "quem mudou" que a tabela existe para guardar.
 *
 * Existe porque a queda e silenciosa por desenho: perfil malformado derruba a
 * matriz inteira para `{}` e toda tarefa de IA para. Depois de trocar um
 * modelo, este comando e a conferencia.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { Client } from "pg";

import { lerEnv } from "./alvo-do-banco.mjs";

export const CHAVES = ["param.m2.matriz_de_modelos", "param.m2.precos_por_modelo"];

/**
 * A tabela, e nao a view `configuracoes_vigentes` — a view nao expoe `motivo`,
 * e aqui o motivo da ultima troca e metade do que se quer ver. O `distinct on`
 * repete a regra da view, inclusive o desempate por `id`, porque duas linhas
 * inseridas na mesma transacao compartilham o `alterado_em`.
 */
export const CONSULTA = `
  select distinct on (chave) chave, valor, alterado_em, motivo
    from public.configuracoes
   where chave = any($1)
   order by chave, alterado_em desc, id desc
`;

/**
 * @param {string} [raiz]
 * @returns {Record<string, string | undefined>}
 */
export function ambienteDoScript(raiz = process.cwd()) {
  const caminho = path.join(raiz, ".env");
  if (!existsSync(caminho)) return { ...process.env };
  return { ...process.env, ...lerEnv(readFileSync(caminho, "utf8")) };
}

/**
 * Texto do relatorio. Separado da conexao para poder ser testado sem banco.
 *
 * @param {Array<Record<string, unknown>>} linhas
 * @returns {string}
 */
export function relatorio(linhas) {
  if (linhas.length === 0) {
    return [
      "[ia] a matriz de modelos esta VAZIA.",
      "     Nenhuma tarefa de IA roda — e isso e o desenho, nao um defeito.",
      "     Para provisionar: o SQL pronto esta em docs/IA.md.",
    ].join("\n");
  }

  const partes = [];
  for (const linha of linhas) {
    const quando =
      linha.alterado_em instanceof Date
        ? linha.alterado_em.toISOString()
        : String(linha.alterado_em);
    partes.push(`[ia] ${String(linha.chave)}  (desde ${quando})`);
    if (linha.motivo) partes.push(`     motivo: ${String(linha.motivo)}`);
    partes.push(JSON.stringify(linha.valor, null, 2));
  }

  const matriz = linhas.find((l) => l.chave === "param.m2.matriz_de_modelos");
  if (matriz === undefined) {
    partes.push("[ia] ATENCAO: ha precos configurados e nenhuma matriz.");
  } else {
    const tarefas = Object.keys(matriz.valor ?? {});
    partes.push(`[ia] ${tarefas.length} tarefa(s) com perfil: ${tarefas.join(", ")}`);
  }

  return partes.join("\n");
}

/**
 * @param {Record<string, string | undefined>} ambiente
 * @returns {Promise<number>} codigo de saida
 */
export async function executar(ambiente) {
  if (!ambiente.DATABASE_URL?.trim()) {
    console.error("[ia] DATABASE_URL nao esta definida. Ver .env.example.");
    return 1;
  }

  const cliente = new Client({ connectionString: ambiente.DATABASE_URL });
  try {
    await cliente.connect();
    const { rows } = await cliente.query(CONSULTA, [CHAVES]);
    console.log(relatorio(rows));
    return 0;
  } catch (erro) {
    console.error("[ia] nao deu para ler a configuracao:", String(erro));
    return 1;
  } finally {
    await cliente.end().catch(() => {});
  }
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exit(await executar(ambienteDoScript()));
}
