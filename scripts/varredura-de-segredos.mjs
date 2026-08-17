#!/usr/bin/env node
/**
 * Varredura de segredo em arquivo versionado (INFRA-10).
 *
 * A SPEC 01 ja tinha esta regra, mas ela morava dentro do YAML da CI e nao
 * tinha teste — o que significa que ninguem sabia se ela ainda pegava alguma
 * coisa. Aqui ela vira codigo com teste, e o YAML so chama.
 *
 * Sem acao externa de proposito: nada de licenca nem de versao para quebrar.
 *
 * **O que esta varredura nao e:** ela nao substitui a disciplina. Segredo que ja
 * entrou no historico do git continua la mesmo depois do commit de remocao —
 * a unica correcao de verdade e **rotacionar a chave**. Ver docs/SEGREDOS.md.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { pathToFileURL } from "node:url";

/**
 * Cada padrao tem nome para o erro dizer **o que** achou, e nao so "achei algo".
 *
 * @type {Array<{ nome: string, regex: RegExp }>}
 */
export const PADROES = [
  { nome: "token de acesso do Supabase", regex: /sbp_[A-Za-z0-9]{20,}/ },
  { nome: "chave secreta do Supabase", regex: /sb_secret_[A-Za-z0-9_-]{20,}/ },
  { nome: "token de autenticacao do Sentry", regex: /sntrys_[A-Za-z0-9_=+/-]{20,}/ },
  { nome: "chave da OpenAI", regex: /sk-[A-Za-z0-9_-]{20,}/ },
  { nome: "chave de producao de gateway", regex: /(?:sk|rk)_live_[A-Za-z0-9]{20,}/ },
  { nome: "token do Slack", regex: /xox[baprs]-[A-Za-z0-9-]{10,}/ },
  { nome: "chave de acesso da AWS", regex: /AKIA[0-9A-Z]{16}/ },
  { nome: "token do GitHub", regex: /ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{50,}/ },
  { nome: "chave da Google", regex: /AIza[0-9A-Za-z_-]{35}/ },
  { nome: "chave privada", regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  {
    // Senha de banco embutida na string de conexao.
    //
    // Duas restricoes evitam alarme falso sem afrouxar a regra:
    // · senha de 8+ caracteres — exemplo curto de documentacao (`u:s@host`) nao
    //   e credencial;
    // · a senha nao pode comecar por `${` nem conter aspas — isso e marcador de
    //   codigo, nao segredo. `postgresql://u:${SENHA}@host` e uma fixture de
    //   teste montando a string, e o valor de verdade nao esta ali.
    nome: "senha dentro de string de conexao do Postgres",
    regex: /postgres(?:ql)?:\/\/[^:\s/]+:(?!\$\{)[^@\s/"'`]{8,}@/,
  },
];

/** Extensoes que nao vale a pena varrer — binario nao guarda segredo em texto. */
const EXTENSOES_IGNORADAS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf",
  ".mp3", ".wav", ".mp4", ".woff", ".woff2", ".ttf", ".zip",
]);

const TAMANHO_MAXIMO = 2 * 1024 * 1024;

/**
 * Achados dentro de um texto, com numero de linha.
 *
 * @param {string} texto
 * @returns {Array<{ nome: string, linha: number, trecho: string }>}
 */
export function encontrarSegredos(texto) {
  const achados = [];
  const linhas = texto.split(/\r?\n/);

  for (let i = 0; i < linhas.length; i += 1) {
    for (const { nome, regex } of PADROES) {
      const casou = regex.exec(linhas[i]);
      if (casou === null) continue;
      achados.push({
        nome,
        linha: i + 1,
        // Nunca imprime o valor inteiro: o log da CI e publico para quem tem o
        // repositorio, e vazar no relatorio do vazamento seria irônico demais.
        trecho: `${casou[0].slice(0, 8)}…`,
      });
    }
  }

  return achados;
}

/**
 * @param {string} caminho
 * @returns {boolean}
 */
export function deveVarrer(caminho) {
  const ponto = caminho.lastIndexOf(".");
  const extensao = ponto === -1 ? "" : caminho.slice(ponto).toLowerCase();
  return !EXTENSOES_IGNORADAS.has(extensao);
}

/** @returns {string[]} */
export function arquivosVersionados() {
  return execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
    .split("\0")
    .filter((caminho) => caminho !== "");
}

/** O `.env` nunca pode estar versionado — `.env.example` documenta sem valor. */
export function envEstaVersionado() {
  try {
    execFileSync("git", ["ls-files", "--error-unmatch", ".env"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/** @returns {number} codigo de saida */
export function executar() {
  let achouAlgo = false;

  for (const caminho of arquivosVersionados()) {
    if (!deveVarrer(caminho)) continue;

    let texto;
    try {
      if (statSync(caminho).size > TAMANHO_MAXIMO) continue;
      texto = readFileSync(caminho, "utf8");
    } catch {
      continue; // arquivo removido no meio da varredura, ou ilegivel
    }

    for (const achado of encontrarSegredos(texto)) {
      console.error(
        `::error file=${caminho},line=${achado.linha}::${achado.nome} em arquivo versionado (${achado.trecho})`,
      );
      achouAlgo = true;
    }
  }

  if (envEstaVersionado()) {
    console.error("::error::.env esta versionado. Ele deve ficar apenas na maquina local.");
    achouAlgo = true;
  }

  if (achouAlgo) {
    console.error(
      "\nSegredo no repositorio. ROTACIONE a chave — remover o commit nao basta, " +
        "ela ja esteve no historico. Depois mova o valor para o .env, que o git ignora. " +
        "Ver docs/SEGREDOS.md.",
    );
    return 1;
  }

  console.log("Nenhuma credencial encontrada em arquivo versionado.");
  return 0;
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exit(executar());
}
