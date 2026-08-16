/**
 * Quem e o banco do outro lado da conexao.
 *
 * Existe porque a maquina de desenvolvimento tem uma variavel de ambiente
 * global do Windows, `SUPABASE_ACCESS_TOKEN`, com o token de OUTRA conta. O
 * `--env-file` do Node **nao** sobrescreve variavel que ja existe no sistema
 * (verificado em 2026-08-16), entao ler o `.env` nao basta: e preciso conferir
 * para onde a conexao aponta antes de aplicar qualquer migracao.
 */

/** O unico projeto onde `npm run db:push` pode aplicar migracao. */
export const PROJETO_REF = "kfpmetkmhjtmgwgaaerl";

/**
 * Le um arquivo .env em texto e devolve um objeto chave/valor.
 * Ignora linha vazia e comentario; tira aspas em volta do valor.
 *
 * @param {string} texto
 * @returns {Record<string, string>}
 */
export function lerEnv(texto) {
  /** @type {Record<string, string>} */
  const saida = {};
  for (const linha of texto.split(/\r?\n/)) {
    const limpa = linha.trim();
    if (limpa === "" || limpa.startsWith("#")) continue;

    const igual = limpa.indexOf("=");
    if (igual === -1) continue;

    const chave = limpa.slice(0, igual).trim();
    let valor = limpa.slice(igual + 1).trim();
    const aspas = valor.startsWith('"') && valor.endsWith('"');
    const apostrofos = valor.startsWith("'") && valor.endsWith("'");
    if (valor.length >= 2 && (aspas || apostrofos)) {
      valor = valor.slice(1, -1);
    }
    saida[chave] = valor;
  }
  return saida;
}

/**
 * Extrai o ref do projeto Supabase de uma string de conexao. Cobre os dois
 * formatos que o painel entrega:
 *   conexao direta -> host  `db.<ref>.supabase.co`
 *   pooler         -> usuario `postgres.<ref>`
 *
 * @param {string | undefined} databaseUrl
 * @returns {string | null} o ref, ou null quando nao da para dizer
 */
export function refDoBanco(databaseUrl) {
  if (typeof databaseUrl !== "string" || databaseUrl.trim() === "") return null;

  let url;
  try {
    url = new URL(databaseUrl.trim());
  } catch {
    return null;
  }

  const direto = /^db\.([a-z0-9]+)\.supabase\.(?:co|com)$/.exec(url.hostname);
  if (direto) return direto[1];

  const pooler = /^postgres\.([a-z0-9]+)$/.exec(
    decodeURIComponent(url.username),
  );
  if (pooler) return pooler[1];

  return null;
}

/**
 * Decide se uma string de conexao pode receber migracao.
 *
 * @param {string | undefined} databaseUrl
 * @returns {{ ok: true } | { ok: false, motivo: string }}
 */
export function conferirAlvo(databaseUrl) {
  const ref = refDoBanco(databaseUrl);
  if (ref === PROJETO_REF) return { ok: true };

  const encontrado = ref === null ? "um projeto que nao consegui identificar" : `"${ref}"`;
  return {
    ok: false,
    motivo:
      `o DATABASE_URL do .env aponta para ${encontrado}, e nao para "${PROJETO_REF}". ` +
      "Recusando: migracao no projeto errado nao tem desfazer.",
  };
}
