#!/usr/bin/env node
// Comparador cego de vozes (TTS) PT-BR — SaaS de concursos (decisao D14).
// Gera O MESMO texto (samples/*.txt) em varias vozes de cada provedor com chave no .env.
//
// Uso (dentro desta pasta):
//   1) cp .env.example .env  e preencha SO as chaves que voce tiver
//   2) npm install
//   3) node compare.mjs
// Varias vozes: use as variaveis PLURAIS (lista separada por virgula):
//   ELEVENLABS_VOICE_IDS, FISH_REFERENCE_IDS, OPENAI_VOICES
// Filtrar provedores nesta rodada: PROVIDERS=fish,openai
// Regerar tudo (ignorar arquivos existentes): FORCE=1
//
// CUSTO: as APIs de TTS NAO devolvem valor em R$/US$ na resposta. Mostra o uso que a API
// expoe (headers) e, no fim, ONDE ver o gasto real em cada painel.

import { config } from 'dotenv';
import { readFile, writeFile, readdir, mkdir, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '.env') }); // carrega .env DESTA pasta; nao sobrescreve env do shell

const SAMPLES_DIR = join(__dirname, 'samples');
const OUT_DIR = join(__dirname, 'out');
const env = process.env;

const has = (...keys) => keys.every((k) => env[k] && env[k].trim() !== '');
const list = (s) => (s || '').split(',').map((x) => x.trim()).filter(Boolean);
const short = (id) => id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
const escapeXml = (s) => s.replace(/[<>&'"]/g, (c) =>
  ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
const exists = (p) => access(p).then(() => true, () => false);

function usageFromHeaders(headers) {
  const found = [];
  for (const [k, v] of headers.entries()) {
    if (/(cost|character|credit|usage|quota|tokens|billing|units|remaining)/i.test(k)) found.push(`${k}: ${v}`);
  }
  return found;
}

const DASHBOARDS = {
  elevenlabs: 'https://elevenlabs.io/app/usage',
  openai: 'https://platform.openai.com/usage  (ou Settings > Billing)',
  fish: 'https://fish.audio/app  (creditos/billing)',
  google: 'https://console.cloud.google.com/billing',
  azure: 'https://portal.azure.com  (recurso Speech > Cost analysis)',
  polly: 'https://console.aws.amazon.com/costmanagement',
};

const providers = {
  elevenlabs: {
    enabled: () => has('ELEVENLABS_API_KEY') && (env.ELEVENLABS_VOICE_IDS || env.ELEVENLABS_VOICE_ID),
    hint: 'ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID(S)',
    variants: () => list(env.ELEVENLABS_VOICE_IDS || env.ELEVENLABS_VOICE_ID).map((v) => ({ label: short(v), voice: v })),
    async synth(text, variant) {
      const model = env.ELEVENLABS_MODEL_ID || 'eleven_v3';
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${variant.voice}?output_format=mp3_44100_128`, {
        method: 'POST',
        headers: { 'xi-api-key': env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify({ text, model_id: model }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
      return { buffer: Buffer.from(await r.arrayBuffer()), usage: usageFromHeaders(r.headers), tag: model };
    },
  },
  openai: {
    enabled: () => has('OPENAI_API_KEY'),
    hint: 'OPENAI_API_KEY',
    variants: () => list(env.OPENAI_VOICES || env.OPENAI_VOICE || 'coral').map((v) => ({ label: v, voice: v })),
    async synth(text, variant) {
      const model = env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
      const r = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          voice: variant.voice,
          input: text,
          instructions: 'Fale em portugues do Brasil, como um professor de concurso: tom didatico, claro e pausado. Pronuncie corretamente valores em reais, porcentagens, datas e siglas financeiras.',
          response_format: 'mp3',
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
      return { buffer: Buffer.from(await r.arrayBuffer()), usage: usageFromHeaders(r.headers), tag: model };
    },
  },
  fish: {
    enabled: () => has('FISH_API_KEY') && (env.FISH_REFERENCE_IDS || env.FISH_REFERENCE_ID),
    hint: 'FISH_API_KEY + FISH_REFERENCE_ID(S)',
    variants: () => list(env.FISH_REFERENCE_IDS || env.FISH_REFERENCE_ID).map((v) => ({ label: short(v), ref: v })),
    async synth(text, variant) {
      const model = env.FISH_MODEL || 's2.1-pro-free';
      const r = await fetch('https://api.fish.audio/v1/tts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.FISH_API_KEY}`, 'Content-Type': 'application/json', model },
        body: JSON.stringify({ text, reference_id: variant.ref, format: 'mp3' }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
      return { buffer: Buffer.from(await r.arrayBuffer()), usage: usageFromHeaders(r.headers), tag: model };
    },
  },
  azure: {
    enabled: () => has('AZURE_SPEECH_KEY', 'AZURE_REGION'),
    hint: 'AZURE_SPEECH_KEY + AZURE_REGION',
    variants: () => list(env.AZURE_VOICES || env.AZURE_VOICE || 'pt-BR-FranciscaNeural').map((v) => ({ label: v.replace('pt-BR-', ''), voice: v })),
    async synth(text, variant) {
      const ssml = `<speak version='1.0' xml:lang='pt-BR'><voice name='${variant.voice}'>${escapeXml(text)}</voice></speak>`;
      const r = await fetch(`https://${env.AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': env.AZURE_SPEECH_KEY,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
          'User-Agent': 'tts-compare',
        },
        body: ssml,
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
      return { buffer: Buffer.from(await r.arrayBuffer()), usage: usageFromHeaders(r.headers), tag: variant.voice };
    },
  },
  google: {
    enabled: () => has('GOOGLE_API_KEY'),
    hint: 'GOOGLE_API_KEY',
    variants: () => list(env.GOOGLE_VOICES || env.GOOGLE_VOICE || 'pt-BR-Chirp3-HD-Aoede').map((v) => ({ label: v.replace('pt-BR-Chirp3-HD-', ''), voice: v })),
    async synth(text, variant) {
      const r = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${env.GOOGLE_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: { text }, voice: { languageCode: 'pt-BR', name: variant.voice }, audioConfig: { audioEncoding: 'MP3' } }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
      const j = await r.json();
      return { buffer: Buffer.from(j.audioContent, 'base64'), usage: usageFromHeaders(r.headers), tag: variant.voice };
    },
  },
  polly: {
    enabled: () => has('AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION'),
    hint: 'AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY + AWS_REGION (npm install @aws-sdk/client-polly)',
    variants: () => list(env.POLLY_VOICES || env.POLLY_VOICE || 'Camila').map((v) => ({ label: v, voice: v })),
    async synth(text, variant) {
      let PollyClient, SynthesizeSpeechCommand;
      try {
        ({ PollyClient, SynthesizeSpeechCommand } = await import('@aws-sdk/client-polly'));
      } catch {
        throw new Error('falta o pacote: rode  npm install @aws-sdk/client-polly');
      }
      const client = new PollyClient({ region: env.AWS_REGION });
      const out = await client.send(new SynthesizeSpeechCommand({
        Text: text, OutputFormat: 'mp3', VoiceId: variant.voice, Engine: env.POLLY_ENGINE || 'neural', LanguageCode: 'pt-BR',
      }));
      return { buffer: Buffer.from(await out.AudioStream.transformToByteArray()), usage: [], tag: env.POLLY_ENGINE || 'neural' };
    },
  },
};

async function elevenCharCount() {
  try {
    const r = await fetch('https://api.elevenlabs.io/v1/user/subscription', { headers: { 'xi-api-key': env.ELEVENLABS_API_KEY } });
    if (!r.ok) return null;
    const j = await r.json();
    return j.character_count ?? null;
  } catch { return null; }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const files = (await readdir(SAMPLES_DIR)).filter((f) => f.endsWith('.txt')).sort();
  if (files.length === 0) { console.error('Nenhum .txt em samples/'); process.exit(1); }

  const only = list(env.PROVIDERS);
  const active = Object.entries(providers)
    .filter(([n, p]) => p.enabled() && (only.length === 0 || only.includes(n)));
  const skipped = Object.entries(providers).filter(([n, p]) => !p.enabled() && (only.length === 0 || only.includes(n)));

  console.log(`\nProvedores ativos: ${active.map(([n, p]) => `${n}(${p.variants().length} voz)`).join(', ') || '(nenhum)'}`);
  for (const [n, p] of skipped) console.log(`  pulado ${n}: ${p.hint}`);
  if (active.length === 0) { console.error('\nNada pra rodar.'); process.exit(1); }

  const elBefore = active.some(([n]) => n === 'elevenlabs') ? await elevenCharCount() : null;
  const force = !!env.FORCE;

  for (const file of files) {
    const text = (await readFile(join(SAMPLES_DIR, file), 'utf8')).trim();
    const base = file.replace(/\.txt$/, '');
    console.log(`\n=== ${file} (${text.length} caracteres) ===`);
    for (const [name, p] of active) {
      for (const variant of p.variants()) {
        const outPath = join(OUT_DIR, `${base}__${name}__${variant.label}.mp3`);
        const rel = `out/${base}__${name}__${variant.label}.mp3`;
        if (!force && (await exists(outPath))) { console.log(`  ${name}/${variant.label}: (ja existe, pulado)`); continue; }
        process.stdout.write(`  ${name}/${variant.label} ... `);
        try {
          const t0 = Date.now();
          const { buffer, usage, tag } = await p.synth(text, variant);
          await writeFile(outPath, buffer);
          console.log(`ok [${tag}] ${(buffer.length / 1024).toFixed(0)}KB ${((Date.now() - t0) / 1000).toFixed(1)}s -> ${rel}`);
          if (usage.length) console.log(`      uso: ${usage.join(' | ')}`);
        } catch (e) {
          console.log(`FALHOU: ${e.message}`);
        }
      }
    }
  }

  if (elBefore != null) {
    const elAfter = await elevenCharCount();
    if (elAfter != null) console.log(`\nElevenLabs — caracteres usados nesta rodada: ${elAfter - elBefore} (total no periodo: ${elAfter})`);
  }

  console.log('\n--- GASTO REAL (as APIs nao retornam valor em dinheiro; veja nos paineis) ---');
  for (const [name] of active) console.log(`  ${name.padEnd(11)} ${DASHBOARDS[name]}`);
  console.log('\nOuca os arquivos em out/ SEM olhar o nome e pontue quem le numero/R$/%/sigla melhor.\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
