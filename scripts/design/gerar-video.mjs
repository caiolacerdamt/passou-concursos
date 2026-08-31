#!/usr/bin/env node
/**
 * Gerador do clipe do herói da landing, via kie.ai.
 *
 * Ferramenta de design, nao de producao: nada em `src/` importa isto. Existe
 * porque o script da skill `scrollcraft` cabeia `kling/v2-1-pro`, e o modelo
 * que este projeto usa e o `kling-3.0/video` — geracao atual, e a unica com
 * controle explicito de quadro inicial E final, que e a tecnica inteira aqui:
 * o clipe interpola entre duas imagens nossas em vez de alucinar a
 * transformacao a partir de uma so.
 *
 * A chave sai do `.env` (`KIE_AI_API_KEY`) e nunca e impressa.
 *
 *   node scripts/design/gerar-video.mjs creditos
 *   node scripts/design/gerar-video.mjs clipe --prompt-file p.txt \
 *     --inicio a1-caos.png --fim a1-ordem.png --out bruto/a1.mp4
 *
 * Flags: --dur (padrao 5) · --aspect (16:9 | 9:16 | 1:1) · --modo (std|pro|4K)
 *        --dry-run
 *
 * Cada chamada gasta credito real. `--dry-run` mostra o payload sem gastar.
 */
import fs from "node:fs";
import path from "node:path";

const API = "https://api.kie.ai";
const UPLOAD = "https://kieai.redpandaai.co/api/file-base64-upload";
const MODELO = "kling-3.0/video";

const argv = process.argv.slice(2);
const flag = (nome, padrao = null) => {
  const i = argv.indexOf(`--${nome}`);
  const v = argv[i + 1];
  return i > -1 && v && !v.startsWith("--") ? v : padrao;
};
const marca = (nome) => argv.includes(`--${nome}`);

function lerEnv(arquivo = ".env") {
  if (!fs.existsSync(arquivo)) return {};
  const env = {};
  for (const linha of fs.readFileSync(arquivo, "utf8").split(/\r?\n/)) {
    if (!linha || linha.startsWith("#") || !linha.includes("=")) continue;
    const corte = linha.indexOf("=");
    env[linha.slice(0, corte).trim()] = linha.slice(corte + 1).trim();
  }
  return env;
}

