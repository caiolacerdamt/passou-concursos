# Comparador de vozes (TTS) — teste cego PT-BR

Gera **o mesmo texto** (2 explicações reais, cheias de número, R$, % e sigla) na **melhor voz de
cada provedor**, pra você ouvir e escolher qual lê melhor. É o experimento que fecha a **decisão
D14** (voz do áudio das explicações). Regra: ganha quem **lê número/R$/%/sigla certo**, não quem
tem a voz mais bonita.

## Passo a passo

```bash
cd experiments/tts-comparacao
cp .env.example .env      # preencha SÓ as chaves que você tiver (o resto é pulado)
npm install
node compare.mjs
```

Os áudios saem em `out/` com nome `01-matematica-financeira__<provedor>.mp3`. **Ouça sem olhar o
nome do arquivo** (teste cego) e pontue. No fim, o script imprime uma **estimativa de custo** pra
gerar N explicações de uma vez (ajuste `ESTIMATE_EXPLICACOES` no `.env`).

## Provedores e como pegar a chave

| Provedor | Grátis pra testar | O que preencher no `.env` | Onde pegar |
|---|---|---|---|
| **ElevenLabs** | ~10 mil caracteres/mês | `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID` | [api-keys](https://elevenlabs.io/app/settings/api-keys); Voice ID na aba **Voices** (escolha uma voz PT-BR) |
| **Google Chirp 3 HD** | 1 milhão caracteres/mês | `GOOGLE_API_KEY` | Console Google Cloud → habilite **Cloud Text-to-Speech** → crie API key. Voz já vem em `GOOGLE_VOICE` |
| **OpenAI** | sem free (pago é baixíssimo) | `OPENAI_API_KEY` | [platform.openai.com](https://platform.openai.com/api-keys) |
| **Fish Audio** | trial | `FISH_API_KEY` + `FISH_REFERENCE_ID` | [api-keys](https://fish.audio/app/api-keys); `reference_id` = id de uma voz PT-BR do site |
| **Azure Speech** | 500 mil caracteres/mês | `AZURE_SPEECH_KEY` + `AZURE_REGION` | Portal Azure → recurso **Speech** → Keys and Endpoint |
| **Amazon Polly** | 1 milhão caracteres/mês (1º ano) | `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` + `AWS_REGION` | IAM na AWS; voz **Camila** |

### Observações por provedor (armadilhas)
- **Google:** se a API key for recusada, o projeto precisa de **faturamento ativado** e da API
  Text-to-Speech habilitada. As vozes Chirp 3 HD pt-BR são `pt-BR-Chirp3-HD-Aoede`, `-Kore`,
  `-Leda`, `-Zephyr`, etc. — troque em `GOOGLE_VOICE` pra comparar vozes dentro do Google.
- **Azure:** a região tem que casar com a do seu recurso (`brazilsouth`, `eastus`, ...). Vozes:
  `pt-BR-FranciscaNeural` (feminina padrão), `pt-BR-AntonioNeural` (masculina); confira se há
  vozes HD mais novas na sua conta.
- **Amazon Polly:** a voz **Camila** roda no engine `neural` na maioria das regiões. O engine
  `generative` (mais natural) só existe em algumas regiões (`eu-west-2`, `ca-central-1`,
  `eu-central-2`) — se quiser testar, troque `AWS_REGION` e `POLLY_ENGINE=generative`.
- **Fish Audio:** obriga um `reference_id` (a voz). Entre no site, ouça as vozes PT-BR e copie o
  Model ID da que quiser.
- **ElevenLabs:** use `eleven_v3` (o mais novo, fev/2026, feito pra áudio pré-gravado) ou
  `eleven_multilingual_v2` (anterior, narração limpa). **Não** use "flash/turbo" — são pra chat ao
  vivo e podem desligar o normalizador de números.
- **Fish Audio:** use `s2.1-pro` (o mais novo/melhor) ou `s2.1-pro-free` para avaliar. O `s1` é anterior.
- **OpenAI:** `gpt-4o-mini-tts` é o certo pra gerar áudio de texto. Os "gpt-realtime" são pra
  conversa ao vivo, não servem aqui.

## O que este teste NÃO faz
- Não aplica a **normalização** de número/sigla que o produto final vai ter (D14): aqui mandamos o
  texto **cru** de propósito, pra ver quem lê melhor **sem** ajuda. Em produção, um passo converte
  "R$ 1.250,00" → "mil duzentos e cinquenta reais" antes da voz.
- Não decide sozinho: a escolha é sua, ouvindo. O código só gera os arquivos.
