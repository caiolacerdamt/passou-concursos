#!/usr/bin/env node
/**
 * `node scripts/aplicar-emails-auth.mjs` — sobe os templates de e-mail do
 * Supabase Auth a partir de `docs/emails/`.
 *
 * Por que existe, em vez de colar no painel: o texto do e-mail que o aluno
 * recebe e produto, e produto mora no repositorio. Colado so no painel, ele
 * fica sem historico, sem revisao e sem como saber quem mudou o que — e a
 * proxima pessoa que abrir a caixa de texto nao tem como saber se o que esta
 * la e o que deveria estar.
 *
 * Roda **contra producao**. Por isso: mostra o diff, exige `--sim` para
 * escrever, e grava o estado anterior em `.temp/auth-config-backup-<hora>.json`
 * antes de tocar em qualquer coisa.
 *
 *   node scripts/aplicar-emails-auth.mjs          # so mostra o que mudaria
 *   node scripts/aplicar-emails-auth.mjs --sim    # aplica
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { lerEnv } from "./alvo-do-banco.mjs";

const RAIZ = process.cwd();
const PROJETO = "kfpmetkmhjtmgwgaaerl";
const API = `https://api.supabase.com/v1/projects/${PROJETO}/config/auth`;

/** @param {string} mensagem */
function morrer(mensagem) {
  console.error(`\n[emails-auth] ${mensagem}\n`);
  process.exit(1);
}

const caminhoEnv = path.join(RAIZ, ".env");
const doArquivo = existsSync(caminhoEnv)
  ? lerEnv(readFileSync(caminhoEnv, "utf8"))
  : {};
const token = doArquivo.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_ACCESS_TOKEN;

if (!token) {
  morrer("SUPABASE_ACCESS_TOKEN nao esta definida. Preencha o .env.");
}

/**
 * O cabecalho `<!-- ... -->` do arquivo e comentario **para quem le o
 * repositorio**, e nao conteudo do e-mail. Ele sai antes de subir.
 *
 * @param {string} arquivo
 */
function corpoDoTemplate(arquivo) {
  const bruto = readFileSync(path.join(RAIZ, "docs", "emails", arquivo), "utf8");
  return bruto.replace(/^<!--[\s\S]*?-->\s*/, "").trim();
}

const DESEJADO = {
  mailer_templates_confirmation_content: corpoDoTemplate("confirm-signup.html"),
  mailer_subjects_confirmation: "Confirme seu e-mail e comece o teste de 7 dias",

  mailer_templates_recovery_content: corpoDoTemplate("reset-password.html"),
  mailer_subjects_recovery: "Defina a senha da sua conta",

  // `/auth/confirm` do dominio de producao faltava na lista. O template monta o
  // link com `{{ .SiteURL }}` e passa mesmo sem ele, mas `emailRedirectTo` e
  // `redirectTo` do codigo apontam para la — fora da lista, o Supabase os
  // descarta em silencio e volta para a Site URL.
  uri_allow_list: [
    "https://www.passouconcursos.com/auth/callback",
    "https://www.passouconcursos.com/auth/confirm",
    "http://localhost:3000/auth/callback",
    "http://localhost:3000/auth/confirm",
  ].join(","),
};

const cabecalhos = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
};

const atual = await fetch(API, { headers: cabecalhos }).then((r) => {
  if (!r.ok) morrer(`GET falhou: ${r.status}`);
  return r.json();
});

const pasta = path.join(RAIZ, ".temp");
mkdirSync(pasta, { recursive: true });
const backup = path.join(
  pasta,
  `auth-config-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
);
writeFileSync(
  backup,
  JSON.stringify(
    Object.fromEntries(
      Object.keys(atual)
        .filter((c) => /^mailer_(templates|subjects)_/.test(c) || c === "uri_allow_list")
        .map((c) => [c, atual[c]]),
    ),
    null,
    2,
  ),
);
console.log(`[emails-auth] estado anterior salvo em ${path.relative(RAIZ, backup)}`);

const mudancas = Object.keys(DESEJADO).filter((c) => atual[c] !== DESEJADO[c]);

if (mudancas.length === 0) {
  console.log("[emails-auth] o painel ja esta igual a docs/emails/. Nada a fazer.");
  process.exit(0);
}

console.log("\n[emails-auth] mudaria:");
for (const chave of mudancas) {
  const de = String(atual[chave] ?? "").replace(/\s+/g, " ").slice(0, 90);
  const para = String(DESEJADO[chave]).replace(/\s+/g, " ").slice(0, 90);
  console.log(`\n  ${chave}\n    de:   ${de}…\n    para: ${para}…`);
}

if (!process.argv.includes("--sim")) {
  console.log(
    "\n[emails-auth] nada foi escrito. Rode de novo com --sim para aplicar.\n",
  );
  process.exit(0);
}

const resposta = await fetch(API, {
  method: "PATCH",
  headers: cabecalhos,
  body: JSON.stringify(DESEJADO),
});

if (!resposta.ok) {
  morrer(`PATCH falhou: ${resposta.status} ${await resposta.text()}`);
}

const depois = await resposta.json();
const divergentes = Object.keys(DESEJADO).filter(
  (c) => depois[c] !== DESEJADO[c],
);

if (divergentes.length > 0) {
  morrer(`o painel aceitou mas nao gravou: ${divergentes.join(", ")}`);
}

console.log(`\n[emails-auth] aplicado. ${mudancas.length} chave(s) atualizada(s).\n`);
