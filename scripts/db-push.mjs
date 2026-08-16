#!/usr/bin/env node
/**
 * `npm run db:push` — aplica as migracoes de supabase/migrations no projeto de
 * desenvolvimento, sem Docker (AD-083).
 *
 * Le o .env explicitamente e **forca** os valores do arquivo por cima do
 * ambiente, na ordem contraria da que o Node usa: `--env-file` deixa a variavel
 * do sistema vencer, e a variavel do sistema desta maquina guarda o token de
 * outra conta. Antes de chamar o CLI, confere para onde a conexao aponta.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { conferirAlvo, lerEnv } from "./alvo-do-banco.mjs";

const RAIZ = process.cwd();
const CAMINHO_ENV = path.join(RAIZ, ".env");
const CAMINHO_CLI = path.join(RAIZ, "node_modules", "supabase", "dist", "supabase.js");

/** @param {string} mensagem */
function morrer(mensagem) {
  console.error(`\n[db:push] ${mensagem}\n`);
  process.exit(1);
}

if (!existsSync(CAMINHO_ENV)) {
  morrer("nao achei o .env na raiz do projeto. Copie .env.example para .env e preencha DATABASE_URL.");
}
if (!existsSync(CAMINHO_CLI)) {
  morrer("nao achei o Supabase CLI em node_modules. Rode `npm install` antes.");
}

const doArquivo = lerEnv(readFileSync(CAMINHO_ENV, "utf8"));
const databaseUrl = doArquivo.DATABASE_URL;

if (!databaseUrl) {
  morrer("DATABASE_URL esta vazia no .env. Pegue a string do Session pooler no painel do Supabase.");
}

const alvo = conferirAlvo(databaseUrl);
if (!alvo.ok) {
  morrer(alvo.motivo);
}

// O valor do arquivo vence o do sistema, nao o contrario.
const ambiente = { ...process.env };
if (doArquivo.SUPABASE_ACCESS_TOKEN) {
  ambiente.SUPABASE_ACCESS_TOKEN = doArquivo.SUPABASE_ACCESS_TOKEN;
}

const resultado = spawnSync(
  process.execPath,
  [CAMINHO_CLI, "db", "push", "--db-url", databaseUrl, ...process.argv.slice(2)],
  { stdio: "inherit", env: ambiente, cwd: RAIZ },
);

process.exit(resultado.status ?? 1);