const chave = process.env.KIE_AI_API_KEY || lerEnv().KIE_AI_API_KEY;
if (!chave) {
  console.error("KIE_AI_API_KEY ausente (nem no ambiente nem no .env).");
  process.exit(1);
}
const CABECALHO = { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" };

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * A API so aceita imagem por URL publica, entao o arquivo local sobe antes.
 * Um `http(s)` passa direto.
 */
async function comoUrl(caminho) {
  if (/^https?:\/\//i.test(caminho)) return caminho;

  const abs = path.resolve(caminho);
  if (!fs.existsSync(abs)) throw new Error(`imagem nao encontrada: ${abs}`);
  const ext = path.extname(abs).slice(1).toLowerCase();
  const mime = ext === "jpg" ? "image/jpeg" : `image/${ext}`;

  const resposta = await fetch(UPLOAD, {
    method: "POST",
    headers: CABECALHO,
    body: JSON.stringify({
      base64Data: `data:${mime};base64,${fs.readFileSync(abs).toString("base64")}`,
      uploadPath: "passou-lp",
      fileName: path.basename(abs),
    }),
  });
  const json = await resposta.json();
  const url = json?.data?.downloadUrl || json?.data?.fileUrl || json?.data?.url;
  if (!url) throw new Error(`upload falhou: ${JSON.stringify(json).slice(0, 400)}`);
  return url;
}

async function criarTarefa(input) {
  const resposta = await fetch(`${API}/api/v1/jobs/createTask`, {
    method: "POST",
    headers: CABECALHO,
    body: JSON.stringify({ model: MODELO, input }),
  });
  const json = await resposta.json();
  if (json.code !== 200 || !json?.data?.taskId) {
    throw new Error(`createTask: ${JSON.stringify(json).slice(0, 600)}`);
  }
  return json.data.taskId;
}

async function esperar(taskId, tetoMs = 20 * 60 * 1000) {
  const inicio = Date.now();
  let espera = 5000;

  for (;;) {
    const decorrido = Math.round((Date.now() - inicio) / 1000);
    if (Date.now() - inicio > tetoMs) throw new Error(`estourou o teto em ${decorrido}s`);

    const resposta = await fetch(
      `${API}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
      { headers: CABECALHO },
    );
    const dados = (await resposta.json())?.data ?? {};
    const estado = dados.state || dados.status;

    if (estado === "success") {
      let saida = dados.resultJson;
      if (typeof saida === "string") {
        try {
          saida = JSON.parse(saida);
        } catch {
          /* resultJson nem sempre e JSON; o proximo teste cobre isso */
        }
      }
      const urls = saida?.resultUrls || saida?.result_urls || saida?.urls || [];
      if (urls.length === 0) throw new Error(`sucesso sem URL: ${JSON.stringify(dados).slice(0, 400)}`);
      return urls;
    }

    if (estado === "fail" || estado === "failed") {
      throw new Error(`falhou: ${dados.failMsg || dados.failCode || JSON.stringify(dados).slice(0, 400)}`);
    }

    process.stderr.write(`  ${estado || "na fila"} (${decorrido}s)\n`);
    await dormir(espera);
    espera = Math.min(espera * 1.25, 15000);
  }
}

async function baixar(url, destino) {
  const abs = path.resolve(destino);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error(`download ${resposta.status}`);
  fs.writeFileSync(abs, Buffer.from(await resposta.arrayBuffer()));
  return abs;
}

// ------------------------------------------------------------------ main ---
const comando = argv[0];

try {
  if (comando === "creditos") {
    const resposta = await fetch(`${API}/api/v1/chat/credit`, { headers: CABECALHO });
    console.log("creditos:", (await resposta.json()).data);
    //
  } else if (comando === "clipe") {
    const prompt =
      flag("prompt") ??
      (flag("prompt-file") ? fs.readFileSync(flag("prompt-file"), "utf8").trim() : null);
    const inicio = flag("inicio");
    const destino = flag("out");

    if (!prompt || !inicio || !destino) {
      console.error(
        "uso: clipe --prompt-file <arq> --inicio <a.png> [--fim <b.png>] --out <x.mp4>",
      );
      process.exit(1);
    }

    const input = {
      prompt,
      // Duas URLs = quadro inicial e quadro final. Com uma so, o modelo inventa
      // para onde a cena vai; com as duas, ele so preenche o meio.
      image_urls: [],
      sound: false,
      duration: flag("dur", "5"),
      aspect_ratio: flag("aspect", "16:9"),
      mode: flag("modo", "pro"),
      multi_shots: false,
    };

    if (marca("dry-run")) {
      console.log(
        JSON.stringify(
          { model: MODELO, input: { ...input, prompt: `${prompt.slice(0, 160)}...`, image_urls: [inicio, flag("fim")].filter(Boolean) } },
          null,
          2,
        ),
      );
      process.exit(0);
    }

    input.image_urls.push(await comoUrl(inicio));
    if (flag("fim")) input.image_urls.push(await comoUrl(flag("fim")));

    const taskId = await criarTarefa(input);
    console.error(`tarefa ${taskId}`);

    const [url] = await esperar(taskId);
    const arquivo = await baixar(url, destino);

    // O sidecar guarda o pedido: sem ele nao da para regerar nem variar.
    fs.writeFileSync(
      `${arquivo}.json`,
      JSON.stringify({ model: MODELO, taskId, input: { ...input, prompt } }, null, 2),
    );
    console.log(`${arquivo}  (${(fs.statSync(arquivo).size / 1024 / 1024).toFixed(1)} MB)`);
    //
  } else {
    console.error("comandos: creditos | clipe");
    process.exit(1);
  }
} catch (erro) {
  console.error(erro.message);
  process.exit(1);
}
