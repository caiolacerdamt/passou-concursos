#!/usr/bin/env node
/**
 * Gerador de ilustracao da landing, via OpenRouter.
 *
 * Ferramenta de design, nao de producao: nada em `src/` importa isto. Existe
 * porque a arte de personagem da landing e ativo gerado, e o gerador da skill
 * `impeccable` bate direto em `api.openai.com` — o credito do projeto esta no
 * OpenRouter, entao usamos o endpoint dele (`POST /api/v1/images`, que devolve
 * `data[].b64_json`).
 *
 * A chave sai do `.env` (`OPENROUTER_API_KEY`) e nunca e impressa.
 *
 *   node scripts/design/gerar-imagem.mjs --prompt "..." --out public/arte/x.png
 *   node scripts/design/gerar-imagem.mjs --prompt-file p.txt --out x.png --model openai/gpt-image-2
 *
 * Flags: --model (padrao openai/gpt-image-2) · --size · --aspect · --quality
 *        --background transparent · --n · --seed · --dry-run
 *
 * Cada chamada gasta credito real. `--dry-run` mostra o payload sem gastar.
 */
import fs from "node:fs";
import path from "node:path";

const ENDPOINT = "https://openrouter.ai/api/v1/images";
const MODELO_PADRAO = "openai/gpt-image-2";

function arg(nome, padrao = null) {
  const i = process.argv.indexOf(`--${nome}`);
  if (i === -1) return padrao;
  const v = process.argv[i + 1];
  return v && !v.startsWith("--") ? v : padrao;
}

const flag = (nome) => process.argv.includes(`--${nome}`);

/**
 * Le o `.env` na mao em vez de usar dotenv: este script roda fora do Next, e
 * adicionar dependencia de producao para uma ferramenta de design seria pior.
 */
function lerEnv(arquivo = ".env") {
  if (!fs.existsSync(arquivo)) return {};
  const linhas = fs.readFileSync(arquivo, "utf8").split(/\r?\n/);
  const env = {};
  for (const linha of linhas) {
    if (!linha || linha.startsWith("#") || !linha.includes("=")) continue;
    const corte = linha.indexOf("=");
    env[linha.slice(0, corte).trim()] = linha.slice(corte + 1).trim();
  }
  return env;
}

const prompt = arg("prompt") ?? (arg("prompt-file") ? fs.readFileSync(arg("prompt-file"), "utf8").trim() : null);
const saida = arg("out");

if (!prompt || !saida) {
  console.error("uso: --prompt <texto> | --prompt-file <arquivo>   --out <caminho.png>");
  process.exit(1);
}

const corpo = { model: arg("model", MODELO_PADRAO), prompt };
if (arg("size")) corpo.size = arg("size");
if (arg("aspect")) corpo.aspect_ratio = arg("aspect");
if (arg("quality")) corpo.quality = arg("quality");
if (arg("background")) corpo.background = arg("background");
if (arg("seed")) corpo.seed = Number(arg("seed"));
if (arg("n")) corpo.n = Number(arg("n"));

if (flag("dry-run")) {
  console.log(JSON.stringify({ ...corpo, prompt: `${prompt.slice(0, 120)}...` }, null, 2));
  process.exit(0);
}

const chave = process.env.OPENROUTER_API_KEY || lerEnv().OPENROUTER_API_KEY;
if (!chave) {
  console.error("OPENROUTER_API_KEY ausente (nem no ambiente nem no .env).");
  process.exit(1);
}

const resposta = await fetch(ENDPOINT, {
  method: "POST",
  headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
  body: JSON.stringify(corpo),
});

if (!resposta.ok) {
  console.error(`HTTP ${resposta.status}: ${(await resposta.text()).slice(0, 600)}`);
  process.exit(1);
}

const json = await resposta.json();
const imagens = json.data ?? [];
if (imagens.length === 0) {
  console.error("resposta sem imagem:", JSON.stringify(json).slice(0, 600));
  process.exit(1);
}

fs.mkdirSync(path.dirname(path.resolve(saida)), { recursive: true });

const extensaoDe = (mime) => (mime?.includes("svg") ? ".svg" : mime?.includes("webp") ? ".webp" : mime?.includes("jpeg") ? ".jpg" : ".png");

imagens.forEach((imagem, indice) => {
  const base = saida.replace(/\.(png|jpg|jpeg|webp|svg)$/i, "");
  const ext = path.extname(saida) || extensaoDe(imagem.media_type);
  const destino = imagens.length === 1 ? `${base}${ext}` : `${base}-${indice + 1}${ext}`;
  fs.writeFileSync(destino, Buffer.from(imagem.b64_json, "base64"));
  // O sidecar guarda o prompt: sem ele nao da para regerar nem variar a arte.
  fs.writeFileSync(
    `${destino}.json`,
    JSON.stringify({ ...corpo, media_type: imagem.media_type, custo: json.usage?.cost ?? null }, null, 2),
  );
  console.log(`${destino}  (${(fs.statSync(destino).size / 1024).toFixed(0)} KB)`);
});

console.log(`custo: US$ ${(json.usage?.cost ?? 0).toFixed(4)}`);
